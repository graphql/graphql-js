'use strict';

const fs = require('fs');
const path = require('path');

const ts = require('typescript');

const inlineInvariant = require('./inline-invariant.js');
const addExtensionToImportPaths = require('./add-extension-to-import-paths.js');
const {
  writeGeneratedFile,
  readdirRecursive,
  showDirStats,
} = require('./utils.js');

if (require.main === module) {
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
}
