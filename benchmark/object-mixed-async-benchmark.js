import { execute } from 'graphql/execution/execute.js';
import { parse } from 'graphql/language/parser.js';
import { buildSchema } from 'graphql/utilities/buildASTSchema.js';

const listSize = 100;
const syncFieldCount = 100;
const syncFieldNames = Array.from(
  { length: syncFieldCount },
  (_, index) => `f${index}`,
);

const schema = buildSchema(
  `
    type Query { items: [Item] }
    type Item { ${syncFieldNames.map((fieldName) => `${fieldName}: Int`).join(' ')} asyncField: Int }
  `,
  { assumeValid: true },
);

const document = parse(`{ items { ${syncFieldNames.join(' ')} asyncField } }`);

const item = {
  ...Object.fromEntries(
    syncFieldNames.map((fieldName, index) => [fieldName, index]),
  ),
  asyncField: () => Promise.resolve(syncFieldCount),
};

const rootValue = { items: Array.from({ length: listSize }, () => item) };

export const benchmark = {
  name: 'Execute Objects With Mostly Synchronous Fields',
  measure: () =>
    execute({
      schema,
      document,
      rootValue,
    }),
};
