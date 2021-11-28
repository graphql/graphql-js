'use strict';

const onlyASCII = require('./only-ascii.js');
const noDirImport = require('./no-dir-import.js');
const requireToStringTag = require('./require-to-string-tag.js');
const requireCoverageIgnoreReason = require('./require-coverage-ignore-reason.js');

module.exports = {
  rules: {
    'only-ascii': onlyASCII,
    'no-dir-import': noDirImport,
    'require-to-string-tag': requireToStringTag,
    'require-coverage-ignore-reason': requireCoverageIgnoreReason,
  },
};
