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

  const memBaseline = process.memoryUsage().heapUsed;
  await runIterations(benchmark, memorySampleIterations);
  return (
    (process.memoryUsage().heapUsed - memBaseline) / memorySampleIterations
  );
}

async function runIterations(benchmark, iterations) {
  for (let i = 0; i < iterations; ++i) {
    // Each benchmark decides whether the measurement must await async work.
    // eslint-disable-next-line no-await-in-loop
    await benchmark.measure();
  }
}
