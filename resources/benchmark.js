/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @noflow
 */

'use strict';

const os = require('os');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { Benchmark } = require('benchmark');

const {
  copyFile,
  writeFile,
  rmdirRecursive,
  mkdirRecursive,
  readdirRecursive,
} = require('./utils');

const LOCAL = 'local';

function LOCAL_DIR(...paths) {
  return path.join(__dirname, '..', ...paths);
}

function TEMP_DIR(...paths) {
  return path.join(os.tmpdir(), 'graphql-js-benchmark', ...paths);
}

// Returns the complete git hash for a given git revision reference.
function hashForRevision(revision) {
  const out = execSync(`git rev-parse "${revision}"`, { encoding: 'utf8' });
  const match = /[0-9a-f]{8,40}/.exec(out);
  if (!match) {
    throw new Error(`Bad results for revision ${revision}: ${out}`);
  }
  return match[0];
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

  const hash = hashForRevision(revision);
  const dir = TEMP_DIR(hash);

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir);
    execSync(`git archive "${hash}" | tar -xC "${dir}"`);
    execSync('yarn install', { cwd: dir });
  }
  for (const file of findFiles(LOCAL_DIR('src'), '*/__tests__/*')) {
    const from = LOCAL_DIR('src', file);
    const to = path.join(dir, 'src', file);
    fs.copyFileSync(from, to);
  }
  execSync(
    `cp -R "${LOCAL_DIR()}/src/__fixtures__/" "${dir}/src/__fixtures__/"`,
  );

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
  const out = execSync(`find . -path '${pattern}'`, { cwd, encoding: 'utf8' });
  return out.split('\n').filter(Boolean);
}

// Run a given benchmark test with the provided revisions.
function runBenchmark(benchmark, environments) {
  let benchmarkName;
  const benches = environments.map(environment => {
    const module = require(path.join(environment.distPath, benchmark));
    benchmarkName = module.name;
    return new Benchmark(environment.revision, module.measure);
  });

  console.log('⏱️   ' + benchmarkName);
  for (let i = 0; i < benches.length; ++i) {
    benches[i].run({ async: false });
    process.stdout.write('  ' + cyan(i + 1) + ' tests completed.\u000D');
  }
  console.log('\n');

  beautifyBenchmark(benches);
  console.log('');
}

function beautifyBenchmark(results) {
  const benches = results.map(result => ({
    name: result.name,
    error: result.error,
    ops: result.hz,
    deviation: result.stats.rme,
    numRuns: result.stats.sample.length,
  }));

  const nameMaxLen = maxBy(benches, ({ name }) => name.length);
  const opsTop = maxBy(benches, ({ ops }) => ops);
  const opsMaxLen = maxBy(benches, ({ ops }) => beautifyNumber(ops).length);

  for (const bench of benches) {
    if (bench.error) {
      console.log('  ' + bench.name + ': ' + red(String(bench.error)));
      continue;
    }
    printBench(bench);
  }

  function printBench(bench) {
    const { name, ops, deviation, numRuns } = bench;
    console.log(
      '  ' +
        nameStr() +
        grey(' x ') +
        opsStr() +
        ' ops/sec ' +
        grey('\xb1') +
        deviationStr() +
        cyan('%') +
        grey(' (' + numRuns + ' runs sampled)'),
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

function beautifyNumber(num) {
  return Number(num.toFixed(num > 100 ? 0 : 2)).toLocaleString();
}

function maxBy(array, fn) {
  return Math.max(...array.map(fn));
}

// Prepare all revisions and run benchmarks matching a pattern against them.
function prepareAndRunBenchmarks(benchmarkPatterns, revisions) {
  // Find all benchmark tests to be run.
  let benchmarks = findFiles(LOCAL_DIR('src'), '*/__tests__/*-benchmark.js');
  if (benchmarkPatterns.length !== 0) {
    benchmarks = benchmarks.filter(benchmark =>
      benchmarkPatterns.some(pattern =>
        path.join('src', benchmark).includes(pattern),
      ),
    );
  }

  if (benchmarks.length === 0) {
    console.warn(
      'No benchmarks matching: ' +
        `\u001b[1m${benchmarkPatterns.join('\u001b[0m or \u001b[1m')}\u001b[0m`,
    );
    return;
  }

  const environments = revisions.map(revision => ({
    revision,
    distPath: prepareRevision(revision),
  }));
  benchmarks.forEach(benchmark => runBenchmark(benchmark, environments));
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
