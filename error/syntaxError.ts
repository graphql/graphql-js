import type { Source } from '../language/source.ts';
import { GraphQLError } from './GraphQLError.ts';
/**
 * Produces a GraphQLError representing a syntax error, containing useful
 * descriptive information about the syntax error's position in the source.
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
