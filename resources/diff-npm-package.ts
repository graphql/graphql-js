import assert from 'node:assert';
import childProcess from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

import {
  git,
  localRepoPath,
  makeTmpDir,
  npm,
  prettify,
  writeGeneratedFile,
} from './utils.js';

const LOCAL = 'local';
const { tmpDirPath } = makeTmpDir('graphql-js-npm-diff');

const args = process.argv.slice(2);
let [fromRevision, toRevision] = args;
if (args.length < 2) {
  fromRevision ??= 'HEAD';
  toRevision ??= LOCAL;
  console.warn(
    `Assuming you meant: diff-npm-package ${fromRevision} ${toRevision}`,
  );
}

console.log(`📦 Building NPM package for ${fromRevision}...`);
const fromPackage = prepareNPMPackage(fromRevision);

console.log(`📦 Building NPM package for ${toRevision}...`);
const toPackage = prepareNPMPackage(toRevision);

console.log('➖➕ Generating diff...');
const diff = npm().diff('--diff', fromPackage, '--diff', toPackage);

if (diff === '') {
  console.log('No changes found!');
} else {
  const reportPath = localRepoPath('reports', 'npm-dist-diff.html');
  const prettified = await prettify(reportPath, generateReport(diff));
  writeGeneratedFile(reportPath, prettified);
  console.log('Report saved to: ', reportPath);
}

function generateReport(diffString: string): string {
  return `
    <!DOCTYPE html>
    <html lang="en-us">
      <head>
        <meta charset="utf-8" />
        <!-- Make sure to load the highlight.js CSS file before the Diff2Html CSS file -->
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/10.7.1/styles/github.min.css" />
        <link
          rel="stylesheet"
          type="text/css"
          href="https://cdn.jsdelivr.net/npm/diff2html/bundles/css/diff2html.min.css"
        />
        <script type="text/javascript" src="https://cdn.jsdelivr.net/npm/diff2html/bundles/js/diff2html-ui.min.js"></script>
      </head>
      <script>
        const diffString = ${JSON.stringify(diffString)};

        document.addEventListener('DOMContentLoaded', () => {
          const targetElement = document.getElementById('myDiffElement');
          const configuration = {
            drawFileList: true,
            fileContentToggle: true,
            matching: 'lines',
            outputFormat: 'side-by-side',
            renderNothingWhenEmpty: false,
          };
          const diff2htmlUi = new Diff2HtmlUI(targetElement, diffString, configuration);
          diff2htmlUi.draw();
          diff2htmlUi.highlightCode();
        });
      </script>
      <body>
        <div id="myDiffElement"></div>
      </body>
    </html>
  `;
}

function prepareNPMPackage(revision: string): string {
  if (revision === LOCAL) {
    npm({ cwd: localRepoPath(), quiet: true }).run('build:npm');
    return localRepoPath('npmDist');
  }

  // Returns the complete git hash for a given git revision reference.
  const hash = git().revParse(revision);
  assert(hash != null);

  const repoDir = tmpDirPath(hash);
  fs.rmSync(repoDir, { recursive: true, force: true });
  fs.mkdirSync(repoDir);
  childProcess.execSync(`git archive "${hash}" | tar -xC "${repoDir}"`);
  npm({ cwd: repoDir, quiet: true }).ci('--ignore-scripts');
  npm({ cwd: repoDir, quiet: true }).run('build:npm');
  return path.join(repoDir, 'npmDist');
}
