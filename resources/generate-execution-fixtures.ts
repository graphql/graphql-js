import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  createKitchenSinkFixtureSchema,
  incrementalFixtureDocument,
  queryFixtureDocument,
  subscriptionFixtureDocument,
} from '../src/execution/generate/__tests__/generatedFixtureSchemas.ts';
import {
  generateExecution,
  generateSubscription,
} from '../src/execution/generate/index.ts';

const fixtureDir = path.join(
  process.cwd(),
  'reports/generated-execution-fixtures',
);

export const generatedExecutionFixtureDir: string = fixtureDir;

export interface GeneratedExecutionFixtureSource {
  filename: string;
  source: string;
}

export function getGeneratedExecutionFixtureSources(
  outputDir: string = fixtureDir,
): ReadonlyArray<GeneratedExecutionFixtureSource> {
  return [
    {
      filename: 'query.mjs',
      source: generatedFixtureSource(
        generateExecution({
          schema: createKitchenSinkFixtureSchema(),
          document: queryFixtureDocument,
        }),
        outputDir,
      ),
    },
    {
      filename: 'incremental.mjs',
      source: generatedFixtureSource(
        generateExecution({
          schema: createKitchenSinkFixtureSchema(),
          document: incrementalFixtureDocument,
        }),
        outputDir,
      ),
    },
    {
      filename: 'subscription.mjs',
      source: generatedFixtureSource(
        generateSubscription({
          schema: createKitchenSinkFixtureSchema(),
          document: subscriptionFixtureDocument,
        }),
        outputDir,
      ),
    },
  ];
}

export function writeGeneratedExecutionFixtures(
  outputDir: string = fixtureDir,
): string {
  fs.rmSync(outputDir, { force: true, recursive: true });
  fs.mkdirSync(outputDir, { recursive: true });
  for (const fixture of getGeneratedExecutionFixtureSources(outputDir)) {
    fs.writeFileSync(path.join(outputDir, fixture.filename), fixture.source);
  }
  return outputDir;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  writeGeneratedExecutionFixtures();
}

function generatedFixtureSource(
  sourceOrErrors: ReadonlyArray<Error> | string,
  outputDir: string,
): string {
  if (typeof sourceOrErrors !== 'string') {
    throw sourceOrErrors[0];
  }
  const sourceImportPrefix = path
    .relative(outputDir, path.join(process.cwd(), 'src'))
    .replaceAll(path.sep, '/');
  return sourceOrErrors
    .replaceAll("from 'graphql/", `from '${sourceImportPrefix}/`)
    .replaceAll(".js';", ".ts';");
}
