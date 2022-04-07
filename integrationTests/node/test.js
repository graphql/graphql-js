'use strict';

const childProcess = require('child_process');

const graphqlPackageJSON = require('graphql/package.json');

const nodeVersions = graphqlPackageJSON.engines.node
  .split(' || ')
  .map((version) => version.replace(/^(\^|>=)/, ''))
  .sort((a, b) => b.localeCompare(a));

for (const version of nodeVersions) {
  console.log(`Testing on node@${version} ...`);

  childProcess.execSync(
    `docker run --rm --volume "$PWD":/usr/src/app -w /usr/src/app node:${version}-slim node ./index.js`,
    { stdio: 'inherit' },
  );
}
