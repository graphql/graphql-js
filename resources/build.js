/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @noflow
 */

'use strict';

const path = require('path');
const assert = require('assert');
const babel = require('@babel/core');
const {
  copyFile,
  writeFile,
  rmdirRecursive,
  mkdirRecursive,
  readdirRecursive,
  parseSemver,
} = require('./utils');

if (require.main === module) {
  rmdirRecursive('./dist');
  mkdirRecursive('./dist');

  copyFile('./LICENSE', './dist/LICENSE');
  copyFile('./README.md', './dist/README.md');

  const srcFiles = readdirRecursive('./src', { ignoreDir: /^__.*__$/ });
  for (const filepath of srcFiles) {
    if (filepath.endsWith('.js')) {
      buildJSFile(filepath);
    }
  }

  const packageJSON = buildPackageJSON();
  assert(
    packageJSON.version === require('../dist/version').version,
    'Version in package.json and version.js should match',
  );

  writeFile('./dist/package.json', JSON.stringify(packageJSON, null, 2));
}

function babelBuild(srcPath, envName) {
  return babel.transformFileSync(srcPath, { envName }).code + '\n';
}

function buildJSFile(filepath) {
  const srcPath = path.join('./src', filepath);
  const destPath = path.join('./dist', filepath);

  copyFile(srcPath, destPath + '.flow');
  writeFile(destPath, babelBuild(srcPath, 'cjs'));
  writeFile(destPath.replace(/\.js$/, '.mjs'), babelBuild(srcPath, 'mjs'));
}

function buildPackageJSON() {
  const packageJSON = require('../package.json');
  delete packageJSON.scripts;
  delete packageJSON.devDependencies;

  const { preReleaseTag } = parseSemver(packageJSON.version);
  if (preReleaseTag != null) {
    const [tag] = preReleaseTag.split('.');
    assert(tag === 'rc', 'Only "rc" tag is supported.');

    assert(!packageJSON.publishConfig, 'Can not override "publishConfig".');
    packageJSON.publishConfig = { tag: tag || 'latest' };
  }

  return packageJSON;
}
