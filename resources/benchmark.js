// @noflow

'use strict';

const os = require('os');
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const { red, green, yellow, cyan, grey } = require('./colors');
const {
  exec,
  copyFile,
  writeFile,
  rmdirRecursive,
  mkdirRecursive,
  readdirRecursive,
} = require('./utils');

const NS_PER_SEC = 1e9;
const LOCAL = 'local';

const minTime = 0.05 * NS_PER_SEC;
// The maximum time a benchmark is allowed to run before finishing.
const maxTime = 5 * NS_PER_SEC;
// The minimum sample size required to perform statistical analysis.
const minSamples = 15;
// The default number of times to execute a test on a benchmark's first cycle.
const initCount = 10;

function LOCAL_DIR(...paths) {
  return path.join(__dirname, '..', ...paths);
}

function TEMP_DIR(...paths) {
  return path.join(os.tmpdir(), 'graphql-js-benchmark', ...paths);
}

// Build a benchmarkable environment for the given revision
// and returns path to its 'dist' directory.
function prepareRevision(revision) {
  console.log(`🍳  Preparing ${revision}...`);

  if (revision === LOCAL) {
    return babelBuild(LOCAL_DIR());
  }

  if (!fs.existsSync(TEMP_DIR())) {
    fs.mkdirSync(TEMP_DIR());
  }

  // Returns the complete git hash for a given git revision reference.
  const hash = exec(`git rev-parse "${revision}"`);
  const dir = TEMP_DIR(hash);

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir);
    exec(`git archive "${hash}" | tar -xC "${dir}"`);
    exec('yarn install', { cwd: dir });
  }
  for (const file of findFiles(LOCAL_DIR('src'), '*/__tests__/*')) {
    const from = LOCAL_DIR('src', file);
    const to = path.join(dir, 'src', file);
    fs.copyFileSync(from, to);
  }
  exec(`cp -R "${LOCAL_DIR()}/src/__fixtures__/" "${dir}/src/__fixtures__/"`);

  return babelBuild(dir);
}

function babelBuild(dir) {
  const oldCWD = process.cwd();
  process.chdir(dir);

  rmdirRecursive('./benchmarkDist');
  mkdirRecursive('./benchmarkDist');

  const babel = require('@babel/core');
  for (const filepath of readdirRecursive('./src')) {
    const srcPath = path.join('./src', filepath);
    const distPath = path.join('./benchmarkDist', filepath);

    if (filepath.endsWith('.js')) {
      const cjs = babel.transformFileSync(srcPath, { envName: 'cjs' });
      writeFile(distPath, cjs.code);
    } else {
      copyFile(srcPath, distPath);
    }
  }

  process.chdir(oldCWD);
  return path.join(dir, 'benchmarkDist');
}

function findFiles(cwd, pattern) {
  const out = exec(`find . -path '${pattern}'`, { cwd });
  return out.split('\n').filter(Boolean);
}

function collectSamples(fn) {
  clock(initCount, fn); // initial warm up

  // Cycles a benchmark until a run `count` can be established.
  // Resolve time span required to achieve a percent uncertainty of at most 1%.
  // For more information see http://spiff.rit.edu/classes/phys273/uncert/uncert.html.
  let count = initCount;
  let clocked = 0;
  while ((clocked = clock(count, fn)) < minTime) {
    // Calculate how many more iterations it will take to achieve the `minTime`.
    count += Math.ceil(((minTime - clocked) * count) / clocked);
  }

  let elapsed = 0;
  const samples = [];

  // If time permits, increase sample size to reduce the margin of error.
  while (samples.length < minSamples || elapsed < maxTime) {
    clocked = clock(count, fn);
    assert(clocked > 0);

    elapsed += clocked;
    // Compute the seconds per operation.
    samples.push(clocked / count);
  }

  return samples;
}

// Clocks the time taken to execute a test per cycle (secs).
function clock(count, fn) {
  const start = process.hrtime.bigint();
  for (let i = 0; i < count; ++i) {
    fn();
  }
  return Number(process.hrtime.bigint() - start);
}

// T-Distribution two-tailed critical values for 95% confidence.
// See http://www.itl.nist.gov/div898/handbook/eda/section3/eda3672.htm.
const tTable = /* prettier-ignore */ {
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
  for (const x of samples) {
    mean += x;
  }
  mean /= samples.length;

  // Compute the sample variance (estimate of the population variance).
  let variance = 0;
  for (const x of samples) {
    variance += Math.pow(x - mean, 2);
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
    ops: NS_PER_SEC / mean,
    deviation: rme,
  };
}

function beautifyBenchmark(results) {
  const nameMaxLen = maxBy(results, ({ name }) => name.length);
  const opsTop = maxBy(results, ({ ops }) => ops);
  const opsMaxLen = maxBy(results, ({ ops }) => beautifyNumber(ops).length);

  for (const result of results) {
    printBench(result);
  }

  function printBench(bench) {
    const { name, ops, deviation, samples } = bench;
    console.log(
      '  ' +
        nameStr() +
        grey(' x ') +
        opsStr() +
        ' ops/sec ' +
        grey('\xb1') +
        deviationStr() +
        cyan('%') +
        grey(' (' + samples.length + ' runs sampled)'),
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
  }
}

function beautifyNumber(num) {
  return Number(num.toFixed(num > 100 ? 0 : 2)).toLocaleString();
}

function maxBy(array, fn) {
  return Math.max(...array.map(fn));
}

// Prepare all revisions and run benchmarks matching a pattern against them.
function prepareAndRunBenchmarks(benchmarkPatterns, revisions) {
  const environments = revisions.map(revision => ({
    revision,
    distPath: prepareRevision(revision),
  }));

  for (const benchmark of matchBenchmarks(benchmarkPatterns)) {
    const results = [];
    for (let i = 0; i < environments.length; ++i) {
      const environment = environments[i];
      const module = require(path.join(environment.distPath, benchmark));

      if (i) {
        console.log('⏱️   ' + module.name);
      }

      try {
        const samples = collectSamples(module.measure);
        results.push({
          name: environment.revision,
          samples,
          ...computeStats(samples),
        });
        process.stdout.write('  ' + cyan(i + 1) + ' tests completed.\u000D');
      } catch (error) {
        console.log('  ' + module.name + ': ' + red(String(error)));
      }
    }
    console.log('\n');

    beautifyBenchmark(results);
    console.log('');
  }
}

// Find all benchmark tests to be run.
function matchBenchmarks(patterns) {
  let benchmarks = findFiles(LOCAL_DIR('src'), '*/__tests__/*-benchmark.js');
  if (patterns.length > 0) {
    benchmarks = benchmarks.filter(benchmark =>
      patterns.some(pattern => path.join('src', benchmark).includes(pattern)),
    );
  }

  if (benchmarks.length === 0) {
    console.warn(
      'No benchmarks matching: ' +
        `\u001b[1m${patterns.join('\u001b[0m or \u001b[1m')}\u001b[0m`,
    );
  }

  return benchmarks;
}

function getArguments(argv) {
  const revsIdx = argv.indexOf('--revs');
  const revsArgs = revsIdx === -1 ? [] : argv.slice(revsIdx + 1);
  const benchmarkPatterns = revsIdx === -1 ? argv : argv.slice(0, revsIdx);
  let assumeArgs;
  let revisions;
  switch (revsArgs.length) {
    case 0:
      assumeArgs = [...benchmarkPatterns, '--revs', 'local', 'HEAD'];
      revisions = [LOCAL, 'HEAD'];
      break;
    case 1:
      assumeArgs = [...benchmarkPatterns, '--revs', 'local', revsArgs[0]];
      revisions = [LOCAL, revsArgs[0]];
      break;
    default:
      revisions = revsArgs;
      break;
  }
  if (assumeArgs) {
    console.warn(
      `Assuming you meant: \u001b[1mbenchmark ${assumeArgs.join(' ')}\u001b[0m`,
    );
  }
  return { benchmarkPatterns, revisions };
}

// Get the revisions and make things happen!
if (require.main === module) {
  const { benchmarkPatterns, revisions } = getArguments(process.argv.slice(2));
  prepareAndRunBenchmarks(benchmarkPatterns, revisions);
}
