'use strict';

const fs = require('fs');
const path = require('path');
const assert = require('assert');

const babel = require('@babel/core');
const prettier = require('prettier');

const { readdirRecursive, showDirStats } = require('./utils');

const prettierConfig = JSON.parse(
  fs.readFileSync(require.resolve('../.prettierrc'), 'utf-8'),
);

if (require.main === module) {
  fs.rmSync('./npmDist', { recursive: true, force: true });
  fs.mkdirSync('./npmDist');

  const srcFiles = readdirRecursive('./src', { ignoreDir: /^__.*__$/ });
  for (const filepath of srcFiles) {
    const srcPath = path.join('./src', filepath);
    const destPath = path.join('./npmDist', filepath);

    fs.mkdirSync(path.dirname(destPath), { recursive: true });
    if (filepath.endsWith('.ts') && !filepath.endsWith('.d.ts')) {
      const cjs = babelBuild(srcPath, { envName: 'cjs' });
      writeGeneratedFile(destPath.replace(/\.ts$/, '.js'), cjs);

      const mjs = babelBuild(srcPath, { envName: 'mjs' });
      writeGeneratedFile(destPath.replace(/\.ts$/, '.mjs'), mjs);
    } else if (filepath.endsWith('.d.ts')) {
      fs.copyFileSync(srcPath, destPath);
    }
  }

  fs.copyFileSync('./LICENSE', './npmDist/LICENSE');
  fs.copyFileSync('./README.md', './npmDist/README.md');

  // Should be done as the last step so only valid packages can be published
  const packageJSON = buildPackageJSON();
  writeGeneratedFile('./npmDist/package.json', JSON.stringify(packageJSON));

  showDirStats('./npmDist');
}

function writeGeneratedFile(filepath, body) {
  const formatted = prettier.format(body, { filepath, ...prettierConfig });
  fs.writeFileSync(filepath, formatted);
}

function babelBuild(srcPath, options) {
  const { code } = babel.transformFileSync(srcPath, {
    babelrc: false,
    configFile: './.babelrc-npm.json',
    ...options,
  });
  return code + '\n';
}

function buildPackageJSON() {
  const packageJSON = JSON.parse(
    fs.readFileSync(require.resolve('../package.json'), 'utf-8'),
  );

  delete packageJSON.private;
  delete packageJSON.scripts;
  delete packageJSON.devDependencies;

  const { version } = packageJSON;
  const versionMatch = /^\d+\.\d+\.\d+-?(?<preReleaseTag>.*)?$/.exec(version);
  if (!versionMatch) {
    throw new Error('Version does not match semver spec: ' + version);
  }

  const { preReleaseTag } = versionMatch.groups;

  if (preReleaseTag != null) {
    const [tag] = preReleaseTag.split('.');
    assert(
      tag.startsWith('experimental-') || ['alpha', 'beta', 'rc'].includes(tag),
      `"${tag}" tag is supported.`,
    );

    assert(!packageJSON.publishConfig, 'Can not override "publishConfig".');
    packageJSON.publishConfig = { tag: tag || 'latest' };
  }

  return packageJSON;
}
