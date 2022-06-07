import * as fs from 'node:fs';
import * as path from 'node:path';

import * as ts from 'typescript';

import { addExtensionToImportPaths } from './add-extension-to-import-paths';
import { inlineInvariant } from './inline-invariant';
import { readdirRecursive, showDirStats, writeGeneratedFile } from './utils';

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
      addExtensionToImportPaths({ extension: '.ts' }),
      inlineInvariant,
    ]);
    const printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed });
    const newContent = printer.printBundle(
      ts.createBundle(transformed.transformed),
    );

    transformed.dispose();

    const destPath = path.join('./denoDist', filepath);
    fs.mkdirSync(path.dirname(destPath), { recursive: true });
    writeGeneratedFile(destPath, newContent);
  }
}

fs.copyFileSync('./LICENSE', './denoDist/LICENSE');
fs.copyFileSync('./README.md', './denoDist/README.md');

showDirStats('./denoDist');
