import { execute } from 'graphql/execution/execute.js';
import { parse } from 'graphql/language/parser.js';
import { buildSchema } from 'graphql/utilities/buildASTSchema.js';

const schema = buildSchema(`
  type Query {
    listField: [Object]
  }

  type Object {
    field: String
  }
`);
const document = parse('{ listField { field } }');

function listField() {
  const results = [];
  for (let index = 0; index < 1; index++) {
    results.push(Promise.resolve({ field: Promise.resolve(index) }));
  }
  return results;
}

export const benchmark = {
  name: 'Execute Asynchronous List Field with Nested Asynchronous Fields',
  count: 10,
  async measure() {
    await execute({
      schema,
      document,
      rootValue: { listField },
    });
  },
};
