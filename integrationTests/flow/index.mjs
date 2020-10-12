// @flow strict

import { parse } from 'graphql/language';
import { GraphQLString, GraphQLSchema, GraphQLObjectType } from 'graphql/type';
import { type ExecutionResult, execute } from 'graphql/execution';
import { graphqlSync } from 'graphql';

interface SomeExtension {
  number: number;
  string: string;
}

const example: SomeExtension = {
  number: 42,
  string: 'Meaning of life',
};

const queryType: GraphQLObjectType = new GraphQLObjectType({
  name: 'Query',
  fields: {
    sayHi: {
      type: GraphQLString,
      args: {
        who: {
          type: GraphQLString,
          extensions: {
            someArgumentExtension: example,
          },
        },
      },
      resolve: (_root, args) => 'Hello ' + (args.who || 'World'),
      extensions: {
        someFieldExtension: example,
      },
    },
  },
  extensions: {
    someObjectExtension: example,
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
