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
const fs = require('fs');
const path = require('path');

// Like build:cjs, but includes __tests__ and copies other files.
const BUILD_CMD = 'babel src --copy-files --out-dir dist/';
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
    execSync(`yarn run ${BUILD_CMD}`);
    return LOCAL_DIR('dist');
  } else {
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
    execSync(`cp -R "${LOCAL_DIR()}/src/__fixtures__/" "${dir}/src/__fixtures__/"`);
    execSync(`yarn run ${BUILD_CMD}`, { cwd: dir });

    return path.join(dir, 'dist');
  }
}

function findFiles(cwd, pattern) {
  const out = execSync(`find . -path '${pattern}'`, { cwd, encoding: 'utf8' });
  return out.split('\n').filter(Boolean);
}

// Run a given benchmark test with the provided revisions.
function runBenchmark(benchmark, enviroments) {
  const modules = enviroments.map(({distPath}) =>
    require(path.join(distPath, benchmark)),
  );
  const suite = new Suite(modules[0].name, {
    onStart(event) {
      console.log('⏱️  ' + event.currentTarget.name);
      beautifyBenchmark.reset();
    },
    onCycle(event) {
      beautifyBenchmark.add(event.target);
    },
    onError(event) {
      console.error(event.target.error);
    },
    onComplete() {
      beautifyBenchmark.log();
    },
  });
  for (let i = 0; i < enviroments.length; i++) {
    suite.add(enviroments[i].revision, modules[i].measure);
  }
  suite.run({ async: false });
}

// Prepare all revisions and run benchmarks matching a pattern against them.
function prepareAndRunBenchmarks(benchmarkPatterns, revisions) {
  // Find all benchmark tests to be run.
  let benchmarks = findFiles(LOCAL_DIR('src'), '*/__tests__/*-benchmark.js');
  if (benchmarkPatterns.length !== 0) {
    benchmarks = benchmarks.filter(
      benchmark => benchmarkPatterns.some(
        pattern => path.join('src', benchmark).includes(pattern)
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

  const enviroments = revisions.map(
    revision => ({ revision, distPath: prepareRevision(revision)})
  );
  benchmarks.forEach(benchmark => runBenchmark(benchmark, enviroments));
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
