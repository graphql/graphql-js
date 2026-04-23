import assert from 'node:assert';

import { NS_PER_SEC } from './config.js';
import type { BenchmarkResult } from './types.js';

// T-Distribution two-tailed critical values for 95% confidence.
// See http://www.itl.nist.gov/div898/handbook/eda/section3/eda3672.htm.
// prettier-ignore
const tTable: { [v: number]: number } = {
  1:  12.706, 2:  4.303, 3:  3.182, 4:  2.776, 5:  2.571, 6:  2.447,
  7:  2.365,  8:  2.306, 9:  2.262, 10: 2.228, 11: 2.201, 12: 2.179,
  13: 2.16,   14: 2.145, 15: 2.131, 16: 2.12,  17: 2.11,  18: 2.101,
  19: 2.093,  20: 2.086, 21: 2.08,  22: 2.074, 23: 2.069, 24: 2.064,
  25: 2.06,   26: 2.056, 27: 2.052, 28: 2.048, 29: 2.045, 30: 2.042,
};
const tTableInfinity = 1.96;

// Computes stats on benchmark results.
export function computeStats(
  name: string,
  timingSamples: ReadonlyArray<number>,
  memorySamples: ReadonlyArray<number>,
): BenchmarkResult {
  assert(timingSamples.length > 1);
  assert(memorySamples.length > 0);

  // Compute the sample mean (estimate of the population mean).
  let mean = 0;
  for (const clocked of timingSamples) {
    mean += clocked;
  }
  mean /= timingSamples.length;

  let meanMemUsed = 0;
  for (const memUsed of memorySamples) {
    meanMemUsed += memUsed;
  }
  meanMemUsed /= memorySamples.length;

  // Compute the sample variance (estimate of the population variance).
  let variance = 0;
  for (const clocked of timingSamples) {
    variance += (clocked - mean) ** 2;
  }
  variance /= timingSamples.length - 1;

  // Compute the sample standard deviation (estimate of the population standard deviation).
  const sd = Math.sqrt(variance);

  // Compute the standard error of the mean (a.k.a. the standard deviation of the sampling distribution of the sample mean).
  const sem = sd / Math.sqrt(timingSamples.length);

  // Compute the degrees of freedom.
  const df = timingSamples.length - 1;

  // Compute the critical value.
  const critical = tTable[df] ?? tTableInfinity;

  // Compute the margin of error.
  const moe = sem * critical;

  // The relative margin of error (expressed as a percentage of the mean).
  const rme = (moe / mean) * 100 || 0;

  return {
    name,
    memPerOp: Math.floor(meanMemUsed),
    ops: NS_PER_SEC / mean,
    deviation: rme,
    numSamples: timingSamples.length,
  };
}
