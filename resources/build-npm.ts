import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

import ts from 'typescript';

import { changeExtensionInImportPaths } from './change-extension-in-import-paths.js';
import { inlineInvariant } from './inline-invariant.js';
import type { PlatformConditionalExports } from './utils.js';
import {
  prettify,
  readPackageJSON,
  readTSConfig,
  showDirStats,
  writeGeneratedFile,
} from './utils.js';

console.log('\n./npmDist');
await buildPackage('./npmDist', false);
showDirStats('./npmDist');

console.log('\n./npmEsmDist');
await buildPackage('./npmEsmDist', true);
showDirStats('./npmEsmDist');

async function buildPackage(outDir: string, isESMOnly: boolean): Promise<void> {
  const devDir = path.join(outDir, '__dev__');

  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir);
  fs.mkdirSync(devDir);

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

    const { emittedTSFiles } = emitTSFiles({ outDir, extension: '.js' });

    for (const filepath of emittedTSFiles) {
      if (path.basename(filepath) === 'index.js') {
        const relativePath = './' + path.relative('./npmEsmDist', filepath);
        packageJSON.exports[path.dirname(relativePath)] = relativePath;
      }
    }

    packageJSON.exports['./*.js'] = './*.js';
    packageJSON.exports['./*'] = './*.js';

    packageJSON.publishConfig.tag += '-esm';
    packageJSON.version += '+esm';
  } else {
    delete packageJSON.type;
    packageJSON.main = 'index.js';
    packageJSON.module = 'index.mjs';
    packageJSON.types = 'index.d.ts';

    const { emittedTSFiles } = emitTSFiles({
      outDir,
      module: 'commonjs',
      moduleResolution: 'node10',
      extension: '.js',
    });
    emitTSFiles({ outDir, extension: '.mjs' });

    packageJSON.exports = {};
    for (const prodFile of emittedTSFiles) {
      const { dir, base, name, ext } = path.parse(prodFile);

      if (ext === '.map') {
        continue;
      } else if (path.basename(dir) === 'dev') {
        packageJSON.exports['./dev'] = buildPlatformConditionalExports(
          './dev',
          'index',
        );
        continue;
      }

      const relativePathToProd = path.relative(prodFile, outDir);

      const { name: innerName, ext: innerExt } = path.parse(name);

      if (innerExt === '.d') {
        const relativePathAndName = path.relative(
          outDir,
          `${dir}/${innerName}`,
        );

        const line = `export * from '${relativePathToProd}/${relativePathAndName}.mjs';`;
        for (const typeExt of ['.ts', '.mts']) {
          writeGeneratedFile(
            path.join(
              devDir,
              path.relative(outDir, `${dir}/${name}${typeExt}`),
            ),
            line,
          );
        }
        continue;
      }

      const relativePathAndName = path.relative(outDir, `${dir}/${name}`);

      let lines = [
        `const { enableDevMode } = require('${relativePathToProd}/devMode.js');`,
        'enableDevMode();',
        `module.exports = require('${relativePathToProd}/${relativePathAndName}.js');`,
      ];

      writeGeneratedFile(
        path.join(devDir, path.relative(outDir, `${dir}/${name}.js`)),
        lines.join('\n'),
      );

      lines = [
        `import { enableDevMode } from '${relativePathToProd}/devMode.mjs';`,
        'enableDevMode();',
        `export * from '${relativePathToProd}/${relativePathAndName}.mjs';`,
      ];

      writeGeneratedFile(
        path.join(devDir, path.relative(outDir, `${dir}/${name}.mjs`)),
        lines.join('\n'),
      );

      if (base === 'index.js') {
        const dirname = path.dirname(relativePathAndName);
        packageJSON.exports[dirname === '.' ? dirname : `./${dirname}`] = {
          development: buildPlatformConditionalExports(
            './__dev__',
            relativePathAndName,
          ),
          default: buildPlatformConditionalExports('.', relativePathAndName),
        };
      }
    }

    const globEntryPoints = {
      development: buildPlatformConditionalExports('./__dev__', '*'),
      default: buildPlatformConditionalExports('.', '*'),
    };
    packageJSON.exports['./*.js'] = globEntryPoints;
    packageJSON.exports['./*'] = globEntryPoints;

    packageJSON.sideEffects = ['__dev__/*'];
  }

  const packageJsonPath = `./${outDir}/package.json`;
  const prettified = await prettify(
    packageJsonPath,
    JSON.stringify(packageJSON),
  );
  // Should be done as the last step so only valid packages can be published
  writeGeneratedFile(packageJsonPath, prettified);
}

// Based on https://github.com/Microsoft/TypeScript/wiki/Using-the-Compiler-API#getting-the-dts-from-a-javascript-file
function emitTSFiles(options: {
  outDir: string;
  module?: string;
  moduleResolution?: string;
  extension: string;
}): {
  emittedTSFiles: ReadonlyArray<string>;
} {
  const { extension, ...rest } = options;
  const tsOptions = readTSConfig({
    ...rest,
    noEmit: false,
    declaration: true,
    declarationDir: rest.outDir,
    listEmittedFiles: true,
  });

  const tsHost = ts.createCompilerHost(tsOptions);
  tsHost.writeFile = (filepath, body) => {
    if (extension === '.mjs') {
      if (filepath.match(/.js$/)) {
        let bodyToWrite = body;
        bodyToWrite = bodyToWrite.replace(
          '//# sourceMappingURL=graphql.js.map',
          '//# sourceMappingURL=graphql.mjs.map',
        );
        writeGeneratedFile(filepath.replace(/.js$/, extension), bodyToWrite);
        return;
      }

      if (filepath.match(/.js.map$/)) {
        writeGeneratedFile(
          filepath.replace(/.js.map$/, extension + '.map'),
          body,
        );
        return;
      }

      if (filepath.match(/.d.ts$/)) {
        writeGeneratedFile(filepath.replace(/.d.ts$/, '.d.mts'), body);
        return;
      }
    }
    writeGeneratedFile(filepath, body);
  };

  const tsProgram = ts.createProgram(
    ['src/index.ts', 'src/dev/index.ts'],
    tsOptions,
    tsHost,
  );
  const tsResult = tsProgram.emit(undefined, undefined, undefined, undefined, {
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

function buildPlatformConditionalExports(
  dir: string,
  name: string,
): PlatformConditionalExports {
  const base = `./${path.join(dir, name)}`;
  return {
    module: `${base}.mjs`,
    bun: `${base}.mjs`,
    'module-sync': `${base}.mjs`,
    node: `${base}.js`,
    require: `${base}.js`,
    default: `${base}.mjs`,
  };
}
