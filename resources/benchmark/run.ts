import assert from 'node:assert';
import path from 'node:path';

import { getArguments } from './args.js';
import { maxTime, memorySamplesPerBenchmark, minSamples } from './config.js';
import { cyan, printBenchmarkResults, red } from './output.js';
import { prepareBenchmarkProjects } from './projects.js';
import { computeStats } from './statistics.js';
import type { BenchmarkProject, BenchmarkResult } from './types.js';
import {
  getBenchmarkName,
  sampleMemoryModule,
  sampleTimingModule,
} from './workers.js';

export function runBenchmarks(): void {
  // Get the revisions and make things happen!
  const { benchmarks, revisions } = getArguments(process.argv.slice(2));
  const benchmarkProjects = prepareBenchmarkProjects(revisions);

  for (const benchmark of benchmarks) {
    runBenchmark(benchmark, benchmarkProjects);
  }
}

// Prepare all revisions and run benchmarks matching a pattern against them.
function runBenchmark(
  benchmark: string,
  benchmarkProjects: ReadonlyArray<BenchmarkProject>,
): void {
  const results: Array<BenchmarkResult> = [];
  for (let i = 0; i < benchmarkProjects.length; ++i) {
    const { revision, projectPath } = benchmarkProjects[i];
    const modulePath = path.join(projectPath, benchmark);

    if (i === 0) {
      console.log('\u23F1   ' + getBenchmarkName(modulePath));
    }

    try {
      const timingSamples = collectTimingSamples(modulePath);
      const memorySamples = collectMemorySamples(modulePath);

      results.push(computeStats(revision, timingSamples, memorySamples));
      process.stdout.write('  ' + cyan(i + 1) + ' tests completed.\u000D');
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.log('  ' + revision + ': ' + red(errorMessage));
    }
  }
  console.log('\n');

  printBenchmarkResults(results);
  console.log('');
}

export function collectTimingSamples(modulePath: string): Array<number> {
  const samples: Array<number> = [];

  // If time permits, increase sample size to reduce the margin of error.
  const start = Date.now();
  while (samples.length < minSamples || (Date.now() - start) / 1e3 < maxTime) {
    const sample = sampleTimingModule(modulePath);

    assert(sample > 0);
    samples.push(sample);
  }
  return samples;
}

export function collectMemorySamples(modulePath: string): Array<number> {
  const samples: Array<number> = [];
  for (
    let sampleIndex = 0;
    sampleIndex < memorySamplesPerBenchmark;
    ++sampleIndex
  ) {
    const sample = sampleMemoryModule(modulePath);
    assert(sample > 0);
    samples.push(sample);
  }
  return samples;
}
