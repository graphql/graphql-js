import { buildSchema, graphqlSync } from 'graphql';

const schema = buildSchema('type Query { hello: String }');

export const result = graphqlSync({
  schema,
  source: '{ hello }',
  rootValue: { hello: 'world' },
});
