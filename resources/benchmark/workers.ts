import assert from 'node:assert';
import childProcess from 'node:child_process';

import { localRepoPath } from '../utils.js';

import { memoryBenchmarkNodeFlags } from './config.js';
import type { BenchmarkTimingSample } from './types.js';

export function getBenchmarkName(modulePath: string): string {
  return runWorkerFile(
    localRepoPath('resources/benchmark/worker-name.js'),
    modulePath,
  ) as string;
}

export function sampleTimingModule(modulePath: string): BenchmarkTimingSample {
  return runWorkerFile(
    localRepoPath('resources/benchmark/worker-timing.js'),
    modulePath,
  ) as BenchmarkTimingSample;
}

export function sampleMemoryModule(modulePath: string): number {
  return runWorkerFile(
    localRepoPath('resources/benchmark/worker-memory.js'),
    modulePath,
    memoryBenchmarkNodeFlags,
  ) as number;
}

function runWorkerFile(
  workerPath: string,
  modulePath: string,
  nodeFlags: ReadonlyArray<string> = [],
): unknown {
  const result = childProcess.spawnSync(
    process.execPath,
    [...nodeFlags, workerPath, modulePath],
    {
      stdio: ['inherit', 'inherit', 'inherit', 'pipe'],
      env: { NODE_ENV: 'production' },
    },
  );
  if (result.status !== 0) {
    throw new Error(`Benchmark worker failed with "${result.status}" status.`);
  }

  const resultStr = result.output[3]?.toString();
  assert(resultStr != null);
  return JSON.parse(resultStr);
}
