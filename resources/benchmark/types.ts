export interface BenchmarkProject {
  revision: string;
  projectPath: string;
}

export interface BenchmarkTimingSample {
  clocked: number;
  involuntaryContextSwitches: number;
}

export interface BenchmarkResult {
  name: string;
  memPerOp: number;
  ops: number;
  deviation: number;
  numSamples: number;
}
