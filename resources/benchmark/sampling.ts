import assert from 'node:assert';

import { maxTime, minSamples } from './config.js';
import { yellow } from './output.js';
import type { BenchmarkSample } from './types.js';
import { sampleModule } from './workers.js';

export function collectSamples(modulePath: string): Array<BenchmarkSample> {
  let numOfConsequentlyRejectedSamples = 0;
  const samples: Array<BenchmarkSample> = [];

  // If time permits, increase sample size to reduce the margin of error.
  const start = Date.now();
  while (samples.length < minSamples || (Date.now() - start) / 1e3 < maxTime) {
    const sample = sampleModule(modulePath);

    if (sample.involuntaryContextSwitches > 0) {
      numOfConsequentlyRejectedSamples++;
      if (numOfConsequentlyRejectedSamples === 5) {
        console.error(
          yellow(
            '  Five or more consequent runs beings rejected because of context switching.\n' +
              '  Measurement can take a significantly longer time and its correctness can also be impacted.',
          ),
        );
      }
      continue;
    }
    numOfConsequentlyRejectedSamples = 0;

    assert(sample.clocked > 0);
    assert(sample.memUsed > 0);
    samples.push(sample);
  }
  return samples;
}
