import fs from 'node:fs';
import path from 'node:path';

import { localRepoPath } from '../utils.js';

import { LOCAL } from './config.js';
import { bold } from './output.js';

export interface BenchmarkArguments {
  benchmarks: Array<string>;
  revisions: Array<string>;
}

export function getArguments(argv: ReadonlyArray<string>): BenchmarkArguments {
  const revsIndex = argv.indexOf('--revs');
  const revisions = revsIndex === -1 ? [] : argv.slice(revsIndex + 1);
  const benchmarks = revsIndex === -1 ? [...argv] : argv.slice(0, revsIndex);

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

  return { benchmarks, revisions };
}

function findAllBenchmarks(): Array<string> {
  return fs
    .readdirSync(localRepoPath('benchmark'), { withFileTypes: true })
    .filter((dirent) => dirent.isFile())
    .map((dirent) => dirent.name)
    .filter((name) => name.endsWith('-benchmark.js'))
    .map((name) => path.join('benchmark', name));
}
