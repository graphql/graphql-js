import fs from 'node:fs';

import { describe, it } from 'mocha';

import { localRepoPath, makeTmpDir, npm, readPackageJSON } from './utils.js';

const BUN_VERSION = '1.2.18';
const DENO_VERSION = '2.4.1';

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
      npm({
        cwd: projectPath,
        quiet: true,
        env: {
          ...process.env,
          BUN_VERSION,
          DENO_VERSION,
        },
      }).run('test');
    }).timeout(120000);
  }

  testOnNodeProject('ts');
  testOnNodeProject('node');
  testOnNodeProject('webpack');

  // Conditional export tests
  testOnNodeProject('conditions');

  // Development mode tests
  testOnNodeProject('dev-node');
  testOnNodeProject('dev-deno');
  testOnNodeProject('dev-bun');
  testOnNodeProject('dev-webpack');
  testOnNodeProject('dev-rspack');
  testOnNodeProject('dev-rollup');
  testOnNodeProject('dev-esbuild');
  testOnNodeProject('dev-swc');
  testOnNodeProject('dev-jest');
  testOnNodeProject('dev-vitest');

  // Production mode tests
  testOnNodeProject('prod-node');
  testOnNodeProject('prod-deno');
  testOnNodeProject('prod-bun');
  testOnNodeProject('prod-webpack');
  testOnNodeProject('prod-rspack');
  testOnNodeProject('prod-rollup');
  testOnNodeProject('prod-esbuild');
  testOnNodeProject('prod-swc');
});
