import { graphqlSync } from 'graphql/graphql.js';
import { buildSchema } from 'graphql/utilities/buildASTSchema.js';

const schema = buildSchema('type Query { hello: String! }');
const source = `{ ${'hello '.repeat(250)}}`;

export const benchmark = {
  name: 'Many repeated fields',
  measure: () => graphqlSync({ schema, source }),
};
