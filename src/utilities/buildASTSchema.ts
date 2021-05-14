import { devAssert } from '../jsutils/devAssert';

import type { Source } from '../language/source';
import type { DocumentNode } from '../language/ast';
import type { ParseOptions } from '../language/parser';
import { Kind } from '../language/kinds';
import { parse } from '../language/parser';

import { assertValidSDL } from '../validation/validate';

import type { GraphQLSchemaValidationOptions } from '../type/schema';
import { GraphQLSchema } from '../type/schema';
import { specifiedDirectives } from '../type/directives';

import { extendSchemaImpl } from './extendSchema';

export type BuildSchemaOptions = {
  ...GraphQLSchemaValidationOptions;

  /**
   * Set to true to assume the SDL is valid.
   *
   * Default: false
   */
  assumeValidSDL?: boolean;
};

/**
 * This takes the ast of a schema document produced by the parse function in
 * src/language/parser.js.
 *
 * If no schema definition is provided, then it will look for types named Query
 * and Mutation.
 *
 * Given that AST it constructs a GraphQLSchema. The resulting schema
 * has no resolve methods, so execution will use default resolvers.
 */
export function buildASTSchema(
  documentAST: DocumentNode,
  options?: BuildSchemaOptions,
): GraphQLSchema {
  devAssert(
    documentAST != null && documentAST.kind === Kind.DOCUMENT,
    'Must provide valid Document AST.',
  );

  if (options?.assumeValid !== true && options?.assumeValidSDL !== true) {
    assertValidSDL(documentAST);
  }

  const emptySchemaConfig = {
    description: undefined,
    types: [],
    directives: [],
    extensions: undefined,
    extensionASTNodes: [],
    assumeValid: false,
  };
  const config = extendSchemaImpl(emptySchemaConfig, documentAST, options);

  if (config.astNode == null) {
    for (const type of config.types) {
      switch (type.name) {
        // Note: While this could make early assertions to get the correctly
        // typed values below, that would throw immediately while type system
        // validation with validateSchema() will produce more actionable results.
        case 'Query':
          // $FlowExpectedError[incompatible-type] validated in `validateSchema`
          config.query = type;
          break;
        case 'Mutation':
          // $FlowExpectedError[incompatible-type] validated in `validateSchema`
          config.mutation = type;
          break;
        case 'Subscription':
          // $FlowExpectedError[incompatible-type] validated in `validateSchema`
          config.subscription = type;
          break;
      }
    }
  }

  const { directives } = config;
  // If specified directives were not explicitly declared, add them.
  for (const stdDirective of specifiedDirectives) {
    if (directives.every((directive) => directive.name !== stdDirective.name)) {
      directives.push(stdDirective);
    }
  }

  return new GraphQLSchema(config);
}

/**
 * A helper function to build a GraphQLSchema directly from a source
 * document.
 */
export function buildSchema(
  source: string | Source,
  options?: { ...BuildSchemaOptions; ...ParseOptions },
): GraphQLSchema {
  const document = parse(source, {
    noLocation: options?.noLocation,
    allowLegacyFragmentVariables: options?.allowLegacyFragmentVariables,
  });

  return buildASTSchema(document, {
    assumeValidSDL: options?.assumeValidSDL,
    assumeValid: options?.assumeValid,
  });
}
