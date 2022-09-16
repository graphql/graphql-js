import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

import ts from 'typescript';

import { inlineInvariant } from './inline-invariant.js';
import {
  readPackageJSON,
  readTSConfig,
  showDirStats,
  writeGeneratedFile,
} from './utils.js';

buildPackage();
showDirStats('./npmDist');

function buildPackage() {
  fs.rmSync('./npmDist', { recursive: true, force: true });
  fs.mkdirSync('./npmDist');

  fs.copyFileSync('./LICENSE', './npmDist/LICENSE');
  fs.copyFileSync('./README.md', './npmDist/README.md');

  const { emittedTSFiles } = emitTSFiles('./npmDist');

  const packageJSON = readPackageJSON();

  delete packageJSON.private;
  delete packageJSON.scripts;
  delete packageJSON.devDependencies;

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

  packageJSON.exports = {};

  for (const filepath of emittedTSFiles) {
    if (path.basename(filepath) === 'index.js') {
      const relativePath = './' + path.relative('./npmDist', filepath);
      packageJSON.exports[path.dirname(relativePath)] = relativePath;
    }
  }

  // Temporary workaround to allow "internal" imports, no grantees provided
  packageJSON.exports['./*.js'] = './*.js';
  packageJSON.exports['./*'] = './*.js';

  // TODO: move to integration tests
  const publishTag = packageJSON.publishConfig?.tag;
  assert(publishTag != null, 'Should have packageJSON.publishConfig defined!');

  const { version } = packageJSON;
  const versionMatch = /^\d+\.\d+\.\d+-?(?<preReleaseTag>.*)?$/.exec(version);
  if (versionMatch?.groups == null) {
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

  // Should be done as the last step so only valid packages can be published
  writeGeneratedFile('./npmDist/package.json', JSON.stringify(packageJSON));
}

// Based on https://github.com/Microsoft/TypeScript/wiki/Using-the-Compiler-API#getting-the-dts-from-a-javascript-file
function emitTSFiles(outDir: string): {
  emittedTSFiles: ReadonlyArray<string>;
} {
  const tsOptions = readTSConfig({
    module: 'es2020',
    noEmit: false,
    declaration: true,
    declarationDir: outDir,
    outDir,
    listEmittedFiles: true,
  });

  const tsHost = ts.createCompilerHost(tsOptions);
  tsHost.writeFile = writeGeneratedFile;

  const tsProgram = ts.createProgram(['src/index.ts'], tsOptions, tsHost);
  const tsResult = tsProgram.emit(undefined, undefined, undefined, undefined, {
    after: [inlineInvariant],
  });
  assert(
    !tsResult.emitSkipped,
    'Fail to generate `*.d.ts` files, please run `npm run check`',
  );

  assert(tsResult.emittedFiles != null);
  return {
    emittedTSFiles: tsResult.emittedFiles.sort((a, b) => a.localeCompare(b)),
  };
}
