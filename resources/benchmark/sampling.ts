import assert from 'node:assert';
import cp from 'node:child_process';
import url from 'node:url';

import { maxTime, minSamples } from './config.js';
import { yellow } from './output.js';
import type { BenchmarkSample } from './types.js';

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

export function sampleModule(modulePath: string): BenchmarkSample {
  // To support Windows we need to use URL instead of path
  const moduleURL = url.pathToFileURL(modulePath);

  const sampleCode = `
    import fs from 'node:fs';

    import { benchmark } from '${moduleURL}';

    // warm up, it looks like 7 is a magic number to reliably trigger JIT
    await benchmark.measure();
    await benchmark.measure();
    await benchmark.measure();
    await benchmark.measure();
    await benchmark.measure();
    await benchmark.measure();
    await benchmark.measure();

    const memBaseline = process.memoryUsage().heapUsed;

    const resourcesStart = process.resourceUsage();
    const startTime = process.hrtime.bigint();
    for (let i = 0; i < benchmark.count; ++i) {
      await benchmark.measure();
    }
    const timeDiff = Number(process.hrtime.bigint() - startTime);
    const resourcesEnd = process.resourceUsage();

    const result = {
      name: benchmark.name,
      clocked: timeDiff / benchmark.count,
      memUsed: (process.memoryUsage().heapUsed - memBaseline) / benchmark.count,
      involuntaryContextSwitches:
        resourcesEnd.involuntaryContextSwitches - resourcesStart.involuntaryContextSwitches,
    };
    fs.writeFileSync(3, JSON.stringify(result));
  `;

  const result = cp.spawnSync(
    process.execPath,
    [
      // V8 flags
      '--predictable',
      '--no-concurrent-sweeping',
      '--no-minor-gc-task',
      '--min-semi-space-size=1280', // 1.25GB
      '--max-semi-space-size=1280', // 1.25GB
      '--trace-gc', // no gc calls should happen during benchmark, so trace them

      // Node.js flags
      '--input-type=module',
      '--eval',
      sampleCode,
    ],
    {
      stdio: ['inherit', 'inherit', 'inherit', 'pipe'],
      env: { NODE_ENV: 'production' },
    },
  );

  if (result.status !== 0) {
    throw new Error(`Benchmark failed with "${result.status}" status.`);
  }

  const resultStr = result.output[3]?.toString();
  assert(resultStr != null);
  return JSON.parse(resultStr);
}
