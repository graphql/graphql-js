import { graphqlSync } from 'graphql-esm';
import { buildSchema } from 'graphql-esm/utilities/buildASTSchema';

const schema = buildSchema('type Query { hello: String }');

export const result = graphqlSync({
  schema,
  source: '{ hello }',
  rootValue: { hello: 'world' },
});
