import { parse } from '../../language/parser';

import { buildSchema } from '../../utilities/buildASTSchema';

import { execute } from '../execute';

const schema = buildSchema('type Query { listField: [String] }');
const document = parse('{ listField }');

function listField() {
  const results = [];
  for (let index = 0; index < 100000; index++) {
    results.push(Promise.resolve(index));
  }
  return results;
}

export const name = 'Execute Asynchronous List Field';
export const count = 10;
export async function measure() {
  await execute({
    schema,
    document,
    rootValue: { listField },
  });
}
