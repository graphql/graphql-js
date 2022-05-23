import * as assert from 'node:assert';
import * as fs from 'node:fs';
import * as path from 'node:path';

import * as ts from 'typescript';

import { addExtensionToImportPaths } from './add-extension-to-import-paths';
import { inlineInvariant } from './inline-invariant';
import {
  readdirRecursive,
  readPackageJSON,
  showDirStats,
  writeGeneratedFile,
} from './utils';

fs.rmSync('./npmDist', { recursive: true, force: true });
fs.mkdirSync('./npmDist');

// Based on https://github.com/Microsoft/TypeScript/wiki/Using-the-Compiler-API#getting-the-dts-from-a-javascript-file
const tsConfig = JSON.parse(
  fs.readFileSync(require.resolve('../tsconfig.json'), 'utf-8'),
);
assert(
  tsConfig.compilerOptions,
  '"tsconfig.json" should have `compilerOptions`',
);

const { options: tsOptions, errors: tsOptionsErrors } =
  ts.convertCompilerOptionsFromJson(
    {
      ...tsConfig.compilerOptions,
      module: 'es2020',
      noEmit: false,
      declaration: true,
      declarationDir: './npmDist',
      outDir: './npmDist',
    },
    process.cwd(),
  );

assert(
  tsOptionsErrors.length === 0,
  'Fail to parse options: ' + tsOptionsErrors,
);

const tsHost = ts.createCompilerHost(tsOptions);
tsHost.writeFile = (filepath, body) => {
  fs.mkdirSync(path.dirname(filepath), { recursive: true });
  writeGeneratedFile(filepath, body);
};

const tsProgram = ts.createProgram(['src/index.ts'], tsOptions, tsHost);
const tsResult = tsProgram.emit(undefined, undefined, undefined, undefined, {
  after: [addExtensionToImportPaths({ extension: '.js' }), inlineInvariant],
});
assert(
  !tsResult.emitSkipped,
  'Fail to generate `*.d.ts` files, please run `npm run check`',
);

fs.copyFileSync('./LICENSE', './npmDist/LICENSE');
fs.copyFileSync('./README.md', './npmDist/README.md');

// Should be done as the last step so only valid packages can be published
writeGeneratedFile(
  './npmDist/package.json',
  JSON.stringify(buildPackageJSON()),
);

showDirStats('./npmDist');

function buildPackageJSON() {
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

  packageJSON.type = 'module';
  packageJSON.exports = {};

  for (const filepath of readdirRecursive('./src', { ignoreDir: /^__.*__$/ })) {
    if (path.basename(filepath) === 'index.ts') {
      const key = path.dirname(filepath);
      packageJSON.exports[key] = filepath.replace(/\.ts$/, '.js');
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

  return packageJSON;
}
