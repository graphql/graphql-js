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

  const resourcesStart = process.resourceUsage();
  const startTime = process.hrtime.bigint();
  for (let i = 0; i < benchmark.count; ++i) {
    // eslint-disable-next-line no-await-in-loop
    await benchmark.measure();
  }
  const timeDiff = Number(process.hrtime.bigint() - startTime);
  const resourcesEnd = process.resourceUsage();

  writeResult({
    clocked: timeDiff / benchmark.count,
    memUsed: (process.memoryUsage().heapUsed - memBaseline) / benchmark.count,
    involuntaryContextSwitches:
      resourcesEnd.involuntaryContextSwitches -
      resourcesStart.involuntaryContextSwitches,
  });
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
