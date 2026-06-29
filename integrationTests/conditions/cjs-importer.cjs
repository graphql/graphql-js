'use strict';

const {
  GraphQLObjectType,
  GraphQLString,
  isCompositeType,
} = require('graphql');
const {
  GraphQLObjectType: TypeGraphQLObjectType,
  GraphQLString: TypeGraphQLString,
  isCompositeType: typeIsCompositeType,
} = require('graphql/type');

const cjsPath = require.resolve('graphql');
const cjsTypePath = require.resolve('graphql/type');

// eslint-disable-next-line import/no-commonjs
module.exports = {
  CJSGraphQLObjectType: GraphQLObjectType,
  CJSGraphQLString: GraphQLString,
  CJSIsCompositeType: isCompositeType,
  CJSTypeGraphQLObjectType: TypeGraphQLObjectType,
  CJSTypeGraphQLString: TypeGraphQLString,
  CJSTypeIsCompositeType: typeIsCompositeType,
  cjsPath,
  cjsTypePath,
};
