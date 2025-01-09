import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

import ts from 'typescript';

import { changeExtensionInImportPaths } from './change-extension-in-import-paths.js';
import { inlineInvariant } from './inline-invariant.js';
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
    packageJSON.main = 'index.js';
    packageJSON.module = 'index.mjs';
    packageJSON.types = 'index.d.ts';
    packageJSON.exports = {
      '.': {
        import: {
          types: './index.d.ts',
          default: './index.mjs'
        },
        require: {
          types: './index.d.ts',
          default: './index.js'
        }
      },
      './graphql': {
        import: {
          types: './graphql.d.ts',
          default: './graphql.mjs'
        },
        require: {
          types: './graphql.d.ts',
          default: './graphql.js'
        }
      },
      './version': {
        import: {
          types: './version.d.ts',
          default: './version.mjs'
        },
        require: {
          types: './version.d.ts',
          default: './version.js'
        }
      },
      './error': {
        import: {
          types: './error/index.d.ts',
          default: './error/index.mjs'
        },
        require: {
          types: './error/index.d.ts',
          default: './error/index.js'
        }
      },
      './error/*': {
        import: {
          types: './error/*.d.ts',
          default: './error/*.mjs'
        },
        require: {
          types: './error/*.d.ts',
          default: './error/*.js'
        }
      },
      './execution': {
        import: {
          types: './execution/index.d.ts',
          default: './execution/index.mjs'
        },
        require: {
          types: './execution/index.d.ts',
          default: './execution/index.js'
        }
      },
      './execution/*': {
        import: {
          types: './execution/*.d.ts',
          default: './execution/*.mjs'
        },
        require: {
          types: './execution/*.d.ts',
          default: './execution/*.js'
        }
      },
      './jsutils': {
        import: {
          types: './jsutils/index.d.ts',
          default: './jsutils/index.mjs'
        },
        require: {
          types: './jsutils/index.d.ts',
          default: './jsutils/index.js'
        }
      },
      './jsutils/*': {
        import: {
          types: './jsutils/*.d.ts',
          default: './jsutils/*.mjs'
        },
        require: {
          types: './jsutils/*.d.ts',
          default: './jsutils/*.js'
        }
      },
      './language': {
        import: {
          types: './language/index.d.ts',
          default: './language/index.mjs'
        },
        require: {
          types: './language/index.d.ts',
          default: './language/index.js'
        }
      },
      './language/*': {
        import: {
          types: './language/*.d.ts',
          default: './language/*.mjs'
        },
        require: {
          types: './language/*.d.ts',
          default: './language/*.js'
        }
      },
      './subscription': {
        import: {
          types: './subscription/index.d.ts',
          default: './subscription/index.mjs'
        },
        require: {
          types: './subscription/index.d.ts',
          default: './subscription/index.js'
        }
      },
      './subscription/*': {
        import: {
          types: './subscription/*.d.ts',
          default: './subscription/*.mjs'
        },
        require: {
          types: './subscription/*.d.ts',
          default: './subscription/*.js'
        }
      },
      './type': {
        import: {
          types: './type/index.d.ts',
          default: './type/index.mjs'
        },
        require: {
          types: './type/index.d.ts',
          default: './type/index.js'
        }
      },
      './type/*': {
        import: {
          types: './type/*.d.ts',
          default: './type/*.mjs'
        },
        require: {
          types: './type/*.d.ts',
          default: './type/*.js'
        }
      },
      './utilities': {
        import: {
          types: './utilities/index.d.ts',
          default: './utilities/index.mjs'
        },
        require: {
          types: './utilities/index.d.ts',
          default: './utilities/index.js'
        }
      },
      './utilities/*': {
        import: {
          types: './utilities/*.d.ts',
          default: './utilities/*.mjs'
        },
        require: {
          types: './utilities/*.d.ts',
          default: './utilities/*.js'
        }
      },
      './validation': {
        import: {
          types: './validation/index.d.ts',
          default: './validation/index.mjs'
        },
        require: {
          types: './validation/index.d.ts',
          default: './validation/index.js'
        }
      },
      './validation/*': {
        import: {
          types: './validation/*.d.ts',
          default: './validation/*.mjs'
        },
        require: {
          types: './validation/*.d.ts',
          default: './validation/*.js'
        }
      }
    }
    emitTSFiles({ outDir, module: 'commonjs', extension: '.js' });
    emitTSFiles({ outDir, module: 'es2020', extension: '.mjs' });
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
  tsHost.writeFile = (filepath, body) => {
    if (filepath.match(/.js$/) && extension === '.mjs') {
      let bodyToWrite = body;
      bodyToWrite = bodyToWrite.replace(
        '//# sourceMappingURL=graphql.js.map',
        '//# sourceMappingURL=graphql.mjs.map',
      );
      writeGeneratedFile(filepath.replace(/.js$/, extension), bodyToWrite);
    } else if (filepath.match(/.js.map$/) && extension === '.mjs') {
      writeGeneratedFile(
        filepath.replace(/.js.map$/, extension + '.map'),
        body,
      );
    } else {
      writeGeneratedFile(filepath, body);
    }
  };

  const tsProgram = ts.createProgram(['src/index.ts'], tsOptions, tsHost);
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
