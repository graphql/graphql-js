import childProcess from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const { dependencies } = JSON.parse(fs.readFileSync('./package.json', 'utf-8'));

const tsVersions = Object.keys(dependencies)
  .filter((pkg) => pkg.startsWith('typescript-'))
  .sort((a, b) => b.localeCompare(a));

for (const version of tsVersions) {
  console.log(`Testing on ${version} ...`);
  childProcess.execSync(tscPath(version), { stdio: 'inherit' });
}

function tscPath(version) {
  return path.join('node_modules', version, 'bin', 'tsc');
}
