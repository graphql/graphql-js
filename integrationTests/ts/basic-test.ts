import type { ExecutionResult } from 'graphql/execution';

import { graphqlSync } from 'graphql';
import type { GraphQLSchema, GraphQLObjectType } from 'graphql/type';
import {
  GraphQLString,
  GraphQLSchemaImpl,
  GraphQLObjectTypeImpl,
} from 'graphql/type';

const queryType: GraphQLObjectType = new GraphQLObjectTypeImpl({
  name: 'Query',
  fields: () => ({
    sayHi: {
      type: GraphQLString,
      args: {
        who: {
          type: GraphQLString,
          defaultValue: 'World',
        },
      },
      resolve(_root, args: { who: string }) {
        return 'Hello ' + args.who;
      },
    },
  }),
});

const schema: GraphQLSchema = new GraphQLSchemaImpl({ query: queryType });

const result: ExecutionResult = graphqlSync({
  schema,
  source: `
    query helloWho($who: String){
      test(who: $who)
    }
  `,
  variableValues: { who: 'Dolly' },
});
