import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { generatedExecutionCoverageFixtureDir } from './generate-execution-coverage-fixtures.ts';

interface V8CoverageRange {
  startOffset: number;
  endOffset: number;
  count: number;
}

interface V8CoverageFunction {
  functionName: string;
  ranges: ReadonlyArray<V8CoverageRange>;
}

interface V8CoverageScript {
  url: string;
  functions: ReadonlyArray<V8CoverageFunction>;
}

interface V8CoverageFile {
  result: ReadonlyArray<V8CoverageScript>;
}

interface CoverageRange {
  functionName: string;
  startOffset: number;
  endOffset: number;
  count: number;
}

const fixtureDir = generatedExecutionCoverageFixtureDir;
const coverageDir = path.join(
  process.cwd(),
  'reports/generated-fixture-coverage-v8',
);
const minimumRangeCoveragePercent = getMinimumRangeCoveragePercent();
const requireCompleteCoverage =
  process.argv.includes('--complete') ||
  process.env.GRAPHQL_JS_GENERATED_COVERAGE_STRICT === '1';

fs.rmSync(fixtureDir, { force: true, recursive: true });
fs.rmSync(coverageDir, { force: true, recursive: true });
fs.mkdirSync(coverageDir, { recursive: true });

const testResult = spawnSync(
  process.execPath,
  [
    '--experimental-strip-types',
    '--throw-deprecation',
    '--test',
    '--experimental-test-isolation=none',
    '--test-concurrency=1',
    '--test-reporter=dot',
    'src/execution/generate/__tests__/generated-coverage-test.ts',
  ],
  {
    cwd: process.cwd(),
    encoding: 'utf8',
    env: {
      ...process.env,
      NODE_V8_COVERAGE: coverageDir,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  },
);

process.stdout.write(testResult.stdout);
process.stderr.write(testResult.stderr);
if (testResult.status !== 0) {
  process.exit(testResult.status ?? 1);
}

const generatedFiles = fs
  .readdirSync(fixtureDir)
  .filter((filename) => filename.endsWith('.mjs'))
  .sort();
if (generatedFiles.length === 0) {
  throw new Error('Expected generated execution modules to be written.');
}

const coverageByPath = readGeneratedCoverage();
if (coverageByPath.size === 0) {
  throw new Error('Expected V8 coverage for generated execution modules.');
}
if (coverageByPath.size !== generatedFiles.length) {
  throw new Error(
    `Expected V8 coverage for ${String(
      generatedFiles.length,
    )} generated execution modules, got ${String(coverageByPath.size)}.`,
  );
}

let coveredRangeCount = 0;
let rangeCount = 0;
const coverageSummaries: Array<{
  filepath: string;
  coveredRangeCount: number;
  rangeCount: number;
}> = [];
const uncoveredRanges: Array<{
  filepath: string;
  range: CoverageRange;
}> = [];

for (const [filepath, ranges] of coverageByPath) {
  const source = fs.readFileSync(filepath, 'utf8');
  const ignoredLines = getIgnoredCoverageLines(source);
  let fileCoveredRangeCount = 0;
  let fileRangeCount = 0;
  for (const range of ranges) {
    if (isIgnoredRange(source, range, ignoredLines)) {
      continue;
    }
    rangeCount++;
    fileRangeCount++;
    if (range.count === 0) {
      uncoveredRanges.push({ filepath, range });
    } else {
      coveredRangeCount++;
      fileCoveredRangeCount++;
    }
  }
  coverageSummaries.push({
    filepath,
    coveredRangeCount: fileCoveredRangeCount,
    rangeCount: fileRangeCount,
  });
}

const coveragePercent =
  rangeCount === 0 ? 100 : (coveredRangeCount / rangeCount) * 100;
console.log('');
console.log(
  `Generated modules covered: ${String(coverageByPath.size)}/${String(
    generatedFiles.length,
  )}`,
);
console.log(
  `Generated range coverage: ${coveragePercent.toFixed(2)}% ` +
    `(${String(coveredRangeCount)}/${String(rangeCount)})`,
);
for (const summary of coverageSummaries) {
  const fileCoveragePercent =
    summary.rangeCount === 0
      ? 100
      : (summary.coveredRangeCount / summary.rangeCount) * 100;
  console.log(
    `  ${path.basename(summary.filepath)}: ${fileCoveragePercent.toFixed(
      2,
    )}% (${String(summary.coveredRangeCount)}/${String(summary.rangeCount)})`,
  );
}

if (uncoveredRanges.length !== 0) {
  console.log('');
  console.log('First uncovered generated ranges:');
  for (const { filepath, range } of uncoveredRanges.slice(0, 20)) {
    const source = fs.readFileSync(filepath, 'utf8');
    console.log(
      `${path.basename(filepath)} ${offsetToLocation(
        source,
        range.startOffset,
      )} ${range.functionName || '<anonymous>'}`,
    );
    console.log(snippet(source, range));
  }
}

if (coveragePercent < minimumRangeCoveragePercent) {
  console.error(
    `Generated range coverage ${coveragePercent.toFixed(
      2,
    )}% does not meet the ${minimumRangeCoveragePercent.toFixed(2)}% floor.`,
  );
  process.exitCode = 1;
}

if (requireCompleteCoverage && uncoveredRanges.length !== 0) {
  console.error('Generated range coverage is not complete.');
  process.exitCode = 1;
}

function getMinimumRangeCoveragePercent(): number {
  const arg = process.argv.find((value) => value.startsWith('--min-ranges='));
  const rawValue =
    arg?.slice('--min-ranges='.length) ??
    process.env.GRAPHQL_JS_GENERATED_COVERAGE_MIN_RANGES ??
    '0';
  const minimum = Number(rawValue);
  if (!Number.isFinite(minimum) || minimum < 0 || minimum > 100) {
    throw new Error(
      `Invalid generated coverage minimum range percentage: ${rawValue}`,
    );
  }
  return minimum;
}

function readGeneratedCoverage(): Map<string, ReadonlyArray<CoverageRange>> {
  const rangesByPath = new Map<string, Map<string, CoverageRange>>();
  const fixtureDirURL = pathToFileURL(`${fixtureDir}${path.sep}`).href;

  for (const filename of fs.readdirSync(coverageDir)) {
    if (!filename.endsWith('.json')) {
      continue;
    }
    const coverageFile = JSON.parse(
      fs.readFileSync(path.join(coverageDir, filename), 'utf8'),
    ) as V8CoverageFile;

    for (const script of coverageFile.result) {
      if (!script.url.startsWith(fixtureDirURL)) {
        continue;
      }
      const filepath = fileURLToPath(script.url);
      const rangesByKey = rangesByPath.get(filepath) ?? new Map();
      rangesByPath.set(filepath, rangesByKey);

      for (const fn of script.functions) {
        for (const range of fn.ranges) {
          const key = [
            fn.functionName,
            String(range.startOffset),
            String(range.endOffset),
          ].join(':');
          const existing = rangesByKey.get(key);
          if (existing === undefined) {
            rangesByKey.set(key, {
              functionName: fn.functionName,
              startOffset: range.startOffset,
              endOffset: range.endOffset,
              count: range.count,
            });
          } else {
            existing.count += range.count;
          }
        }
      }
    }
  }

  return new Map(
    Array.from(rangesByPath, ([filepath, rangesByKey]) => [
      filepath,
      Array.from(rangesByKey.values()),
    ]),
  );
}

function offsetToLocation(source: string, offset: number): string {
  let line = 1;
  let column = 1;
  for (let index = 0; index < offset; index++) {
    if (source.charCodeAt(index) === 10) {
      line++;
      column = 1;
    } else {
      column++;
    }
  }
  return `${String(line)}:${String(column)}`;
}

function getIgnoredCoverageLines(source: string): ReadonlySet<number> {
  const ignoredLines = new Set<number>();
  const lines = source.split('\n');
  for (let index = 0; index < lines.length; index++) {
    const match = /node:coverage ignore next(?:\s+(\d+))?/.exec(lines[index]);
    if (match === null) {
      continue;
    }
    const lineCount = match[1] === undefined ? 1 : Number(match[1]);
    if (!Number.isSafeInteger(lineCount) || lineCount < 1) {
      throw new Error(`Invalid coverage ignore line count: ${match[1]}`);
    }
    for (let offset = 1; offset <= lineCount; offset++) {
      ignoredLines.add(index + 1 + offset);
    }
  }
  return ignoredLines;
}

function isIgnoredRange(
  source: string,
  range: CoverageRange,
  ignoredLines: ReadonlySet<number>,
): boolean {
  return ignoredLines.has(offsetToLine(source, range.startOffset));
}

function offsetToLine(source: string, offset: number): number {
  let line = 1;
  for (let index = 0; index < offset; index++) {
    if (source.charCodeAt(index) === 10) {
      line++;
    }
  }
  return line;
}

function snippet(source: string, range: CoverageRange): string {
  return source
    .slice(range.startOffset, range.endOffset)
    .split('\n')
    .slice(0, 4)
    .join('\n')
    .trim()
    .replaceAll(/\s+/g, ' ')
    .slice(0, 180);
}
