import { strict as assert } from 'assert';
import fs from 'fs';
import type { Context } from 'mocha';
import { after, before, it } from 'mocha';
import { createRequire } from 'module';
import os from 'os';
import path from 'path';
import ts from 'typescript';
import vm from 'vm';

import type { SourceEdit } from './jsdoc-examples';
import { applyEdits, extractJSDocExamples } from './jsdoc-examples';
import { spawnOutput } from './utils.js';

interface Example {
  filename: string;
  line: number;
  code: string;
}

const root = path.join(__dirname, '..');

const allExamples = findExamples();
assert(allExamples.length > 0, 'No JSDoc examples found');

const directory = fs.mkdtempSync(
  path.join(os.tmpdir(), 'graphql-js-examples-'),
);
const originalDirectory = process.cwd();
const exampleRequire = createRequire(path.join(directory, 'example.js'));
const typeErrors = new Map<Example, Array<string>>();
after(() => {
  process.chdir(originalDirectory);
  fs.rmSync(directory, { recursive: true, force: true });
});
before(function prepareExamples(this: Context) {
  this.timeout(120000);
  const packageDirectory = path.join(directory, 'npmDist');
  spawnOutput(
    process.execPath,
    [path.join(root, 'resources/build-npm.js'), packageDirectory],
    { cwd: root },
  );
  const npmCommand = process.platform === 'win32' ? 'cmd' : 'npm';
  const npmPrefix = process.platform === 'win32' ? ['/c', 'npm.cmd'] : [];
  const archives: Array<{ filename: string }> = JSON.parse(
    spawnOutput(
      npmCommand,
      [...npmPrefix, 'pack', packageDirectory, '--json', '--ignore-scripts'],
      {
        cwd: directory,
      },
    ),
  );
  assert.equal(archives.length, 1);
  fs.writeFileSync(
    path.join(directory, 'package.json'),
    JSON.stringify({
      private: true,
      dependencies: { graphql: `file:./${archives[0].filename}` },
    }),
  );
  spawnOutput(
    npmCommand,
    [
      ...npmPrefix,
      'install',
      '--ignore-scripts',
      '--offline',
      '--no-audit',
      '--no-fund',
    ],
    { cwd: directory },
  );
  for (const [example, errors] of checkExampleTypes(allExamples, directory)) {
    typeErrors.set(example, errors);
  }
  process.chdir(directory);
});

// Run each example against the installed package through CommonJS resolution.
// TypeScript compiles snippets and preserves top-level await in the async wrapper.
for (const example of allExamples) {
  it(`${example.filename}:${example.line}`, async () => {
    const errors = typeErrors.get(example) ?? [];
    assert.equal(errors.length, 0, errors.join('\n'));
    const source = parseExample(example);
    validateImports(source);
    const { assertionEdits, locations, runtimeName } = getAssertionEdits(
      source,
      example,
    );
    const code = applyEdits(example.code, assertionEdits);
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
    await run(exampleRequire, {});
  });
}

function checkExampleTypes(
  examples: ReadonlyArray<Example>,
  exampleDirectory: string,
): Map<Example, Array<string>> {
  const examplesByPath = new Map<string, Example>();
  for (const [index, example] of examples.entries()) {
    const filename = path.join(exampleDirectory, `${index}.ts`);
    // Import-free snippets are modules too; keep original diagnostic positions.
    fs.writeFileSync(filename, `${example.code}\nexport {};`);
    examplesByPath.set(filename, example);
  }
  const config = ts.readConfigFile(
    path.join(root, 'tsconfig.json'),
    ts.sys.readFile,
  );
  assert(!config.error, 'Cannot read tsconfig.json');
  const { options, errors: configErrors } = ts.parseJsonConfigFileContent(
    config.config,
    ts.sys,
    root,
  );
  assert.equal(configErrors.length, 0, 'Invalid TypeScript configuration');
  const program = ts.createProgram([...examplesByPath.keys()], {
    ...options,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.NodeJs,
    esModuleInterop: true,
    noUnusedLocals: false,
    typeRoots: [path.join(root, 'node_modules/@types')],
    types: ['node'],
  });
  const errors = new Map<Example, Array<string>>();
  for (const diagnostic of ts.getPreEmitDiagnostics(program)) {
    const message = `TS${diagnostic.code}: ${ts.flattenDiagnosticMessageText(
      diagnostic.messageText,
      '\n',
    )}`;
    const { file, start } = diagnostic;
    assert(file && start !== undefined, message);
    const { line } = file.getLineAndCharacterOfPosition(start);
    const example = examplesByPath.get(path.normalize(file.fileName));
    assert(example, `${file.fileName}:${line + 1}: ${message}`);
    const messages = errors.get(example) ?? [];
    messages.push(`${example.filename}:${example.line + line}: ${message}`);
    errors.set(example, messages);
  }
  return errors;
}

function findExamples(): Array<Example> {
  const examples: Array<Example> = [];
  const names: Array<string> = [];
  function walk(relativePath: string): void {
    for (const entry of fs.readdirSync(path.join(root, 'src', relativePath), {
      withFileTypes: true,
    })) {
      const name = path.join(relativePath, entry.name);
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
    if (['graphql', 'gql'].includes(language)) {
      continue;
    }
    assert(
      ['ts', 'typescript'].includes(language),
      `${filename}:${line}: executable examples must use a TypeScript fence (ts or typescript)`,
    );
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
    const module = exampleRequire(specifier);
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
