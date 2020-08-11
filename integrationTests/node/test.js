'use strict';

const path = require('path');
const childProcess = require('child_process');

const { dependencies } = require('./package.json');

const nodeVersions = Object.keys(dependencies)
  .filter((pkg) => pkg.startsWith('node-'))
  .sort((a, b) => b.localeCompare(a));

for (const version of nodeVersions) {
  console.log(`Testing on ${version} ...`);

  const nodePath = path.join(__dirname, 'node_modules', version, 'bin/node');
  childProcess.execSync(nodePath + ' index.js', { stdio: 'inherit' });
}
