import * as assert from 'node:assert';
import * as childProcess from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';

import * as prettier from 'prettier';

export function localRepoPath(...paths: ReadonlyArray<string>): string {
  return path.join(__dirname, '..', ...paths);
}

export function npm(
  args: ReadonlyArray<string>,
  options?: SpawnOptions,
): string {
  return spawn('npm', args, options);
}

export function git(
  args: ReadonlyArray<string>,
  options?: SpawnOptions,
): string {
  return spawn('git', args, options);
}

interface SpawnOptions {
  cwd?: string;
}

function spawn(
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
  return result.stdout.toString().trimEnd();
}

export function readdirRecursive(
  dirPath: string,
  opts: { ignoreDir?: RegExp } = {},
): Array<string> {
  const { ignoreDir } = opts;
  const result = [];
  for (const dirent of fs.readdirSync(dirPath, { withFileTypes: true })) {
    const name = dirent.name;
    if (!dirent.isDirectory()) {
      result.push(dirent.name);
      continue;
    }

    if (ignoreDir?.test(name)) {
      continue;
    }
    const list = readdirRecursive(path.join(dirPath, name), opts).map((f) =>
      path.join(name, f),
    );
    result.push(...list);
  }
  return result.map((filepath) => './' + filepath);
}

export function showDirStats(dirPath: string): void {
  const fileTypes: {
    [filetype: string]: { filepaths: Array<string>; size: number };
  } = {};
  let totalSize = 0;

  for (const filepath of readdirRecursive(dirPath)) {
    const name = filepath.split(path.sep).at(-1);
    assert(name != null);
    const [base, ...splitExt] = name.split('.');
    const ext = splitExt.join('.');

    const filetype = ext ? '*.' + ext : base;
    fileTypes[filetype] = fileTypes[filetype] || { filepaths: [], size: 0 };

    const { size } = fs.lstatSync(path.join(dirPath, filepath));
    totalSize += size;
    fileTypes[filetype].size += size;
    fileTypes[filetype].filepaths.push(filepath);
  }

  const stats: Array<[string, number]> = [];
  for (const [filetype, typeStats] of Object.entries(fileTypes)) {
    const numFiles = typeStats.filepaths.length;

    if (numFiles > 1) {
      stats.push([filetype + ' x' + numFiles, typeStats.size]);
    } else {
      stats.push([typeStats.filepaths[0], typeStats.size]);
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
  version: string;
  private?: boolean;
  repository?: { url?: string };
  scripts?: { [name: string]: string };
  type?: string;
  exports: { [path: string]: string };
  types?: string;
  typesVersions: { [ranges: string]: { [path: string]: Array<string> } };
  devDependencies?: { [name: string]: string };
  publishConfig?: { tag?: string };
}

export function readPackageJSON(): PackageJSON {
  return JSON.parse(fs.readFileSync(localRepoPath('package.json'), 'utf-8'));
}
