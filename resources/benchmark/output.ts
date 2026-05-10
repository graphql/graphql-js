import { pairedGreenThreshold, pairedYellowThreshold } from './config.ts';
import type { BenchmarkResult, PairedComparison } from './types.ts';

type ColorFn = (value: number | string) => string;

export function printBenchmarkResults(
  results: ReadonlyArray<BenchmarkResult>,
  includesMemory: boolean,
): void {
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

  function printBench(bench: BenchmarkResult): void {
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
        (includesMemory ? grey(' x ') + memPerOpStr() + '/op' : '') +
        grey(' (' + numSamples + ' runs sampled)'),
    );

    function nameStr(): string {
      const nameFmt = name.padEnd(nameMaxLen);
      return ops === opsTop ? green(nameFmt) : nameFmt;
    }

    function opsStr(): string {
      const percent = ops / opsTop;
      const colorFn = percent > 0.95 ? green : percent > 0.8 ? yellow : red;
      return colorFn(beautifyNumber(ops).padStart(opsMaxLen));
    }

    function deviationStr(): string {
      const colorFn = deviation > 5 ? red : deviation > 2 ? yellow : green;
      return colorFn(deviation.toFixed(2));
    }

    function memPerOpStr(): string {
      return beautifyBytes(memPerOp).padStart(memPerOpMaxLen);
    }
  }
}

export function printPairedComparisons(
  pairedComparisons: ReadonlyArray<PairedComparison>,
): void {
  if (pairedComparisons.length === 0) {
    return;
  }

  console.log('  ' + grey('paired round-by-round ops/sec changes:'));

  const leftMaxLen = maxBy(
    pairedComparisons,
    ({ baselineRevision }) => baselineRevision.length,
  );
  const rightMaxLen = maxBy(
    pairedComparisons,
    ({ revision }) => revision.length,
  );
  const speedupMaxLen = maxBy(
    pairedComparisons,
    ({ speedupPercent }) => formatSignedPercent(speedupPercent).length,
  );
  const ciMaxLen = maxBy(
    pairedComparisons,
    (comparison) => formatConfidenceInterval(comparison).length,
  );

  for (const paired of pairedComparisons) {
    const speedupColorFn = pairedSpeedupColorFn(paired);
    console.log(
      '  ' +
        paired.baselineRevision.padEnd(leftMaxLen) +
        ' -> ' +
        paired.revision.padEnd(rightMaxLen) +
        grey(' x ') +
        speedupColorFn(
          formatSignedPercent(paired.speedupPercent).padStart(speedupMaxLen),
        ) +
        ' ops/sec change ' +
        grey(
          '(95% CI ' +
            formatConfidenceInterval(paired).padStart(ciMaxLen) +
            ', ' +
            paired.numPairs +
            ' paired runs)',
        ),
    );
  }
}
function beautifyBytes(bytes: number): string {
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log2(bytes) / 10);
  return beautifyNumber(bytes / 2 ** (i * 10)) + ' ' + sizes[i];
}

function beautifyNumber(num: number): string {
  return Number(num.toFixed(num > 100 ? 0 : 2)).toLocaleString();
}

function formatSignedPercent(num: number): string {
  const rounded = Number(num.toFixed(2));
  const sign = rounded > 0 ? '+' : '';
  return sign + rounded.toFixed(2) + '%';
}

function formatConfidenceInterval({
  ciLowPercent,
  ciHighPercent,
}: PairedComparison): string {
  return (
    formatSignedPercent(ciLowPercent) +
    ' to ' +
    formatSignedPercent(ciHighPercent)
  );
}

function maxBy<T>(array: ReadonlyArray<T>, fn: (obj: T) => number): number {
  return Math.max(...array.map(fn));
}

function pairedSpeedupColorFn({
  speedupPercent,
  ciLowPercent,
  ciHighPercent,
}: PairedComparison): ColorFn {
  if (ciLowPercent <= 0 && ciHighPercent >= 0) {
    return grey;
  }

  const relativeOps = 1 + speedupPercent / 100;
  if (speedupPercent < 0) {
    if (relativeOps > pairedGreenThreshold) {
      return grey;
    }

    if (relativeOps > pairedYellowThreshold) {
      return yellow;
    }

    return red;
  }

  return green;
}

export function bold(str: number | string): string {
  return '\u001b[1m' + str + '\u001b[0m';
}

export function red(str: number | string): string {
  return '\u001b[31m' + str + '\u001b[0m';
}

export function green(str: number | string): string {
  return '\u001b[32m' + str + '\u001b[0m';
}

export function yellow(str: number | string): string {
  return '\u001b[33m' + str + '\u001b[0m';
}

export function cyan(str: number | string): string {
  return '\u001b[36m' + str + '\u001b[0m';
}

export function grey(str: number | string): string {
  return '\u001b[90m' + str + '\u001b[0m';
}
