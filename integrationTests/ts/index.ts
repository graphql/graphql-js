import { parse } from 'graphql/language';
import { GraphQLString, GraphQLSchema, GraphQLObjectType } from 'graphql/type';
import { ExecutionResult, execute } from 'graphql/execution';
import { TypedQueryDocumentNode, graphqlSync } from 'graphql';

interface SomeExtension {
  number: number;
  string: string;
}

const example: SomeExtension = {
  number: 42,
  string: 'Meaning of life',
};

// FIXME: The following code block requires a version of TypeScript >= 3.2
/*

declare module 'graphql' {
  interface GraphQLObjectTypeExtensions<TSource = any, TContext = any> {
    someObjectExtension?: SomeExtension;
  }
  interface GraphQLFieldExtensions<
    TSource,
    TContext,
    TArgs = { [argName: string]: any }
  > {
    someFieldExtension?: SomeExtension;
  }
  interface GraphQLArgumentExtensions {
    someArgumentExtension?: SomeExtension;
  }
}
*/

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

// Tests for TS specific TypedQueryDocumentNode type
const queryDocument = parse(`
  query helloWho($who: String){
    test(who: $who)
  }
`);

type ResponseData = { test: string };
const typedQueryDocument = queryDocument as TypedQueryDocumentNode<
  ResponseData,
  {}
>;

// Supports conversion to DocumentNode
execute({ schema, document: typedQueryDocument });

function wrappedExecute<T>(document: TypedQueryDocumentNode<T>) {
  return execute({ schema, document }) as ExecutionResult<T>;
}

const { data } = wrappedExecute(typedQueryDocument);
if (data != null) {
  const typedData: ResponseData = data;
}

declare function runQueryA(
  q: TypedQueryDocumentNode<{ output: string }, { input: string | null }>,
): void;

// valid
declare const optionalInputRequiredOutput: TypedQueryDocumentNode<
  { output: string },
  { input: string | null }
>;
runQueryA(optionalInputRequiredOutput);

declare function runQueryB(
  q: TypedQueryDocumentNode<{ output: string | null }, { input: string }>,
): void;

// still valid: We still accept {output: string} as a valid result.
// We're now passing in {input: string} which is still assignable to {input: string | null}
runQueryB(optionalInputRequiredOutput);

// valid: we now accept {output: null} as a valid Result
declare const optionalInputOptionalOutput: TypedQueryDocumentNode<
  { output: string | null },
  { input: string | null }
>;
runQueryB(optionalInputOptionalOutput);

// valid: we now only pass {input: string} to the query
declare const requiredInputRequiredOutput: TypedQueryDocumentNode<
  { output: string },
  { input: string }
>;
runQueryB(requiredInputRequiredOutput);

// valid: we now accept {output: null} as a valid Result AND
//        we now only pass {input: string} to the query
declare const requiredInputOptionalOutput: TypedQueryDocumentNode<
  { output: null },
  { input: string }
>;
runQueryB(requiredInputOptionalOutput);
