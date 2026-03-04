'use strict';

const {
  readPackageJSON,
  readPackageJSONAtRef,
  spawnOutput,
} = require('./utils.js');

try {
  const packageJSON = readPackageJSON();
  const { version, publishConfig } = packageJSON;

  if (typeof version !== 'string' || version === '') {
    throw new Error('package.json is missing a valid "version" field.');
  }

  const tag = `v${version}`;
  const distTag = publishConfig?.tag ?? '';
  const prerelease = distTag === 'alpha';
  const releaseCommitSha = findReleaseCommitSha(version);
  const releaseNotes =
    releaseCommitSha == null
      ? ''
      : spawnOutput('git', [
          'log',
          '-1',
          '--format=%b',
          releaseCommitSha,
        ]).trim();
  const packageSpec = `graphql@${version}`;
  const tarballName = `graphql-${version}.tgz`;

  const versionsJSON = spawnOutput('npm', [
    'view',
    'graphql',
    'versions',
    '--json',
  ]);
  const parsedVersions = JSON.parse(versionsJSON);
  const versions = Array.isArray(parsedVersions)
    ? parsedVersions
    : [parsedVersions];
  const shouldPublish = !versions.includes(version);
  const releaseMetadata = {
    version,
    tag,
    distTag,
    prerelease,
    releaseNotes,
    packageSpec,
    tarballName,
    shouldPublish,
  };

  process.stdout.write(JSON.stringify(releaseMetadata) + '\n');
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(message + '\n');
  process.exit(1);
}

function findReleaseCommitSha(version) {
  const commitsTouchingPackageJSONOutput = spawnOutput('git', [
    'rev-list',
    '--first-parent',
    '--reverse',
    'HEAD',
    '--',
    'package.json',
  ]);
  const commitsTouchingPackageJSON =
    commitsTouchingPackageJSONOutput === ''
      ? []
      : commitsTouchingPackageJSONOutput.split('\n');

  let previousVersion = null;
  for (const commit of commitsTouchingPackageJSON) {
    const versionAtCommit = readPackageJSONAtRef(commit).version;
    if (versionAtCommit === version && previousVersion !== version) {
      return commit;
    }
    previousVersion = versionAtCommit;
  }

  process.stderr.write(
    `Warning: Unable to find commit introducing version ${version} in fetched history. ` +
      'Release notes will be empty for this run.\n',
  );
  return null;
}
