'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.buildSchema = exports.buildASTSchema = void 0;
const parser_js_1 = require('../language/parser.js');
const directives_js_1 = require('../type/directives.js');
const schema_js_1 = require('../type/schema.js');
const validate_js_1 = require('../validation/validate.js');
const extendSchema_js_1 = require('./extendSchema.js');
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
function buildASTSchema(documentAST, options) {
  if (options?.assumeValid !== true && options?.assumeValidSDL !== true) {
    (0, validate_js_1.assertValidSDL)(documentAST);
  }
  const emptySchemaConfig = {
    description: undefined,
    types: [],
    directives: [],
    extensions: Object.create(null),
    extensionASTNodes: [],
    assumeValid: false,
  };
  const config = (0, extendSchema_js_1.extendSchemaImpl)(
    emptySchemaConfig,
    documentAST,
    options,
  );
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
    ...directives_js_1.specifiedDirectives.filter((stdDirective) =>
      config.directives.every(
        (directive) => directive.name !== stdDirective.name,
      ),
    ),
  ];
  return new schema_js_1.GraphQLSchema({ ...config, directives });
}
exports.buildASTSchema = buildASTSchema;
/**
 * A helper function to build a GraphQLSchema directly from a source
 * document.
 */
function buildSchema(source, options) {
  const document = (0, parser_js_1.parse)(source, {
    noLocation: options?.noLocation,
    allowLegacyFragmentVariables: options?.allowLegacyFragmentVariables,
  });
  return buildASTSchema(document, {
    assumeValidSDL: options?.assumeValidSDL,
    assumeValid: options?.assumeValid,
  });
}
exports.buildSchema = buildSchema;
