import fs from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import url from 'node:url';

export async function createGeneratedExecution(
  execution,
  staticArgs,
  factoryArgs,
  importMetaURL,
  name,
) {
  if (typeof execution.generateExecution !== 'function') {
    return undefined;
  }

  const source = execution.generateExecution(staticArgs);
  if (Array.isArray(source)) {
    throw source[0];
  }

  const require = createRequire(importMetaURL);
  const executionPath = require.resolve('graphql/execution/index.js');
  const packageDir = path.dirname(path.dirname(executionPath));
  const projectDir = path.dirname(path.dirname(packageDir));
  const generatedDir = path.join(
    os.tmpdir(),
    'graphql-js-generated',
    'benchmarks',
    path.basename(projectDir),
  );
  fs.mkdirSync(generatedDir, { recursive: true });
  linkGraphQLPackage(generatedDir, packageDir);

  const generatedPath = path.join(generatedDir, `${name}.mjs`);
  fs.writeFileSync(generatedPath, source);

  const generatedModule = await import(
    url.pathToFileURL(generatedPath).href + `?v=${Date.now()}`
  );
  const generated = generatedModule.createCompiledExecution(factoryArgs);
  if (Array.isArray(generated)) {
    throw generated[0];
  }
  return generated;
}

function linkGraphQLPackage(generatedDir, packageDir) {
  const nodeModulesDir = path.join(generatedDir, 'node_modules');
  const linkPath = path.join(nodeModulesDir, 'graphql');
  fs.mkdirSync(nodeModulesDir, { recursive: true });

  try {
    if (fs.realpathSync(linkPath) === fs.realpathSync(packageDir)) {
      return;
    }
  } catch {
    // Create or replace below.
  }

  fs.rmSync(linkPath, { force: true, recursive: true });
  fs.symlinkSync(packageDir, linkPath, 'dir');
}
