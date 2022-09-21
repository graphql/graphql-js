import { parse } from '../language/parser.mjs';
import { specifiedDirectives } from '../type/directives.mjs';
import { GraphQLSchema } from '../type/schema.mjs';
import { assertValidSDL } from '../validation/validate.mjs';
import { extendSchemaImpl } from './extendSchema.mjs';
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
export function buildASTSchema(documentAST, options) {
  if (options?.assumeValid !== true && options?.assumeValidSDL !== true) {
    assertValidSDL(documentAST);
  }
  const emptySchemaConfig = {
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
export function buildSchema(source, options) {
  const document = parse(source, {
    noLocation: options?.noLocation,
    allowLegacyFragmentVariables: options?.allowLegacyFragmentVariables,
  });
  return buildASTSchema(document, {
    assumeValidSDL: options?.assumeValidSDL,
    assumeValid: options?.assumeValid,
  });
}
