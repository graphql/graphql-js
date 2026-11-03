import { strict as assert } from 'assert';
import fs from 'fs';
import { it } from 'mocha';
import path from 'path';
import ts from 'typescript';
import vm from 'vm';

import type { SourceEdit } from './jsdoc-examples';
import { applyEdits, extractJSDocExamples } from './jsdoc-examples';

interface Example {
  filename: string;
  line: number;
  code: string;
}

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
    const { assertionEdits, locations, runtimeName } = getAssertionEdits(
      source,
      example,
    );
    const code = applyEdits(example.code, [...importEdits, ...assertionEdits]);
    const module = addRuntimeChecks(code, locations, runtimeName);
    const javascript = ts.transpileModule(module, {
      compilerOptions: {
        target: ts.ScriptTarget.ES2019,
        module: ts.ModuleKind.CommonJS,
        esModuleInterop: true,
      },
    }).outputText;
    const run = vm.runInThisContext(
      `(async function (require, exports) {
${javascript.replace(/^#![^\r\n]*/, '')}
})`,
      { filename: `${example.filename}:${example.line}` },
    );
    await run(require, {});
  });
}

function findExamples(): Array<Example> {
  const examples: Array<Example> = [];
  const names: Array<string> = [];
  function walk(directory: string): void {
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
  for (const name of names.sort((a, b) => a.localeCompare(b))) {
    if (name.endsWith('.ts')) {
      const filename = path.join('src', name);
      const text = fs.readFileSync(path.join(root, filename), 'utf8');
      examples.push(...extractExamples(text, filename));
    }
  }
  return examples;
}

function extractExamples(text: string, filename: string): Array<Example> {
  const examples: Array<Example> = [];
  for (const { code, line, language, metadata } of extractJSDocExamples(
    text,
    filename,
  )) {
    if (!['ts', 'typescript', 'js', 'javascript'].includes(language)) {
      continue;
    }
    assert.equal(
      metadata,
      '',
      `${filename}:${line}: unsupported example metadata`,
    );
    examples.push({ filename, line, code: code.replace(/^\uFEFF/, '') });
  }
  return examples;
}

function parseExample(example: Example): ts.SourceFile {
  const source = ts.createSourceFile(
    'example.ts',
    example.code,
    ts.ScriptTarget.Latest,
    true,
  );
  assert.equal(
    (
      source as ts.SourceFile & {
        parseDiagnostics: ReadonlyArray<ts.Diagnostic>;
      }
    ).parseDiagnostics.length,
    0,
    `${example.filename}:${example.line}: invalid example syntax`,
  );
  function checkReturn(node: ts.Node): void {
    assert(
      !ts.isReturnStatement(node),
      'Top-level return is not allowed in examples',
    );
    if (!ts.isFunctionLike(node)) {
      ts.forEachChild(node, checkReturn);
    }
  }
  checkReturn(source);
  const javascript = ts.transpileModule(example.code, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2019,
      module: ts.ModuleKind.ESNext,
    },
  }).outputText;
  assert.doesNotThrow(
    () =>
      new vm.SourceTextModule(javascript, {
        identifier: `${example.filename}:${example.line}`,
      }),
    `${example.filename}:${example.line}: invalid example syntax`,
  );
  return source;
}

// TypeScript can erase imports; validate runtime imports and re-exports first.
function validateImports(source: ts.SourceFile): void {
  for (const statement of source.statements) {
    if (
      !ts.isImportDeclaration(statement) &&
      !ts.isExportDeclaration(statement)
    ) {
      continue;
    }
    const clause = ts.isImportDeclaration(statement)
      ? statement.importClause
      : undefined;
    if (
      !statement.moduleSpecifier ||
      (ts.isExportDeclaration(statement) && statement.isTypeOnly) ||
      clause?.isTypeOnly
    ) {
      continue;
    }
    const bindings = ts.isExportDeclaration(statement)
      ? statement.exportClause
      : clause?.namedBindings;
    const named =
      bindings && (ts.isNamedImports(bindings) || ts.isNamedExports(bindings))
        ? [...bindings.elements]
        : [];
    if (
      named.length > 0 &&
      named.every((binding) => binding.isTypeOnly) &&
      !clause?.name
    ) {
      continue;
    }
    assert(ts.isStringLiteral(statement.moduleSpecifier));
    const specifier = statement.moduleSpecifier.text;
    const target = resolveSourceImport(specifier);
    // eslint-disable-next-line node/global-require, import/no-dynamic-require, @typescript-eslint/no-var-requires, @typescript-eslint/no-require-imports -- Load the same source module as the example.
    const module = require(target === undefined ? specifier : target);
    const checkBinding = (name: string) => {
      // CommonJS modules supply a synthetic default through esModuleInterop.
      if (name === 'default' && !module?.__esModule) {
        return;
      }
      assert(
        Object.prototype.hasOwnProperty.call(module, name),
        `${specifier} does not export ${name}`,
      );
    };
    if (clause?.name) {
      checkBinding('default');
    }
    for (const binding of named) {
      if (!binding.isTypeOnly) {
        checkBinding((binding.propertyName ?? binding.name).text);
      }
    }
  }
}

function getImportEdits(source: ts.SourceFile): Array<SourceEdit> {
  const edits: Array<SourceEdit> = [];
  function visit(node: ts.Node): void {
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
function resolveSourceImport(specifier: string): string | undefined {
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

function getAssertionEdits(source: ts.SourceFile, example: Example) {
  const { code, filename, line: firstLine } = example;
  const assertionEdits: Array<SourceEdit> = [];
  const locations: Array<string> = [];
  const nodes = [...walkSyntax(source)];
  // Inspect actual comments, not strings that happen to contain "// =>".
  const annotationPositions = new Set(
    nodes
      .flatMap((node) => [
        ...(ts.getLeadingCommentRanges(code, node.pos) ?? []),
        ...(ts.getTrailingCommentRanges(code, node.end) ?? []),
      ])
      .filter((range) =>
        /^\/\/\s*(?:=>|throws\b|does not throw\b)/.test(
          code.slice(range.pos, range.end),
        ),
      )
      .map((range) => range.pos),
  );
  const identifiers = new Set(
    nodes.filter(ts.isIdentifier).map((node) => node.text),
  );
  let runtimeName = '__exampleChecks';
  while (
    [runtimeName, `${runtimeName}Assertion`, `${runtimeName}Threw`].some(
      (name) => identifiers.has(name),
    ) ||
    code.includes(runtimeName)
  ) {
    runtimeName += '_';
  }
  function location(position: number): string {
    const { line } = source.getLineAndCharacterOfPosition(position);
    return `${filename}:${firstLine + line}`;
  }
  for (const node of nodes) {
    if (!ts.isExpressionStatement(node) && !ts.isVariableStatement(node)) {
      continue;
    }
    for (const range of ts.getTrailingCommentRanges(code, node.end) ?? []) {
      if (!annotationPositions.delete(range.pos)) {
        continue;
      }
      const label = location(range.pos);
      const expression = getAnnotatedExpression(node, label);
      const assertionIndex = locations.length;
      const comment = code.slice(range.pos + 2, range.end).trim();
      const expectsError = comment === 'throws an error';
      const wrapper = getAssertionWrapper(
        comment,
        `${runtimeName}[${assertionIndex}]`,
        runtimeName,
      );
      assert(wrapper, `${label}: unsupported example annotation`);
      if (ts.isVariableStatement(node)) {
        const { name } = node.declarationList.declarations[0];
        if (expectsError) {
          // A throwing initializer has no value to destructure. Keep its
          // bindings in the original scope, without evaluating defaults.
          const bindings = getBindingNames(name)
            .map((binding) => `${binding} = void 0`)
            .join(', ');
          if (bindings !== '') {
            const prefix = code.slice(
              node.getStart(source),
              name.getStart(source),
            );
            const declaration = `${prefix}${bindings};`;
            if (
              (node.declarationList.flags & ts.NodeFlags.BlockScoped) === 0 &&
              !node.modifiers?.some(
                (modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword,
              )
            ) {
              // var keeps its scope inside the generated block, including
              // when the declaration is an unbraced if/else or loop body.
              wrapper.after = wrapper.after.slice(0, -1) + declaration + ' }';
            } else {
              wrapper.after += ' ' + declaration;
            }
          }
        }
        if (ts.isIdentifier(name)) {
          // A property initializer preserves anonymous function/class names
          // just as a variable initializer does. Compute the key so even
          // __proto__ is an ordinary property.
          const key = JSON.stringify(name.text);
          wrapper.before += `({ [${key}]: (`;
          wrapper.after = `) })[${key}]${wrapper.after}`;
        }
      }
      locations.push(label);
      // Wrap the expression so assertions inside it can be edited separately.
      assertionEdits.push({
        start: expectsError
          ? node.getStart(source)
          : expression.getStart(source),
        end: expression.getStart(source),
        text: wrapper.before,
      });
      assertionEdits.push({
        start: expression.end,
        end: range.end,
        text: wrapper.after,
      });
    }
  }

  // Reject misplaced or malformed annotations instead of silently skipping them.
  for (const position of annotationPositions) {
    assert.fail(`${location(position)}: unsupported example annotation`);
  }
  return { assertionEdits, locations, runtimeName };
}

function* walkSyntax(node: ts.Node): Generator<ts.Node> {
  yield node;
  // Include punctuation tokens to find comments in empty blocks and containers.
  for (const child of node.getChildren()) {
    if (!ts.isJSDoc(child)) {
      yield* walkSyntax(child);
    }
  }
}

// Both statement forms check a value; declarations must keep that value too.
function getAnnotatedExpression(
  statement: ts.ExpressionStatement | ts.VariableStatement,
  location: string,
): ts.Expression {
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

function getBindingNames(name: ts.BindingName): Array<string> {
  if (ts.isIdentifier(name)) {
    return [name.getText()];
  }
  return name.elements.flatMap((element) =>
    ts.isOmittedExpression(element) ? [] : getBindingNames(element.name),
  );
}

// Add assertion code before and after the original expression.
function getAssertionWrapper(
  comment: string,
  assertion: string,
  runtimeName: string,
) {
  // Begin with an identifier or a block to preserve statement boundaries.
  // Start before evaluating the expression: a caught failure must leave a
  // pending check even if this assertion succeeded on an earlier invocation.
  const start = `${assertion}.start()`;
  const expected = /^=>\s*(.+)$/.exec(comment);
  if (expected) {
    return {
      before: `${start}.value((`,
      after: `), (${expected[1]}\n));`,
    };
  }
  if (comment === 'throws an error') {
    // Keep await and yield in their original scope instead of a callback.
    const threw = `${runtimeName}Threw`;
    return {
      before: `{ ${start}; let ${threw} = false; try { (`,
      after: `); } catch { ${threw} = true; } ${assertion}.threw(${threw}); }`,
    };
  }
  if (comment === 'does not throw') {
    return {
      before: `${start}.record((`,
      after: '));',
    };
  }
  return undefined;
}

function addRuntimeChecks(
  code: string,
  locations: ReadonlyArray<string>,
  runtimeName: string,
): string {
  const helper = path.join(root, 'resources/example-assertions.ts');
  const shebang = ts.getShebang(code) ?? '';
  return `${shebang}
import { ExampleAssertion as ${runtimeName}Assertion } from ${JSON.stringify(
    helper,
  )};
const ${runtimeName} = ${JSON.stringify(locations)}
  .map((location) => new ${runtimeName}Assertion(location));
${code.slice(shebang.length)}
for (const assertion of ${runtimeName}) { assertion.verify(); }
`;
}
