import fs from 'node:fs';
import path from 'node:path';

import { localRepoPath } from '../utils.ts';

import { LOCAL } from './config.ts';
import { bold } from './output.ts';

export type Runtime = 'node' | 'deno' | 'bun';

export interface BenchmarkArguments {
  benchmarks: Array<string>;
  revisions: Array<string>;
  runtime: Runtime;
}

export function getArguments(argv: ReadonlyArray<string>): BenchmarkArguments {
  const runtimeIndex = argv.indexOf('--runtime');
  const runtimeValue =
    runtimeIndex === -1
      ? inferRuntimeFromExecPath(process.execPath)
      : argv[runtimeIndex + 1];
  if (
    runtimeValue !== 'node' &&
    runtimeValue !== 'deno' &&
    runtimeValue !== 'bun'
  ) {
    throw new Error(
      `Invalid --runtime value: "${runtimeValue}". Must be "node", "deno", or "bun".`,
    );
  }
  const runtime: Runtime = runtimeValue;

  const filteredArgv =
    runtimeIndex === -1
      ? [...argv]
      : [...argv.slice(0, runtimeIndex), ...argv.slice(runtimeIndex + 2)];

  const revsIndex = filteredArgv.indexOf('--revs');
  const revisions = revsIndex === -1 ? [] : filteredArgv.slice(revsIndex + 1);
  const benchmarks =
    revsIndex === -1 ? [...filteredArgv] : filteredArgv.slice(0, revsIndex);

  switch (revisions.length) {
    case 0:
      revisions.unshift('HEAD');
    // fall through
    case 1: {
      revisions.unshift(LOCAL);

      const assumeArgv = ['benchmark', ...benchmarks, '--revs', ...revisions];
      console.warn('Assuming you meant: ' + bold(assumeArgv.join(' ')));
      break;
    }
  }

  if (benchmarks.length === 0) {
    benchmarks.push(...findAllBenchmarks());
  }

  return { benchmarks, revisions, runtime };
}

function inferRuntimeFromExecPath(execPath: string): Runtime {
  const executableName = path.basename(execPath).toLowerCase();

  if (executableName.startsWith('deno')) {
    return 'deno';
  }
  if (executableName.startsWith('bun')) {
    return 'bun';
  }
  return 'node';
}

function findAllBenchmarks(): Array<string> {
  const benchmarkDir = localRepoPath('benchmark');
  const benchmarks: Array<string> = [];
  collectBenchmarks(benchmarkDir, benchmarks);
  return benchmarks.sort();
}

function collectBenchmarks(
  directoryPath: string,
  benchmarks: Array<string>,
): void {
  for (const dirent of fs.readdirSync(directoryPath, { withFileTypes: true })) {
    const absolutePath = path.join(directoryPath, dirent.name);
    if (dirent.isDirectory()) {
      collectBenchmarks(absolutePath, benchmarks);
    } else if (dirent.isFile() && dirent.name.endsWith('-benchmark.js')) {
      benchmarks.push(path.relative(localRepoPath(), absolutePath));
    }
  }
}
