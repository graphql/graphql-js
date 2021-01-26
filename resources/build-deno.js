'use strict';

const fs = require('fs');
const path = require('path');

const babel = require('@babel/core');

const { readdirRecursive, buildTypes, showDirStats } = require('./utils');

if (require.main === module) {
  fs.rmdirSync('./denoDist', { recursive: true, force: true });
  fs.mkdirSync('./denoDist');

  const srcFiles = readdirRecursive('./src', { ignoreDir: /^__.*__$/ });
  for (const filepath of srcFiles) {
    const srcPath = path.join('./src', filepath);
    const destPath = path.join('./denoDist', filepath);

    fs.mkdirSync(path.dirname(destPath), { recursive: true });

    if (filepath.endsWith('.ts')) {
      const options = { babelrc: false, configFile: './.babelrc-deno.json' };
      const output = babel.transformFileSync(srcPath, options).code + '\n';
      fs.writeFileSync(destPath, output);
    }
  }

  fs.copyFileSync('./LICENSE', './denoDist/LICENSE');
  fs.copyFileSync('./README.md', './denoDist/README.md');

  buildTypes('./denoDist');
  showDirStats('./denoDist');
}
