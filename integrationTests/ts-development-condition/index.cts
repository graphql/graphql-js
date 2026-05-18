import { graphqlSync } from 'graphql';
import { GraphQLObjectType, GraphQLSchema, GraphQLString } from 'graphql/type';

const queryType = new GraphQLObjectType({
  name: 'Query',
  fields: {
    greeting: {
      type: GraphQLString,
      resolve: () => 'Hello world',
    },
  },
});

const schema = new GraphQLSchema({ query: queryType });
const result = graphqlSync({ schema, source: '{ greeting }' });

if (result.data?.greeting !== 'Hello world') {
  throw new Error('Unexpected GraphQL result.');
}
