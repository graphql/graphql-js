/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @noflow
 */

'use strict';

const sane = require('sane');
const { resolve: resolvePath } = require('path');
const { spawn } = require('child_process');
const flowBinPath = require('flow-bin');

process.env.PATH += ':./node_modules/.bin';

const cmd = resolvePath(__dirname);
const srcDir = resolvePath(cmd, '../src');

function exec(command, options) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, options, {
      cmd,
      env: process.env,
      stdio: 'inherit',
    });
    child.on('exit', code => {
      if (code === 0) {
        resolve(true);
      } else {
        reject(new Error('Error code: ' + code));
      }
    });
  });
}

const flowServer = spawn(flowBinPath, ['server'], {
  cmd,
  env: process.env,
});

const watcher = sane(srcDir, { glob: ['**/*.js', '**/*.graphql'] })
  .on('ready', startWatch)
  .on('add', changeFile)
  .on('delete', deleteFile)
  .on('change', changeFile);

process.on('SIGINT', () => {
  console.log(CLEARLINE + yellow(invert('stopped watching')));
  watcher.close();
  flowServer.kill();
  process.exit();
});

let isChecking;
let needsCheck;
let toCheck = {};
let timeout;

function startWatch() {
  process.stdout.write(CLEARSCREEN + green(invert('watching...')));
}

function changeFile(filepath, root, stat) {
  if (!stat.isDirectory()) {
    toCheck[filepath] = true;
    debouncedCheck();
  }
}

function deleteFile(filepath) {
  delete toCheck[filepath];
  debouncedCheck();
}

function debouncedCheck() {
  needsCheck = true;
  clearTimeout(timeout);
  timeout = setTimeout(guardedCheck, 250);
}

function guardedCheck() {
  if (isChecking || !needsCheck) {
    return;
  }
  isChecking = true;
  const filepaths = Object.keys(toCheck);
  toCheck = {};
  needsCheck = false;
  checkFiles(filepaths).then(() => {
    isChecking = false;
    process.nextTick(guardedCheck);
  });
}

function checkFiles(filepaths) {
  console.log('\u001b[2J');

  return runTests(filepaths)
    .then(testSuccess =>
      lintFiles().then(lintSuccess =>
        typecheckStatus().then(
          typecheckSuccess => testSuccess && lintSuccess && typecheckSuccess,
        ),
      ),
    )
    .catch(() => false)
    .then(success => {
      process.stdout.write(
        '\n' + (success ? '' : '\x07') + green(invert('watching...')),
      );
    });
}

// Checking steps
function runTests(filepaths) {
  console.log('\nRunning Tests');

  return exec(
    'mocha',
    ['--reporter', 'progress'].concat(
      allTests(filepaths)
        ? filepaths.map(srcPath)
        : ['src/**/__tests__/**/*-test.js'],
    ),
  ).catch(() => false);
}

function lintFiles() {
  console.log('Linting Code\n');
  return exec('eslint', ['--cache', 'src/']).catch(() => false);
}

function typecheckStatus() {
  console.log('\nType Checking\n');
  return exec(flowBinPath, ['status']).catch(() => false);
}

// Filepath

function srcPath(filepath) {
  return resolvePath(srcDir, filepath);
}

// Predicates

function allTests(filepaths) {
  return filepaths.length > 0 && filepaths.every(isTest);
}

const TEST_PATH_RX = /^(?:.*?\/)?__tests__\/.+?-test\.js$/;

function isTest(filepath) {
  return TEST_PATH_RX.test(filepath);
}

// Print helpers

const CLEARSCREEN = '\u001b[2J';
const CLEARLINE = '\r\x1B[K';

function invert(str) {
  return `\u001b[7m ${str} \u001b[27m`;
}

function green(str) {
  return `\x1B[K\u001b[1m\u001b[32m${str}\u001b[39m\u001b[22m`;
}

function yellow(str) {
  return `\x1B[K\u001b[1m\u001b[33m${str}\u001b[39m\u001b[22m`;
}
