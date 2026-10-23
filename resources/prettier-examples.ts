import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { applyEdits, extractJSDocExamples } from './jsdoc-examples.ts';
import { localRepoPath, prettify, readdirRecursive } from './utils.ts';

type Mode = 'check' | 'write';

interface Options {
  filePaths: ReadonlyArray<string>;
  mode: Mode;
}

const languageExtensions = new Map([
  ['graphql', 'graphql'],
  ['gql', 'graphql'],
  ['javascript', 'js'],
  ['js', 'js'],
  ['jsx', 'jsx'],
  ['ts', 'mts'],
  ['tsx', 'tsx'],
  ['typescript', 'mts'],
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
    return [...readdirRecursive(sourceDir)]
      .filter(({ name, stats }) => name.endsWith('.ts') && stats.isFile())
      .map(({ filepath }) => filepath)
      .sort((a, b) => a.localeCompare(b));
  }

  const filePaths = new Set<string>();
  for (const fileArg of fileArgs) {
    const filePath = path.resolve(fileArg);
    const relativePath = path.relative(sourceDir, filePath);
    if (
      relativePath !== '..' &&
      !relativePath.startsWith(`..${path.sep}`) &&
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
  const filename = path.relative(localRepoPath(), filePath);
  let examples;
  try {
    examples = await extractJSDocExamples(source, filename);
  } catch (error) {
    return { issues: [errorMessage(error)], source };
  }
  const fenceResults = await Promise.all(
    examples.map(async (example) => {
      const { code, language, metadata, line, start, end, prefix } = example;
      const extension = languageExtensions.get(language);
      if (extension == null || metadata.includes('prettier-ignore')) {
        return {};
      }
      let formatted;
      try {
        formatted = (await prettify(`example.${extension}`, code)).trimEnd();
      } catch (error) {
        return {
          issue: `${filename}:${line - 1}: Could not prettify ${language} example: ${errorMessage(error)}`,
        };
      }
      if (formatted === code) {
        return {};
      }
      if (options.mode === 'check') {
        return {
          issue: `${filename}:${line - 1}: JSDoc example is not formatted.`,
        };
      }
      const newline = /\r\n?|\n/.exec(source.slice(start, end))?.[0] ?? '\n';
      const text =
        formatted
          .split('\n')
          .map((content) =>
            content === '' ? prefix.trimEnd() : prefix + content,
          )
          .join(newline) + newline;
      return { update: { start, end, text }, code: formatted };
    }),
  );
  const issues = fenceResults.flatMap(({ issue }) => issue ?? []);
  const updatedSource = applyEdits(
    source,
    fenceResults.flatMap(({ update }) => update ?? []),
  );
  if (updatedSource !== source) {
    try {
      // Formatting embedded strings can create a closing fence. Check the
      // resulting Markdown before writing changes back to a source file.
      const updatedExamples = await extractJSDocExamples(
        updatedSource,
        filename,
      );
      assert.deepEqual(
        updatedExamples.map(({ code }) => code),
        examples.map(
          (example, index) => fenceResults[index].code ?? example.code,
        ),
      );
    } catch {
      issues.push(
        `${filename}: Formatting would change JSDoc example boundaries; use longer code fences.`,
      );
      return { issues, source };
    }
  }
  return { issues, source: updatedSource };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message.split('\n')[0] : String(error);
}
