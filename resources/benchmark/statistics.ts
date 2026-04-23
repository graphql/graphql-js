import assert from 'node:assert';

import {
  NS_PER_SEC,
  targetPairwiseComparisonIntervalHalfWidth,
} from './config.js';
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
  const { mean, marginOfError } = computeMeanStats(timingSamples);

  let meanMemUsed = 0;
  for (const memUsed of memorySamples) {
    meanMemUsed += memUsed;
  }
  meanMemUsed /= memorySamples.length;

  return {
    name,
    memPerOp: Math.floor(meanMemUsed),
    ops: NS_PER_SEC / mean,
    deviation: (marginOfError / mean) * 100 || 0,
    numSamples: timingSamples.length,
  };
}

export function havePairwiseComparisonsStabilized(
  timingSamplesByRevision: ReadonlyArray<ReadonlyArray<number>>,
): boolean {
  for (
    let baselineIndex = 1;
    baselineIndex < timingSamplesByRevision.length;
    ++baselineIndex
  ) {
    const baselineSamples = timingSamplesByRevision[baselineIndex];

    for (
      let revisionIndex = 0;
      revisionIndex < baselineIndex;
      ++revisionIndex
    ) {
      const ciHalfWidthPercent = computeLogRatioRelativeMarginOfError(
        getRoundLogRatios(
          baselineSamples,
          timingSamplesByRevision[revisionIndex],
        ),
      );
      if (
        ciHalfWidthPercent == null ||
        ciHalfWidthPercent > targetPairwiseComparisonIntervalHalfWidth
      ) {
        return false;
      }
    }
  }

  return true;
}

function computeLogRatioRelativeMarginOfError(
  logRatios: ReadonlyArray<number>,
): number | undefined {
  const { marginOfError } = computeMeanStats(logRatios);
  return Math.expm1(marginOfError) * 100;
}

function getRoundLogRatios(
  baselineSamples: ReadonlyArray<number>,
  samples: ReadonlyArray<number>,
): Array<number> {
  const logRatios: Array<number> = [];
  const numSamplePairs = Math.min(baselineSamples.length, samples.length);
  for (let index = 0; index < numSamplePairs; ++index) {
    // Positive values mean the candidate revision is faster than the baseline.
    logRatios.push(Math.log(baselineSamples[index] / samples[index]));
  }
  return logRatios;
}

function computeMeanStats(samples: ReadonlyArray<number>): {
  mean: number;
  marginOfError: number;
} {
  assert(samples.length > 1);

  let mean = 0;
  for (const sample of samples) {
    mean += sample;
  }
  mean /= samples.length;

  let variance = 0;
  for (const sample of samples) {
    variance += (sample - mean) ** 2;
  }
  variance /= samples.length - 1;

  const sd = Math.sqrt(variance);
  const sem = sd / Math.sqrt(samples.length);
  const df = samples.length - 1;
  const critical = tTable[df] ?? tTableInfinity;
  return { mean, marginOfError: sem * critical };
}
