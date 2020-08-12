'use strict';

const os = require('os');
const fs = require('fs');
const path = require('path');
const childProcess = require('child_process');

const { describe, it } = require('mocha');

function exec(command, options = {}) {
  return childProcess.execSync(command, {
    stdio: 'inherit',
    ...options,
  });
}

describe('Integration Tests', () => {
  const tmpDir = path.join(os.tmpdir(), 'graphql-js-integrationTmp');
  fs.rmdirSync(tmpDir, { recursive: true });
  fs.mkdirSync(tmpDir);

  const distDir = path.resolve('./npmDist');
  exec(`npm pack ${distDir} && cp graphql-*.tgz graphql.tgz`, { cwd: tmpDir });

  it('Should compile with all supported TS versions', () => {
    exec(`cp -R ${path.join(__dirname, 'ts')} ${tmpDir}`);

    const cwd = path.join(tmpDir, 'ts');
    exec('npm install --silent', { cwd });
    exec('npm test', { cwd });
  }).timeout(40000);

  it('Should work on all supported node versions', () => {
    exec(`cp -R ${path.join(__dirname, 'node')} ${tmpDir}`);

    const cwd = path.join(tmpDir, 'node');
    exec('npm install', { cwd });
    exec('npm test', { cwd });
  }).timeout(40000);
});
