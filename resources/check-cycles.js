'use strict';

const os = require('os');
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const { exec } = require('./utils');

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'flow-dep-graph'));
const tmpFile = path.join(tmpDir, 'out.dot');

exec(`npx flow graph dep-graph --quiet --strip-root --out ${tmpFile}`);
const dot = fs.readFileSync(tmpFile, 'utf-8');
assert(dot.startsWith('digraph {\n') && dot.endsWith('\n}'));
const dotLines = dot.split('\n').slice(1, -1);

let depGraph = [];
for (const line of dotLines) {
  const [, from, to] = line.trim().match(/^"(.*?)" -> "(.*?)"$/);
  assert(from && to);
  depGraph.push([from, to]);
}

for (const [from, to] of depGraph) {
  if (
    path.basename(to) === 'index.js' &&
    !path.dirname(to).endsWith('__fixtures__') &&
    path.basename(from) !== 'index.js'
  ) {
    console.log(from);
  }
}

let removedEdges;
do {
  removedEdges = 0;
  const fromFiles = new Set();
  const toFiles = new Set();

  for (const [from, to] of depGraph) {
    fromFiles.add(from);
    toFiles.add(to);
  }

  console.log(depGraph.length);
  // eslint-disable-next-line no-loop-func
  depGraph = depGraph.filter(([from, to]) => {
    if (!toFiles.has(from) || !fromFiles.has(to)) {
      ++removedEdges;
      return false;
    }
    return true;
  });
} while (removedEdges > 0);

console.log('digraph {');
for (const [from, to] of depGraph) {
  console.log(`  "${from}" -> "${to}"`);
}
console.log('}');
