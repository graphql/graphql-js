import { execute } from 'graphql/execution/execute.js';
import { parse } from 'graphql/language/parser.js';
import { buildSchema } from 'graphql/utilities/buildASTSchema.js';

const fieldCount = 1000;
const fieldNames = Array.from(
  { length: fieldCount },
  (_, index) => `f${index}`,
);

const schema = buildSchema(
  `type Query { ${fieldNames.map((fieldName) => `${fieldName}: Int`).join(' ')} }`,
  { assumeValid: true },
);

const document = parse(`{ ${fieldNames.join(' ')} }`);

const rootValue = Object.fromEntries(
  fieldNames.map((fieldName, index) => [
    fieldName,
    () => Promise.resolve(index),
  ]),
);

export const benchmark = {
  name: 'Execute Asynchronous Fields',
  measure: () =>
    execute({
      schema,
      document,
      rootValue,
    }),
};
