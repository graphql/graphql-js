'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.ExecutableDefinitionsRule = void 0;
const GraphQLError_js_1 = require('../../error/GraphQLError.js');
const kinds_js_1 = require('../../language/kinds.js');
const predicates_js_1 = require('../../language/predicates.js');
/**
 * Executable definitions
 *
 * A GraphQL document is only valid for execution if all definitions are either
 * operation or fragment definitions.
 *
 * See https://spec.graphql.org/draft/#sec-Executable-Definitions
 */
function ExecutableDefinitionsRule(context) {
  return {
    Document(node) {
      for (const definition of node.definitions) {
        if (!(0, predicates_js_1.isExecutableDefinitionNode)(definition)) {
          const defName =
            definition.kind === kinds_js_1.Kind.SCHEMA_DEFINITION ||
            definition.kind === kinds_js_1.Kind.SCHEMA_EXTENSION
              ? 'schema'
              : '"' + definition.name.value + '"';
          context.reportError(
            new GraphQLError_js_1.GraphQLError(
              `The ${defName} definition is not executable.`,
              {
                nodes: definition,
              },
            ),
          );
        }
      }
      return false;
    },
  };
}
exports.ExecutableDefinitionsRule = ExecutableDefinitionsRule;
