import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

import ts from 'typescript';

import { changeExtensionInImportPaths } from './change-extension-in-import-paths.js';
import { inlineInvariant } from './inline-invariant.js';
import {
  buildESMDevModeStub,
  prettify,
  readPackageJSON,
  readTSConfig,
  showDirStats,
  writeGeneratedFile,
} from './utils.js';

console.log('\n./denoDist');
await buildPackage('./denoDist');
showDirStats('./denoDist');

async function buildPackage(outDir: string): Promise<void> {
  const devDir = path.join(outDir, '__dev__');
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir);
  fs.mkdirSync(devDir);

  const emittedTSFiles = await emitTSFiles(outDir);
  emitDevTSFiles(outDir, devDir, emittedTSFiles);
  await writeJSRConfig(outDir, emittedTSFiles);

  fs.copyFileSync('./LICENSE', path.join(outDir, 'LICENSE'));
  fs.copyFileSync('./README.md', path.join(outDir, 'README.md'));
}

async function emitTSFiles(outDir: string): Promise<ReadonlyArray<string>> {
  const emittedTSFiles = [];
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
    const destPath = path.join(outDir, filepath);
    // eslint-disable-next-line no-await-in-loop
    const prettified = await prettify(destPath, newContent);
    writeGeneratedFile(destPath, prettified);
    emittedTSFiles.push(filepath);
  }

  return emittedTSFiles.sort((a, b) => a.localeCompare(b));
}

function emitDevTSFiles(
  outDir: string,
  devDir: string,
  emittedTSFiles: ReadonlyArray<string>,
): void {
  for (const filepath of emittedTSFiles) {
    const devPath = path.join(devDir, filepath);
    const relativePathToOutDir = path.relative(path.dirname(devPath), outDir);

    writeGeneratedFile(
      devPath,
      buildESMDevModeStub(
        `${relativePathToOutDir}/devMode.ts`,
        `${relativePathToOutDir}/${filepath}`,
      ),
    );
  }
}

interface JSRConfig {
  name: string;
  version: string;
  exports: { [entrypoint: string]: string };
  publish: {
    exclude: ReadonlyArray<string>;
  };
}

async function writeJSRConfig(
  outDir: string,
  emittedTSFiles: ReadonlyArray<string>,
): Promise<void> {
  const jsrConfigPath = path.join(outDir, 'jsr.json');

  const { version } = readPackageJSON();
  const jsrExports: { [entrypoint: string]: string } = {};

  for (const filepath of emittedTSFiles) {
    const devEntrypointPath = `./__dev__/${filepath}`;
    const devEntrypointKey = `./dev/${filepath}`;
    setJSRExport(jsrExports, devEntrypointKey, devEntrypointPath);
  }

  for (const filepath of emittedTSFiles) {
    const prodEntrypointPath = `./${filepath}`;
    const prodEntrypointKey = `./${filepath}`;
    setJSRExport(jsrExports, prodEntrypointKey, prodEntrypointPath);

    if (filepath === 'index.ts') {
      setJSRExport(jsrExports, '.', prodEntrypointPath);
      setJSRExport(jsrExports, './mod.ts', prodEntrypointPath);
    }
  }

  const jsrConfig: JSRConfig = {
    name: '@graphql/graphql-js',
    version,
    exports: jsrExports,
    publish: {
      // The package root is `denoDist/`, so unignore relative to that root.
      exclude: ['!.'],
    },
  };

  const prettified = await prettify(jsrConfigPath, JSON.stringify(jsrConfig));
  writeGeneratedFile(jsrConfigPath, prettified);
}

function setJSRExport(
  jsrExports: { [entrypoint: string]: string },
  entrypoint: string,
  targetPath: string,
): void {
  const existingPath = jsrExports[entrypoint];
  assert(
    existingPath === undefined || existingPath === targetPath,
    `JSR export "${entrypoint}" cannot target both "${existingPath}" and "${targetPath}".`,
  );
  jsrExports[entrypoint] = targetPath;
}
