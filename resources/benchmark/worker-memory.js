import { getHeapStatistics } from 'node:v8';

import {
  loadBenchmark,
  readModulePath,
  runWorker,
  writeResult,
} from './worker-utils.js';

const memoryWarmupIterations = 10;
const memorySampleIterations = 10;

runWorker(async () => {
  const benchmark = await loadBenchmark(readModulePath());
  writeResult(await measureMemoryUsage(benchmark));
});

async function measureMemoryUsage(benchmark) {
  await runIterations(benchmark, memoryWarmupIterations);

  globalThis.gc();
  const memBaseline = getAllocatedBytes();
  await runIterations(benchmark, memorySampleIterations);
  return (getAllocatedBytes() - memBaseline) / memorySampleIterations;
}

async function runIterations(benchmark, iterations) {
  for (let i = 0; i < iterations; ++i) {
    // Each benchmark decides whether the measurement must await async work.
    // eslint-disable-next-line no-await-in-loop
    await benchmark.measure();
  }
}

function getAllocatedBytes() {
  const stats = getHeapStatistics();
  // TODO: Remove the heap-growth fallback once all supported runtimes expose
  // total_allocated_bytes (currently missing on Node.js 22 and 24).
  return stats.total_allocated_bytes ?? stats.used_heap_size;
}
