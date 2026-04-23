export const NS_PER_SEC = 1e9;
export const LOCAL = 'local';

// The maximum time in seconds a benchmark is allowed to run before finishing.
export const maxTime = 5;
// The minimum sample size required to perform statistical analysis.
export const minSamples = 5;

export const memorySamplesPerBenchmark = 10;

export const memoryBenchmarkNodeFlags: ReadonlyArray<string> = [
  '--predictable',
  '--no-concurrent-sweeping',
  '--no-minor-gc-task',
  '--min-semi-space-size=1280', // 1.25GB
  '--max-semi-space-size=1280', // 1.25GB
  '--trace-gc', // no gc calls should happen during benchmark, so trace them
];
