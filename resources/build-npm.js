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

const root = path.join(__dirname, '..');

if (require.main === module) {
  const outputDirectory = path.resolve(
    process.argv[2] ?? path.join(root, 'npmDist'),
  );
  fs.rmSync(outputDirectory, { recursive: true, force: true });
  fs.mkdirSync(outputDirectory);

  const packageJSON = buildPackageJSON();

  const srcFiles = readdirRecursive(path.join(root, 'src'), {
    ignoreDir: /^__.*__$/,
  });
  for (const filepath of srcFiles) {
    const srcPath = path.join(path.join(root, 'src'), filepath);
    const destPath = path.join(outputDirectory, filepath);

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
    declarationDir: outputDirectory,
    emitDeclarationOnly: true,
  };

  const tsHost = ts.createCompilerHost(tsOptions);
  tsHost.getCurrentDirectory = () => root;
  tsHost.writeFile = (filepath, body) => {
    writeGeneratedFile(filepath, body);
  };

  const tsProgram = ts.createProgram(
    [path.join(root, 'src/index.ts')],
    tsOptions,
    tsHost,
  );
  const tsResult = tsProgram.emit();
  assert(
    !tsResult.emitSkipped,
    'Fail to generate `*.d.ts` files, please run `npm run check`',
  );

  assert(packageJSON.types === undefined, 'Unexpected "types" in package.json');
  const supportedTSVersions = Object.keys(packageJSON.typesVersions);
  assert(
    supportedTSVersions.length === 1,
    'Property "typesVersions" should have exactly one key.',
  );
  // TODO: revisit once TS implements https://github.com/microsoft/TypeScript/issues/32166
  const notSupportedTSVersionFile = 'NotSupportedTSVersion.d.ts';
  fs.writeFileSync(
    path.join(outputDirectory, notSupportedTSVersionFile),
    // Provoke syntax error to show this message
    `"Package 'graphql' support only TS versions that are ${supportedTSVersions[0]}".`,
  );
  packageJSON.typesVersions = {
    ...packageJSON.typesVersions,
    '*': { '*': [notSupportedTSVersionFile] },
  };

  fs.copyFileSync(
    path.join(root, 'LICENSE'),
    path.join(outputDirectory, 'LICENSE'),
  );
  fs.copyFileSync(
    path.join(root, 'README.md'),
    path.join(outputDirectory, 'README.md'),
  );

  // Should be done as the last step so only valid packages can be published
  writeGeneratedFile(
    path.join(outputDirectory, 'package.json'),
    JSON.stringify(packageJSON),
  );

  showDirStats(outputDirectory);
}

function babelBuild(srcPath, options) {
  const { code } = babel.transformFileSync(srcPath, {
    babelrc: false,
    configFile: path.join(root, '.babelrc-npm.json'),
    cwd: root,
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

  const { version } = packageJSON;
  const versionMatch = /^\d+\.\d+\.\d+-?(?<preReleaseTag>.*)?$/.exec(version);
  if (!versionMatch) {
    throw new Error('Version does not match semver spec: ' + version);
  }

  return packageJSON;
}
