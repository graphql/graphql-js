// @noflow

'use strict';

const fs = require('fs');
const path = require('path');
const assert = require('assert');

const babel = require('@babel/core');

const { rmdirRecursive, readdirRecursive } = require('./utils');

if (require.main === module) {
  rmdirRecursive('./dist');
  fs.mkdirSync('./dist');

  const srcFiles = readdirRecursive('./src', { ignoreDir: /^__.*__$/ });
  for (const filepath of srcFiles) {
    const srcPath = path.join('./src', filepath);
    const destPath = path.join('./dist', filepath);

    fs.mkdirSync(path.dirname(destPath), { recursive: true });
    if (filepath.endsWith('.js')) {
      fs.copyFileSync(srcPath, destPath + '.flow');

      const cjs = babelBuild(srcPath, { envName: 'cjs' });
      fs.writeFileSync(destPath, cjs);

      const mjs = babelBuild(srcPath, { envName: 'mjs' });
      fs.writeFileSync(destPath.replace(/\.js$/, '.mjs'), mjs);
    } else if (filepath.endsWith('.d.ts')) {
      fs.copyFileSync(srcPath, destPath);
    }
  }

  fs.copyFileSync('./LICENSE', './dist/LICENSE');
  fs.copyFileSync('./README.md', './dist/README.md');

  // Should be done as the last step so only valid packages can be published
  const packageJSON = buildPackageJSON();
  fs.writeFileSync('./dist/package.json', JSON.stringify(packageJSON, null, 2));

  showStats();
}

function babelBuild(srcPath, options) {
  return babel.transformFileSync(srcPath, options).code + '\n';
}

function buildPackageJSON() {
  const packageJSON = require('../package.json');
  delete packageJSON.private;
  delete packageJSON.scripts;
  delete packageJSON.devDependencies;

  const versionJS = require('../dist/version.js');
  assert(
    versionJS.version === packageJSON.version,
    'Version in package.json and version.js should match',
  );

  if (versionJS.preReleaseTag != null) {
    const [tag] = versionJS.preReleaseTag.split('.');
    assert(['alpha', 'beta', 'rc'].includes(tag), `"${tag}" tag is supported.`);

    assert(!packageJSON.publishConfig, 'Can not override "publishConfig".');
    packageJSON.publishConfig = { tag: tag || 'latest' };
  }

  return packageJSON;
}

function showStats() {
  const fileTypes = {};
  let totalSize = 0;

  for (const filepath of readdirRecursive('./dist')) {
    const name = filepath.split(path.sep).pop();
    const [base, ...splitExt] = name.split('.');
    const ext = splitExt.join('.');

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

  const typeMaxLength = Math.max(...stats.map((x) => x[0].length));
  const sizeMaxLength = Math.max(...stats.map((x) => x[1].length));
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
