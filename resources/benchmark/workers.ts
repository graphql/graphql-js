import assert from 'node:assert';
import childProcess from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { localRepoPath } from '../utils.ts';

import type { Runtime } from './args.ts';
import {
  memoryCommandArgsByRuntime,
  timingCommandArgsByRuntime,
} from './config.ts';

export function getBenchmarkName(modulePath: string, runtime: Runtime): string {
  return runWorkerFile(
    localRepoPath('resources/benchmark/worker-name.js'),
    modulePath,
    timingCommandArgsByRuntime[runtime],
    runtime,
  ) as string;
}

export function sampleTimingModule(
  modulePath: string,
  runtime: Runtime = inferRuntimeFromExecPath(process.execPath),
): number {
  return runWorkerFile(
    localRepoPath('resources/benchmark/worker-timing.js'),
    modulePath,
    timingCommandArgsByRuntime[runtime],
    runtime,
  ) as number;
}

export function sampleMemoryModule(
  modulePath: string,
  runtime: Runtime = inferRuntimeFromExecPath(process.execPath),
): number {
  return runWorkerFile(
    localRepoPath('resources/benchmark/worker-memory.js'),
    modulePath,
    memoryCommandArgsByRuntime[runtime],
    runtime,
  ) as number;
}

function runWorkerFile(
  workerPath: string,
  modulePath: string,
  commandArgs: ReadonlyArray<string>,
  runtime: Runtime,
): unknown {
  const resultPath = fs.mkdtempSync(
    path.join(os.tmpdir(), 'graphql-benchmark-worker-'),
  );
  const resultFilePath = path.join(resultPath, 'result.json');

  const currentRuntime = inferRuntimeFromExecPath(process.execPath);
  const execPath =
    runtime === currentRuntime ? process.execPath : String(runtime);
  const execArgs = [...commandArgs, workerPath, modulePath];

  try {
    const result = childProcess.spawnSync(execPath, execArgs, {
      stdio: 'inherit',
      env: {
        ...process.env,
        BENCHMARK_RESULT_FILE: resultFilePath,
        NODE_ENV: 'production',
      },
    });
    if (result.error != null) {
      throw result.error;
    }
    if (result.signal != null) {
      throw new Error(
        `Benchmark worker terminated by signal "${result.signal}".`,
      );
    }
    if (result.status !== 0) {
      throw new Error(
        `Benchmark worker failed with "${result.status}" status.`,
      );
    }

    const resultStr = fs.readFileSync(resultFilePath, 'utf8');
    assert(resultStr !== '');
    return JSON.parse(resultStr);
  } finally {
    fs.rmSync(resultPath, { recursive: true, force: true });
  }
}

function inferRuntimeFromExecPath(execPath: string): Runtime {
  const executableName = path.basename(execPath).toLowerCase();

  if (executableName === 'deno' || executableName === 'deno.exe') {
    return 'deno';
  }
  if (executableName === 'bun' || executableName === 'bun.exe') {
    return 'bun';
  }
  return 'node';
}
