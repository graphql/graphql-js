import * as childProcess from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { describe, it } from 'mocha';

function exec(command: string, options = {}) {
  const output = childProcess.execSync(command, {
    encoding: 'utf-8',
    ...options,
  });
  return output?.trimEnd();
}

describe('Integration Tests', () => {
  const tmpDir = path.join(os.tmpdir(), 'graphql-js-integrationTmp');
  fs.rmSync(tmpDir, { recursive: true, force: true });
  fs.mkdirSync(tmpDir);

  const distDir = path.resolve('./npmDist');
  const archiveName = exec(`npm --quiet pack ${distDir}`, { cwd: tmpDir });
  fs.renameSync(
    path.join(tmpDir, archiveName),
    path.join(tmpDir, 'graphql.tgz'),
  );

  function testOnNodeProject(projectName: string) {
    const projectPath = path.join(__dirname, projectName);

    const packageJSONPath = path.join(projectPath, 'package.json');
    const packageJSON = JSON.parse(fs.readFileSync(packageJSONPath, 'utf-8'));

    it(packageJSON.description, () => {
      fs.cpSync(projectPath, path.join(tmpDir, projectName), {
        recursive: true,
      });

      const cwd = path.join(tmpDir, projectName);
      // TODO: figure out a way to run it with --ignore-scripts
      exec('npm --quiet install', { cwd, stdio: 'inherit' });
      exec('npm --quiet test', { cwd, stdio: 'inherit' });
    }).timeout(120000);
  }

  testOnNodeProject('ts');
  testOnNodeProject('node');
  testOnNodeProject('webpack');
});
