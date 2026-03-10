'use strict';

const { readPackageJSON, spawn, spawnOutput } = require('./utils.js');

let args;
try {
  args = parseArgs();
  validateBranchState(args.releaseBranch);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

console.log('Installing dependencies...');
spawn('npm', ['ci', '--ignore-scripts']);

console.log('Bumping package version without creating a tag...');
spawn('npm', ['version', ...args.npmVersionArgs, '--no-git-tag-version']);

console.log('Updating src/version.ts...');
spawn('node', ['resources/gen-version.js']);

console.log('Running test suite...');
spawn('npm', ['run', 'test']);

const { version } = readPackageJSON();
console.log(`Generating changelog for v${version}...`);
const changelogArgs = ['run', '--silent', 'changelog'];
if (args.fromRev != null) {
  changelogArgs.push('--', args.fromRev);
}
const releaseChangelog = spawnOutput('npm', changelogArgs);
const releaseCommitTitle = `chore(release): v${version}`;

console.log('Creating release commit...');
spawn('git', ['add', 'package.json', 'package-lock.json', 'src/version.ts']);
spawn('git', ['commit', '-m', releaseCommitTitle, '-m', releaseChangelog]);

const currentBranch = spawnOutput('git', ['rev-parse', '--abbrev-ref', 'HEAD']);

console.log('');
console.log(`Release commit created for v${version}.`);
console.log(
  `Next steps: push "${currentBranch}", open a PR to "${args.releaseBranch}", wait for CI, then merge.`,
);

function parseArgs() {
  const rawArgs = process.argv.slice(2);
  const fromRevArgName = '--fromRev';
  let fromRev = null;
  let releasePrepareArgs = rawArgs;

  if (rawArgs[0] === fromRevArgName) {
    fromRev = rawArgs[1] || null;
    releasePrepareArgs = rawArgs.slice(2);
  } else if (rawArgs.includes(fromRevArgName)) {
    throwUsage(`${fromRevArgName} must be the first argument when provided.`);
  }

  const releaseBranch = releasePrepareArgs[0];
  if (releaseBranch == null || releaseBranch.trim() === '') {
    throwUsage('Missing required release branch as the first argument.');
  }
  if (releaseBranch.startsWith('-')) {
    throwUsage(
      'Missing required release branch as the first argument (before options).',
    );
  }

  const npmVersionArgs = releasePrepareArgs.slice(1);
  if (npmVersionArgs.length === 0) {
    throwUsage(
      'Missing npm version arguments (e.g. patch, major, prerelease --preid alpha).',
    );
  }

  return {
    fromRev,
    releaseBranch,
    npmVersionArgs,
  };
}

function validateBranchState(releaseBranch) {
  const checkedBranch = spawnOutput('git', [
    'rev-parse',
    '--abbrev-ref',
    'HEAD',
  ]);
  if (checkedBranch === 'HEAD') {
    throw new Error(
      'Git is in detached HEAD state (not on a local branch). ' +
        'Switch to a local branch based on the release branch first, for example:\n' +
        `  git switch -c release-${releaseBranch.replace(
          /[^a-zA-Z0-9._-]/g,
          '-',
        )} ${releaseBranch}`,
    );
  }
  if (checkedBranch === releaseBranch) {
    throw new Error(
      `Release prepare must not run on "${releaseBranch}". Create a local release branch first.`,
    );
  }

  const status = spawnOutput('git', ['status', '--porcelain']).trim();
  if (status !== '') {
    throw new Error(
      'Working directory must be clean before running release:prepare.',
    );
  }

  const branchStatus = spawnOutput('git', [
    'status',
    '--porcelain',
    '--branch',
  ]);
  const branchSummary = branchStatus.split('\n')[0] || '';
  if (/\[[^\]]+\]/.test(branchSummary)) {
    throw new Error(
      `Current branch "${checkedBranch}" is not up to date with its upstream.`,
    );
  }

  let releaseBranchHead;
  try {
    releaseBranchHead = spawnOutput('git', ['rev-parse', releaseBranch]);
  } catch (error) {
    throw new Error(
      `Release branch "${releaseBranch}" does not exist locally.`,
      {
        cause: error,
      },
    );
  }

  let releaseBranchUpstream;
  try {
    releaseBranchUpstream = spawnOutput('git', [
      'rev-parse',
      '--abbrev-ref',
      `${releaseBranch}@{upstream}`,
    ]);
  } catch (error) {
    throw new Error(
      `Release branch "${releaseBranch}" does not track a remote branch. ` +
        'Set one first (for example: git branch --set-upstream-to ' +
        `<remote>/${releaseBranch} ${releaseBranch}).`,
      { cause: error },
    );
  }

  const upstreamRemote = releaseBranchUpstream.split('/')[0];
  try {
    spawn('git', ['fetch', '--quiet', '--tags', upstreamRemote, releaseBranch]);
  } catch (error) {
    throw new Error(
      `Failed to fetch "${releaseBranchUpstream}" and tags from "${upstreamRemote}". ` +
        'Check remote access, authentication, git remote configuration, ' +
        'and local/remote tag state.',
      { cause: error },
    );
  }

  const upstreamReleaseBranchHead = spawnOutput('git', [
    'rev-parse',
    `${releaseBranch}@{upstream}`,
  ]);
  const localOnlyCommitsRaw = spawnOutput('git', [
    'rev-list',
    `${upstreamReleaseBranchHead}..${releaseBranchHead}`,
  ]);
  const upstreamOnlyCommitsRaw = spawnOutput('git', [
    'rev-list',
    `${releaseBranchHead}..${upstreamReleaseBranchHead}`,
  ]);
  const localOnlyCommits =
    localOnlyCommitsRaw === '' ? [] : localOnlyCommitsRaw.split('\n');
  const upstreamOnlyCommits =
    upstreamOnlyCommitsRaw === '' ? [] : upstreamOnlyCommitsRaw.split('\n');
  if (localOnlyCommits.length > 0 && upstreamOnlyCommits.length > 0) {
    throw new Error(
      `Local "${releaseBranch}" has diverged from "${releaseBranchUpstream}". ` +
        'Resolve conflicts and synchronize first (for example: ' +
        `git switch ${releaseBranch} && git pull --rebase).`,
    );
  }
  if (upstreamOnlyCommits.length > 0) {
    throw new Error(
      `Local "${releaseBranch}" is behind "${releaseBranchUpstream}". ` +
        `Update it first (for example: git switch ${releaseBranch} && git pull --ff-only).`,
    );
  }
  if (localOnlyCommits.length > 0) {
    throw new Error(
      `Local "${releaseBranch}" is ahead of "${releaseBranchUpstream}". ` +
        `Push or reset it before release prepare (for example: git switch ${releaseBranch} && git push).`,
    );
  }

  const currentHead = spawnOutput('git', ['rev-parse', 'HEAD']);
  if (currentHead !== releaseBranchHead) {
    throw new Error(
      `Current branch "${checkedBranch}" must match "${releaseBranch}" before preparing a release.`,
    );
  }
}

function throwUsage(message) {
  throw new Error(
    `${message}\n` +
      'Usage: npm run release:prepare -- [--fromRev <fromRev>] <release-branch> <npm version args>\n' +
      'Examples:\n' +
      '  npm run release:prepare -- 16.x.x patch\n' +
      '  npm run release:prepare -- 16.x.x prerelease --preid alpha\n' +
      '  npm run release:prepare -- --fromRev <fromRev> 16.x.x prerelease --preid alpha',
  );
}
