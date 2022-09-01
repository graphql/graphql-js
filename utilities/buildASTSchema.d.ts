import type { DocumentNode } from '../language/ast.js';
import type { ParseOptions } from '../language/parser.js';
import type { Source } from '../language/source.js';
import type { GraphQLSchemaValidationOptions } from '../type/schema.js';
import { GraphQLSchema } from '../type/schema.js';
export interface BuildSchemaOptions extends GraphQLSchemaValidationOptions {
  /**
   * Set to true to assume the SDL is valid.
   *
   * Default: false
   */
  assumeValidSDL?: boolean | undefined;
}
/**
 * This takes the ast of a schema document produced by the parse function in
 * src/language/parser.js.
 *
 * If no schema definition is provided, then it will look for types named Query,
 * Mutation and Subscription.
 *
 * Given that AST it constructs a GraphQLSchema. The resulting schema
 * has no resolve methods, so execution will use default resolvers.
 */
export declare function buildASTSchema(
  documentAST: DocumentNode,
  options?: BuildSchemaOptions,
): GraphQLSchema;
/**
 * A helper function to build a GraphQLSchema directly from a source
 * document.
 */
export declare function buildSchema(
  source: string | Source,
  options?: BuildSchemaOptions & ParseOptions,
): GraphQLSchema;
