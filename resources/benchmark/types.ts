export interface BenchmarkProject {
  revision: string;
  projectPath: string;
}

export interface BenchmarkResult {
  name: string;
  memPerOp: number;
  ops: number;
  deviation: number;
  numSamples: number;
}
