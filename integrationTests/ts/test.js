import childProcess from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const { dependencies } = JSON.parse(fs.readFileSync('./package.json', 'utf-8'));

const tsVersions = Object.keys(dependencies)
  .filter((pkg) => pkg.startsWith('typescript-'))
  .sort((a, b) => b.localeCompare(a));

for (const version of tsVersions) {
  console.log(`Testing on node ${version} ...`);
  childProcess.execSync(tscPath(version), { stdio: 'inherit' });
}

console.log('Testing on deno ...');
childProcess.execSync(
  `docker run --rm --volume "$PWD":/usr/src/app -w /usr/src/app denoland/deno:alpine-2.4.1 deno check`,
  { stdio: 'inherit' },
);

function tscPath(version) {
  return path.join('node_modules', version, 'bin', 'tsc');
}
