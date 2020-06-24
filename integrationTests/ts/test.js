// @noflow

'use strict';

const path = require('path');
const childProcess = require('child_process');
const assert = require('assert');
const fs = require('fs');

const glob = require('glob');
const semver = require('semver');

const { dependencies } = require('./package.json');

const tsVersions = Object.keys(dependencies)
  .filter((pkg) => pkg.startsWith('typescript-'))
  .sort((a, b) => b.localeCompare(a));

// To allow omitting certain code from older versions of TypeScript, we have a
// "magic" comment syntax. We precede a block of code with:
//
//     /*! SEMVER_RANGE !*/
//
// replacing SEMVER_RANGE with a semver range spec, such as '>=3.2'; we
// terminate the block of code with:
//
//     /*!!*/
//
// We will only include the code between these comments if the TypeScript
// version being tested satisfies the semver range that was specified. NOTE: We
// currently do not allow nesting of these blocks.
const templates = glob.sync('./*.ts.template').map((filename) => {
  const content = fs.readFileSync(filename, 'utf8');
  const targetFilename = filename.replace(/\.template$/, '');
  assert.notEqual(filename, targetFilename);
  const writeFileSync = (version) => {
    // Captures our magic comment syntax: `/*!(CAPTURE1)!*/(CAPTURE 2)/*!!*/`
    const regex = /\/\*!([^!]+)!\*\/([\s\S]*?)\/\*!!\*\//g;
    const finalContent = content.replace(regex, (_, versionRange, payload) => {
      if (semver.satisfies(version, versionRange)) {
        return payload;
      }
      return '';
    });
    fs.writeFileSync(targetFilename, finalContent);
  };
  return { writeFileSync };
});

for (const version of tsVersions) {
  console.log(`Testing on ${version} ...`);

  for (const template of templates) {
    template.writeFileSync(version);
  }

  const tscPath = path.join(__dirname, 'node_modules', version, 'bin/tsc');
  childProcess.execSync(tscPath, { stdio: 'inherit' });
}
