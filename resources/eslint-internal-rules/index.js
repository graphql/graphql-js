'use strict';

const onlyASCII = require('./only-ascii.js');
const noDirImport = require('./no-dir-import.js');

module.exports = {
  rules: {
    'only-ascii': onlyASCII,
    'no-dir-import': noDirImport,
  },
};
