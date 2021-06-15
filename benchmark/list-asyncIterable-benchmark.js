'use strict';

const { parse } = require('graphql/language/parser.js');
const { execute } = require('graphql/execution/execute.js');
const { buildSchema } = require('graphql/utilities/buildASTSchema.js');

const schema = buildSchema('type Query { listField: [String] }');
const document = parse('{ listField }');

async function* listField() {
  for (let index = 0; index < 100000; index++) {
    yield index;
  }
}

module.exports = {
  name: 'Execute Async Iterable List Field',
  count: 10,
  async measure() {
    await execute({
      schema,
      document,
      rootValue: { listField },
    });
  },
};
