import { parse } from '../../language/parser';

import { buildSchema } from '../../utilities/buildASTSchema';

import { execute } from '../execute';

const schema = buildSchema('type Query { listField: [String] }');
const document = parse('{ listField }');

async function* listField() {
  for (let index = 0; index < 100000; index++) {
    yield index;
  }
}

export const name = 'Execute Async Iterable List Field';
export const count = 10;
export async function measure() {
  await execute({
    schema,
    document,
    rootValue: { listField },
  });
}
