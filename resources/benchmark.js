/**
 * Copyright (c) 2015-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

const { Suite } = require('benchmark');
const beautifyBenchmark = require('beautify-benchmark');
const { execSync } = require('child_process');
const os = require('os');
const path = require('path');

// Like build:cjs, but includes __tests__ and copies other files.
const BUILD_CMD = 'babel src --optional runtime --copy-files --out-dir dist/';
const LOCAL = 'local';
const LOCAL_DIR = path.join(__dirname, '../');
const TEMP_DIR = os.tmpdir();

// Returns the complete git hash for a given git revision reference.
function hashForRevision(revision) {
  if (revision === LOCAL) {
    return revision;
  }
  const out = execSync(`git rev-parse "${revision}"`, { encoding: 'utf8' });
  const match = /[0-9a-f]{8,40}/.exec(out);
  if (!match) {
    throw new Error(`Bad results for revision ${revision}: ${out}`);
  }
  return match[0];
}

// Returns the temporary directory which hosts the files for this git hash.
function dirForHash(hash) {
  if (hash === LOCAL) {
    return path.join(__dirname, '../');
  }
  return path.join(TEMP_DIR, 'graphql-js-benchmark', hash);
}

// Build a benchmarkable environment for the given revision.
function prepareRevision(revision) {
  console.log(`🍳  Preparing ${revision}...`);
  const hash = hashForRevision(revision);
  const dir = dirForHash(hash);
  if (hash === LOCAL) {
    execSync(`(cd "${dir}" && yarn run ${BUILD_CMD})`);
  } else {
    execSync(`
      if [ ! -d "${dir}" ]; then
        mkdir -p "${dir}" &&
        git archive "${hash}" | tar -xC "${dir}" &&
        (cd "${dir}" && yarn install);
      fi &&
      # Copy in local tests so the same logic applies to each revision.
      for file in $(cd "${LOCAL_DIR}src"; find . -path '*/__tests__/*.js');
        do cp "${LOCAL_DIR}src/$file" "${dir}/src/$file";
      done &&
      (cd "${dir}" && yarn run ${BUILD_CMD})
    `);
  }
}

// Find all benchmark tests to be run.
function findBenchmarks() {
  const out = execSync(
    `(cd ${LOCAL_DIR}src; find . -path '*/__tests__/*-benchmark.js')`,
    { encoding: 'utf8' },
  );
  return out.split('\n').filter(Boolean);
}

// Run a given benchmark test with the provided revisions.
function runBenchmark(benchmark, revisions) {
  const modules = revisions.map(revision =>
    require(path.join(
      dirForHash(hashForRevision(revision)),
      'dist',
      benchmark,
    )),
  );
  const suite = new Suite(modules[0].name, {
    onStart(event) {
      console.log('⏱️  ' + event.currentTarget.name);
    },
    onCycle(event) {
      beautifyBenchmark.add(event.target);
    },
    onComplete() {
      beautifyBenchmark.log();
    },
  });
  for (let i = 0; i < revisions.length; i++) {
    suite.add(revisions[i], modules[i].measure);
  }
  suite.run();
}

// Prepare all revisions and run benchmarks matching a pattern against them.
function prepareAndRunBenchmarks(benchmarkPatterns, revisions) {
  const benchmarks = findBenchmarks().filter(
    benchmark =>
      benchmarkPatterns.length === 0 ||
      benchmarkPatterns.some(pattern => benchmark.indexOf(pattern) !== -1),
  );
  if (benchmarks.length === 0) {
    console.warn(
      'No benchmarks matching: ' +
        `\u001b[1m${benchmarkPatterns.join('\u001b[0m or \u001b[1m')}\u001b[0m`,
    );
    return;
  }
  revisions.forEach(revision => prepareRevision(revision));
  benchmarks.forEach(benchmark => runBenchmark(benchmark, revisions));
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
