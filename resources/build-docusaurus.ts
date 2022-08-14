// The whole script is a hack to allow building Docusaurus in ESM project
// https://github.com/facebook/docusaurus/issues/6520
// Should be just: `docusaurus build --out-dir ./websiteDist ./website`

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { localRepoPath, npm, readPackageJSON } from './utils.js';

const tmpDir = path.join(os.tmpdir(), 'graphql-run-docusaurus');
fs.rmSync(tmpDir, { recursive: true, force: true });
fs.mkdirSync(tmpDir);

const packageJSON = readPackageJSON();
delete packageJSON.type;
fs.writeFileSync(tmpDirPath('package.json'), JSON.stringify(packageJSON));

copyToTmpDir('package-lock.json');
copyToTmpDir('tsconfig.json');
copyToTmpDir('src');
copyToTmpDir('website');

npm(['install', 'ci'], { cwd: tmpDir });

const env = {
  ...process.env,
  DOCUSAURUS_GENERATED_FILES_DIR_NAME: tmpDirPath('.docusaurus'),
};
const docusaurusArgs = [
  'build',
  '--out-dir',
  localRepoPath('websiteDist'),
  tmpDirPath('website'),
];
npm(['exec', 'docusaurus', '--', ...docusaurusArgs], { env, cwd: tmpDir });

function copyToTmpDir(relativePath: string) {
  fs.cpSync(localRepoPath(relativePath), tmpDirPath(relativePath), {
    recursive: true,
  });
}

function tmpDirPath(...paths: ReadonlyArray<string>): string {
  return path.join(tmpDir, ...paths);
}
