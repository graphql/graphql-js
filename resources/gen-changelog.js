// @noflow

'use strict';

const util = require('util');
const https = require('https');
const { exec } = require('./utils');
const packageJSON = require('../package.json');

const graphqlRequest = util.promisify(graphqlRequestImpl);
const labelsConfig = {
  'PR: breaking change 💥': {
    section: 'Breaking Change 💥',
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
const GH_TOKEN = process.env['GH_TOKEN'];

if (!GH_TOKEN) {
  console.error('Must provide GH_TOKEN as enviroment variable!');
  process.exit(1);
}

if (!packageJSON.repository || typeof packageJSON.repository.url !== 'string') {
  console.error('package.json is missing repository.url string!');
  process.exit(1);
}

const match = /https:\/\/github.com\/([^/]+)\/([^/]+).git/.exec(
  packageJSON.repository.url,
);
if (match == null) {
  console.error('Can not extract organisation and repo name from repo URL!');
  process.exit(1);
}
const [, githubOrg, githubRepo] = match;

getChangeLog()
  .then(changelog => process.stdout.write(changelog))
  .catch(error => console.error(error));

function getChangeLog() {
  const { version } = packageJSON;

  let tag = null;
  let commitsList = exec(`git rev-list --reverse v${version}..`);
  if (commitsList === '') {
    const parentPackageJSON = exec('git cat-file blob HEAD~1:package.json');
    const parentVersion = JSON.parse(parentPackageJSON).version;
    commitsList = exec(`git rev-list --reverse v${parentVersion}..HEAD~1`);
    tag = `v${version}`;
  }

  const date = exec('git log -1 --format=%cd --date=short');
  return getCommitsInfo(commitsList.split('\n')).then(commitsInfo =>
    genChangeLog(tag, date, commitsInfo),
  );
}

function genChangeLog(tag, date, commitsInfo) {
  const allPRs = commitsInfoToPRs(commitsInfo);
  const byLabel = {};
  const commitersByLogin = {};

  for (const pr of allPRs) {
    if (!labelsConfig[pr.label]) {
      throw new Error('Unknown label: ' + pr.label + pr.number);
    }
    byLabel[pr.label] = byLabel[pr.label] || [];
    byLabel[pr.label].push(pr);
    commitersByLogin[pr.author.login] = pr.author;
  }

  let changelog = `## ${tag || 'Unreleased'} (${date})\n`;
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

  const commiters = Object.values(commitersByLogin).sort((a, b) =>
    (a.name || a.login).localeCompare(b.name || b.login),
  );
  changelog += `\n#### Committers: ${commiters.length}\n`;
  for (const commiter of commiters) {
    changelog += `* ${commiter.name}([@${commiter.login}](${commiter.url}))\n`;
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

  req.on('response', res => {
    let responseBody = '';

    res.setEncoding('utf8');
    res.on('data', d => (responseBody += d));
    res.on('error', error => resultCB(error));

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

  req.on('error', error => cb(error));
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
                title
                url
                author {
                  login
                  url
                  ... on User {
                    name
                  }
                }
                repository {
                  nameWithOwner
                }
                labels(first: 10) {
                  nodes {
                    name
                  }
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

function commitsInfoToPRs(commits) {
  const prs = {};
  for (const commit of commits) {
    const associatedPRs = commit.associatedPullRequests.nodes.filter(
      pr => pr.repository.nameWithOwner === `${githubOrg}/${githubRepo}`,
    );
    if (associatedPRs.length === 0) {
      throw new Error(
        `Commit ${commit.oid} has no associated PR: ${commit.message}`,
      );
    }
    if (associatedPRs.length > 1) {
      throw new Error(
        `Commit ${commit.oid} is associated with multiple PRs: ${commit.message}`,
      );
    }

    const pr = associatedPRs[0];
    const labels = pr.labels.nodes
      .map(label => label.name)
      .filter(label => label.startsWith('PR: '));

    if (labels.length === 0) {
      throw new Error(`PR #${pr.number} missing label`);
    }
    if (labels.length > 1) {
      throw new Error(
        `PR #${pr.number} has conflicting labels: ` + labels.join('\n'),
      );
    }

    prs[pr.number] = {
      number: pr.number,
      title: pr.title,
      url: pr.url,
      author: pr.author,
      label: labels[0],
    };
  }

  return Object.values(prs);
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
