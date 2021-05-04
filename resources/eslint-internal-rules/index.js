'use strict';

const onlyASCII = require('./only-ascii');
const noDirImport = require('./no-dir-import');

module.exports = {
  rules: {
    'only-ascii': onlyASCII,
    'no-dir-import': noDirImport,
  },
};
