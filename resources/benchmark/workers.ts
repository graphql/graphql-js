import assert from 'node:assert';
import childProcess from 'node:child_process';

import { localRepoPath } from '../utils.js';

import { nodeFlags } from './config.js';
import type { BenchmarkSample } from './types.js';

export function getBenchmarkName(modulePath: string): string {
  return runWorkerFile(
    localRepoPath('resources/benchmark/worker-name.js'),
    modulePath,
  ) as string;
}

export function sampleModule(modulePath: string): BenchmarkSample {
  return runWorkerFile(
    localRepoPath('resources/benchmark/worker-timing.js'),
    modulePath,
  ) as BenchmarkSample;
}

function runWorkerFile(workerPath: string, modulePath: string): unknown {
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
