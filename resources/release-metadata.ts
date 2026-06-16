import {
  getReleaseDistTag,
  git,
  isLatestReleaseVersion,
  isPrereleaseVersion,
  npm,
  readPackageJSON,
  readPackageJSONAtRef,
} from './utils.ts';

interface ReleaseMetadata {
  version: string;
  tag: string;
  distTag: string;
  latest: boolean;
  prerelease: boolean;
  releaseNotes: string;
  packageSpec: string;
  tarballName: string;
  shouldPublish: boolean;
}

try {
  const packageJSON = readPackageJSON();
  const { version } = packageJSON;

  if (typeof version !== 'string' || version === '') {
    throw new Error('package.json is missing a valid "version" field.');
  }

  const tag = `v${version}`;
  const latestVersion = npm().view('graphql', 'dist-tags.latest');
  const distTag = getReleaseDistTag(version, latestVersion);
  const latest = isLatestReleaseVersion(version, latestVersion);
  const prerelease = isPrereleaseVersion(version);
  const releaseCommitSha = findReleaseCommitSha(version);
  const releaseNotes =
    releaseCommitSha == null
      ? ''
      : git().log('-1', '--format=%b', releaseCommitSha).trim();
  const packageSpec = `graphql@${version}`;
  const tarballName = `graphql-${version}.tgz`;

  const versionsJSON = npm().view('graphql', 'versions', '--json');
  const parsedVersions = JSON.parse(versionsJSON) as unknown;
  const versions = Array.isArray(parsedVersions)
    ? parsedVersions
    : [parsedVersions];
  const shouldPublish = !versions.includes(version);
  const releaseMetadata: ReleaseMetadata = {
    version,
    tag,
    distTag,
    latest,
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

function findReleaseCommitSha(version: string): string | null {
  const commitsTouchingPackageJSON = git().revList(
    '--first-parent',
    '--reverse',
    'HEAD',
    '--',
    'package.json',
  );

  let previousVersion: string | null = null;
  for (const commit of commitsTouchingPackageJSON) {
    const versionAtCommit = readPackageJSONAtRef(commit).version;
    if (versionAtCommit === version && previousVersion !== version) {
      return commit;
    }
    previousVersion = versionAtCommit;
  }

  process.stderr.write(
    `Warning: Unable to find commit introducing version ${version} in fetched history. ` +
      `Release notes will be empty for this run.\n`,
  );
  return null;
}
