import type { Source } from '../language/source.js';
import { GraphQLError } from './GraphQLError.js';
/**
 * Produces a GraphQLError representing a syntax error, containing useful
 * descriptive information about the syntax error's position in the source.
 */
export declare function syntaxError(
  source: Source,
  position: number,
  description: string,
): GraphQLError;
