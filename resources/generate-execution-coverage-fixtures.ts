import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  createRootStringCoverageSchema,
  rootStringCoverageDocument,
} from '../src/execution/generate/__tests__/generatedCoverageFixtures.ts';
import { generateExecution } from '../src/execution/generate/index.ts';

const fixtureDir = path.join(
  process.cwd(),
  'reports/generated-execution-coverage-fixtures',
);

export const generatedExecutionCoverageFixtureDir: string = fixtureDir;

export interface GeneratedExecutionCoverageFixtureSource {
  filename: string;
  source: string;
}

export function getGeneratedExecutionCoverageFixtureSources(
  outputDir: string = fixtureDir,
): ReadonlyArray<GeneratedExecutionCoverageFixtureSource> {
  return [
    {
      filename: 'root-string.mjs',
      source: generatedCoverageFixtureSource(
        generateExecution({
          schema: createRootStringCoverageSchema(),
          document: rootStringCoverageDocument,
        }),
        outputDir,
      ),
    },
  ];
}

export function writeGeneratedExecutionCoverageFixtures(
  outputDir: string = fixtureDir,
): string {
  fs.rmSync(outputDir, { force: true, recursive: true });
  fs.mkdirSync(outputDir, { recursive: true });
  for (const fixture of getGeneratedExecutionCoverageFixtureSources(
    outputDir,
  )) {
    fs.writeFileSync(path.join(outputDir, fixture.filename), fixture.source);
  }
  return outputDir;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  writeGeneratedExecutionCoverageFixtures();
}

function generatedCoverageFixtureSource(
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
