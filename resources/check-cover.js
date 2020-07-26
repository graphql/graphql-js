'use strict';

const fs = require('fs');
const path = require('path');

const {
  exec,
  execAsync,
  rmdirRecursive,
  readdirRecursive,
} = require('./utils');

rmdirRecursive('./coverage/flow');
getFullCoverage()
  .then((fullCoverage) => {
    fs.mkdirSync('./coverage/flow', { recursive: true });
    fs.writeFileSync(
      './coverage/flow/full-coverage.json',
      JSON.stringify(fullCoverage),
    );
  })
  .catch((error) => {
    console.error(error.stack);
    process.exit(1);
  });

async function getFullCoverage() {
  const fullCoverage = {};

  exec('flow start --quiet');
  try {
    exec('flow check', { stdio: 'inherit' });

    // TODO: measure coverage for all files. ATM  missing types for chai & mocha
    const files = readdirRecursive('./src', { ignoreDir: /^__.*__$/ })
      .filter((filepath) => filepath.endsWith('.js'))
      .map((filepath) => path.join('src/', filepath));

    await Promise.all(files.map(getCoverage)).then((coverages) => {
      for (const coverage of coverages) {
        fullCoverage[coverage.path] = coverage;
      }
    });
  } finally {
    exec('flow stop --quiet');
  }
  return fullCoverage;
}

async function getCoverage(filepath) {
  const json = await execAsync(`flow coverage --json ${filepath}`);
  const flowExpressions = JSON.parse(json).expressions;

  const s = {};
  const statementMap = {};
  let id = 0;
  for (const coveredExp of flowExpressions.covered_locs) {
    s[id] = 1;
    statementMap[id] = covertLocation(coveredExp);
    ++id;
  }

  for (const uncoveredExp of flowExpressions.uncovered_locs) {
    s[id] = 0;
    statementMap[id] = covertLocation(uncoveredExp);
    ++id;
  }

  // istanbul format, see:
  // https://github.com/gotwarlost/istanbul/blob/master/coverage.json.md
  return {
    path: filepath,
    b: {},
    branchMap: {},
    f: {},
    fnMap: {},
    s,
    statementMap,
  };
}

function covertLocation(flow) {
  return {
    start: { line: flow.start.line, column: flow.start.column - 1 },
    end: { line: flow.end.line, column: flow.end.column - 1 },
  };
}
