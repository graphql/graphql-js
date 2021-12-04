'use strict';

const os = require('os');
const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const LOCAL = 'local';
const localRepoDir = path.join(__dirname, '..');
const tmpDir = path.join(os.tmpdir(), 'graphql-js-npm-diff');
fs.rmSync(tmpDir, { recursive: true, force: true });
fs.mkdirSync(tmpDir);

const args = process.argv.slice(2);
let [fromRevision, toRevision] = args;
if (args.length < 2) {
  fromRevision = fromRevision ?? 'HEAD';
  toRevision = toRevision ?? LOCAL;
  console.warn(
    `Assuming you meant: diff-npm-package ${fromRevision} ${toRevision}`,
  );
}

console.log(`📦 Building NPM package for ${fromRevision}...`);
const fromPackage = prepareNPMPackage(fromRevision);

console.log(`📦 Building NPM package for ${toRevision}...`);
const toPackage = prepareNPMPackage(toRevision);

console.log('➖➕ Generating diff...');
const diff = exec(`npm diff --diff=${fromPackage} --diff=${toPackage}`);

if (diff === '') {
  console.log('No changes found!');
} else {
  const reportPath = path.join(localRepoDir, 'npm-dist-diff.html');
  fs.writeFileSync(reportPath, generateReport(diff), 'utf-8');
  console.log('Report saved to: ', reportPath);
}

function generateReport(diffString) {
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
function prepareNPMPackage(revision) {
  if (revision === LOCAL) {
    exec('npm --quiet run build:npm', { cwd: localRepoDir });
    return path.join(localRepoDir, 'npmDist');
  }

  // Returns the complete git hash for a given git revision reference.
  const hash = exec(`git rev-parse "${revision}"`);

  const repoDir = path.join(tmpDir, hash);
  fs.rmSync(repoDir, { recursive: true, force: true });
  fs.mkdirSync(repoDir);
  exec(`git archive "${hash}" | tar -xC "${repoDir}"`);
  exec('npm --quiet ci --ignore-scripts', { cwd: repoDir });
  exec('npm --quiet run build:npm', { cwd: repoDir });
  return path.join(repoDir, 'npmDist');
}

function exec(command, options = {}) {
  const result = cp.execSync(command, {
    encoding: 'utf-8',
    stdio: ['inherit', 'pipe', 'inherit'],
    ...options,
  });
  return result?.trimEnd();
}
