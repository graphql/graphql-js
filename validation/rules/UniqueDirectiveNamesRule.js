'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.UniqueDirectiveNamesRule = void 0;
const GraphQLError_js_1 = require('../../error/GraphQLError.js');
/**
 * Unique directive names
 *
 * A GraphQL document is only valid if all defined directives have unique names.
 */
function UniqueDirectiveNamesRule(context) {
  const knownDirectiveNames = new Map();
  const schema = context.getSchema();
  return {
    DirectiveDefinition(node) {
      const directiveName = node.name.value;
      if (schema?.getDirective(directiveName)) {
        context.reportError(
          new GraphQLError_js_1.GraphQLError(
            `Directive "@${directiveName}" already exists in the schema. It cannot be redefined.`,
            { nodes: node.name },
          ),
        );
        return;
      }
      const knownName = knownDirectiveNames.get(directiveName);
      if (knownName) {
        context.reportError(
          new GraphQLError_js_1.GraphQLError(
            `There can be only one directive named "@${directiveName}".`,
            { nodes: [knownName, node.name] },
          ),
        );
      } else {
        knownDirectiveNames.set(directiveName, node.name);
      }
      return false;
    },
  };
}
exports.UniqueDirectiveNamesRule = UniqueDirectiveNamesRule;
