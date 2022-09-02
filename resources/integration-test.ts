import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { describe, it } from 'mocha';

import { localRepoPath, npm } from './utils.js';

describe('Integration Tests', () => {
  const tmpDir = path.join(os.tmpdir(), 'graphql-js-integrationTmp');
  fs.rmSync(tmpDir, { recursive: true, force: true });
  fs.mkdirSync(tmpDir);

  const distDir = localRepoPath('npmDist');
  const archiveName = npm(['--quiet', 'pack', distDir], { cwd: tmpDir });
  fs.renameSync(
    path.join(tmpDir, archiveName),
    path.join(tmpDir, 'graphql.tgz'),
  );

  function testOnNodeProject(projectName: string) {
    const projectPath = localRepoPath('integrationTests', projectName);

    const packageJSONPath = path.join(projectPath, 'package.json');
    const packageJSON = JSON.parse(fs.readFileSync(packageJSONPath, 'utf-8'));

    it(packageJSON.description, () => {
      fs.cpSync(projectPath, path.join(tmpDir, projectName), {
        recursive: true,
      });

      const cwd = path.join(tmpDir, projectName);
      // TODO: figure out a way to run it with --ignore-scripts
      npm(['--quiet', 'install'], { cwd });
      npm(['--quiet', 'test'], { cwd });
    }).timeout(120000);
  }

  testOnNodeProject('ts');
  testOnNodeProject('node');
  testOnNodeProject('webpack');
});
