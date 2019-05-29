/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @noflow
 */

'use strict';

const fs = require('fs');
const path = require('path');
const childProcess = require('child_process');

function exec(command, options) {
  const output = childProcess.execSync(command, {
    encoding: 'utf-8',
    ...options,
  });
  // Remove trailing new line
  return output
    .split('\n')
    .slice(0, -1)
    .join('\n');
}

function mkdirRecursive(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function rmdirRecursive(dirPath) {
  if (fs.existsSync(dirPath)) {
    for (const dirent of fs.readdirSync(dirPath, { withFileTypes: true })) {
      const fullPath = path.join(dirPath, dirent.name);
      if (dirent.isDirectory()) {
        rmdirRecursive(fullPath);
      } else {
        fs.unlinkSync(fullPath);
      }
    }
    fs.rmdirSync(dirPath);
  }
}

function readdirRecursive(dirPath, opts = {}) {
  const { ignoreDir } = opts;
  const result = [];
  for (const dirent of fs.readdirSync(dirPath, { withFileTypes: true })) {
    const name = dirent.name;
    if (!dirent.isDirectory()) {
      result.push(dirent.name);
      continue;
    }

    if (ignoreDir && ignoreDir.test(name)) {
      continue;
    }
    const list = readdirRecursive(path.join(dirPath, name), opts).map(f =>
      path.join(name, f),
    );
    result.push(...list);
  }
  return result;
}

function writeFile(destPath, data) {
  mkdirRecursive(path.dirname(destPath));
  fs.writeFileSync(destPath, data);
}

function copyFile(srcPath, destPath) {
  mkdirRecursive(path.dirname(destPath));
  fs.copyFileSync(srcPath, destPath);
}

function parseSemver(version) {
  const match = /^(\d+)\.(\d+)\.(\d+)-?(.*)?$/.exec(version);
  if (!match) {
    throw new Error('Version does not match semver spec: ' + version);
  }

  const [, major, minor, patch, preReleaseTag] = match;
  return { major, minor, patch, preReleaseTag };
}

module.exports = {
  exec,
  copyFile,
  writeFile,
  rmdirRecursive,
  mkdirRecursive,
  readdirRecursive,
  parseSemver,
};
