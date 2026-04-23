export const NS_PER_SEC = 1e9;
export const LOCAL = 'local';

// The maximum total time in seconds spent collecting timing samples
// across all revisions for one benchmark.
export const maxTime = 60;
// The minimum sample size to collect for each revision before allowing
// dynamic stopping. maxTime remains a hard upper bound.
export const minTimingSamplesPerBenchmark = 10;
// Stop timing once every pairwise revision comparison has a 95% confidence
// interval this narrow, measured as relative percent error around the mean ratio.
export const targetPairwiseComparisonIntervalHalfWidth = 2;

export const memorySamplesPerBenchmark = 10;

export const pairedGreenThreshold = 0.95;
export const pairedYellowThreshold = 0.8;

export const timingBenchmarkNodeFlags: ReadonlyArray<string> = ['--expose-gc'];

export const memoryBenchmarkNodeFlags: ReadonlyArray<string> = [
  '--predictable',
  '--no-concurrent-sweeping',
  '--no-minor-gc-task',
  '--min-semi-space-size=1280', // 1.25GB
  '--max-semi-space-size=1280', // 1.25GB
];
