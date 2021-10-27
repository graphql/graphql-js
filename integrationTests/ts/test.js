'use strict';

const path = require('path');
const childProcess = require('child_process');

const { dependencies } = require('./package.json');

const tsVersions = Object.keys(dependencies)
  .filter((pkg) => pkg.startsWith('typescript-'))
  .sort((a, b) => b.localeCompare(a));

for (const version of tsVersions) {
  console.log(`Testing on ${version} ...`);
  childProcess.execSync(tscPath(version), { stdio: 'inherit' });
}

function tscPath(version) {
  return path.join(__dirname, 'node_modules', version, 'bin/tsc');
}
