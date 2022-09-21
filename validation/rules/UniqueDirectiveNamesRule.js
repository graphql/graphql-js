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
  const knownDirectiveNames = Object.create(null);
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
      if (knownDirectiveNames[directiveName]) {
        context.reportError(
          new GraphQLError_js_1.GraphQLError(
            `There can be only one directive named "@${directiveName}".`,
            { nodes: [knownDirectiveNames[directiveName], node.name] },
          ),
        );
      } else {
        knownDirectiveNames[directiveName] = node.name;
      }
      return false;
    },
  };
}
exports.UniqueDirectiveNamesRule = UniqueDirectiveNamesRule;
