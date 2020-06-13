import { GraphQLString, GraphQLSchema, GraphQLObjectType } from 'graphql/type';
import { ExecutionResult } from 'graphql/execution';
import { graphqlSync } from 'graphql';

const queryType: GraphQLObjectType = new GraphQLObjectType({
  name: 'Query',
  fields: {
    sayHi: {
      type: GraphQLString,
      args: {
        who: { type: GraphQLString },
      },
      resolve: (_root, args) => 'Hello ' + (args.who || 'World'),
    },
  },
});

const schema: GraphQLSchema = new GraphQLSchema({
  query: queryType,
});

const result: ExecutionResult = graphqlSync({
  schema,
  source: `
    query helloWho($who: String){
      test(who: $who)
    }
  `,
  variableValues: { who: 'Dolly' },
});
