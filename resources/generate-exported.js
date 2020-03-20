// @noflow

'use strict';

const babel = require('@babel/core');
const flowTypesPlugin = require('@babel/plugin-transform-flow-strip-types');

const extractExportPlugin = require('./babel-plugins/extract-exports');

const directoriesToScan = [
  '/src',
  '/src/error',
  '/src/type',
  '/src/language',
  '/src/validation',
  '/src/utilities',
  '/src/execution',
  '/src/subscription',
];

directoriesToScan.forEach(path =>
  babel.transformFileSync(process.cwd() + path + '/index.js', {
    babelrc: false,
    plugins: [flowTypesPlugin, extractExportPlugin],
  }),
);
