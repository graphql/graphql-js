import assert from 'node:assert';
import path from 'node:path';

import { getArguments } from './args.js';
import {
  maxTime,
  memorySamplesPerBenchmark,
  minTimingSamplesPerBenchmark,
} from './config.js';
import { cyan, printBenchmarkResults, red } from './output.js';
import { prepareBenchmarkProjects } from './projects.js';
import {
  computeStats,
  havePairwiseComparisonsStabilized,
} from './statistics.js';
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
  const memorySamples: Array<Array<number>> = [];
  for (let i = 0; i < benchmarkProjects.length; ++i) {
    const modulePath = path.join(benchmarkProjects[i].projectPath, benchmark);

    if (i === 0) {
      console.log('\u23F1   ' + getBenchmarkName(modulePath));
    }

    try {
      memorySamples[i] = collectMemorySamples(modulePath);
      process.stdout.write(
        '  completed ' + cyan(i + 1) + ' memory tests...\u000D',
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.log(
        '  ' + benchmarkProjects[i].revision + ': ' + red(errorMessage),
      );
      return;
    }
  }
  process.stdout.write('\n');

  let timingSamples: Array<Array<number>>;
  try {
    timingSamples = collectTimingSamples(benchmark, benchmarkProjects);
  } catch {
    console.log('  ' + red('timing samples collection failed'));
    return;
  }

  const results: Array<BenchmarkResult> = [];
  for (let i = 0; i < benchmarkProjects.length; ++i) {
    let result: BenchmarkResult;
    try {
      result = computeStats(
        benchmarkProjects[i].revision,
        timingSamples[i],
        memorySamples[i],
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.log(
        '  ' + benchmarkProjects[i].revision + ': ' + red(errorMessage),
      );
      return;
    }

    results.push(result);
  }

  console.log('\n');

  printBenchmarkResults(results);
  console.log('');
}

function collectTimingSamples(
  benchmark: string,
  benchmarkProjects: ReadonlyArray<BenchmarkProject>,
): Array<Array<number>> {
  const sampleGroups = benchmarkProjects.map((project) => ({
    revision: project.revision,
    modulePath: path.join(project.projectPath, benchmark),
    samples: new Array<number>(),
  }));
  const timingSamples = sampleGroups.map(({ samples }) => samples);

  // Start new timing rounds only while the total budget remains. Within that
  // budget, collect the minimum sample size before checking whether every
  // pairwise revision comparison has stabilized.
  const start = Date.now();
  let round = 0;
  while (
    (Date.now() - start) / 1e3 < maxTime &&
    (round < minTimingSamplesPerBenchmark ||
      !havePairwiseComparisonsStabilized(timingSamples))
  ) {
    for (const sampleGroup of shuffled(sampleGroups)) {
      try {
        const sample = sampleTimingModule(sampleGroup.modulePath);

        assert(sample > 0);
        sampleGroup.samples.push(sample);
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        console.log('  ' + sampleGroup.revision + ': ' + red(errorMessage));
        throw error;
      }
    }

    ++round;
    process.stdout.write(
      '  completed ' + cyan(round) + ' timing rounds...\u000D',
    );
  }
  return timingSamples;
}

function shuffled<T>(array: ReadonlyArray<T>): Array<T> {
  const shuffledArray = [...array];
  // Fisher-Yates shuffle: walk backward and swap each slot with a random
  // earlier slot, including itself, to produce an unbiased permutation.
  for (let index = shuffledArray.length - 1; index > 0; --index) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [shuffledArray[index], shuffledArray[randomIndex]] = [
      shuffledArray[randomIndex],
      shuffledArray[index],
    ];
  }
  return shuffledArray;
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
