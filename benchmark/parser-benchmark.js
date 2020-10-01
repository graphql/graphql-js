'use strict';

const { parse } = require('graphql/language/parser.js');
const {
  getIntrospectionQuery,
} = require('graphql/utilities/getIntrospectionQuery.js');

const introspectionQuery = getIntrospectionQuery();

module.exports = {
  name: 'Parse introspection query',
  count: 1000,
  measure() {
    parse(introspectionQuery);
  },
};
