import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

import ts from 'typescript';

import { changeExtensionInImportPaths } from './change-extension-in-import-paths.js';
import { inlineInvariant } from './inline-invariant.js';
import {
  readPackageJSON,
  readTSConfig,
  showDirStats,
  writeGeneratedFile,
} from './utils.js';
import { optimizeArrayDestructuring } from './optimize-array-destructuring.js';
import { optimizeForOf } from './optimize-for-of.js'

console.log('\n./npmDist');
buildPackage('./npmDist', false);
showDirStats('./npmDist');

console.log('\n./npmEsmDist');
buildPackage('./npmEsmDist', true);
showDirStats('./npmEsmDist');

function buildPackage(outDir: string, isESMOnly: boolean): void {
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir);

  fs.copyFileSync('./LICENSE', `./${outDir}/LICENSE`);
  fs.copyFileSync('./README.md', `./${outDir}/README.md`);

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
    path.join(outDir, notSupportedTSVersionFile),
    // Provoke syntax error to show this message
    `"Package 'graphql' support only TS versions that are ${supportedTSVersions[0]}".`,
  );

  packageJSON.typesVersions = {
    ...packageJSON.typesVersions,
    '*': { '*': [notSupportedTSVersionFile] },
  };

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

  if (isESMOnly) {
    packageJSON.exports = {};

    const { emittedTSFiles } = emitTSFiles({
      outDir,
      module: 'es2020',
      extension: '.js',
    });

    for (const filepath of emittedTSFiles) {
      if (path.basename(filepath) === 'index.js') {
        const relativePath = './' + path.relative('./npmEsmDist', filepath);
        packageJSON.exports[path.dirname(relativePath)] = relativePath;
      }
    }

    // Temporary workaround to allow "internal" imports, no grantees provided
    packageJSON.exports['./*.js'] = './*.js';
    packageJSON.exports['./*'] = './*.js';

    packageJSON.publishConfig.tag += '-esm';
    packageJSON.version += '+esm';
  } else {
    delete packageJSON.type;
    packageJSON.main = 'index';
    packageJSON.module = 'index.mjs';
    emitTSFiles({ outDir, module: 'commonjs', extension: '.js' });
    emitTSFiles({ outDir, module: 'es2020', extension: '.mjs' });
  }

  // Should be done as the last step so only valid packages can be published
  writeGeneratedFile(`./${outDir}/package.json`, JSON.stringify(packageJSON));
}

// Based on https://github.com/Microsoft/TypeScript/wiki/Using-the-Compiler-API#getting-the-dts-from-a-javascript-file
function emitTSFiles(options: {
  outDir: string;
  module: string;
  extension: string;
}): {
  emittedTSFiles: ReadonlyArray<string>;
} {
  const { outDir, module, extension } = options;
  const tsOptions = readTSConfig({
    module,
    noEmit: false,
    declaration: true,
    declarationDir: outDir,
    outDir,
    listEmittedFiles: true,
  });

  const tsHost = ts.createCompilerHost(tsOptions);
  tsHost.writeFile = (filepath, body) =>
    writeGeneratedFile(filepath.replace(/.js$/, extension), body);

  const tsProgram = ts.createProgram(['src/index.ts'], tsOptions, tsHost);
  const tsResult = tsProgram.emit(undefined, undefined, undefined, undefined, {
    before: [optimizeForOf(tsProgram), optimizeArrayDestructuring],
    after: [changeExtensionInImportPaths({ extension }), inlineInvariant],
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
