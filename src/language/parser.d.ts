import { Source } from './source';
import { TypeNode, ValueNode, DocumentNode } from './ast';

/**
 * Configuration options to control parser behavior
 */
export interface ParseOptions {
  /**
   * By default, the parser creates AST nodes that know the location
   * in the source that they correspond to. This configuration flag
   * disables that behavior for performance or testing.
   */
  noLocation?: boolean;

  /**
   * EXPERIMENTAL:
   *
   * If enabled, the parser will understand and parse variable definitions
   * contained in a fragment definition. They'll be represented in the
   * `variableDefinitions` field of the FragmentDefinitionNode.
   *
   * The syntax is identical to normal, query-defined variables. For example:
   *
   *   fragment A($var: Boolean = false) on T  {
   *     ...
   *   }
   *
   * Note: this feature is experimental and may change or be removed in the
   * future.
   */
  experimentalFragmentVariables?: boolean;
}

/**
 * Given a GraphQL source, parses it into a Document.
 * Throws GraphQLError if a syntax error is encountered.
 */
export function parse(
  source: string | Source,
  options?: ParseOptions,
): DocumentNode;

/**
 * Given a string containing a GraphQL value, parse the AST for that value.
 * Throws GraphQLError if a syntax error is encountered.
 *
 * This is useful within tools that operate upon GraphQL Values directly and
 * in isolation of complete GraphQL documents.
 */
export function parseValue(
  source: string | Source,
  options?: ParseOptions,
): ValueNode;

/**
 * Given a string containing a GraphQL Type (ex. `[Int!]`), parse the AST for
 * that type.
 * Throws GraphQLError if a syntax error is encountered.
 *
 * This is useful within tools that operate upon GraphQL Types directly and
 * in isolation of complete GraphQL documents.
 *
 * Consider providing the results to the utility function: typeFromAST().
 */
export function parseType(
  source: string | Source,
  options?: ParseOptions,
): TypeNode;
