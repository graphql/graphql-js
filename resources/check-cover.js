/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @noflow
 */

'use strict';

const path = require('path');
const { exec, writeFile, readdirRecursive } = require('./utils');

const fullCoverage = {};

exec('flow start --quiet');
try {
  exec('flow check', { stdio: 'inherit' });

  // TODO: measure coverage for all files.
  // ATM it takes too much time and test files missing types for chai & mocha
  for (const filepath of readdirRecursive('./src', { ignoreDir: /^__.*__$/ })) {
    if (filepath.endsWith('.js')) {
      const fullpath = path.join('src/', filepath);
      fullCoverage[fullpath] = getCoverage(fullpath);
    }
  }
} finally {
  exec('flow stop --quiet');
}

writeFile('./coverage/flow/full-coverage.json', JSON.stringify(fullCoverage));

function getCoverage(filepath) {
  const json = exec(`flow coverage --json ${filepath}`);
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
