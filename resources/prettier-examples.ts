import fs from 'node:fs';
import path from 'node:path';

import { localRepoPath, prettify } from './utils.ts';

type Mode = 'check' | 'write';

interface Options {
  filePaths: ReadonlyArray<string>;
  mode: Mode;
}

interface JsdocLine {
  content: string;
  prefix: string;
}

interface LineUpdate {
  end: number;
  lines: Array<string>;
  start: number;
}

const languageExtensions = new Map([
  ['graphql', 'graphql'],
  ['gql', 'graphql'],
  ['javascript', 'js'],
  ['js', 'js'],
  ['jsx', 'jsx'],
  ['ts', 'ts'],
  ['tsx', 'tsx'],
  ['typescript', 'ts'],
]);

const sourceDir = localRepoPath('src');
const options = parseOptions(process.argv.slice(2));
const allIssues = [];
let changedFiles = 0;

const results = await Promise.all(
  options.filePaths.map(async (filePath) => {
    const source = fs.readFileSync(filePath, 'utf-8');
    const result = await prettifyFile(filePath, source);
    return { filePath, result, source };
  }),
);

for (const { filePath, result, source } of results) {
  allIssues.push(...result.issues);

  if (options.mode === 'write' && result.source !== source) {
    fs.writeFileSync(filePath, result.source);
    changedFiles++;
  }
}

if (allIssues.length > 0) {
  for (const message of allIssues) {
    console.error(message);
  }
  process.exitCode = 1;
} else if (options.mode === 'write') {
  console.log(`Prettified JSDoc examples in ${changedFiles} file(s).`);
}

function parseOptions(args: ReadonlyArray<string>): Options {
  const [modeArg, ...fileArgs] = args;
  let mode: Mode;
  if (modeArg === '--check') {
    mode = 'check';
  } else if (modeArg === '--write') {
    mode = 'write';
  } else {
    usage();
  }

  return { filePaths: sourceFilePaths(fileArgs), mode };
}

function sourceFilePaths(
  fileArgs: ReadonlyArray<string>,
): ReadonlyArray<string> {
  if (fileArgs.length === 0) {
    return Array.from(sourceFiles(sourceDir));
  }

  const filePaths = new Set<string>();
  for (const fileArg of fileArgs) {
    const filePath = path.resolve(fileArg);
    const relativePath = path.relative(sourceDir, filePath);
    if (
      !relativePath.startsWith('..') &&
      !path.isAbsolute(relativePath) &&
      filePath.endsWith('.ts') &&
      fs.existsSync(filePath) &&
      fs.statSync(filePath).isFile()
    ) {
      filePaths.add(filePath);
    }
  }

  return Array.from(filePaths).sort((a, b) => a.localeCompare(b));
}

function usage(): never {
  console.error('Usage: prettier-examples.ts --check|--write');
  process.exit(1);
}

async function prettifyFile(
  filePath: string,
  source: string,
): Promise<{ issues: Array<string>; source: string }> {
  const lines = source.split('\n');
  const blockResults = [];
  const updates: Array<LineUpdate> = [];

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    if (!lines[lineIndex].includes('/**')) {
      continue;
    }

    const blockStart = lineIndex;
    while (lineIndex < lines.length && !lines[lineIndex].includes('*/')) {
      lineIndex++;
    }

    if (lineIndex === lines.length) {
      break;
    }

    const blockEnd = lineIndex;
    if (hasExampleTag(lines, blockStart, blockEnd)) {
      blockResults.push(prettifyBlock(filePath, lines, blockStart, blockEnd));
    }
  }

  const fileIssues = [];
  for (const result of await Promise.all(blockResults)) {
    fileIssues.push(...result.issues);
    updates.push(...result.updates);
  }

  for (const update of updates.reverse()) {
    lines.splice(update.start, update.end - update.start + 1, ...update.lines);
  }

  return { issues: fileIssues, source: lines.join('\n') };
}

async function prettifyBlock(
  filePath: string,
  lines: ReadonlyArray<string>,
  blockStart: number,
  blockEnd: number,
): Promise<{ issues: Array<string>; updates: Array<LineUpdate> }> {
  const fenceResults: Array<
    Promise<{ issues: Array<string>; update?: LineUpdate }>
  > = [];
  let currentTag;

  for (let lineIndex = blockStart + 1; lineIndex < blockEnd; lineIndex++) {
    const line = jsdocLine(lines[lineIndex]);
    if (line == null) {
      continue;
    }

    const tag = /^@([^\s]+)/.exec(line.content.trimStart())?.[1];
    if (tag != null) {
      currentTag = tag;
    }

    const fence = /^\s*```([^\s`]*)\s*(.*)$/.exec(line.content);
    if (fence == null) {
      continue;
    }

    const fenceEnd = closingFenceLine(lines, lineIndex + 1, blockEnd);
    if (fenceEnd == null) {
      fenceResults.push(
        Promise.resolve({
          issues: [
            formatIssue(filePath, lineIndex, 'Unclosed JSDoc example fence.'),
          ],
        }),
      );
      break;
    }

    const language = fence[1].toLowerCase();
    const extension = languageExtensions.get(language);
    const metadata = fence[2];
    if (
      currentTag === 'example' &&
      extension != null &&
      !metadata.includes('prettier-ignore')
    ) {
      fenceResults.push(
        prettifyFence(filePath, lines, lineIndex, fenceEnd, extension),
      );
    }

    lineIndex = fenceEnd;
  }

  const blockIssues = [];
  const updates: Array<LineUpdate> = [];
  for (const result of await Promise.all(fenceResults)) {
    blockIssues.push(...result.issues);
    if (result.update != null) {
      updates.push(result.update);
    }
  }

  return { issues: blockIssues, updates };
}

async function prettifyFence(
  filePath: string,
  lines: ReadonlyArray<string>,
  fenceStart: number,
  fenceEnd: number,
  extension: string,
): Promise<{ issues: Array<string>; update?: LineUpdate }> {
  const codeLines = [];
  const contentPrefix = jsdocLine(lines[fenceStart])?.prefix ?? ' * ';

  for (let lineIndex = fenceStart + 1; lineIndex < fenceEnd; lineIndex++) {
    const line = jsdocLine(lines[lineIndex]);
    codeLines.push(line?.content ?? lines[lineIndex]);
  }

  const code = codeLines.join('\n');
  let formatted;
  try {
    formatted = (await prettify(`example.${extension}`, code)).trimEnd();
  } catch (error) {
    return {
      issues: [
        formatIssue(
          filePath,
          fenceStart,
          `Could not prettify ${extension} example: ${errorMessage(error)}`,
        ),
      ],
    };
  }

  if (formatted === code) {
    return { issues: [] };
  }

  if (options.mode === 'check') {
    return {
      issues: [
        formatIssue(filePath, fenceStart, 'JSDoc example is not formatted.'),
      ],
    };
  }

  return {
    issues: [],
    update: {
      end: fenceEnd - 1,
      lines: formatted
        .split('\n')
        .map((line) => commentLine(contentPrefix, line)),
      start: fenceStart + 1,
    },
  };
}

function hasExampleTag(
  lines: ReadonlyArray<string>,
  blockStart: number,
  blockEnd: number,
): boolean {
  for (let lineIndex = blockStart + 1; lineIndex < blockEnd; lineIndex++) {
    const line = jsdocLine(lines[lineIndex]);
    if (line?.content.trimStart().startsWith('@example')) {
      return true;
    }
  }
  return false;
}

function closingFenceLine(
  lines: ReadonlyArray<string>,
  start: number,
  blockEnd: number,
): number | undefined {
  for (let lineIndex = start; lineIndex < blockEnd; lineIndex++) {
    if (jsdocLine(lines[lineIndex])?.content.trim() === '```') {
      return lineIndex;
    }
  }
}

function jsdocLine(line: string): JsdocLine | undefined {
  const match = /^(\s*\*\s?)(.*)$/.exec(line);
  if (match == null) {
    return;
  }
  return { content: match[2], prefix: match[1] };
}

function commentLine(prefix: string, content: string): string {
  return content === '' ? prefix.trimEnd() : prefix + content;
}

function formatIssue(
  filePath: string,
  lineIndex: number,
  message: string,
): string {
  return `${path.relative(localRepoPath(), filePath)}:${lineIndex + 1}: ${message}`;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message.split('\n')[0] : String(error);
}

function* sourceFiles(dirPath: string): Generator<string> {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });

  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const entryPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      yield* sourceFiles(entryPath);
    } else if (entry.name.endsWith('.ts')) {
      yield entryPath;
    }
  }
}
