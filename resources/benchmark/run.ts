import assert from 'node:assert';
import path from 'node:path';
import readline from 'node:readline';

import type { Runtime } from './args.ts';
import { getArguments } from './args.ts';
import {
  maxTime,
  memorySamplesPerBenchmark,
  minTimingSamplesPerBenchmark,
} from './config.ts';
import {
  cyan,
  grey,
  printBenchmarkResults,
  printPairedComparisons,
  red,
} from './output.ts';
import { prepareBenchmarkProjects } from './projects.ts';
import {
  computeStats,
  getPairedComparisons,
  havePairwiseComparisonsStabilized,
} from './statistics.ts';
import type { BenchmarkProject, BenchmarkResult } from './types.ts';
import {
  getBenchmarkName,
  sampleMemoryModule,
  sampleTimingModule,
} from './workers.ts';

export function runBenchmarks(): void {
  // Get the revisions and make things happen!
  const { benchmarks, revisions, runtime } = getArguments(
    process.argv.slice(2),
  );
  const benchmarkProjects = prepareBenchmarkProjects(revisions);

  console.log('');
  console.log('\u2699\uFE0F  Runtime: ' + runtime);
  console.log('');

  for (const benchmark of benchmarks) {
    runBenchmark(benchmark, benchmarkProjects, runtime);
  }
}

// Prepare all revisions and run benchmarks matching a pattern against them.
function runBenchmark(
  benchmark: string,
  benchmarkProjects: ReadonlyArray<BenchmarkProject>,
  runtime: Runtime,
): void {
  const memorySamples: Array<Array<number> | undefined> = [];
  const includesMemory = runtime !== 'bun';

  for (let i = 0; i < benchmarkProjects.length; ++i) {
    const modulePath = path.join(benchmarkProjects[i].projectPath, benchmark);

    if (i === 0) {
      console.log('\u23F1   ' + getBenchmarkName(modulePath, runtime));
      if (includesMemory) {
        writeProgress('  completed ' + cyan(0) + ' memory tests...');
      }
    }

    if (!includesMemory) {
      continue;
    }

    try {
      memorySamples[i] = collectMemorySamples(modulePath, runtime);
      writeProgress('  completed ' + cyan(i + 1) + ' memory tests...');
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.log(
        '  ' + benchmarkProjects[i].revision + ': ' + red(errorMessage),
      );
      return;
    }
  }
  if (includesMemory) {
    endProgressLine();
  } else {
    console.log('  ' + grey('skipping memory benchmarks for bun runtime'));
  }

  let timingSamples: Array<Array<number>>;
  try {
    timingSamples = collectTimingSamples(benchmark, benchmarkProjects, runtime);
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
        includesMemory ? memorySamples[i] : undefined,
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

  printBenchmarkResults(results, includesMemory);
  printPairedComparisons(
    getPairedComparisons(
      benchmarkProjects.map(({ revision }) => revision),
      timingSamples,
    ),
  );
  console.log('');
}

function collectTimingSamples(
  benchmark: string,
  benchmarkProjects: ReadonlyArray<BenchmarkProject>,
  runtime: Runtime,
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
  writeProgress('  completed ' + cyan(0) + ' timing rounds...');
  while (
    (Date.now() - start) / 1e3 < maxTime &&
    (round < minTimingSamplesPerBenchmark ||
      !havePairwiseComparisonsStabilized(timingSamples))
  ) {
    for (const sampleGroup of shuffled(sampleGroups)) {
      try {
        const sample = sampleTimingModule(sampleGroup.modulePath, runtime);

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
    writeProgress('  completed ' + cyan(round) + ' timing rounds...');
  }
  return timingSamples;
}

function writeProgress(message: string): void {
  readline.clearLine(process.stdout, 0);
  readline.cursorTo(process.stdout, 0);
  process.stdout.write(message);
}

function endProgressLine(): void {
  process.stdout.write('\n');
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

export function collectMemorySamples(
  modulePath: string,
  runtime: Runtime,
): Array<number> {
  const samples: Array<number> = [];
  for (
    let sampleIndex = 0;
    sampleIndex < memorySamplesPerBenchmark;
    ++sampleIndex
  ) {
    const sample = sampleMemoryModule(modulePath, runtime);
    assert(sample > 0);
    samples.push(sample);
  }
  return samples;
}
