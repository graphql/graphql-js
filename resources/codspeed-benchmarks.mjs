import { withCodSpeed } from '@codspeed/tinybench-plugin';
import { Bench } from 'tinybench';
import path from 'node:path';
import fs from 'node:fs';


async function loadBenchmarks() {
  const benchmarkDir = path.resolve('file:///var/folders/pb/xgxvrz094n7c09ltjpf6k0xm0000gq/T/graphql-js-benchmark/setup/local');
  const files = fs.readdirSync(benchmarkDir).filter(file => file.endsWith('-benchmark.js'));

  const bench = withCodSpeed(new Bench());

  for (const file of files) {
    const filePath = path.join(benchmarkDir, file);
    // eslint-disable-next-line no-await-in-loop
    const { benchmark } = await import(filePath);
    bench.add(benchmark.name, benchmark.measure);
  }

  await bench.warmup();
  await bench.run();
  console.log(bench.table());
}

console.log('Running benchmarks...');
loadBenchmarks();
