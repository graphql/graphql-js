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

import { extendSchemaImpl } from './extendSchema';

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

  const config = extendSchemaImpl(emptySchemaConfig, documentAST, {
    ...options,
    assumeValidSDL: true,
  });

  if (config.astNode == null) {
    for (const type of config.types) {
      switch (type.name) {
        // Note: While this could make early assertions to get the correctly
        // typed values below, that would throw immediately while type system
        // validation with validateSchema() will produce more actionable results.
        case 'Query':
          config.query = (type: any);
          break;
        case 'Mutation':
          config.mutation = (type: any);
          break;
        case 'Subscription':
          config.subscription = (type: any);
          break;
      }
    }
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

  return new GraphQLSchema(config);
}

const emptySchemaConfig = new GraphQLSchema({ directives: [] }).toConfig();

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
