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
