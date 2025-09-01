'use strict';

const { GraphQLObjectType } = require('graphql');

const cjsPath = require.resolve('graphql');

// eslint-disable-next-line import/no-commonjs
module.exports = {
  CJSGraphQLObjectType: GraphQLObjectType,
  cjsPath,
};
