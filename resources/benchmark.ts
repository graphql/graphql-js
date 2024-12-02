import assert from 'node:assert';
import cp from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

import { git, localRepoPath, makeTmpDir, npm } from './utils.js';

const NS_PER_SEC = 1e9;
const LOCAL = 'local';

// The maximum time in seconds a benchmark is allowed to run before finishing.
const maxTime = 5;
// The minimum sample size required to perform statistical analysis.
const minSamples = 5;

function runBenchmarks() {
  // Get the revisions and make things happen!
  const { benchmarks, revisions } = getArguments(process.argv.slice(2));
  const benchmarkProjects = prepareBenchmarkProjects(revisions);

  for (const benchmark of benchmarks) {
    runBenchmark(benchmark, benchmarkProjects);
  }
}

interface BenchmarkProject {
  revision: string;
  projectPath: string;
}

// Build a benchmark-friendly environment for the given revision
// and returns path to its 'dist' directory.
function prepareBenchmarkProjects(
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

function collectSamples(modulePath: string) {
  let numOfConsequentlyRejectedSamples = 0;
  const samples = [];

  // If time permits, increase sample size to reduce the margin of error.
  const start = Date.now();
  while (samples.length < minSamples || (Date.now() - start) / 1e3 < maxTime) {
    const sample = sampleModule(modulePath);

    if (sample.involuntaryContextSwitches > 0) {
      numOfConsequentlyRejectedSamples++;
      if (numOfConsequentlyRejectedSamples === 5) {
        console.error(
          yellow(
            '  Five or more consequent runs beings rejected because of context switching.\n' +
              '  Measurement can take a significantly longer time and its correctness can also be impacted.',
          ),
        );
      }
      continue;
    }
    numOfConsequentlyRejectedSamples = 0;

    assert(sample.clocked > 0);
    assert(sample.memUsed > 0);
    samples.push(sample);
  }
  return samples;
}

// T-Distribution two-tailed critical values for 95% confidence.
// See http://www.itl.nist.gov/div898/handbook/eda/section3/eda3672.htm.
// prettier-ignore
const tTable: { [v: number]: number } = {
  1:  12.706, 2:  4.303, 3:  3.182, 4:  2.776, 5:  2.571, 6:  2.447,
  7:  2.365,  8:  2.306, 9:  2.262, 10: 2.228, 11: 2.201, 12: 2.179,
  13: 2.16,   14: 2.145, 15: 2.131, 16: 2.12,  17: 2.11,  18: 2.101,
  19: 2.093,  20: 2.086, 21: 2.08,  22: 2.074, 23: 2.069, 24: 2.064,
  25: 2.06,   26: 2.056, 27: 2.052, 28: 2.048, 29: 2.045, 30: 2.042,
};
const tTableInfinity = 1.96;

interface BenchmarkComputedStats {
  name: string;
  memPerOp: number;
  ops: number;
  deviation: number;
  numSamples: number;
}

// Computes stats on benchmark results.
function computeStats(
  name: string,
  samples: ReadonlyArray<BenchmarkSample>,
): BenchmarkComputedStats {
  assert(samples.length > 1);

  // Compute the sample mean (estimate of the population mean).
  let mean = 0;
  let meanMemUsed = 0;
  for (const { clocked, memUsed } of samples) {
    mean += clocked;
    meanMemUsed += memUsed;
  }
  mean /= samples.length;
  meanMemUsed /= samples.length;

  // Compute the sample variance (estimate of the population variance).
  let variance = 0;
  for (const { clocked } of samples) {
    variance += (clocked - mean) ** 2;
  }
  variance /= samples.length - 1;

  // Compute the sample standard deviation (estimate of the population standard deviation).
  const sd = Math.sqrt(variance);

  // Compute the standard error of the mean (a.k.a. the standard deviation of the sampling distribution of the sample mean).
  const sem = sd / Math.sqrt(samples.length);

  // Compute the degrees of freedom.
  const df = samples.length - 1;

  // Compute the critical value.
  const critical = tTable[df] ?? tTableInfinity;

  // Compute the margin of error.
  const moe = sem * critical;

  // The relative margin of error (expressed as a percentage of the mean).
  const rme = (moe / mean) * 100 || 0;

  return {
    name,
    memPerOp: Math.floor(meanMemUsed),
    ops: NS_PER_SEC / mean,
    deviation: rme,
    numSamples: samples.length,
  };
}

function beautifyBenchmark(results: ReadonlyArray<BenchmarkComputedStats>) {
  const nameMaxLen = maxBy(results, ({ name }) => name.length);
  const opsTop = maxBy(results, ({ ops }) => ops);
  const opsMaxLen = maxBy(results, ({ ops }) => beautifyNumber(ops).length);
  const memPerOpMaxLen = maxBy(
    results,
    ({ memPerOp }) => beautifyBytes(memPerOp).length,
  );

  for (const result of results) {
    printBench(result);
  }

  function printBench(bench: BenchmarkComputedStats) {
    const { name, memPerOp, ops, deviation, numSamples } = bench;
    console.log(
      '  ' +
        nameStr() +
        grey(' x ') +
        opsStr() +
        ' ops/sec ' +
        grey('\xb1') +
        deviationStr() +
        cyan('%') +
        grey(' x ') +
        memPerOpStr() +
        '/op' +
        grey(' (' + numSamples + ' runs sampled)'),
    );

    function nameStr() {
      const nameFmt = name.padEnd(nameMaxLen);
      return ops === opsTop ? green(nameFmt) : nameFmt;
    }

    function opsStr() {
      const percent = ops / opsTop;
      const colorFn = percent > 0.95 ? green : percent > 0.8 ? yellow : red;
      return colorFn(beautifyNumber(ops).padStart(opsMaxLen));
    }

    function deviationStr() {
      const colorFn = deviation > 5 ? red : deviation > 2 ? yellow : green;
      return colorFn(deviation.toFixed(2));
    }

    function memPerOpStr() {
      return beautifyBytes(memPerOp).padStart(memPerOpMaxLen);
    }
  }
}

function beautifyBytes(bytes: number) {
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log2(bytes) / 10);
  return beautifyNumber(bytes / 2 ** (i * 10)) + ' ' + sizes[i];
}

function beautifyNumber(num: number) {
  return Number(num.toFixed(num > 100 ? 0 : 2)).toLocaleString();
}

function maxBy<T>(array: ReadonlyArray<T>, fn: (obj: T) => number) {
  return Math.max(...array.map(fn));
}

// Prepare all revisions and run benchmarks matching a pattern against them.
function runBenchmark(
  benchmark: string,
  benchmarkProjects: ReadonlyArray<BenchmarkProject>,
) {
  const results = [];
  for (let i = 0; i < benchmarkProjects.length; ++i) {
    const { revision, projectPath } = benchmarkProjects[i];
    const modulePath = path.join(projectPath, benchmark);

    if (i === 0) {
      const { name } = sampleModule(modulePath);
      console.log('⏱   ' + name);
    }

    try {
      const samples = collectSamples(modulePath);

      results.push(computeStats(revision, samples));
      process.stdout.write('  ' + cyan(i + 1) + ' tests completed.\u000D');
    } catch (error) {
      console.log('  ' + revision + ': ' + red(error.message));
    }
  }
  console.log('\n');

  beautifyBenchmark(results);
  console.log('');
}

function getArguments(argv: ReadonlyArray<string>) {
  const revsIndex = argv.indexOf('--revs');
  const revisions = revsIndex === -1 ? [] : argv.slice(revsIndex + 1);
  const benchmarks = revsIndex === -1 ? [...argv] : argv.slice(0, revsIndex);

  switch (revisions.length) {
    case 0:
      revisions.unshift('HEAD');
    // fall through
    case 1: {
      revisions.unshift('local');

      const assumeArgv = ['benchmark', ...benchmarks, '--revs', ...revisions];
      console.warn('Assuming you meant: ' + bold(assumeArgv.join(' ')));
      break;
    }
  }

  if (benchmarks.length === 0) {
    benchmarks.push(...findAllBenchmarks());
  }

  return { benchmarks, revisions };
}

function findAllBenchmarks() {
  return fs
    .readdirSync(localRepoPath('benchmark'), { withFileTypes: true })
    .filter((dirent) => dirent.isFile())
    .map((dirent) => dirent.name)
    .filter((name) => name.endsWith('-benchmark.js'))
    .map((name) => path.join('benchmark', name));
}

function bold(str: number | string) {
  return '\u001b[1m' + str + '\u001b[0m';
}

function red(str: number | string) {
  return '\u001b[31m' + str + '\u001b[0m';
}

function green(str: number | string) {
  return '\u001b[32m' + str + '\u001b[0m';
}

function yellow(str: number | string) {
  return '\u001b[33m' + str + '\u001b[0m';
}

function cyan(str: number | string) {
  return '\u001b[36m' + str + '\u001b[0m';
}

function grey(str: number | string) {
  return '\u001b[90m' + str + '\u001b[0m';
}

interface BenchmarkSample {
  name: string;
  clocked: number;
  memUsed: number;
  involuntaryContextSwitches: number;
}

function sampleModule(modulePath: string): BenchmarkSample {
  // To support Windows we need to use URL instead of path
  const moduleURL = url.pathToFileURL(modulePath);

  const sampleCode = `
    import fs from 'node:fs';

    import { benchmark } from '${moduleURL}';

    // warm up, it looks like 7 is a magic number to reliably trigger JIT
    await benchmark.measure();
    await benchmark.measure();
    await benchmark.measure();
    await benchmark.measure();
    await benchmark.measure();
    await benchmark.measure();
    await benchmark.measure();

    const memBaseline = process.memoryUsage().heapUsed;

    const resourcesStart = process.resourceUsage();
    const startTime = process.hrtime.bigint();
    for (let i = 0; i < benchmark.count; ++i) {
      await benchmark.measure();
    }
    const timeDiff = Number(process.hrtime.bigint() - startTime);
    const resourcesEnd = process.resourceUsage();

    const result = {
      name: benchmark.name,
      clocked: timeDiff / benchmark.count,
      memUsed: (process.memoryUsage().heapUsed - memBaseline) / benchmark.count,
      involuntaryContextSwitches:
        resourcesEnd.involuntaryContextSwitches - resourcesStart.involuntaryContextSwitches,
    };
    fs.writeFileSync(3, JSON.stringify(result));
  `;

  const result = cp.spawnSync(
    process.execPath,
    [
      // V8 flags
      '--predictable',
      '--no-concurrent-sweeping',
      '--no-minor-gc-task',
      '--min-semi-space-size=1024', // 1GB
      '--max-semi-space-size=1024', // 1GB
      '--trace-gc', // no gc calls should happen during benchmark, so trace them

      // Node.js flags
      '--input-type=module',
      '--eval',
      sampleCode,
    ],
    {
      stdio: ['inherit', 'inherit', 'inherit', 'pipe'],
      env: { NODE_ENV: 'production' },
    },
  );

  if (result.status !== 0) {
    throw new Error(`Benchmark failed with "${result.status}" status.`);
  }

  const resultStr = result.output[3]?.toString();
  assert(resultStr != null);
  return JSON.parse(resultStr);
}

runBenchmarks();
