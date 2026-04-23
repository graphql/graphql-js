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

export interface PairedComparison {
  baselineRevision: string;
  revision: string;
  speedupPercent: number;
  ciLowPercent: number;
  ciHighPercent: number;
  ciHalfWidthPercent: number;
  numPairs: number;
}
