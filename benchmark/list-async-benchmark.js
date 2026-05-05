import { execute } from 'graphql/execution/execute.js';
import { parse } from 'graphql/language/parser.js';
import { buildSchema } from 'graphql/utilities/buildASTSchema.js';

const schema = buildSchema('type Query { listField: [String] }', {
  assumeValid: true,
});
const document = parse('{ listField }');

function listField() {
  const results = [];
  for (let index = 0; index < 1000; index++) {
    results.push(Promise.resolve(index));
  }
  return results;
}

export const benchmark = {
  name: 'Execute Asynchronous List Field',
  measure: () =>
    execute({
      schema,
      document,
      rootValue: { listField },
    }),
};
