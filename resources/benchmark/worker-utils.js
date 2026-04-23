import assert from 'node:assert';
import fs from 'node:fs';
import url from 'node:url';

export function readModulePath() {
  const [modulePath] = process.argv.slice(2);
  assert(modulePath != null);
  return modulePath;
}

export async function loadBenchmark(modulePath) {
  const moduleURL = url.pathToFileURL(modulePath);
  const module = await import(moduleURL.href);
  const benchmark = module.benchmark;
  if (benchmark?.name == null) {
    throw new Error(`Benchmark at ${modulePath} must define a name.`);
  }
  assert(typeof benchmark.measure === 'function');
  return benchmark;
}

export function writeResult(result) {
  fs.writeFileSync(3, JSON.stringify(result));
}

export function runWorker(main) {
  main().catch((error) => {
    const errorMessage =
      error instanceof Error ? (error.stack ?? error.message) : String(error);
    process.stderr.write(errorMessage + '\n');
    process.exitCode = 1;
  });
}
