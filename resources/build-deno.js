'use strict';

const fs = require('fs');
const path = require('path');

const babel = require('@babel/core');

const { rmdirRecursive, readdirRecursive, showDirStats } = require('./utils');

if (require.main === module) {
  rmdirRecursive('./denoDist');
  fs.mkdirSync('./denoDist');

  const srcFiles = readdirRecursive('./src', { ignoreDir: /^__.*__$/ });
  for (const filepath of srcFiles) {
    const srcPath = path.join('./src', filepath);
    const destPath = path.join('./denoDist', filepath);

    fs.mkdirSync(path.dirname(destPath), { recursive: true });
    if (filepath.endsWith('.js')) {
      const options = { babelrc: false, configFile: './.babelrc-deno.json' };
      const output = babel.transformFileSync(srcPath, options).code + '\n';
      fs.writeFileSync(destPath, output);
    } else if (filepath.endsWith('.d.ts')) {
      fs.copyFileSync(srcPath, destPath);
    }
  }

  fs.copyFileSync('./LICENSE', './denoDist/LICENSE');
  fs.copyFileSync('./README.md', './denoDist/README.md');

  showDirStats('./denoDist');
}
