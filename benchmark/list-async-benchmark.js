'use strict';

const { parse } = require('graphql/language/parser.js');
const { execute } = require('graphql/execution/execute.js');
const { buildSchema } = require('graphql/utilities/buildASTSchema.js');

const schema = buildSchema('type Query { listField: [String] }');
const document = parse('{ listField }');

function listField() {
  const results = [];
  for (let index = 0; index < 100000; index++) {
    results.push(Promise.resolve(index));
  }
  return results;
}

module.exports = {
  name: 'Execute Asynchronous List Field',
  count: 10,
  async measure() {
    await execute({
      schema,
      document,
      rootValue: { listField },
    });
  },
};
