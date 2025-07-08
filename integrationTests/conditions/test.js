import childProcess from 'node:child_process';

const nodeTests = [
  // Old node versions, require => CJS
  { version: '20.18.0', moduleSync: false },
  { version: '22.11.0', moduleSync: false },
  // New node versions, module-sync => ESM
  { version: '20.19.0', moduleSync: true },
  { version: '22.12.0', moduleSync: true },
  { version: '24.0.0', moduleSync: true },
];

for (const { version, moduleSync } of nodeTests) {
  console.log(`Testing on node@${version} (moduleSync: ${moduleSync}) ...`);
  childProcess.execSync(
    `docker run --rm --volume "$PWD":/usr/src/app -w /usr/src/app --env MODULE_SYNC=${moduleSync} node:${version}-slim node ./check.mjs`,
    { stdio: 'inherit' },
  );
}

console.log('Testing on bun (moduleSync: true) ...');
childProcess.execSync(
  `docker run --rm --volume "$PWD":/usr/src/app -w /usr/src/app --env MODULE_SYNC=true oven/bun:alpine bun ./check.mjs`,
  { stdio: 'inherit' },
);

console.log('Testing on deno (moduleSync: false) ...');
childProcess.execSync(
  `docker run --rm --volume "$PWD":/usr/src/app -w /usr/src/app --env MODULE_SYNC=false denoland/deno:alpine-2.4.1 deno run --allow-read --allow-env ./check.mjs`,
  { stdio: 'inherit' },
);
