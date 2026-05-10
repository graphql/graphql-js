import fs from 'node:fs';
import path from 'node:path';

import { git, localRepoPath, makeTmpDir, npm } from '../utils.ts';

import { LOCAL } from './config.ts';
import type { BenchmarkProject } from './types.ts';

// Build a benchmark-friendly install for each revision.
export function prepareBenchmarkProjects(
  revisionList: ReadonlyArray<string>,
): Array<BenchmarkProject> {
  const { tmpDirPath } = makeTmpDir('graphql-js-benchmark');
  const { tmpDirPath: benchmarkCachePath } = makeTmpDir(
    'graphql-js-benchmark-cache',
    false,
  );

  return revisionList.map((revision) => {
    // Resolve refs like "main" to full SHAs so equivalent revisions reuse setup.
    const hash = revision === LOCAL ? LOCAL : git().revParse(revision);
    const projectPath = tmpDirPath('setup', hash);
    if (fs.existsSync(projectPath)) {
      return { revision, projectPath };
    }

    console.log(`\u{1F373}  Preparing ${revision}...`);
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
            graphql: prepareNPMPackage(hash),
          },
        },
        null,
        2,
      ),
    );
    npm({ cwd: projectPath, quiet: true }).install('--ignore-scripts');

    return { revision, projectPath };
  });

  function prepareNPMPackage(hash: string): string {
    if (hash === LOCAL) {
      const repoDir = localRepoPath();
      const archivePath = tmpDirPath('graphql-local.tgz');
      fs.renameSync(buildNPMArchive(repoDir), archivePath);
      return archivePath;
    }

    const archivePath = benchmarkCachePath(`graphql-${hash}.tgz`);
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
