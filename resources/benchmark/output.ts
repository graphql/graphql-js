import type { BenchmarkResult } from './types.js';

export function printBenchmarkResults(
  results: ReadonlyArray<BenchmarkResult>,
): void {
  const nameMaxLen = maxBy(results, ({ name }) => name.length);
  const opsTop = maxBy(results, ({ ops }) => ops);
  const opsMaxLen = maxBy(results, ({ ops }) => beautifyNumber(ops).length);
  const memPerOpMaxLen = maxBy(
    results,
    ({ memPerOp }) => beautifyBytes(memPerOp).length,
  );

  for (const result of results) {
    printBench(result);
  }

  function printBench(bench: BenchmarkResult): void {
    const { name, memPerOp, ops, deviation, numSamples } = bench;
    console.log(
      '  ' +
        nameStr() +
        grey(' x ') +
        opsStr() +
        ' ops/sec ' +
        grey('\xb1') +
        deviationStr() +
        cyan('%') +
        grey(' x ') +
        memPerOpStr() +
        '/op' +
        grey(' (' + numSamples + ' runs sampled)'),
    );

    function nameStr(): string {
      const nameFmt = name.padEnd(nameMaxLen);
      return ops === opsTop ? green(nameFmt) : nameFmt;
    }

    function opsStr(): string {
      const percent = ops / opsTop;
      const colorFn = percent > 0.95 ? green : percent > 0.8 ? yellow : red;
      return colorFn(beautifyNumber(ops).padStart(opsMaxLen));
    }

    function deviationStr(): string {
      const colorFn = deviation > 5 ? red : deviation > 2 ? yellow : green;
      return colorFn(deviation.toFixed(2));
    }

    function memPerOpStr(): string {
      return beautifyBytes(memPerOp).padStart(memPerOpMaxLen);
    }
  }
}

function beautifyBytes(bytes: number): string {
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log2(bytes) / 10);
  return beautifyNumber(bytes / 2 ** (i * 10)) + ' ' + sizes[i];
}

function beautifyNumber(num: number): string {
  return Number(num.toFixed(num > 100 ? 0 : 2)).toLocaleString();
}

function maxBy<T>(array: ReadonlyArray<T>, fn: (obj: T) => number): number {
  return Math.max(...array.map(fn));
}

export function bold(str: number | string): string {
  return '\u001b[1m' + str + '\u001b[0m';
}

export function red(str: number | string): string {
  return '\u001b[31m' + str + '\u001b[0m';
}

export function green(str: number | string): string {
  return '\u001b[32m' + str + '\u001b[0m';
}

export function yellow(str: number | string): string {
  return '\u001b[33m' + str + '\u001b[0m';
}

export function cyan(str: number | string): string {
  return '\u001b[36m' + str + '\u001b[0m';
}

export function grey(str: number | string): string {
  return '\u001b[90m' + str + '\u001b[0m';
}
