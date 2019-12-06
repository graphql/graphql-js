// @noflow

'use strict';

const fs = require('fs');
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
    } else if (filepath.endsWith('.d.ts')) {
      const srcPath = path.join('./src', filepath);
      const destPath = path.join('./dist', filepath);

      copyFile(srcPath, destPath);
    }
  }

  const packageJSON = buildPackageJSON();
  assert(
    packageJSON.version === require('../dist/version').version,
    'Version in package.json and version.js should match',
  );

  writeFile('./dist/package.json', JSON.stringify(packageJSON, null, 2));
  showStats();
}

function showStats() {
  const fileTypes = {};
  let totalSize = 0;

  for (const filepath of readdirRecursive('./dist')) {
    const name = filepath.split(path.sep).pop();
    const [base, ...splitedExt] = name.split('.');
    const ext = splitedExt.join('.');

    const filetype = ext ? '*.' + ext : base;
    fileTypes[filetype] = fileTypes[filetype] || { filepaths: [], size: 0 };

    const { size } = fs.lstatSync(path.join('./dist', filepath));
    totalSize += size;
    fileTypes[filetype].size += size;
    fileTypes[filetype].filepaths.push(filepath);
  }

  let stats = [];
  for (const [filetype, typeStats] of Object.entries(fileTypes)) {
    const numFiles = typeStats.filepaths.length;

    if (numFiles > 1) {
      stats.push([filetype + ' x' + numFiles, typeStats.size]);
    } else {
      stats.push([typeStats.filepaths[0], typeStats.size]);
    }
  }
  stats.sort((a, b) => b[1] - a[1]);
  stats = stats.map(([type, size]) => [type, (size / 1024).toFixed(2) + ' KB']);

  const typeMaxLength = Math.max(...stats.map(x => x[0].length));
  const sizeMaxLength = Math.max(...stats.map(x => x[1].length));
  for (const [type, size] of stats) {
    console.log(
      type.padStart(typeMaxLength) + ' | ' + size.padStart(sizeMaxLength),
    );
  }

  console.log('-'.repeat(typeMaxLength + 3 + sizeMaxLength));
  const totalMB = (totalSize / 1024 / 1024).toFixed(2) + ' MB';
  console.log(
    'Total'.padStart(typeMaxLength) + ' | ' + totalMB.padStart(sizeMaxLength),
  );
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
  writeFile(destPath.replace(/\.js$/, '.es.js'), babelBuild(srcPath, 'esm'));
}

function buildPackageJSON() {
  const packageJSON = require('../package.json');
  delete packageJSON.private;
  delete packageJSON.scripts;
  delete packageJSON.devDependencies;

  const { preReleaseTag } = parseSemver(packageJSON.version);
  if (preReleaseTag != null) {
    const [tag] = preReleaseTag.split('.');
    assert(['alpha', 'beta', 'rc'].includes(tag), `"${tag}" tag is supported.`);

    assert(!packageJSON.publishConfig, 'Can not override "publishConfig".');
    packageJSON.publishConfig = { tag: tag || 'latest' };
  }

  return packageJSON;
}
