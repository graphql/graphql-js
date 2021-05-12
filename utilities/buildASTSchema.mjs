import { devAssert } from '../jsutils/devAssert.mjs';
import { Kind } from '../language/kinds.mjs';
import { parse } from '../language/parser.mjs';
import { assertValidSDL } from '../validation/validate.mjs';
import { GraphQLSchema } from '../type/schema.mjs';
import { specifiedDirectives } from '../type/directives.mjs';
import { extendSchemaImpl } from './extendSchema.mjs';

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
export function buildASTSchema(documentAST, options) {
  (documentAST != null && documentAST.kind === Kind.DOCUMENT) ||
    devAssert(false, 'Must provide valid Document AST.');

  if (
    (options === null || options === void 0 ? void 0 : options.assumeValid) !==
      true &&
    (options === null || options === void 0
      ? void 0
      : options.assumeValidSDL) !== true
  ) {
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

  const { directives } = config; // If specified directives were not explicitly declared, add them.

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

export function buildSchema(source, options) {
  const document = parse(source, {
    noLocation:
      options === null || options === void 0 ? void 0 : options.noLocation,
    allowLegacyFragmentVariables:
      options === null || options === void 0
        ? void 0
        : options.allowLegacyFragmentVariables,
  });
  return buildASTSchema(document, {
    assumeValidSDL:
      options === null || options === void 0 ? void 0 : options.assumeValidSDL,
    assumeValid:
      options === null || options === void 0 ? void 0 : options.assumeValid,
  });
}
