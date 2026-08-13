'use strict';

const onlyASCII = require('./only-ascii.js');
const noDirImport = require('./no-dir-import.js');
const requireGraphqlPublicApiDocs = require('./require-graphql-public-api-docs.js');
const requirePublicApiExports = require('./require-public-api-exports.js');
const requireToStringTag = require('./require-to-string-tag.js');

module.exports = {
  rules: {
    'only-ascii': onlyASCII,
    'no-dir-import': noDirImport,
    'require-graphql-public-api-docs': requireGraphqlPublicApiDocs,
    'require-public-api-exports': requirePublicApiExports,
    'require-to-string-tag': requireToStringTag,
  },
};
