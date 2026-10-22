'use strict';

const assert = require('assert').strict;
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const { it } = require('mocha');
const ts = require('typescript');

const root = path.join(__dirname, '..');

const allExamples = findExamples();
assert(allExamples.length > 0, 'No JSDoc examples found');

// Find examples, parse their code, rewrite imports and assertions, then run them.
// TypeScript reads syntax and compiles examples for the existing source loader.
for (const example of allExamples) {
  it(`${example.filename}:${example.line}`, async () => {
    const source = parseExample(example);
    validateImports(source);
    const importEdits = getImportEdits(source);
    const { assertionEdits, assertions } = getAssertionEdits(source, example);
    const code = applyEdits(example.code, [...importEdits, ...assertionEdits]);
    const module = addRuntimeChecks(code, assertions);
    const javascript = ts.transpileModule(module, {
      compilerOptions: {
        target: ts.ScriptTarget.ES2019,
        module: ts.ModuleKind.CommonJS,
        esModuleInterop: true,
      },
    }).outputText;
    const run = vm.runInThisContext(
      `(async function (require, exports) {
${javascript}
})`,
      { filename: `${example.filename}:${example.line}` },
    );
    await run(require, {});
  });
}

function findExamples() {
  const examples = [];
  const names = [];
  function walk(directory) {
    for (const entry of fs.readdirSync(path.join(root, 'src', directory), {
      withFileTypes: true,
    })) {
      const name = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        walk(name);
      } else {
        names.push(name);
      }
    }
  }
  walk('');
  for (const name of names.sort()) {
    if (name.endsWith('.ts')) {
      const filename = path.join('src', name);
      const text = fs.readFileSync(path.join(root, filename), 'utf8');
      examples.push(...extractExamples(text, filename));
    }
  }
  return examples;
}

function extractExamples(text, filename) {
  const source = ts.createSourceFile(
    filename,
    text,
    ts.ScriptTarget.Latest,
    true,
  );
  const comments = new Map();
  function visit(node) {
    for (const comment of node.jsDoc || []) {
      comments.set(comment.pos, comment);
    }
    ts.forEachChild(node, visit);
  }
  visit(source);

  const examples = [];
  for (const comment of [...comments.values()].sort((a, b) => a.pos - b.pos)) {
    // Read the full comment: GraphQL directives inside fences can resemble tags.
    const lines = text
      .slice(comment.pos, comment.end)
      .split(/\r?\n/)
      .map((line) => line.replace(/^\s*\* ?/, ''));
    const firstLine =
      source.getLineAndCharacterOfPosition(comment.pos).line + 1;
    let inExample = false;
    for (let lineIndex = 1; lineIndex < lines.length; lineIndex++) {
      const content = lines[lineIndex];
      if (/^@\w/.test(content)) {
        inExample = /^@example\b/.test(content);
      }
      const fence = /^\s*```([^\s`]*)\s*(.*)$/.exec(content);
      if (!fence) {
        continue;
      }
      const [, language, metadata] = fence;
      const codeStart = lineIndex + 1;
      while (++lineIndex < lines.length && lines[lineIndex].trim() !== '```') {
        // Skip the whole fence, including languages that are not executable.
      }
      const line = firstLine + codeStart;
      assert(lineIndex < lines.length, `${filename}:${line}: unclosed fence`);
      if (
        !inExample ||
        !['ts', 'typescript', 'js', 'javascript'].includes(language)
      ) {
        continue;
      }
      assert.equal(
        metadata,
        '',
        `${filename}:${line}: unsupported example metadata`,
      );
      examples.push({
        filename,
        line,
        code: lines.slice(codeStart, lineIndex).join('\n'),
      });
    }
  }
  return examples;
}

function parseExample(example) {
  const source = ts.createSourceFile(
    'example.ts',
    example.code,
    ts.ScriptTarget.Latest,
    true,
  );
  assert.equal(
    source.parseDiagnostics.length,
    0,
    `${example.filename}:${example.line}: invalid example syntax`,
  );
  function checkReturn(node) {
    assert(
      !ts.isReturnStatement(node),
      'Top-level return is not allowed in examples',
    );
    if (!ts.isFunctionLike(node)) {
      ts.forEachChild(node, checkReturn);
    }
  }
  checkReturn(source);
  return source;
}

// TypeScript can erase imports; validate runtime imports and re-exports first.
function validateImports(source) {
  for (const statement of source.statements) {
    if (
      (!ts.isImportDeclaration(statement) &&
        !ts.isExportDeclaration(statement)) ||
      !statement.moduleSpecifier ||
      statement.isTypeOnly ||
      (statement.importClause && statement.importClause.isTypeOnly)
    ) {
      continue;
    }
    const clause = statement.importClause;
    const bindings = clause ? clause.namedBindings : statement.exportClause;
    const named =
      bindings && (ts.isNamedImports(bindings) || ts.isNamedExports(bindings));
    if (
      named &&
      bindings.elements.length > 0 &&
      bindings.elements.every((binding) => binding.isTypeOnly) &&
      !(clause && clause.name)
    ) {
      continue;
    }
    const specifier = statement.moduleSpecifier.text;
    const target = resolveSourceImport(specifier);
    // eslint-disable-next-line node/global-require, import/no-dynamic-require -- Load the same source module as the example.
    const module = require(target === undefined ? specifier : target);
    const checkBinding = (name) => {
      // CommonJS modules supply a synthetic default through esModuleInterop.
      if (name === 'default' && !(module && module.__esModule)) {
        return;
      }
      assert(
        Object.prototype.hasOwnProperty.call(module, name),
        `${specifier} does not export ${name}`,
      );
    };
    if (clause && clause.name) {
      checkBinding('default');
    }
    if (named) {
      for (const binding of bindings.elements) {
        if (!binding.isTypeOnly) {
          checkBinding((binding.propertyName || binding.name).text);
        }
      }
    }
  }
}

function getImportEdits(source) {
  const edits = [];
  function visit(node) {
    const specifier =
      ts.isImportDeclaration(node) || ts.isExportDeclaration(node)
        ? node.moduleSpecifier
        : ts.isCallExpression(node) &&
          node.expression.kind === ts.SyntaxKind.ImportKeyword
        ? node.arguments[0]
        : undefined;
    if (specifier && ts.isStringLiteral(specifier)) {
      const target = resolveSourceImport(specifier.text);
      if (target !== undefined) {
        edits.push({
          start: specifier.getStart(source),
          end: specifier.end,
          text: JSON.stringify(target),
        });
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  return edits;
}

// Package imports in documentation run against this checkout's TypeScript source.
function resolveSourceImport(specifier) {
  // Node 12 supports these built-in modules without the node: require prefix.
  if (specifier.startsWith('node:')) {
    return specifier.slice('node:'.length);
  }

  if (specifier !== 'graphql' && !specifier.startsWith('graphql/')) {
    return undefined;
  }
  const subpath =
    specifier === 'graphql'
      ? 'index'
      : specifier.slice('graphql/'.length).replace(/\.js$/, '');
  const filename = path.join(root, 'src', subpath);
  const target =
    fs.existsSync(filename) && fs.statSync(filename).isDirectory()
      ? path.join(filename, 'index.ts')
      : `${filename}.ts`;
  return target;
}

function getAssertionEdits(source, example) {
  const { code, filename, line: firstLine } = example;
  const assertionEdits = [];
  const assertions = [];
  const annotationPositions = new Set();
  const handledAnnotations = new Set();
  function location(position) {
    const { line, character } = source.getLineAndCharacterOfPosition(position);
    return `${filename}:${firstLine + line}:${character + 1}`;
  }
  function visit(node) {
    // Inspect actual comments, not strings that happen to contain "// =>".
    const leadingComments = ts.getLeadingCommentRanges(code, node.pos) || [];
    const trailingComments = ts.getTrailingCommentRanges(code, node.end) || [];
    for (const range of [...leadingComments, ...trailingComments]) {
      if (
        /^\/\/\s*(?:=>|throws\b|does not throw\b)/.test(
          code.slice(range.pos, range.end),
        )
      ) {
        annotationPositions.add(range.pos);
      }
    }
    if (ts.isExpressionStatement(node) || ts.isVariableStatement(node)) {
      for (const range of trailingComments) {
        if (!annotationPositions.has(range.pos)) {
          continue;
        }
        const label = location(range.pos);
        const expression = getAnnotatedExpression(node, label);
        const assertionIndex = assertions.length;
        const wrapper = getAssertionWrapper(
          expression,
          code.slice(range.pos, range.end),
          label,
          assertionIndex,
        );
        if (wrapper === undefined) {
          continue;
        }
        handledAnnotations.add(range.pos);
        assertions.push({ location: label, executed: false, pending: 0 });
        // Wrap the expression so assertions inside it can be edited separately.
        assertionEdits.push({
          start: expression.getStart(source),
          end: expression.getStart(source),
          text: wrapper.before,
        });
        assertionEdits.push({
          start: expression.end,
          end: range.end,
          text: `${wrapper.after};`,
        });
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(source);

  // Reject misplaced or malformed annotations instead of silently skipping them.
  for (const position of annotationPositions) {
    assert(
      handledAnnotations.has(position),
      `${location(position)}: unsupported example annotation`,
    );
  }
  return { assertionEdits, assertions };
}

// Both statement forms check a value; declarations must keep that value too.
function getAnnotatedExpression(statement, location) {
  if (ts.isExpressionStatement(statement)) {
    return statement.expression;
  }
  const declarations = statement.declarationList.declarations;
  assert.equal(
    declarations.length,
    1,
    `${location}: annotate one variable declaration at a time`,
  );
  const initializer = declarations[0].initializer;
  assert(initializer, `${location}: annotated variables need an initializer`);
  return initializer;
}

// Add assertion code before and after the original expression.
function getAssertionWrapper(expression, comment, location, assertionIndex) {
  const label = JSON.stringify(location);
  // Start before evaluating the expression: a caught failure must leave a
  // pending check even if this assertion succeeded on an earlier invocation.
  const start = `(__startAssertion(${assertionIndex}), `;
  const expected = /^\/\/ => (.+)$/.exec(comment);
  if (expected) {
    return {
      before: `${start}__checkValue((`,
      after: `), (${expected[1]}), ${assertionIndex}))`,
    };
  }
  if (comment === '// throws an error') {
    return {
      before: containsAwait(expression)
        ? `${start}__recordExecution(await __assert.rejects(async () => (`
        : `${start}__recordExecution(__assert.throws(() => (`,
      after: `), undefined, ${label}), ${assertionIndex}))`,
    };
  }
  if (comment === '// does not throw') {
    return {
      before: `${start}__recordExecution((`,
      after: `), ${assertionIndex}))`,
    };
  }
  return undefined;
}

// Await inside a nested function does not make the enclosing expression async.
function containsAwait(node) {
  if (ts.isAwaitExpression(node)) {
    return true;
  }
  return (
    !ts.isFunctionLike(node) && Boolean(ts.forEachChild(node, containsAwait))
  );
}

function applyEdits(code, edits) {
  // Apply changes from the end so earlier source offsets remain valid.
  let result = code;
  for (const edit of edits.sort((a, b) => b.start - a.start)) {
    result = result.slice(0, edit.start) + edit.text + result.slice(edit.end);
  }
  return result;
}

function addRuntimeChecks(code, assertions) {
  const helper = path.join(root, 'src/__testUtils__/expectJSON.ts');
  return `
import { strict as __assert } from 'assert';
import { expectJSON as __expectJSON } from ${JSON.stringify(helper)};
const __exampleAssertions = ${JSON.stringify(assertions)};
function __startAssertion(assertionIndex) {
  __exampleAssertions[assertionIndex].pending++;
}
function __checkValue(actual, expected, assertionIndex) {
  __expectJSON(actual, __exampleAssertions[assertionIndex].location)
    .toDeepEqual(expected);
  return __recordExecution(actual, assertionIndex);
}
function __recordExecution(value, assertionIndex) {
  const assertion = __exampleAssertions[assertionIndex];
  assertion.executed = true;
  assertion.pending--;
  // Preserve the value when an assertion wraps a variable initializer.
  return value;
}
${code}
// A failed or unfinished invocation must not be hidden by an earlier success.
for (const assertion of __exampleAssertions) {
  __assert.equal(assertion.pending, 0,
    'Example assertion did not complete: ' + assertion.location);
  __assert.ok(assertion.executed,
    'Example assertion was not executed: ' + assertion.location);
}
`;
}
