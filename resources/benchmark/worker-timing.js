import assert from 'node:assert';

import { measure } from 'mitata';

import {
  loadBenchmark,
  readModulePath,
  runWorker,
  writeResult,
} from './worker-utils.js';

runWorker(async () => {
  const benchmark = await loadBenchmark(readModulePath());
  assert(globalThis.gc != null);

  const timingStats = await measure(benchmark.measure);
  writeResult(timingStats.avg);
});
