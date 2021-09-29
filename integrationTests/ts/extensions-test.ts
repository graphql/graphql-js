import { GraphQLString, GraphQLObjectType } from 'graphql/type';

interface SomeExtension {
  number: number;
  string: string;
}

const example: SomeExtension = {
  number: 42,
  string: 'Meaning of life',
};

declare module 'graphql' {
  interface GraphQLObjectTypeExtensions<_TSource = any, _TContext = any> {
    someObjectExtension?: SomeExtension;
  }

  interface GraphQLFieldExtensions<
    _TSource,
    _TContext,
    _TArgs = { [argName: string]: any },
  > {
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
            someArgumentExtension: example,
          },
        },
      },
      resolve: (_root, args) => 'Hello ' + (args.who || 'World'),
      extensions: {
        someFieldExtension: example,
      },
    },
  }),
  extensions: {
    someObjectExtension: example,
  },
});

function checkExtensionTypes(_test: SomeExtension | null | undefined) {}

checkExtensionTypes(queryType.extensions.someObjectExtension);

const sayHiField = queryType.getFields().sayHi;
checkExtensionTypes(sayHiField.extensions.someFieldExtension);

checkExtensionTypes(sayHiField.args[0].extensions.someArgumentExtension);
