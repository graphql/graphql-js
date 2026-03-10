'use strict';

const util = require('util');
const https = require('https');

const packageJSON = require('../package.json');

const { exec, readPackageJSONAtRef, tagExists } = require('./utils.js');

const graphqlRequest = util.promisify(graphqlRequestImpl);
const labelsConfig = {
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
if (repoURLMatch == null) {
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

function getChangeLog() {
  const workingTreeVersion = packageJSON.version;
  const fromRev = parseFromRevArg(process.argv.slice(2));
  const { title, commitsList } = resolveChangeLogConfig(
    workingTreeVersion,
    fromRev,
  );

  const date = exec('git log -1 --format=%cd --date=short');
  return getCommitsInfo(commitsList)
    .then((commitsInfo) => getPRsInfo(commitsInfoToPRs(commitsInfo)))
    .then((prsInfo) => genChangeLog(title, date, prsInfo));
}

function parseFromRevArg(rawArgs) {
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

function getTaggedVersionCommit(version) {
  const tag = `v${version}`;
  if (!tagExists(tag)) {
    return null;
  }
  return exec(`git rev-parse ${tag}^{}`);
}

function getFirstParentCommit(commit) {
  const commitWithParents = exec(`git rev-list --parents -n 1 ${commit}`);
  if (commitWithParents === '') {
    return null;
  }

  const [, firstParent] = commitWithParents.split(' ');
  return firstParent || null;
}

function resolveCommitRefOrThrow(ref) {
  try {
    return exec(`git rev-parse ${ref}`);
  } catch (error) {
    throw new Error(
      `Unable to resolve fromRev "${ref}" to a local commit. ` +
        'Pass a reachable first-parent revision:\n' +
        '  npm run changelog -- <fromRev>',
      { cause: error },
    );
  }
}

function resolveChangeLogConfig(workingTreeVersion, fromRev) {
  const workingTreeReleaseTag = `v${workingTreeVersion}`;
  const title = tagExists(workingTreeReleaseTag)
    ? 'Unreleased'
    : workingTreeReleaseTag;

  const commitsList = [];
  let rangeStart =
    fromRev != null
      ? resolveCommitRefOrThrow(fromRev)
      : getTaggedVersionCommit(workingTreeVersion);

  let rangeStartReached = false;
  let lastCheckedVersion = workingTreeVersion;
  let newerCommit = null;
  let newerVersion = null;
  let commit = exec('git rev-parse HEAD');

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

function genChangeLog(title, date, allPRs) {
  const byLabel = {};
  const committersByLogin = {};
  const validationIssues = [];

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
        `PR #${pr.number} has conflicting labels: ${labels.join(', ')}\nSee ${
          pr.url
        }`,
      );
      continue;
    }

    const label = labels[0];
    if (!labelsConfig[label]) {
      validationIssues.push(
        `PR #${pr.number} has unknown label: ${label}\nSee ${pr.url}`,
      );
      continue;
    }

    byLabel[label] = byLabel[label] || [];
    byLabel[label].push(pr);
    committersByLogin[pr.author.login] = pr.author;
  }

  if (validationIssues.length > 0) {
    throw new Error(validationIssues.join('\n\n'));
  }

  let changelog = `## ${title} (${date})\n`;
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

function graphqlRequestImpl(query, variables, cb) {
  const resultCB = typeof variables === 'function' ? variables : cb;

  const req = https.request('https://api.github.com/graphql', {
    method: 'POST',
    headers: {
      Authorization: 'bearer ' + GH_TOKEN,
      'Content-Type': 'application/json',
      'User-Agent': 'gen-changelog',
    },
  });

  req.on('response', (res) => {
    let responseBody = '';

    res.setEncoding('utf8');
    res.on('data', (d) => (responseBody += d));
    res.on('error', (error) => resultCB(error));

    res.on('end', () => {
      if (res.statusCode !== 200) {
        return resultCB(
          new Error(
            `GitHub responded with ${res.statusCode}: ${res.statusMessage}\n` +
              responseBody,
          ),
        );
      }

      let json;
      try {
        json = JSON.parse(responseBody);
      } catch (error) {
        return resultCB(error);
      }

      if (json.errors) {
        return resultCB(
          new Error('Errors: ' + JSON.stringify(json.errors, null, 2)),
        );
      }

      resultCB(undefined, json.data);
    });
  });

  req.on('error', (error) => resultCB(error));
  req.write(JSON.stringify({ query, variables }));
  req.end();
}

async function batchCommitInfo(commits) {
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

async function batchPRInfo(prs) {
  let prsSubQuery = '';
  for (const number of prs) {
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
  for (const number of prs) {
    prsInfo.push(response.repository['pr_' + number]);
  }
  return prsInfo;
}

function commitsInfoToPRs(commits) {
  const prs = {};
  for (const commit of commits) {
    const associatedPRs = commit.associatedPullRequests.nodes.filter(
      (pr) => pr.repository.nameWithOwner === `${githubOrg}/${githubRepo}`,
    );
    if (associatedPRs.length === 0) {
      const match = / \(#(?<prNumber>[0-9]+)\)$/m.exec(commit.message);
      if (match) {
        prs[parseInt(match.groups.prNumber, 10)] = true;
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

    prs[associatedPRs[0].number] = true;
  }

  return Object.keys(prs);
}

async function getPRsInfo(commits) {
  // Split pr into batches of 50 to prevent timeouts
  const prInfoPromises = [];
  for (let i = 0; i < commits.length; i += 50) {
    const batch = commits.slice(i, i + 50);
    prInfoPromises.push(batchPRInfo(batch));
  }

  return (await Promise.all(prInfoPromises)).flat();
}

async function getCommitsInfo(commits) {
  // Split commits into batches of 50 to prevent timeouts
  const commitInfoPromises = [];
  for (let i = 0; i < commits.length; i += 50) {
    const batch = commits.slice(i, i + 50);
    commitInfoPromises.push(batchCommitInfo(batch));
  }

  return (await Promise.all(commitInfoPromises)).flat();
}
