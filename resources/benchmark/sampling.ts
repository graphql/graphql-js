import assert from 'node:assert';

import { maxTime, memorySamplesPerBenchmark, minSamples } from './config.js';
import { sampleMemoryModule, sampleTimingModule } from './workers.js';

export function collectTimingSamples(modulePath: string): Array<number> {
  const samples: Array<number> = [];

  // If time permits, increase sample size to reduce the margin of error.
  const start = Date.now();
  while (samples.length < minSamples || (Date.now() - start) / 1e3 < maxTime) {
    const sample = sampleTimingModule(modulePath);

    assert(sample > 0);
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
