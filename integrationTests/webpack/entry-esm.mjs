import { graphqlSync } from 'graphql';
import { buildSchema } from 'graphql/utilities/buildASTSchema';

const schema = buildSchema('type Query { hello: String }');

export const result = graphqlSync({
  schema,
  source: '{ hello }',
  rootValue: { hello: 'world' },
});
