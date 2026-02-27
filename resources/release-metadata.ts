import { npm, readPackageJSON } from './utils.js';

try {
  const packageJSON = readPackageJSON();
  const { version } = packageJSON;

  if (typeof version !== 'string' || version === '') {
    throw new Error('package.json is missing a valid "version" field.');
  }

  const tag = `v${version}`;
  const packageSpec = `graphql@${version}`;
  const tarballName = `graphql-${version}.tgz`;

  const versionsJSON = npm().view('graphql', 'versions', '--json');
  const parsedVersions = JSON.parse(versionsJSON) as unknown;
  const versions = Array.isArray(parsedVersions)
    ? parsedVersions
    : [parsedVersions];
  const shouldPublish = versions.includes(version) ? 'false' : 'true';

  process.stdout.write(`version=${version}\n`);
  process.stdout.write(`tag=${tag}\n`);
  process.stdout.write(`package_spec=${packageSpec}\n`);
  process.stdout.write(`tarball_name=${tarballName}\n`);
  process.stdout.write(`should_publish=${shouldPublish}\n`);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(message + '\n');
  process.exit(1);
}
