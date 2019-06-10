// @noflow

'use strict';

const fs = require('fs');
const util = require('util');
const path = require('path');
const childProcess = require('child_process');

function exec(command, options) {
  const output = childProcess.execSync(command, {
    maxBuffer: 10 * 1024 * 1024, // 10MB
    encoding: 'utf-8',
    ...options,
  });
  return removeTrailingNewLine(output);
}

const childProcessExec = util.promisify(childProcess.exec);
async function execAsync(command, options) {
  const output = await childProcessExec(command, {
    maxBuffer: 10 * 1024 * 1024, // 10MB
    encoding: 'utf-8',
    ...options,
  });
  return removeTrailingNewLine(output.stdout);
}

function removeTrailingNewLine(str) {
  if (str == null) {
    return str;
  }

  return str
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
  execAsync,
  copyFile,
  writeFile,
  rmdirRecursive,
  mkdirRecursive,
  readdirRecursive,
  parseSemver,
};
