export interface BenchmarkProject {
  revision: string;
  projectPath: string;
}

export interface BenchmarkSample {
  clocked: number;
  memUsed: number;
  involuntaryContextSwitches: number;
}

export interface BenchmarkResult {
  name: string;
  memPerOp: number;
  ops: number;
  deviation: number;
  numSamples: number;
}
