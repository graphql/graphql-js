'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.ScalarLeafsRule = void 0;
const inspect_js_1 = require('../../jsutils/inspect.js');
const GraphQLError_js_1 = require('../../error/GraphQLError.js');
const definition_js_1 = require('../../type/definition.js');
/**
 * Scalar leafs
 *
 * A GraphQL document is valid only if all leaf fields (fields without
 * sub selections) are of scalar or enum types.
 */
function ScalarLeafsRule(context) {
  return {
    Field(node) {
      const type = context.getType();
      const selectionSet = node.selectionSet;
      if (type) {
        if (
          (0, definition_js_1.isLeafType)(
            (0, definition_js_1.getNamedType)(type),
          )
        ) {
          if (selectionSet) {
            const fieldName = node.name.value;
            const typeStr = (0, inspect_js_1.inspect)(type);
            context.reportError(
              new GraphQLError_js_1.GraphQLError(
                `Field "${fieldName}" must not have a selection since type "${typeStr}" has no subfields.`,
                { nodes: selectionSet },
              ),
            );
          }
        } else if (!selectionSet) {
          const fieldName = node.name.value;
          const typeStr = (0, inspect_js_1.inspect)(type);
          context.reportError(
            new GraphQLError_js_1.GraphQLError(
              `Field "${fieldName}" of type "${typeStr}" must have a selection of subfields. Did you mean "${fieldName} { ... }"?`,
              { nodes: node },
            ),
          );
        }
      }
    },
  };
}
exports.ScalarLeafsRule = ScalarLeafsRule;
