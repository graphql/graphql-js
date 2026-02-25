import { localRepoPath, npm, readPackageJSON } from './utils.js';

const packageName = 'graphql';
const packageJSON = readPackageJSON();
const packageSpec = `${packageName}@${packageJSON.version}`;
const publishTag = packageJSON.publishConfig.tag;
const taggedSpec = `${packageName}@${publishTag}`;

const taggedVersion = getTaggedVersion(publishTag);

if (taggedVersion != null) {
  console.log(
    `${taggedSpec} currently points to ${taggedVersion}; dry-running ${packageJSON.version}.`,
  );
} else {
  console.log(
    `${taggedSpec} does not exist yet; dry-running ${packageJSON.version}.`,
  );
}

console.log(`${packageSpec} is not published yet, building artifacts...`);
npm().run('build:npm');

console.log(`Dry-running publish of ${packageSpec} from npmDist...`);
npm({ cwd: localRepoPath('npmDist') }).publish('--dry-run');

function getTaggedVersion(tag: string): string | undefined {
  const value = npm().view(packageName, `dist-tags.${tag}`).trim();
  return value === '' ? undefined : value;
}
