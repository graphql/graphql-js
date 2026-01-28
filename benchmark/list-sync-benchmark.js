import { execute } from 'graphql/execution/execute.js';
import { parse } from 'graphql/language/parser.js';
import { buildSchema } from 'graphql/utilities/buildASTSchema.js';

const schema = buildSchema('type Query { listField: [String] }');
const document = parse('{ listField }');

function listField() {
  const results = [];
  for (let index = 0; index < 1000; index++) {
    results.push(index);
  }
  return results;
}

export const benchmark = {
  name: 'Execute Synchronous List Field',
  count: 10,
  async measure() {
    await execute({
      schema,
      document,
      rootValue: { listField },
    });
  },
};
