import fs from 'node:fs';

import { describe, it } from 'mocha';

import { localRepoPath, makeTmpDir, npm, readPackageJSON } from './utils.js';

describe('Integration Tests', () => {
  const { tmpDirPath } = makeTmpDir('graphql-js-integrationTmp');
  fs.cpSync(localRepoPath('integrationTests'), tmpDirPath(), {
    recursive: true,
  });

  npm().run('build:npm');

  const distDir = localRepoPath('npmDist');
  const archiveName = npm({ cwd: tmpDirPath(), quiet: true }).pack(distDir);
  fs.renameSync(tmpDirPath(archiveName), tmpDirPath('graphql.tgz'));

  const esmDistDir = localRepoPath('npmEsmDist');
  const archiveEsmName = npm({ cwd: tmpDirPath(), quiet: true }).pack(
    esmDistDir,
  );
  fs.renameSync(tmpDirPath(archiveEsmName), tmpDirPath('graphql-esm.tgz'));

  npm().run('build:deno');

  function testOnNodeProject(projectName: string) {
    const projectPath = tmpDirPath(projectName);
    const packageJSON = readPackageJSON(projectPath);

    it(packageJSON.description, () => {
      // TODO: figure out a way to run it with --ignore-scripts
      npm({ cwd: projectPath, quiet: true }).install();
      npm({ cwd: projectPath, quiet: true }).run('test');
    }).timeout(120000);
  }

  testOnNodeProject('ts');
  testOnNodeProject('node');
  testOnNodeProject('webpack');
});
