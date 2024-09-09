import fs from 'node:fs';
import path from 'node:path';

import ts from 'typescript';

import { changeExtensionInImportPaths } from './change-extension-in-import-paths.js';
import { inlineInvariant } from './inline-invariant.js';
import {
  prettify,
  readTSConfig,
  showDirStats,
  writeGeneratedFile,
} from './utils.js';

fs.rmSync('./denoDist', { recursive: true, force: true });
fs.mkdirSync('./denoDist');

const tsProgram = ts.createProgram(['src/index.ts'], readTSConfig());
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

showDirStats('./denoDist');
