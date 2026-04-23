export const NS_PER_SEC = 1e9;
export const LOCAL = 'local';

// The maximum total time in seconds spent collecting timing samples
// across all revisions for one benchmark.
export const maxTime = 60;
// The minimum sample size required to perform statistical analysis.
export const minSamples = 5;

export const memorySamplesPerBenchmark = 10;

export const timingBenchmarkNodeFlags: ReadonlyArray<string> = ['--expose-gc'];

export const memoryBenchmarkNodeFlags: ReadonlyArray<string> = [
  '--predictable',
  '--no-concurrent-sweeping',
  '--no-minor-gc-task',
  '--min-semi-space-size=1280', // 1.25GB
  '--max-semi-space-size=1280', // 1.25GB
];
