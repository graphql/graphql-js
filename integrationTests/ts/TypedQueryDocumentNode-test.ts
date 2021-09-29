import type { ExecutionResult } from 'graphql/execution';
import type { TypedQueryDocumentNode } from 'graphql/utilities';

import { parse } from 'graphql/language';
import { execute } from 'graphql/execution';
import { buildSchema } from 'graphql/utilities';

const schema = buildSchema(`
  type Query {
    test: String
  }
`);

// Tests for TS specific TypedQueryDocumentNode type
const queryDocument = parse('{ test }');

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

const response = wrappedExecute(typedQueryDocument);
const responseData: ResponseData | undefined | null = response.data;

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
