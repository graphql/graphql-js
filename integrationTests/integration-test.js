'use strict';

const os = require('os');
const fs = require('fs');
const path = require('path');
const childProcess = require('child_process');

const { describe, it } = require('mocha');

function exec(command, options = {}) {
  const result = childProcess.execSync(command, {
    encoding: 'utf-8',
    ...options,
  });
  return result != null ? result.trimEnd() : result;
}

describe('Integration Tests', () => {
  const tmpDir = path.join(os.tmpdir(), 'graphql-js-integrationTmp');
  fs.rmdirSync(tmpDir, { recursive: true, force: true });
  fs.mkdirSync(tmpDir);

  const distDir = path.resolve('./npmDist');
  const archiveName = exec(`npm --quiet pack ${distDir}`, { cwd: tmpDir });
  fs.renameSync(
    path.join(tmpDir, archiveName),
    path.join(tmpDir, 'graphql.tgz'),
  );

  function testOnNodeProject(projectName) {
    exec(`cp -R ${path.join(__dirname, projectName)} ${tmpDir}`);

    const cwd = path.join(tmpDir, projectName);
    exec('npm --quiet install', { cwd, stdio: 'inherit' });
    exec('npm --quiet test', { cwd, stdio: 'inherit' });
  }

  it('Should compile with all supported TS versions', () => {
    testOnNodeProject('ts');
  }).timeout(40000);

  it('Should compile with Flow', () => {
    testOnNodeProject('flow');
  }).timeout(10000);

  it('Should work on all supported node versions', () => {
    testOnNodeProject('node');
  }).timeout(40000);
});
