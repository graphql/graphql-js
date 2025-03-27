import { devAssert } from '../jsutils/devAssert';

import type { DocumentNode } from '../language/ast';
import { Kind } from '../language/kinds';
import type { ParseOptions } from '../language/parser';
import { parse } from '../language/parser';
import type { Source } from '../language/source';

import { specifiedDirectives } from '../type/directives';
import type { GraphQLSchemaValidationOptions } from '../type/schema';
import { GraphQLSchema } from '../type/schema';

import { assertValidSDL } from '../validation/validate';

import { extendSchemaImpl } from './extendSchema';

export interface BuildSchemaOptions extends GraphQLSchemaValidationOptions {
  /**
   * Set to true to assume the SDL is valid.
   *
   * Default: false
   */
  assumeValidSDL?: boolean;
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
  devAssert(
    documentAST != null && documentAST.kind === Kind.DOCUMENT,
    'Must provide valid Document AST.',
  );

  if (options?.assumeValid !== true && options?.assumeValidSDL !== true) {
    assertValidSDL(documentAST);
  }

  let useSemanticNullability;
  for (const definition of documentAST.definitions) {
    if (definition.kind === Kind.DIRECTIVE_DEFINITION) {
      if (definition.name.value === 'SemanticNullability') {
        useSemanticNullability = true;
      }
    }
  }

  const emptySchemaConfig = {
    useSemanticNullability,
    description: undefined,
    types: [],
    directives: [],
    extensions: Object.create(null),
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
          // @ts-expect-error validated in `validateSchema`
          config.query = type;
          break;
        case 'Mutation':
          // @ts-expect-error validated in `validateSchema`
          config.mutation = type;
          break;
        case 'Subscription':
          // @ts-expect-error validated in `validateSchema`
          config.subscription = type;
          break;
      }
    }
  }

  const directives = [
    ...config.directives,
    // If specified directives were not explicitly declared, add them.
    ...specifiedDirectives.filter((stdDirective) =>
      config.directives.every(
        (directive) => directive.name !== stdDirective.name,
      ),
    ),
  ];

  return new GraphQLSchema({ ...config, directives });
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
    allowLegacyFragmentVariables: options?.allowLegacyFragmentVariables,
    useSemanticNullability: options?.useSemanticNullability,
  });

  return buildASTSchema(document, {
    assumeValidSDL: options?.assumeValidSDL,
    assumeValid: options?.assumeValid,
  });
}
