// eslint-disable-next-line node/no-missing-import, import/no-unresolved
import { graphqlSync } from 'graphql-esm';

// eslint-disable-next-line node/no-missing-import, import/no-unresolved
import { buildSchema } from 'graphql-esm/utilities/buildASTSchema';

const schema = buildSchema('type Query { hello: String }');

export const result = graphqlSync({
  schema,
  source: '{ hello }',
  rootValue: { hello: 'world' },
});
