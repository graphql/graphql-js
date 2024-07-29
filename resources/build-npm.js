'use strict';

const fs = require('fs');
const path = require('path');
const assert = require('assert');

const ts = require('typescript');
const babel = require('@babel/core');

const {
  writeGeneratedFile,
  readdirRecursive,
  showDirStats,
} = require('./utils.js');

const entryPoints = fs
  .readdirSync('./src', { recursive: true })
  .filter((f) => f.endsWith('index.ts'))
  .map((f) => f.replace(/^src/, ''))
  .reverse()
  .concat([
    'execution/execute.ts',
    'jsutils/instanceOf.ts',
    'language/parser.ts',
    'language/ast.ts',
  ]);

if (require.main === module) {
  fs.rmSync('./npmDist', { recursive: true, force: true });
  fs.mkdirSync('./npmDist');

  const packageJSON = buildPackageJSON();

  const srcFiles = readdirRecursive('./src', { ignoreDir: /^__.*__$/ });
  for (const filepath of srcFiles) {
    const srcPath = path.join('./src', filepath);
    const destPath = path.join('./npmDist', filepath);

    fs.mkdirSync(path.dirname(destPath), { recursive: true });
    if (filepath.endsWith('.ts')) {
      const cjs = babelBuild(srcPath, { envName: 'cjs' });
      writeGeneratedFile(destPath.replace(/\.ts$/, '.js'), cjs);

      const mjs = babelBuild(srcPath, { envName: 'mjs' });
      writeGeneratedFile(destPath.replace(/\.ts$/, '.mjs'), mjs);
    }
  }

  // Based on https://github.com/Microsoft/TypeScript/wiki/Using-the-Compiler-API#getting-the-dts-from-a-javascript-file
  const tsConfig = JSON.parse(
    fs.readFileSync(require.resolve('../tsconfig.json'), 'utf-8'),
  );
  assert(
    tsConfig.compilerOptions,
    '"tsconfig.json" should have `compilerOptions`',
  );
  const tsOptions = {
    ...tsConfig.compilerOptions,
    noEmit: false,
    declaration: true,
    declarationDir: './npmDist',
    emitDeclarationOnly: true,
  };

  const tsHost = ts.createCompilerHost(tsOptions);
  tsHost.writeFile = (filepath, body) => {
    writeGeneratedFile(filepath, body);
  };

  const tsProgram = ts.createProgram(['src/index.ts'], tsOptions, tsHost);
  const tsResult = tsProgram.emit();

  assert(
    !tsResult.emitSkipped,
    'Fail to generate `*.d.ts` files, please run `npm run check`',
  );

  for (const [filename, contents] of Object.entries(
    buildCjsEsmWrapper(
      entryPoints.map((e) => './src/' + e),
      tsProgram,
    ),
  )) {
    writeGeneratedFile(filename, contents);
  }

  assert(packageJSON.types === undefined, 'Unexpected "types" in package.json');
  const supportedTSVersions = Object.keys(packageJSON.typesVersions);
  assert(
    supportedTSVersions.length === 1,
    'Property "typesVersions" should have exactly one key.',
  );
  // TODO: revisit once TS implements https://github.com/microsoft/TypeScript/issues/32166
  const notSupportedTSVersionFile = 'NotSupportedTSVersion.d.ts';
  fs.writeFileSync(
    path.join('./npmDist', notSupportedTSVersionFile),
    // Provoke syntax error to show this message
    `"Package 'graphql' support only TS versions that are ${supportedTSVersions[0]}".`,
  );
  packageJSON.typesVersions = {
    ...packageJSON.typesVersions,
    '*': { '*': [notSupportedTSVersionFile] },
  };

  fs.copyFileSync('./LICENSE', './npmDist/LICENSE');
  fs.copyFileSync('./README.md', './npmDist/README.md');

  // Should be done as the last step so only valid packages can be published
  writeGeneratedFile('./npmDist/package.json', JSON.stringify(packageJSON));

  showDirStats('./npmDist');
}

function babelBuild(srcPath, options) {
  const { code } = babel.transformFileSync(srcPath, {
    babelrc: false,
    configFile: './.babelrc-npm.json',
    ...options,
  });
  return code + '\n';
}

function buildPackageJSON() {
  const packageJSON = JSON.parse(
    fs.readFileSync(require.resolve('../package.json'), 'utf-8'),
  );

  delete packageJSON.private;
  delete packageJSON.scripts;
  delete packageJSON.devDependencies;

  packageJSON.type = 'commonjs';

  for (const entryPoint of entryPoints) {
    const base = ('./' + path.dirname(entryPoint)).replace(/\/.?$/, '');
    const filename = path.basename(entryPoint, '.ts');
    const generated = {};
    generated[filename === 'index' ? base : `${base}/${filename}.js`] = {
      types: {
        import: `${base}/${filename}.js.d.mts`,
        default: `${base}/${filename}.d.ts`,
      },
      /*
       this is not automatically picked up by vitest, but we can instruct users to add it to their vitest config:
      ```js title="vite.config.ts"
      import { defineConfig } from 'vite';
      export default defineConfig(async ({ mode }) => {
        return {
          resolve: mode === 'test' ? { conditions: ['dual-module-hazard-workaround'] } : undefined,
        };
      });
      ```
       */
      'dual-module-hazard-workaround': {
        import: `${base}/${filename}.js.mjs`,
        default: `${base}/${filename}.js`,
      },
      module: `${base}/${filename}.mjs`,
      import: `${base}/${filename}.js.mjs`,
      default: `${base}/${filename}.js`,
    };
    packageJSON.exports = {
      ...generated,
      ...packageJSON.exports,
    };
  }

  // TODO: move to integration tests
  const publishTag = packageJSON.publishConfig?.tag;
  assert(publishTag != null, 'Should have packageJSON.publishConfig defined!');

  const { version } = packageJSON;
  const versionMatch = /^\d+\.\d+\.\d+-?(?<preReleaseTag>.*)?$/.exec(version);
  if (!versionMatch) {
    throw new Error('Version does not match semver spec: ' + version);
  }

  const { preReleaseTag } = versionMatch.groups;

  if (preReleaseTag != null) {
    const splittedTag = preReleaseTag.split('.');
    // Note: `experimental-*` take precedence over `alpha`, `beta` or `rc`.
    const versionTag = splittedTag[2] ?? splittedTag[0];
    assert(
      ['alpha', 'beta', 'rc'].includes(versionTag) ||
        versionTag.startsWith('experimental-'),
      `"${versionTag}" tag is not supported.`,
    );
    assert.equal(
      versionTag,
      publishTag,
      'Publish tag and version tag should match!',
    );
  }

  return packageJSON;
}

/**
 *
 * @param {string[]} files
 * @param {ts.Program} tsProgram
 * @returns
 */
function buildCjsEsmWrapper(files, tsProgram) {
  /**
   * @type {Record<string, string>} inputFiles
   */
  const inputFiles = {};
  for (const file of files) {
    const sourceFile = tsProgram.getSourceFile(file);
    assert(sourceFile, `No source file found for ${file}`);

    const generatedFileName = path.relative(
      path.dirname(tsProgram.getRootFileNames()[0]),
      file.replace(/\.ts$/, '.js.mts'),
    );
    const exportFrom = ts.factory.createStringLiteral(
      './' + path.basename(file, '.ts') + '.js',
    );

    /**
     * @type {ts.Statement[]}
     */
    const statements = [];

    /** @type {string[]} */
    const exports = [];

    /** @type {string[]} */
    const typeExports = [];

    sourceFile.forEachChild((node) => {
      if (ts.isExportDeclaration(node)) {
        if (node.exportClause && ts.isNamedExports(node.exportClause)) {
          for (const element of node.exportClause.elements) {
            if (node.isTypeOnly || element.isTypeOnly) {
              typeExports.push(element.name.text);
            } else {
              exports.push(element.name.text);
            }
          }
        }
      } else if (
        node.modifiers?.some(
          (modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword,
        )
      ) {
        if (ts.isVariableStatement(node)) {
          for (const declaration of node.declarationList.declarations) {
            if (declaration.name && ts.isIdentifier(declaration.name)) {
              exports.push(declaration.name.text);
            }
          }
        } else if (
          ts.isFunctionDeclaration(node) ||
          ts.isClassDeclaration(node)
        ) {
          exports.push(node.name.text);
        } else if (ts.isTypeAliasDeclaration(node)) {
          typeExports.push(node.name.text);
        }
      }
    });
    if (exports.length > 0) {
      statements.push(
        ts.factory.createExportDeclaration(
          undefined,
          undefined,
          false,
          ts.factory.createNamedExports(
            exports.map((name) =>
              ts.factory.createExportSpecifier(false, undefined, name),
            ),
          ),
          exportFrom,
        ),
      );
    }
    if (typeExports.length > 0) {
      statements.push(
        ts.factory.createExportDeclaration(
          undefined,
          undefined,
          true,
          ts.factory.createNamedExports(
            typeExports.map((name) =>
              ts.factory.createExportSpecifier(false, undefined, name),
            ),
          ),
          exportFrom,
        ),
      );
    }
    const printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed });
    inputFiles[generatedFileName] = printer.printFile(
      ts.factory.createSourceFile(
        statements,
        ts.factory.createToken(ts.SyntaxKind.EndOfFileToken),
        ts.NodeFlags.None,
      ),
    );
  }
  /**
   * @type {ts.CompilerOptions} options
   */
  const options = {
    ...tsProgram.getCompilerOptions(),
    declaration: true,
    emitDeclarationOnly: false,
    isolatedModules: true,
    module: ts.ModuleKind.ESNext,
  };
  options.outDir = options.declarationDir;
  const results = {};
  const host = ts.createCompilerHost(options);
  host.writeFile = (fileName, contents) => (results[fileName] = contents);
  host.readFile = (fileName) => inputFiles[fileName];

  const program = ts.createProgram(Object.keys(inputFiles), options, host);
  program.emit();

  return results;
}
