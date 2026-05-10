import { git, readPackageJSON, readPackageJSONAtRef } from './utils.ts';

const packageJSON = readPackageJSON();
const labelsConfig: { [label: string]: { section: string; fold?: boolean } } = {
  'PR: breaking change 💥': {
    section: 'Breaking Change 💥',
  },
  'PR: deprecation ⚠': {
    section: 'Deprecation ⚠',
  },
  'PR: feature 🚀': {
    section: 'New Feature 🚀',
  },
  'PR: bug fix 🐞': {
    section: 'Bug Fix 🐞',
  },
  'PR: docs 📝': {
    section: 'Docs 📝',
    fold: true,
  },
  'PR: polish 💅': {
    section: 'Polish 💅',
    fold: true,
  },
  'PR: internal 🏠': {
    section: 'Internal 🏠',
    fold: true,
  },
  'PR: dependency 📦': {
    section: 'Dependency 📦',
    fold: true,
  },
};
const { GH_TOKEN } = process.env;

if (GH_TOKEN == null) {
  console.error('Must provide GH_TOKEN as environment variable!');
  process.exit(1);
}

if (!packageJSON.repository || typeof packageJSON.repository.url !== 'string') {
  console.error('package.json is missing repository.url string!');
  process.exit(1);
}

const repoURLMatch =
  /https:\/\/github.com\/(?<githubOrg>[^/]+)\/(?<githubRepo>[^/]+).git/.exec(
    packageJSON.repository.url,
  );
if (repoURLMatch?.groups == null) {
  console.error('Cannot extract organization and repo name from repo URL!');
  process.exit(1);
}
const { githubOrg, githubRepo } = repoURLMatch.groups;

process.stdout.write(await genChangeLog());

function parseFromRevArg(rawArgs: ReadonlyArray<string>): string | null {
  if (rawArgs.length === 0) {
    return null;
  }

  if (rawArgs.length === 1 && rawArgs[0].trim() !== '') {
    return rawArgs[0];
  }

  throw new Error(
    'Usage: npm run changelog [-- <fromRev>]\n' +
      'Example: npm run changelog -- d41f59bbfdfc207712a2fc3778934694a3410ddf',
  );
}

function getTaggedVersionCommit(version: string): string | null {
  const tag = `v${version}`;
  if (!git().tagExists(tag)) {
    return null;
  }
  return git({ quiet: true }).revParse(`${tag}^{}`);
}

function getFirstParentCommit(commit: string): string | null {
  const [commitWithParents] = git().revList('--parents', '-n', '1', commit);
  if (commitWithParents == null) {
    return null;
  }

  const [, firstParent] = commitWithParents.split(' ');
  return firstParent ?? null;
}

function resolveCommitRefOrThrow(ref: string): string {
  try {
    return git().revParse(ref);
  } catch (error) {
    throw new Error(
      `Unable to resolve fromRev "${ref}" to a local commit. ` +
        'Pass a reachable first-parent revision:\n' +
        '  npm run changelog -- <fromRev>',
      { cause: error },
    );
  }
}

function resolveChangeLogConfig(
  workingTreeVersion: string,
  fromRev: string | null,
): {
  title: string;
  commitsList: Array<string>;
} {
  const workingTreeReleaseTag = `v${workingTreeVersion}`;
  const title = git().tagExists(workingTreeReleaseTag)
    ? 'Unreleased'
    : workingTreeReleaseTag;

  const commitsList: Array<string> = [];
  let rangeStart =
    fromRev != null
      ? resolveCommitRefOrThrow(fromRev)
      : getTaggedVersionCommit(workingTreeVersion);

  let rangeStartReached = false;
  let lastCheckedVersion = workingTreeVersion;
  let newerCommit: string | null = null;
  let newerVersion: string | null = null;
  let commit: string | null = git().revParse('HEAD');

  while (commit != null) {
    const commitVersion = readPackageJSONAtRef(commit).version;

    if (rangeStart == null && commitVersion !== lastCheckedVersion) {
      rangeStart = getTaggedVersionCommit(commitVersion);
      lastCheckedVersion = commitVersion;
    }

    if (newerCommit != null && newerVersion === commitVersion) {
      commitsList.push(newerCommit);
    }

    if (rangeStart != null && commit === rangeStart) {
      rangeStartReached = true;
      break;
    }

    newerCommit = commit;
    newerVersion = commitVersion;
    commit = getFirstParentCommit(commit);
  }

  if (rangeStart == null || !rangeStartReached) {
    throw new Error(
      'Unable to determine changelog range from local first-parent history.\n' +
        'This can happen with a shallow clone, missing tags, or an unreachable fromRev.\n' +
        'Fetch more history/tags (for example, "git fetch --tags --deepen=200") ' +
        'or pass an explicit reachable first-parent fromRev:\n' +
        '  npm run changelog -- <fromRev>',
    );
  }

  return {
    title,
    commitsList: commitsList.reverse(),
  };
}

async function genChangeLog(): Promise<string> {
  const workingTreeVersion = packageJSON.version;
  const fromRev = parseFromRevArg(process.argv.slice(2));
  const { title, commitsList } = resolveChangeLogConfig(
    workingTreeVersion,
    fromRev,
  );

  const allPRs = await getPRsInfo(commitsList);
  const date = git().log('-1', '--format=%cd', '--date=short');

  const byLabel: { [label: string]: Array<PRInfo> } = {};
  const committersByLogin: { [login: string]: AuthorInfo } = {};
  const validationIssues: Array<string> = [];

  for (const pr of allPRs) {
    const labels = pr.labels.nodes
      .map((label) => label.name)
      .filter((label) => label.startsWith('PR: '));

    if (labels.length === 0) {
      validationIssues.push(`PR #${pr.number} is missing label. See ${pr.url}`);
      continue;
    }

    if (labels.length > 1) {
      validationIssues.push(
        `PR #${pr.number} has conflicting labels: ${labels.join(', ')}\nSee ${pr.url}`,
      );
      continue;
    }

    const label = labels[0];
    if (labelsConfig[label] == null) {
      validationIssues.push(
        `PR #${pr.number} has unknown label: ${label}\nSee ${pr.url}`,
      );
      continue;
    }

    byLabel[label] ??= [];
    byLabel[label].push(pr);
    committersByLogin[pr.author.login] = pr.author;
  }

  if (validationIssues.length > 0) {
    throw new Error(validationIssues.join('\n\n'));
  }

  let changelog = `## ${title} (${date})\n`;
  for (const [label, config] of Object.entries(labelsConfig)) {
    const prs = byLabel[label];
    if (prs != null) {
      const shouldFold = config.fold && prs.length > 1;

      changelog += `\n#### ${config.section}\n`;
      if (shouldFold) {
        changelog += '<details>\n';
        changelog += `<summary> ${prs.length} PRs were merged </summary>\n\n`;
      }

      for (const pr of prs) {
        const { number, url, author } = pr;
        changelog += `* [#${number}](${url}) ${pr.title} ([@${author.login}](${author.url}))\n`;
      }

      if (shouldFold) {
        changelog += '</details>\n';
      }
    }
  }

  const committers = Object.values(committersByLogin).sort((a, b) =>
    (a.name || a.login).localeCompare(b.name || b.login),
  );
  changelog += `\n#### Committers: ${committers.length}\n`;
  for (const committer of committers) {
    changelog += `* ${committer.name}([@${committer.login}](${committer.url}))\n`;
  }

  return changelog;
}

async function graphqlRequest(query: string) {
  const response = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: {
      Authorization: 'bearer ' + GH_TOKEN,
      'Content-Type': 'application/json',
      'User-Agent': 'gen-changelog',
    },
    body: JSON.stringify({ query }),
  });

  if (!response.ok) {
    throw new Error(
      `GitHub responded with ${response.status}: ${response.statusText}\n` +
        (await response.text()),
    );
  }

  const json = (await response.json()) as {
    data: unknown;
    errors?: ReadonlyArray<unknown>;
  };
  if (json.errors != null) {
    throw new Error('Errors: ' + JSON.stringify(json.errors, null, 2));
  }
  return json.data;
}

interface RepositoryCommitInfo {
  repository: {
    [commit: string]: CommitInfo;
  };
}

interface CommitInfo {
  oid: string;
  message: string;
  associatedPullRequests: {
    nodes: ReadonlyArray<{
      number: number;
      merged: boolean;
      repository: {
        nameWithOwner: string;
      };
    }>;
  };
}

async function batchCommitToPR(
  commits: ReadonlyArray<string>,
): Promise<ReadonlyArray<number>> {
  let commitsSubQuery = '';
  for (const oid of commits) {
    commitsSubQuery += `
        commit_${oid}: object(oid: "${oid}") {
          ... on Commit {
            oid
            message
            associatedPullRequests(first: 10) {
              nodes {
                number
                merged
                repository {
                  nameWithOwner
                }
              }
            }
          }
        }
    `;
  }

  const response = (await graphqlRequest(`
    {
      repository(owner: "${githubOrg}", name: "${githubRepo}") {
        ${commitsSubQuery}
      }
    }
  `)) as RepositoryCommitInfo;

  const prNumbers = [];
  for (const oid of commits) {
    const commitInfo: CommitInfo = response.repository['commit_' + oid];
    prNumbers.push(commitInfoToPR(commitInfo));
  }
  return prNumbers;
}

interface AuthorInfo {
  login: string;
  url: string;
  name: string;
}

interface RepositoryPrInfo {
  repository: {
    [pr: string]: PRInfo;
  };
}

interface PRInfo {
  number: number;
  title: string;
  url: string;
  author: AuthorInfo;
  labels: {
    nodes: ReadonlyArray<{
      name: string;
    }>;
  };
}

async function batchPRInfo(
  prNumbers: ReadonlyArray<number>,
): Promise<Array<PRInfo>> {
  let prsSubQuery = '';
  for (const number of prNumbers) {
    prsSubQuery += `
        pr_${number}: pullRequest(number: ${number}) {
          number
          title
          url
          author {
            login
            url
            ... on User {
              name
            }
          }
          labels(first: 10) {
            nodes {
              name
            }
          }
        }
    `;
  }

  const response = (await graphqlRequest(`
    {
      repository(owner: "${githubOrg}", name: "${githubRepo}") {
        ${prsSubQuery}
      }
    }
  `)) as RepositoryPrInfo;

  const prsInfo = [];
  for (const number of prNumbers) {
    prsInfo.push(response.repository['pr_' + number]);
  }
  return prsInfo;
}

function commitInfoToPR(commit: CommitInfo): number {
  const associatedPRs = commit.associatedPullRequests.nodes.filter(
    (pr) =>
      pr.merged && pr.repository.nameWithOwner === `${githubOrg}/${githubRepo}`,
  );
  if (associatedPRs.length === 0) {
    const match = / \(#(?<prNumber>[0-9]+)\)$/m.exec(commit.message);
    if (match?.groups?.prNumber != null) {
      return parseInt(match.groups.prNumber, 10);
    }
    throw new Error(
      `Commit ${commit.oid} has no associated PR: ${commit.message}`,
    );
  }
  if (associatedPRs.length > 1) {
    throw new Error(
      `Commit ${commit.oid} is associated with multiple PRs: ${commit.message}`,
    );
  }

  return associatedPRs[0].number;
}

async function getPRsInfo(
  commits: ReadonlyArray<string>,
): Promise<ReadonlyArray<PRInfo>> {
  let prNumbers = await splitBatches(commits, batchCommitToPR);
  prNumbers = Array.from(new Set(prNumbers)); // Remove duplicates

  return splitBatches(prNumbers, batchPRInfo);
}

// Split commits into batches of 50 to prevent timeouts
async function splitBatches<I, R>(
  array: ReadonlyArray<I>,
  batchFn: (array: ReadonlyArray<I>) => Promise<ReadonlyArray<R>>,
): Promise<ReadonlyArray<R>> {
  const promises = [];
  for (let i = 0; i < array.length; i += 50) {
    const batchItems = array.slice(i, i + 50);
    promises.push(batchFn(batchItems));
  }

  return (await Promise.all(promises)).flat();
}
