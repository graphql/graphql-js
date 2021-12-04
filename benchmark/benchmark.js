'use strict';

const os = require('os');
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const cp = require('child_process');

const NS_PER_SEC = 1e9;
const LOCAL = 'local';

// The maximum time in seconds a benchmark is allowed to run before finishing.
const maxTime = 5;
// The minimum sample size required to perform statistical analysis.
const minSamples = 5;

// Get the revisions and make things happen!
if (require.main === module) {
  const { benchmarks, revisions } = getArguments(process.argv.slice(2));
  const benchmarkProjects = prepareBenchmarkProjects(revisions);

  runBenchmarks(benchmarks, benchmarkProjects).catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

function localDir(...paths) {
  return path.join(__dirname, '..', ...paths);
}

function exec(command, options = {}) {
  const result = cp.execSync(command, {
    encoding: 'utf-8',
    stdio: ['inherit', 'pipe', 'inherit'],
    ...options,
  });
  return result?.trimEnd();
}

// Build a benchmark-friendly environment for the given revision
// and returns path to its 'dist' directory.
function prepareBenchmarkProjects(revisionList) {
  const tmpDir = path.join(os.tmpdir(), 'graphql-js-benchmark');
  fs.rmSync(tmpDir, { recursive: true, force: true });
  fs.mkdirSync(tmpDir);

  const setupDir = path.join(tmpDir, 'setup');
  fs.mkdirSync(setupDir);

  return revisionList.map((revision) => {
    console.log(`🍳  Preparing ${revision}...`);
    const projectPath = path.join(setupDir, revision);
    fs.rmSync(projectPath, { recursive: true, force: true });
    fs.mkdirSync(projectPath);

    fs.writeFileSync(
      path.join(projectPath, 'package.json'),
      '{ "private": true }',
    );
    exec(
      'npm --quiet install --ignore-scripts ' + prepareNPMPackage(revision),
      { cwd: projectPath },
    );
    exec(`cp -R ${localDir('benchmark')} ${projectPath}`);

    return { revision, projectPath };
  });

  function prepareNPMPackage(revision) {
    if (revision === LOCAL) {
      const repoDir = localDir();
      const archivePath = path.join(tmpDir, 'graphql-local.tgz');
      fs.renameSync(buildNPMArchive(repoDir), archivePath);
      return archivePath;
    }

    // Returns the complete git hash for a given git revision reference.
    const hash = exec(`git rev-parse "${revision}"`);

    const archivePath = path.join(tmpDir, `graphql-${hash}.tgz`);
    if (fs.existsSync(archivePath)) {
      return archivePath;
    }

    const repoDir = path.join(tmpDir, hash);
    fs.rmSync(repoDir, { recursive: true, force: true });
    fs.mkdirSync(repoDir);
    exec(`git archive "${hash}" | tar -xC "${repoDir}"`);
    exec('npm --quiet ci --ignore-scripts', { cwd: repoDir });
    fs.renameSync(buildNPMArchive(repoDir), archivePath);
    fs.rmSync(repoDir, { recursive: true });
    return archivePath;
  }

  function buildNPMArchive(repoDir) {
    exec('npm --quiet run build:npm', { cwd: repoDir });

    const distDir = path.join(repoDir, 'npmDist');
    const archiveName = exec(`npm --quiet pack ${distDir}`, { cwd: repoDir });
    return path.join(repoDir, archiveName);
  }
}

async function collectSamples(modulePath) {
  const samples = [];

  // If time permits, increase sample size to reduce the margin of error.
  const start = Date.now();
  while (samples.length < minSamples || (Date.now() - start) / 1e3 < maxTime) {
    const { clocked, memUsed } = await sampleModule(modulePath);
    assert(clocked > 0);
    assert(memUsed > 0);
    samples.push({ clocked, memUsed });
  }
  return samples;
}

// T-Distribution two-tailed critical values for 95% confidence.
// See http://www.itl.nist.gov/div898/handbook/eda/section3/eda3672.htm.
// prettier-ignore
const tTable = {
  '1':  12.706, '2':  4.303, '3':  3.182, '4':  2.776, '5':  2.571, '6':  2.447,
  '7':  2.365,  '8':  2.306, '9':  2.262, '10': 2.228, '11': 2.201, '12': 2.179,
  '13': 2.16,   '14': 2.145, '15': 2.131, '16': 2.12,  '17': 2.11,  '18': 2.101,
  '19': 2.093,  '20': 2.086, '21': 2.08,  '22': 2.074, '23': 2.069, '24': 2.064,
  '25': 2.06,   '26': 2.056, '27': 2.052, '28': 2.048, '29': 2.045, '30': 2.042,
  infinity: 1.96,
};

// Computes stats on benchmark results.
function computeStats(samples) {
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
  const critical = tTable[df] || tTable.infinity;

  // Compute the margin of error.
  const moe = sem * critical;

  // The relative margin of error (expressed as a percentage of the mean).
  const rme = (moe / mean) * 100 || 0;

  return {
    memPerOp: Math.floor(meanMemUsed),
    ops: NS_PER_SEC / mean,
    deviation: rme,
    numSamples: samples.length,
  };
}

function beautifyBenchmark(results) {
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

  function printBench(bench) {
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

function beautifyBytes(bytes) {
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log2(bytes) / 10);
  return beautifyNumber(bytes / 2 ** (i * 10)) + ' ' + sizes[i];
}

function beautifyNumber(num) {
  return Number(num.toFixed(num > 100 ? 0 : 2)).toLocaleString();
}

function maxBy(array, fn) {
  return Math.max(...array.map(fn));
}

// Prepare all revisions and run benchmarks matching a pattern against them.
async function runBenchmarks(benchmarks, benchmarkProjects) {
  for (const benchmark of benchmarks) {
    const results = [];
    for (let i = 0; i < benchmarkProjects.length; ++i) {
      const { revision, projectPath } = benchmarkProjects[i];
      const modulePath = path.join(projectPath, benchmark);

      if (i === 0) {
        const { name } = await sampleModule(modulePath);
        console.log('⏱   ' + name);
      }

      try {
        const samples = await collectSamples(modulePath);

        results.push({
          name: revision,
          samples,
          ...computeStats(samples),
        });
        process.stdout.write('  ' + cyan(i + 1) + ' tests completed.\u000D');
      } catch (error) {
        console.log('  ' + revision + ': ' + red(String(error)));
      }
    }
    console.log('\n');

    beautifyBenchmark(results);
    console.log('');
  }
}

function getArguments(argv) {
  const revsIndex = argv.indexOf('--revs');
  const revisions = revsIndex === -1 ? [] : argv.slice(revsIndex + 1);
  const benchmarks = revsIndex === -1 ? argv : argv.slice(0, revsIndex);

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
    .readdirSync(localDir('benchmark'), { withFileTypes: true })
    .filter((dirent) => dirent.isFile())
    .map((dirent) => dirent.name)
    .filter((name) => name.endsWith('-benchmark.js'))
    .map((name) => path.join('benchmark', name));
}

function bold(str) {
  return '\u001b[1m' + str + '\u001b[0m';
}

function red(str) {
  return '\u001b[31m' + str + '\u001b[0m';
}

function green(str) {
  return '\u001b[32m' + str + '\u001b[0m';
}

function yellow(str) {
  return '\u001b[33m' + str + '\u001b[0m';
}

function cyan(str) {
  return '\u001b[36m' + str + '\u001b[0m';
}

function grey(str) {
  return '\u001b[90m' + str + '\u001b[0m';
}

function sampleModule(modulePath) {
  const sampleCode = `
    const assert = require('assert');

    assert(global.gc);
    assert(process.send);
    const module = require('${modulePath}');

    clock(7, module.measure); // warm up
    global.gc();
    process.nextTick(() => {
      const memBaseline = process.memoryUsage().heapUsed;
      const clocked = clock(module.count, module.measure);
      process.send({
        name: module.name,
        clocked: clocked / module.count,
        memUsed: (process.memoryUsage().heapUsed - memBaseline) / module.count,
      });
    });

    // Clocks the time taken to execute a test per cycle (secs).
    function clock(count, fn) {
      const start = process.hrtime.bigint();
      for (let i = 0; i < count; ++i) {
        fn();
      }
      return Number(process.hrtime.bigint() - start);
    }
  `;

  return new Promise((resolve, reject) => {
    const child = cp.spawn(
      process.argv[0],
      [
        '--no-concurrent-sweeping',
        '--predictable',
        '--expose-gc',
        '--eval',
        sampleCode,
      ],
      {
        stdio: ['inherit', 'inherit', 'inherit', 'ipc'],
        env: { NODE_ENV: 'production' },
      },
    );

    let message;
    let error;

    child.on('message', (msg) => (message = msg));
    child.on('error', (e) => (error = e));
    child.on('close', () => {
      if (message) {
        return resolve(message);
      }
      reject(error || new Error('Spawn process closed without error'));
    });
  });
}
