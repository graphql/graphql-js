// @flow strict

import devAssert from '../jsutils/devAssert';

import { Kind } from '../language/kinds';
import { type Source } from '../language/source';
import { type DocumentNode } from '../language/ast';
import { type ParseOptions, parse } from '../language/parser';

import { assertValidSDL } from '../validation/validate';

import {
  type GraphQLSchemaValidationOptions,
  GraphQLSchema,
} from '../type/schema';
import {
  GraphQLSkipDirective,
  GraphQLIncludeDirective,
  GraphQLDeprecatedDirective,
} from '../type/directives';

import { extendSchema } from './extendSchema';

export type BuildSchemaOptions = {|
  ...GraphQLSchemaValidationOptions,

  /**
   * Descriptions are defined as preceding string literals, however an older
   * experimental version of the SDL supported preceding comments as
   * descriptions. Set to true to enable this deprecated behavior.
   * This option is provided to ease adoption and will be removed in v16.
   *
   * Default: false
   */
  commentDescriptions?: boolean,

  /**
   * Set to true to assume the SDL is valid.
   *
   * Default: false
   */
  assumeValidSDL?: boolean,
|};

/**
 * This takes the ast of a schema document produced by the parse function in
 * src/language/parser.js.
 *
 * If no schema definition is provided, then it will look for types named Query
 * and Mutation.
 *
 * Given that AST it constructs a GraphQLSchema. The resulting schema
 * has no resolve methods, so execution will use default resolvers.
 *
 * Accepts options as a second argument:
 *
 *    - commentDescriptions:
 *        Provide true to use preceding comments as the description.
 *
 */
export function buildASTSchema(
  documentAST: DocumentNode,
  options?: BuildSchemaOptions,
): GraphQLSchema {
  devAssert(
    documentAST && documentAST.kind === Kind.DOCUMENT,
    'Must provide valid Document AST.',
  );

  if (!options || !(options.assumeValid || options.assumeValidSDL)) {
    assertValidSDL(documentAST);
  }

  const emptySchema = new GraphQLSchema({ directives: [] });
  const extendedSchema = extendSchema(emptySchema, documentAST, {
    ...options,
    assumeValidSDL: true,
  });

  const config = extendedSchema.toConfig();
  if (extendedSchema.astNode == null) {
    // Note: While this could make early assertions to get the correctly
    // typed values below, that would throw immediately while type system
    // validation with validateSchema() will produce more actionable results.
    config.query = (extendedSchema.getType('Query'): any);
    config.mutation = (extendedSchema.getType('Mutation'): any);
    config.subscription = (extendedSchema.getType('Subscription'): any);
  }

  const { directives } = config;
  // If specified directives were not explicitly declared, add them.
  if (!directives.some(directive => directive.name === 'skip')) {
    directives.push(GraphQLSkipDirective);
  }

  if (!directives.some(directive => directive.name === 'include')) {
    directives.push(GraphQLIncludeDirective);
  }

  if (!directives.some(directive => directive.name === 'deprecated')) {
    directives.push(GraphQLDeprecatedDirective);
  }

  config.assumeValid = (options && options.assumeValid) || false;
  return new GraphQLSchema(config);
}

/**
 * A helper function to build a GraphQLSchema directly from a source
 * document.
 */
export function buildSchema(
  source: string | Source,
  options?: {| ...BuildSchemaOptions, ...ParseOptions |},
): GraphQLSchema {
  const document = parse(source, {
    noLocation: (options && options.noLocation) || false,
    allowLegacySDLEmptyFields:
      (options && options.allowLegacySDLEmptyFields) || false,
    allowLegacySDLImplementsInterfaces:
      (options && options.allowLegacySDLImplementsInterfaces) || false,
    experimentalFragmentVariables:
      (options && options.experimentalFragmentVariables) || false,
  });

  return buildASTSchema(document, {
    commentDescriptions: (options && options.commentDescriptions) || false,
    assumeValidSDL: (options && options.assumeValidSDL) || false,
    assumeValid: (options && options.assumeValid) || false,
  });
}
