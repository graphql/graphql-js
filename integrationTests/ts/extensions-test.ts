import { GraphQLError } from 'graphql/error';
import { GraphQLString, GraphQLObjectType } from 'graphql/type';

interface SomeExtension {
  meaningOfLife: 42;
}

declare module 'graphql' {
  interface GraphQLObjectTypeExtensions<_TSource, _TContext> {
    someObjectExtension?: SomeExtension;
  }

  interface GraphQLFieldExtensions<_TSource, _TContext, _TArgs> {
    someFieldExtension?: SomeExtension;
  }

  interface GraphQLArgumentExtensions {
    someArgumentExtension?: SomeExtension;
  }
}

const queryType: GraphQLObjectType = new GraphQLObjectType({
  name: 'Query',
  fields: () => ({
    sayHi: {
      type: GraphQLString,
      args: {
        who: {
          type: GraphQLString,
          extensions: {
            someArgumentExtension: { meaningOfLife: 42 },
          },
        },
      },
      resolve: (_root, args) => 'Hello ' + (args.who || 'World'),
      extensions: {
        someFieldExtension: { meaningOfLife: 42 },
      },
    },
  }),
  extensions: {
    someObjectExtension: { meaningOfLife: 42 },
  },
});

function checkExtensionTypes(_test: SomeExtension | null | undefined) {}

checkExtensionTypes(queryType.extensions.someObjectExtension);

const sayHiField = queryType.getFields().sayHi;
checkExtensionTypes(sayHiField.extensions.someFieldExtension);

checkExtensionTypes(sayHiField.args[0].extensions.someArgumentExtension);

declare module 'graphql' {
  export interface GraphQLErrorExtensions {
    someErrorExtension?: SomeExtension;
  }
}

const error = new GraphQLError('foo');
checkExtensionTypes(error.extensions.someErrorExtension);
