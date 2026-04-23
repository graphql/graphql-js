import {
  loadBenchmark,
  readModulePath,
  runWorker,
  writeResult,
} from './worker-utils.js';

runWorker(async () => {
  const benchmark = await loadBenchmark(readModulePath());
  writeResult(benchmark.name);
});
