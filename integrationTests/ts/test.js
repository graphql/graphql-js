import childProcess from 'child_process';
import fs from 'fs';
import path from 'path';

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
