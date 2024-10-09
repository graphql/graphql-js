import childProcess from 'node:child_process';
import fs from 'node:fs';

const graphqlPackageJSON = JSON.parse(
  fs.readFileSync('./node_modules/graphql/package.json', 'utf-8'),
);

const nodeVersions = graphqlPackageJSON.engines.node
  .replaceAll('^', '')
  .replaceAll('>=', '')
  .split(' || ')
  .sort((a, b) => b.localeCompare(a));

for (const version of nodeVersions) {
  console.log(`Testing on node@${version} ...`);

  const dockerNodePath = `docker run --rm --volume "$PWD":/usr/src/app -w /usr/src/app node:${version}-slim node`;

  childProcess.execSync(`${dockerNodePath} ./index.cjs`, { stdio: 'inherit' });
  childProcess.execSync(
    `${dockerNodePath} --conditions=development ./instanceOfForDevelopment.cjs`,
    { stdio: 'inherit' },
  );

  childProcess.execSync(`${dockerNodePath} ./index.mjs`, { stdio: 'inherit' });
  childProcess.execSync(
    `${dockerNodePath} --conditions=development ./instanceOfForDevelopment.mjs`,
    { stdio: 'inherit' },
  );
}
