import fs from 'node:fs';
import path from 'node:path';

import ts from 'typescript';

import { changeExtensionInImportPaths } from './change-extension-in-import-paths.js';
import { inlineInvariant } from './inline-invariant.js';
import { readdirRecursive, showDirStats, writeGeneratedFile } from './utils.js';

fs.rmSync('./denoDist', { recursive: true, force: true });
fs.mkdirSync('./denoDist');

const srcFiles = readdirRecursive('./src', { ignoreDir: /^__.*__$/ });
for (const filepath of srcFiles) {
  if (filepath.endsWith('.ts')) {
    const srcPath = path.join('./src', filepath);

    const sourceFile = ts.createSourceFile(
      srcPath,
      fs.readFileSync(srcPath, 'utf-8'),
      ts.ScriptTarget.Latest,
    );

    const transformed = ts.transform(sourceFile, [
      changeExtensionInImportPaths({ extension: '.ts' }),
      inlineInvariant,
    ]);
    const printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed });
    const newContent = printer.printBundle(
      ts.factory.createBundle(transformed.transformed),
    );

    transformed.dispose();

    const destPath = path.join('./denoDist', filepath);
    writeGeneratedFile(destPath, newContent);
  }
}

fs.copyFileSync('./LICENSE', './denoDist/LICENSE');
fs.copyFileSync('./README.md', './denoDist/README.md');

showDirStats('./denoDist');
