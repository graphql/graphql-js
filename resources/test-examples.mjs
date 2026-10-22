import assert from 'node:assert/strict';
import fs from 'node:fs';
// eslint-disable-next-line n/no-unsupported-features/node-builtins -- Native type stripping for examples.
import { stripTypeScriptTypes } from 'node:module';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';

import ts from 'typescript';

const root = fileURLToPath(new URL('../', import.meta.url));

const allExamples = findExamples();
assert(allExamples.length > 0, 'No JSDoc examples found');

// Find examples, parse their code, rewrite imports and assertions, then run them.
// TypeScript reads syntax; Node strips types and runs the resulting ES modules.
for (const example of allExamples) {
  test(`${example.filename}:${example.line}`, { timeout: 10000 }, async () => {
    const source = parseExample(example);
    const importEdits = getImportEdits(source);
    const { assertionEdits, assertions } = getAssertionEdits(source, example);
    const code = applyEdits(example.code, [...importEdits, ...assertionEdits]);
    const module = addRuntimeChecks(code, assertions);
    // The source URL identifies failures and keeps identical examples distinct.
    const javascript = stripTypeScriptTypes(module, {
      sourceUrl: `${example.filename}:${example.line}`,
    });
    await import(`data:text/javascript,${encodeURIComponent(javascript)}`);
  });
}

function findExamples() {
  const examples = [];
  const names = fs.readdirSync(path.join(root, 'src'), { recursive: true });
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
    {
      languageVersion: ts.ScriptTarget.Latest,
      // Examples are ES modules even when they have no imports or exports.
      setExternalModuleIndicator(file) {
        file.externalModuleIndicator = true;
      },
    },
    true,
  );
  assert.equal(
    source.parseDiagnostics.length,
    0,
    `${example.filename}:${example.line}: invalid example syntax`,
  );
  return source;
}

function getImportEdits(source) {
  const edits = [];
  for (const statement of source.statements) {
    if (!ts.isImportDeclaration(statement)) {
      continue;
    }
    const url = resolveSourceImport(statement.moduleSpecifier.text);
    if (url !== undefined) {
      edits.push({
        start: statement.moduleSpecifier.getStart(source),
        end: statement.moduleSpecifier.end,
        text: JSON.stringify(url),
      });
    }
  }
  return edits;
}

// Package imports in documentation run against this checkout's TypeScript source.
function resolveSourceImport(specifier) {
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
  return pathToFileURL(target).href;
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
  const helper = new URL('../src/__testUtils__/expectJSON.ts', import.meta.url);
  return `
import __assert from 'node:assert/strict';
import { expectJSON as __expectJSON } from ${JSON.stringify(helper.href)};
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
