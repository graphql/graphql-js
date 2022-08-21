import * as childProcess from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { describe, it } from 'mocha';

function npm(args: ReadonlyArray<string>, options = {}): string {
  const result = childProcess.spawnSync('npm', [...args], {
    maxBuffer: 10 * 1024 * 1024, // 10MB
    stdio: ['inherit', 'pipe', 'inherit'],
    encoding: 'utf-8',
    ...options,
  });
  return result.stdout.toString().trimEnd();
}

describe('Integration Tests', () => {
  const tmpDir = path.join(os.tmpdir(), 'graphql-js-integrationTmp');
  fs.rmSync(tmpDir, { recursive: true, force: true });
  fs.mkdirSync(tmpDir);

  const distDir = path.resolve('./npmDist');
  const archiveName = npm(['--quiet', 'pack', distDir], { cwd: tmpDir });
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
      npm(['--quiet', 'install'], { cwd });
      npm(['--quiet', 'test'], { cwd });
    }).timeout(120000);
  }

  testOnNodeProject('ts');
  testOnNodeProject('node');
  testOnNodeProject('webpack');
});
