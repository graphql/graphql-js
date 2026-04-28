import fs from 'node:fs';
import path from 'node:path';

import { localRepoPath } from '../utils.js';

import { LOCAL } from './config.js';
import { bold } from './output.js';

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
  return fs
    .readdirSync(localRepoPath('benchmark'), { withFileTypes: true })
    .filter((dirent) => dirent.isFile())
    .map((dirent) => dirent.name)
    .filter((name) => name.endsWith('-benchmark.js'))
    .map((name) => path.join('benchmark', name));
}
