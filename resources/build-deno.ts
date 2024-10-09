import fs from 'node:fs';
import path from 'node:path';

import ts from 'typescript';

import { changeExtensionInImportPaths } from './change-extension-in-import-paths.js';
import { inlineInvariant } from './inline-invariant.js';
import type { ImportsMap } from './utils.js';
import {
  prettify,
  readPackageJSON,
  readTSConfig,
  showDirStats,
  writeGeneratedFile,
} from './utils.js';

fs.rmSync('./denoDist', { recursive: true, force: true });
fs.mkdirSync('./denoDist');

const tsProgram = ts.createProgram(
  ['src/index.ts', 'src/jsutils/instanceOf.ts'],
  readTSConfig(),
);
for (const sourceFile of tsProgram.getSourceFiles()) {
  if (
    tsProgram.isSourceFileFromExternalLibrary(sourceFile) ||
    tsProgram.isSourceFileDefaultLibrary(sourceFile)
  ) {
    continue;
  }

  const transformed = ts.transform(sourceFile, [
    changeExtensionInImportPaths({ extension: '.ts' }),
    inlineInvariant,
  ]);
  const printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed });
  const newContent = printer.printBundle(
    ts.factory.createBundle(transformed.transformed),
  );

  transformed.dispose();

  const filepath = path.relative('./src', sourceFile.fileName);
  const destPath = path.join('./denoDist', filepath);
  // eslint-disable-next-line no-await-in-loop
  const prettified = await prettify(destPath, newContent);
  writeGeneratedFile(destPath, prettified);
}

fs.copyFileSync('./LICENSE', './denoDist/LICENSE');
fs.copyFileSync('./README.md', './denoDist/README.md');

const imports = getImports();
const importsJsonPath = `./denoDist/imports.json`;
const prettified = await prettify(importsJsonPath, JSON.stringify(imports));
writeGeneratedFile(importsJsonPath, prettified);

showDirStats('./denoDist');

function getImports(): ImportsMap {
  const packageJSON = readPackageJSON();
  const newImports: ImportsMap = {};
  for (const [key, value] of Object.entries(packageJSON.imports)) {
    if (typeof value === 'string') {
      newImports[key] = updateImportPath(value, '.ts');
      continue;
    }
    const denoValue = findDenoValue(value);
    if (denoValue !== undefined) {
      newImports[key] = updateImportPath(denoValue, '.ts');
    }
  }
  return newImports;
}

function updateImportPath(value: string, extension: string) {
  return value.replace(/\/src\//g, '/').replace(/\.ts$/, extension);
}

function findDenoValue(importsMap: ImportsMap): string | undefined {
  for (const [key, value] of Object.entries(importsMap)) {
    if (key === 'deno' || key === 'default') {
      if (typeof value === 'string') {
        return value;
      }
      return findDenoValue(value);
    }
  }
}
