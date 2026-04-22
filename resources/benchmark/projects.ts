import fs from 'node:fs';
import path from 'node:path';

import { git, localRepoPath, makeTmpDir, npm } from '../utils.js';

import { LOCAL } from './config.js';
import type { BenchmarkProject } from './types.js';

// Build a benchmark-friendly environment for each revision.
export function prepareBenchmarkProjects(
  revisionList: ReadonlyArray<string>,
): Array<BenchmarkProject> {
  const { tmpDirPath } = makeTmpDir('graphql-js-benchmark');

  return revisionList.map((revision) => {
    console.log(`\u{1F373}  Preparing ${revision}...`);
    const projectPath = tmpDirPath('setup', revision);
    fs.rmSync(projectPath, { recursive: true, force: true });
    fs.mkdirSync(projectPath, { recursive: true });

    fs.cpSync(localRepoPath('benchmark'), path.join(projectPath, 'benchmark'), {
      recursive: true,
    });

    fs.writeFileSync(
      path.join(projectPath, 'package.json'),
      JSON.stringify(
        {
          private: true,
          type: 'module',
          dependencies: {
            graphql: prepareNPMPackage(revision),
          },
        },
        null,
        2,
      ),
    );
    npm({ cwd: projectPath, quiet: true }).install('--ignore-scripts');

    return { revision, projectPath };
  });

  function prepareNPMPackage(revision: string): string {
    if (revision === LOCAL) {
      const repoDir = localRepoPath();
      const archivePath = tmpDirPath('graphql-local.tgz');
      fs.renameSync(buildNPMArchive(repoDir), archivePath);
      return archivePath;
    }

    // Returns the complete git hash for a given git revision reference.
    const hash = git().revParse(revision);

    const archivePath = tmpDirPath(`graphql-${hash}.tgz`);
    if (fs.existsSync(archivePath)) {
      return archivePath;
    }

    const repoDir = tmpDirPath(hash);
    fs.rmSync(repoDir, { recursive: true, force: true });
    fs.mkdirSync(repoDir);
    git({ quiet: true }).clone(localRepoPath(), repoDir);
    git({ cwd: repoDir, quiet: true }).checkout('--detach', hash);
    npm({ cwd: repoDir, quiet: true }).ci('--ignore-scripts');
    fs.renameSync(buildNPMArchive(repoDir), archivePath);
    fs.rmSync(repoDir, { recursive: true });
    return archivePath;
  }

  function buildNPMArchive(repoDir: string): string {
    npm({ cwd: repoDir, quiet: true }).run('build:npm');

    const distDir = path.join(repoDir, 'npmDist');
    const archiveName = npm({ cwd: repoDir, quiet: true }).pack(distDir);
    return path.join(repoDir, archiveName);
  }
}
