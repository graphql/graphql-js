// @noflow

'use strict';

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
  const tmpDir = path.resolve('./integrationTmp');
  fs.rmdirSync(tmpDir, { recursive: true });
  fs.mkdirSync(tmpDir);

  it('Should compile with all supported TS versions', () => {
    exec(`cp -R ${path.join(__dirname, 'ts')} ${tmpDir}`);

    const cwd = path.join(tmpDir, 'ts');
    exec('npm install --silent', { cwd });
    exec('npm test', { cwd });
  }).timeout(40000);
});
