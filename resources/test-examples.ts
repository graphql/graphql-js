import assert from 'node:assert/strict';
import fs from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import path from 'node:path';
import { test } from 'node:test';
import { pathToFileURL } from 'node:url';
import { SourceTextModule } from 'node:vm';

import ts from 'typescript';

import type { SourceEdit } from './jsdoc-examples.ts';
import { applyEdits, extractJSDocExamples } from './jsdoc-examples.ts';
import { localRepoPath, readdirRecursive } from './utils.ts';

interface Example {
  filename: string;
  line: number;
  code: string;
  language: 'js' | 'ts';
}

const root = localRepoPath();

const allExamples = await findExamples();
assert(allExamples.length > 0, 'No JSDoc examples found');

for (const example of allExamples) {
  test(`${example.filename}:${example.line}`, { timeout: 10000 }, async () => {
    const source = parseExample(example);
    const importEdits = getImportEdits(source);
    const { assertionEdits, locations, runtimeName } = getAssertionEdits(
      source,
      example,
    );
    const code = toJavaScript(
      applyEdits(example.code, [...importEdits, ...assertionEdits]),
      example.language,
    );
    const module = `${addRuntimeChecks(code, locations, runtimeName)}\n//# sourceURL=${example.filename}:${example.line}\n`;
    await import(`data:text/javascript,${encodeURIComponent(module)}`);
  });
}

async function findExamples(): Promise<Array<Example>> {
  const filenames = [...readdirRecursive(path.join(root, 'src'))]
    .filter(({ name, stats }) => name.endsWith('.ts') && stats.isFile())
    .map(({ filepath }) => filepath)
    .sort();
  const examples = await Promise.all(
    filenames.map(async (filePath) => {
      const filename = path.relative(root, filePath);
      const text = fs.readFileSync(filePath, 'utf8');
      return extractExamples(text, filename);
    }),
  );
  return examples.flat();
}

async function extractExamples(
  text: string,
  filename: string,
): Promise<Array<Example>> {
  const examples: Array<Example> = [];
  for (const { code, line, language, metadata } of await extractJSDocExamples(
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
    examples.push({
      filename,
      line,
      // Match Node's module loader before parsing or instrumenting hashbangs.
      code: code.replace(/^\uFEFF/, ''),
      language: language === 'ts' || language === 'typescript' ? 'ts' : 'js',
    });
  }
  return examples;
}

function parseExample(example: Example): ts.SourceFile {
  // Check the original syntax before assertion edits can make invalid code valid.
  assert.doesNotThrow(
    () =>
      new SourceTextModule(toJavaScript(example.code, example.language), {
        identifier: `${example.filename}:${example.line}`,
      }),
    `${example.filename}:${example.line}: invalid example syntax`,
  );
  return ts.createSourceFile(
    example.language === 'ts' ? 'example.mts' : 'example.mjs',
    // An empty export makes TypeScript parse import-free examples as modules.
    // Appending it keeps all original source positions unchanged.
    `${example.code}\nexport {};`,
    {
      languageVersion: ts.ScriptTarget.Latest,
      // JSDoc inside an example is documentation, not executable assertions.
      jsDocParsingMode: ts.JSDocParsingMode.ParseNone,
    },
    true,
  );
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

function toJavaScript(code: string, language: Example['language']): string {
  return language === 'ts' ? stripTypeScriptTypes(code) : code;
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
    yield* walkSyntax(child);
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
  const helper = new URL('./example-assertions.ts', import.meta.url);
  const shebang = ts.getShebang(code) ?? '';
  return `${shebang}
import { ExampleAssertion as ${runtimeName}Assertion } from ${JSON.stringify(helper.href)};
const ${runtimeName} = ${JSON.stringify(locations)}
  .map((location) => new ${runtimeName}Assertion(location));
${code.slice(shebang.length)}
for (const assertion of ${runtimeName}) { assertion.verify(); }
`;
}
