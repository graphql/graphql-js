'use strict';

const { buildClientSchema } = require('graphql/utilities/buildClientSchema.js');

const { bigSchemaIntrospectionResult } = require('./fixtures.js');

module.exports = {
  name: 'Build Schema from Introspection',
  count: 10,
  measure() {
    buildClientSchema(bigSchemaIntrospectionResult.data, { assumeValid: true });
  },
};
