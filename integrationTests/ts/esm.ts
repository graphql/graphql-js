import type { ExecutionResult } from 'graphql-esm/execution';

import { graphqlSync } from 'graphql-esm';
import {
  GraphQLString,
  GraphQLSchema,
  GraphQLObjectType,
} from 'graphql-esm/type';

const queryType: GraphQLObjectType = new GraphQLObjectType({
  name: 'Query',
  fields: () => ({
    sayHi: {
      type: GraphQLString,
      args: {
        who: {
          type: GraphQLString,
          default: { value: 'World' },
        },
      },
      resolve(_root, args: { who: string }) {
        return 'Hello ' + args.who;
      },
    },
  }),
});

const schema: GraphQLSchema = new GraphQLSchema({ query: queryType });

const result: ExecutionResult = graphqlSync({
  schema,
  source: `
    query helloWho($who: String){
      test(who: $who)
    }
  `,
  variableValues: { who: 'Dolly' },
});
