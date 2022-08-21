import { git, readPackageJSON } from './utils';

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

if (!GH_TOKEN) {
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

getChangeLog()
  .then((changelog) => process.stdout.write(changelog))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

function getChangeLog(): Promise<string> {
  const { version } = packageJSON;

  let tag: string | null = null;
  let commitsList = git(['rev-list', '--reverse', `v${version}..`]);
  if (commitsList === '') {
    const parentPackageJSON = git(['cat-file', 'blob', 'HEAD~1:package.json']);
    const parentVersion = JSON.parse(parentPackageJSON).version;
    commitsList = git(['rev-list', '--reverse', `v${parentVersion}..HEAD~1`]);
    tag = `v${version}`;
  }

  const date = git(['log', '-1', '--format=%cd', '--date=short']);
  return getCommitsInfo(commitsList.split('\n'))
    .then((commitsInfo) => getPRsInfo(commitsInfoToPRs(commitsInfo)))
    .then((prsInfo) => genChangeLog(tag, date, prsInfo));
}

function genChangeLog(
  tag: string | null,
  date: string,
  allPRs: ReadonlyArray<PRInfo>,
): string {
  const byLabel: { [label: string]: Array<PRInfo> } = {};
  const committersByLogin: { [login: string]: AuthorInfo } = {};

  for (const pr of allPRs) {
    const labels = pr.labels.nodes
      .map((label) => label.name)
      .filter((label) => label.startsWith('PR: '));

    if (labels.length === 0) {
      throw new Error(`PR is missing label. See ${pr.url}`);
    }
    if (labels.length > 1) {
      throw new Error(
        `PR has conflicting labels: ${labels.join('\n')}\nSee ${pr.url}`,
      );
    }

    const label = labels[0];
    if (!labelsConfig[label]) {
      throw new Error(`Unknown label: ${label}. See ${pr.url}`);
    }
    byLabel[label] = byLabel[label] || [];
    byLabel[label].push(pr);
    committersByLogin[pr.author.login] = pr.author;
  }

  let changelog = `## ${tag ?? 'Unreleased'} (${date})\n`;
  for (const [label, config] of Object.entries(labelsConfig)) {
    const prs = byLabel[label];
    if (prs) {
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

  const json = await response.json();
  if (json.errors) {
    throw new Error('Errors: ' + JSON.stringify(json.errors, null, 2));
  }
  return json.data;
}

interface CommitInfo {
  oid: string;
  message: string;
  associatedPullRequests: {
    nodes: ReadonlyArray<{
      number: number;
      repository: {
        nameWithOwner: string;
      };
    }>;
  };
}

async function batchCommitInfo(
  commits: ReadonlyArray<string>,
): Promise<Array<CommitInfo>> {
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
                repository {
                  nameWithOwner
                }
              }
            }
          }
        }
    `;
  }

  const response = await graphqlRequest(`
    {
      repository(owner: "${githubOrg}", name: "${githubRepo}") {
        ${commitsSubQuery}
      }
    }
  `);

  const commitsInfo = [];
  for (const oid of commits) {
    commitsInfo.push(response.repository['commit_' + oid]);
  }
  return commitsInfo;
}

interface AuthorInfo {
  login: string;
  url: string;
  name: string;
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

async function batchPRInfo(prNumbers: Array<number>): Promise<Array<PRInfo>> {
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

  const response = await graphqlRequest(`
    {
      repository(owner: "${githubOrg}", name: "${githubRepo}") {
        ${prsSubQuery}
      }
    }
  `);

  const prsInfo = [];
  for (const number of prNumbers) {
    prsInfo.push(response.repository['pr_' + number]);
  }
  return prsInfo;
}

function commitsInfoToPRs(commits: ReadonlyArray<CommitInfo>): Array<number> {
  const prNumbers = new Set<number>();
  for (const commit of commits) {
    const associatedPRs = commit.associatedPullRequests.nodes.filter(
      (pr) => pr.repository.nameWithOwner === `${githubOrg}/${githubRepo}`,
    );
    if (associatedPRs.length === 0) {
      const match = / \(#(?<prNumber>[0-9]+)\)$/m.exec(commit.message);
      if (match?.groups?.prNumber != null) {
        prNumbers.add(parseInt(match.groups.prNumber, 10));
        continue;
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

    prNumbers.add(associatedPRs[0].number);
  }

  return [...prNumbers.values()];
}

async function getPRsInfo(
  prNumbers: ReadonlyArray<number>,
): Promise<Array<PRInfo>> {
  // Split pr into batches of 50 to prevent timeouts
  const prInfoPromises = [];
  for (let i = 0; i < prNumbers.length; i += 50) {
    const batch = prNumbers.slice(i, i + 50);
    prInfoPromises.push(batchPRInfo(batch));
  }

  return (await Promise.all(prInfoPromises)).flat();
}

async function getCommitsInfo(
  commits: ReadonlyArray<string>,
): Promise<Array<CommitInfo>> {
  // Split commits into batches of 50 to prevent timeouts
  const commitInfoPromises = [];
  for (let i = 0; i < commits.length; i += 50) {
    const batch = commits.slice(i, i + 50);
    commitInfoPromises.push(batchCommitInfo(batch));
  }

  return (await Promise.all(commitInfoPromises)).flat();
}
