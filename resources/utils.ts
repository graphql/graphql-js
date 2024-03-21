import assert from 'node:assert';
import childProcess from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import url from 'node:url';

import prettier from 'prettier';
import ts from 'typescript';

export function localRepoPath(...paths: ReadonlyArray<string>): string {
  const resourcesDir = path.dirname(url.fileURLToPath(import.meta.url));
  const repoDir = path.join(resourcesDir, '..');
  return path.join(repoDir, ...paths);
}

interface MakeTmpDirReturn {
  tmpDirPath: (...paths: ReadonlyArray<string>) => string;
}

export function makeTmpDir(name: string): MakeTmpDirReturn {
  const tmpDir = path.join(os.tmpdir(), name);
  fs.rmSync(tmpDir, { recursive: true, force: true });
  fs.mkdirSync(tmpDir);

  return {
    tmpDirPath: (...paths) => path.join(tmpDir, ...paths),
  };
}

interface NPMOptions extends SpawnOptions {
  quiet?: boolean;
}

export function npm(options?: NPMOptions) {
  const globalOptions = options?.quiet === true ? ['--quiet'] : [];

  // `npm` points to an executable shell script; so it doesn't require a shell per se.
  // On Windows `shell: true` is required or `npm` will be picked rather than `npm.cmd`.
  // This could alternatively be handled by manually selecting `npm.cmd` on Windows.
  // See: https://github.com/nodejs/node/issues/3675 and in particular
  // https://github.com/nodejs/node/issues/3675#issuecomment-308963807.
  const npmOptions = { shell: true, ...options };

  return {
    run(...args: ReadonlyArray<string>): void {
      spawn('npm', [...globalOptions, 'run', ...args], npmOptions);
    },
    install(...args: ReadonlyArray<string>): void {
      spawn('npm', [...globalOptions, 'install', ...args], npmOptions);
    },
    ci(...args: ReadonlyArray<string>): void {
      spawn('npm', [...globalOptions, 'ci', ...args], npmOptions);
    },
    exec(...args: ReadonlyArray<string>): void {
      spawn('npm', [...globalOptions, 'exec', ...args], npmOptions);
    },
    pack(...args: ReadonlyArray<string>): string {
      return spawnOutput(
        'npm',
        [...globalOptions, 'pack', ...args],
        npmOptions,
      );
    },
    diff(...args: ReadonlyArray<string>): string {
      return spawnOutput(
        'npm',
        [...globalOptions, 'diff', ...args],
        npmOptions,
      );
    },
  };
}

interface GITOptions extends SpawnOptions {
  quiet?: boolean;
}

export function git(options?: GITOptions) {
  const cmdOptions = options?.quiet === true ? ['--quiet'] : [];
  return {
    clone(...args: ReadonlyArray<string>): void {
      spawn('git', ['clone', ...cmdOptions, ...args], options);
    },
    checkout(...args: ReadonlyArray<string>): void {
      spawn('git', ['checkout', ...cmdOptions, ...args], options);
    },
    revParse(...args: ReadonlyArray<string>): string {
      return spawnOutput('git', ['rev-parse', ...cmdOptions, ...args], options);
    },
    revList(...args: ReadonlyArray<string>): Array<string> {
      const allArgs = ['rev-list', ...cmdOptions, ...args];
      const result = spawnOutput('git', allArgs, options);
      return result === '' ? [] : result.split('\n');
    },
    catFile(...args: ReadonlyArray<string>): string {
      return spawnOutput('git', ['cat-file', ...cmdOptions, ...args], options);
    },
    log(...args: ReadonlyArray<string>): string {
      return spawnOutput('git', ['log', ...cmdOptions, ...args], options);
    },
  };
}

interface SpawnOptions {
  cwd?: string;
  env?: typeof process.env;
  shell?: boolean;
}

function spawnOutput(
  command: string,
  args: ReadonlyArray<string>,
  options?: SpawnOptions,
): string {
  const result = childProcess.spawnSync(command, args, {
    maxBuffer: 10 * 1024 * 1024, // 10MB
    stdio: ['inherit', 'pipe', 'inherit'],
    encoding: 'utf-8',
    ...options,
  });

  if (result.status !== 0) {
    throw new Error(`Command failed: ${command} ${args.join(' ')}`);
  }

  return result.stdout.toString().trimEnd();
}

function spawn(
  command: string,
  args: ReadonlyArray<string>,
  options?: SpawnOptions,
): void {
  const result = childProcess.spawnSync(command, args, {
    stdio: 'inherit',
    ...options,
  });
  if (result.status !== 0) {
    throw new Error(`Command failed: ${command} ${args.join(' ')}`);
  }
}

function* readdirRecursive(dirPath: string): Generator<{
  name: string;
  filepath: string;
  stats: fs.Stats;
}> {
  for (const name of fs.readdirSync(dirPath)) {
    const filepath = path.join(dirPath, name);
    const stats = fs.lstatSync(filepath);

    if (stats.isDirectory()) {
      yield* readdirRecursive(filepath);
    } else {
      yield { name, filepath, stats };
    }
  }
}

export function showDirStats(dirPath: string): void {
  const fileTypes: {
    [filetype: string]: { filepaths: Array<string>; size: number };
  } = {};
  let totalSize = 0;

  for (const { name, filepath, stats } of readdirRecursive(dirPath)) {
    const ext = name.split('.').slice(1).join('.');
    const filetype = ext ? '*.' + ext : name;

    fileTypes[filetype] ??= { filepaths: [], size: 0 };

    totalSize += stats.size;
    fileTypes[filetype].size += stats.size;
    fileTypes[filetype].filepaths.push(filepath);
  }

  const stats: Array<[string, number]> = [];
  for (const [filetype, typeStats] of Object.entries(fileTypes)) {
    const numFiles = typeStats.filepaths.length;

    if (numFiles > 1) {
      stats.push([filetype + ' x' + numFiles, typeStats.size]);
    } else {
      const relativePath = path.relative(dirPath, typeStats.filepaths[0]);
      stats.push([relativePath, typeStats.size]);
    }
  }
  stats.sort((a, b) => b[1] - a[1]);

  const prettyStats = stats.map(([type, size]) => [
    type,
    (size / 1024).toFixed(2) + ' KB',
  ]);

  const typeMaxLength = Math.max(...prettyStats.map((x) => x[0].length));
  const sizeMaxLength = Math.max(...prettyStats.map((x) => x[1].length));
  for (const [type, size] of prettyStats) {
    console.log(
      type.padStart(typeMaxLength) + ' | ' + size.padStart(sizeMaxLength),
    );
  }

  console.log('-'.repeat(typeMaxLength + 3 + sizeMaxLength));
  const totalMB = (totalSize / 1024 / 1024).toFixed(2) + ' MB';
  console.log(
    'Total'.padStart(typeMaxLength) + ' | ' + totalMB.padStart(sizeMaxLength),
  );
}

const prettierConfig = JSON.parse(
  fs.readFileSync(localRepoPath('.prettierrc'), 'utf-8'),
);

export function writeGeneratedFile(filepath: string, body: string): void {
  const formatted = prettier.format(body, { filepath, ...prettierConfig });
  fs.mkdirSync(path.dirname(filepath), { recursive: true });
  fs.writeFileSync(filepath, formatted);
}

interface PackageJSON {
  description: string;
  version: string;
  private?: boolean;
  repository?: { url?: string };
  scripts?: { [name: string]: string };
  type?: string;
  exports: { [path: string]: string };
  types?: string;
  typesVersions: { [ranges: string]: { [path: string]: Array<string> } };
  devDependencies?: { [name: string]: string };
  publishConfig: { tag: string };

  // TODO: remove after we drop CJS support
  main?: string;
  module?: string;
}

export function readPackageJSON(
  dirPath: string = localRepoPath(),
): PackageJSON {
  const filepath = path.join(dirPath, 'package.json');
  return JSON.parse(fs.readFileSync(filepath, 'utf-8'));
}

export function readTSConfig(overrides?: any): ts.CompilerOptions {
  const tsConfigPath = localRepoPath('tsconfig.json');

  const { config: tsConfig, error: tsConfigError } =
    ts.parseConfigFileTextToJson(
      tsConfigPath,
      fs.readFileSync(tsConfigPath, 'utf-8'),
    );
  assert(tsConfigError === undefined, 'Fail to parse config: ' + tsConfigError);
  assert(
    tsConfig.compilerOptions,
    '"tsconfig.json" should have `compilerOptions`',
  );

  const { options: tsOptions, errors: tsOptionsErrors } =
    ts.convertCompilerOptionsFromJson(
      { ...tsConfig.compilerOptions, ...overrides },
      process.cwd(),
    );

  assert(
    tsOptionsErrors.length === 0,
    'Fail to parse options: ' + tsOptionsErrors,
  );

  return tsOptions;
}
