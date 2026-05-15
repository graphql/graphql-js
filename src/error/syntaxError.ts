/** @category Errors */

import type { Source } from '../language/source.ts';

import { GraphQLError } from './GraphQLError.ts';

/**
 * Produces a GraphQLError representing a syntax error, containing useful
 * descriptive information about the syntax error's position in the source.
 * @param source - The GraphQL source containing the syntax error.
 * @param position - Character offset where the syntax error was encountered.
 * @param description - Human-readable description of the syntax error.
 * @returns A GraphQLError located at the syntax error position.
 * @example
 * ```ts
 * import { Source } from 'graphql/language';
 * import { syntaxError } from 'graphql/error';
 *
 * const error = syntaxError(new Source('query {'), 7, 'Expected Name');
 *
 * error.message; // => 'Syntax Error: Expected Name'
 * error.locations; // => [{ line: 1, column: 8 }]
 * ```
 */
export function syntaxError(
  source: Source,
  position: number,
  description: string,
): GraphQLError {
  return new GraphQLError(`Syntax Error: ${description}`, {
    source,
    positions: [position],
  });
}
