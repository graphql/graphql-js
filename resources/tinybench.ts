import cp from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

import { git, localRepoPath, makeTmpDir, npm } from './utils.js';

const LOCAL = 'local';

function runBenchmarks() {
  // Get the revisions and make things happen!
  const benchmarkProjects = prepareBenchmarkProject([LOCAL]);

  for (const item of benchmarkProjects) {
    const { projectPath } = item;
    const modulePath = path.join(projectPath);
    sampleModule(modulePath);
  }
}

interface BenchmarkProject {
  revision: string;
  projectPath: string;
}

// Build a benchmark-friendly environment for the given revision
// and returns path to its 'dist' directory.
function prepareBenchmarkProject(
  revisionList: ReadonlyArray<string>,
): Array<BenchmarkProject> {
  const { tmpDirPath } = makeTmpDir('graphql-js-benchmark');

  return revisionList.map((revision) => {
    console.log(`🍳  Preparing ${revision}...`);
    const projectPath = tmpDirPath('setup', revision);
    fs.rmSync(projectPath, { recursive: true, force: true });
    fs.mkdirSync(projectPath, { recursive: true });

    fs.cpSync(localRepoPath('benchmark'), path.join(projectPath, 'benchmark'), {
      recursive: true,
    });

    const packageJSON = {
      private: true,
      type: 'module',
      dependencies: {
        graphql: prepareNPMPackage(revision),
        '@codspeed/tinybench-plugin': '^3.1.1',
        'tinybench': '^2.9.0',
      },
    };
    fs.writeFileSync(
      path.join(projectPath, 'package.json'),
      JSON.stringify(packageJSON, null, 2),
    );
    npm({ cwd: projectPath, quiet: true }).install('--ignore-scripts');

    return { revision, projectPath };
  });

  function prepareNPMPackage(revision: string) {
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

  function buildNPMArchive(repoDir: string) {
    npm({ cwd: repoDir, quiet: true }).run('build:npm');

    const distDir = path.join(repoDir, 'npmDist');
    const archiveName = npm({ cwd: repoDir, quiet: true }).pack(distDir);
    return path.join(repoDir, archiveName);
  }
}

interface BenchmarkSample {
  name: string;
  clocked: number;
  memUsed: number;
  involuntaryContextSwitches: number;
}

function sampleModule(modulePath: string): BenchmarkSample {
  // To support Windows we need to use URL instead of path
  //const moduleURL = url.pathToFileURL(modulePath);

  const sampleCode = `
    import { withCodSpeed } from '@codspeed/tinybench-plugin';
    import { Bench } from 'tinybench';
    import path from 'node:path';
    import fs from 'node:fs';
    
    
    async function loadBenchmarks() {
      const benchmarkDir = path.resolve('${modulePath}/benchmark');
      console.log(fs.readdirSync(benchmarkDir));
      const files = fs.readdirSync(benchmarkDir).filter(file => file.endsWith('-benchmark.js'));
    
      const bench = withCodSpeed(new Bench());
    
      for (const file of files) {
        const filePath = path.join(benchmarkDir, file);
        const { benchmark } = await import(filePath);
        bench.add(benchmark.name, benchmark.measure);
        console.log(\`Loaded benchmark: \${benchmark.name}\`);
      }
      
      await bench.warmup();
      await bench.run();
      console.log(bench.table());
    }
    
    console.log('Running benchmarks...');
    loadBenchmarks();
    `;

  const result = cp.spawnSync(
    process.execPath,
    [
      // V8 flags
      /*
      '--predictable',
      '--no-concurrent-sweeping',
      '--no-minor-gc-task',
      '--min-semi-space-size=1024', // 1GB
      '--max-semi-space-size=1024', // 1GB
      '--trace-gc', // no gc calls should happen during benchmark, so trace them*/

      // Node.js flags
      '--input-type=module',
      '--eval',
      sampleCode,
    ],
    {
      stdio: 'pipe',
      env: { NODE_ENV: 'production' },
    },
  );

  if (result.status !== 0) {
    // find out and print why the status is not 0
    console.log(result.stderr.toString());
    throw new Error(`Benchmark failed with "${result.status}" status.`);
  }
  // print all of the output from result
  console.log(result.stdout.toString());
}

runBenchmarks();
