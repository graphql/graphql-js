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

function mkdirRecursive(path) {
  fs.mkdirSync(path, { recursive: true });
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
  return fs.readdirSync(dirPath, { withFileTypes: true })
    .flatMap(dirent => {
      const name = dirent.name;
      if (dirent.isDirectory()) {
        if (ignoreDir && ignoreDir.test(name)) {
          return [];
        }
        return readdirRecursive(path.join(dirPath, name), opts)
          .map(f => path.join(name, f));
      }
      return dirent.name;
    });
}

function writeFile(destPath, data) {
  mkdirRecursive(path.dirname(destPath));
  fs.writeFileSync(destPath, data);
}

function copyFile(srcPath, destPath) {
  mkdirRecursive(path.dirname(destPath));
  fs.copyFileSync(srcPath, destPath);
}

module.exports = {
  copyFile,
  writeFile,
  rmdirRecursive,
  mkdirRecursive,
  readdirRecursive,
};
