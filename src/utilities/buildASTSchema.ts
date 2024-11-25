import type { DocumentNode } from '../language/ast.js';
import type { ParseOptions } from '../language/parser.js';
import { parse } from '../language/parser.js';
import type { Source } from '../language/source.js';

import type { GraphQLSchemaValidationOptions } from '../type/schema.js';
import { GraphQLSchema } from '../type/schema.js';

import { assertValidSDL } from '../validation/validate.js';

import { extendSchemaImpl } from './extendSchema.js';

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
export function buildASTSchema(
  documentAST: DocumentNode,
  options?: BuildSchemaOptions,
): GraphQLSchema {
  if (options?.assumeValid !== true && options?.assumeValidSDL !== true) {
    assertValidSDL(documentAST);
  }

  const config = extendSchemaImpl(documentAST, undefined, options);

  return new GraphQLSchema(config);
}

/**
 * A helper function to build a GraphQLSchema directly from a source
 * document.
 */
export function buildSchema(
  source: string | Source,
  options?: BuildSchemaOptions & ParseOptions,
): GraphQLSchema {
  const document = parse(source, {
    noLocation: options?.noLocation,
    experimentalFragmentArguments: options?.experimentalFragmentArguments,
  });

  return buildASTSchema(document, {
    assumeValidSDL: options?.assumeValidSDL,
    assumeValid: options?.assumeValid,
  });
}
