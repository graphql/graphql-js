import assert from 'node:assert';

import { maxTime, memorySamplesPerBenchmark, minSamples } from './config.js';
import { yellow } from './output.js';
import type { BenchmarkTimingSample } from './types.js';
import { sampleMemoryModule, sampleTimingModule } from './workers.js';

export function collectTimingSamples(
  modulePath: string,
): Array<BenchmarkTimingSample> {
  let numOfConsequentlyRejectedSamples = 0;
  const samples: Array<BenchmarkTimingSample> = [];

  // If time permits, increase sample size to reduce the margin of error.
  const start = Date.now();
  while (samples.length < minSamples || (Date.now() - start) / 1e3 < maxTime) {
    const sample = sampleTimingModule(modulePath);

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
    samples.push(sample);
  }
  return samples;
}

export function collectMemorySamples(modulePath: string): Array<number> {
  const samples: Array<number> = [];
  for (
    let sampleIndex = 0;
    sampleIndex < memorySamplesPerBenchmark;
    ++sampleIndex
  ) {
    const sample = sampleMemoryModule(modulePath);
    assert(sample > 0);
    samples.push(sample);
  }
  return samples;
}
