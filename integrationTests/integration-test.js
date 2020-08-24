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

  function testOnNodeProject(projectName) {
    exec(`cp -R ${path.join(__dirname, projectName)} ${tmpDir}`);

    const cwd = path.join(tmpDir, projectName);
    exec('npm install --quiet', { cwd });
    exec('npm test', { cwd });
  }

  it('Should compile with all supported TS versions', () => {
    testOnNodeProject('ts');
  }).timeout(40000);

  it('Should work on all supported node versions', () => {
    testOnNodeProject('node');
  }).timeout(40000);
});
