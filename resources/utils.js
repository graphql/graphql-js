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

  return str.split('\n').slice(0, -1).join('\n');
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
    const list = readdirRecursive(path.join(dirPath, name), opts).map((f) =>
      path.join(name, f),
    );
    result.push(...list);
  }
  return result;
}

function showDirStats(dirPath) {
  const fileTypes = {};
  let totalSize = 0;

  for (const filepath of readdirRecursive(dirPath)) {
    const name = filepath.split(path.sep).pop();
    const [base, ...splitExt] = name.split('.');
    const ext = splitExt.join('.');

    const filetype = ext ? '*.' + ext : base;
    fileTypes[filetype] = fileTypes[filetype] || { filepaths: [], size: 0 };

    const { size } = fs.lstatSync(path.join(dirPath, filepath));
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

module.exports = {
  exec,
  execAsync,
  rmdirRecursive,
  readdirRecursive,
  showDirStats,
};
