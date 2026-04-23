import {
  loadBenchmark,
  readModulePath,
  runWorker,
  writeResult,
} from './worker-utils.js';

runWorker(async () => {
  const benchmark = await loadBenchmark(readModulePath());
  await warmUp(benchmark);

  const memBaseline = process.memoryUsage().heapUsed;
  for (let i = 0; i < benchmark.count; ++i) {
    // eslint-disable-next-line no-await-in-loop
    await benchmark.measure();
  }
  writeResult((process.memoryUsage().heapUsed - memBaseline) / benchmark.count);
});

async function warmUp(benchmark) {
  // It looks like 7 is a magic number to reliably trigger JIT.
  await benchmark.measure();
  await benchmark.measure();
  await benchmark.measure();
  await benchmark.measure();
  await benchmark.measure();
  await benchmark.measure();
  await benchmark.measure();
}
