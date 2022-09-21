'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.FragmentsOnCompositeTypesRule = void 0;
const GraphQLError_js_1 = require('../../error/GraphQLError.js');
const printer_js_1 = require('../../language/printer.js');
const definition_js_1 = require('../../type/definition.js');
const typeFromAST_js_1 = require('../../utilities/typeFromAST.js');
/**
 * Fragments on composite type
 *
 * Fragments use a type condition to determine if they apply, since fragments
 * can only be spread into a composite type (object, interface, or union), the
 * type condition must also be a composite type.
 *
 * See https://spec.graphql.org/draft/#sec-Fragments-On-Composite-Types
 */
function FragmentsOnCompositeTypesRule(context) {
  return {
    InlineFragment(node) {
      const typeCondition = node.typeCondition;
      if (typeCondition) {
        const type = (0, typeFromAST_js_1.typeFromAST)(
          context.getSchema(),
          typeCondition,
        );
        if (type && !(0, definition_js_1.isCompositeType)(type)) {
          const typeStr = (0, printer_js_1.print)(typeCondition);
          context.reportError(
            new GraphQLError_js_1.GraphQLError(
              `Fragment cannot condition on non composite type "${typeStr}".`,
              { nodes: typeCondition },
            ),
          );
        }
      }
    },
    FragmentDefinition(node) {
      const type = (0, typeFromAST_js_1.typeFromAST)(
        context.getSchema(),
        node.typeCondition,
      );
      if (type && !(0, definition_js_1.isCompositeType)(type)) {
        const typeStr = (0, printer_js_1.print)(node.typeCondition);
        context.reportError(
          new GraphQLError_js_1.GraphQLError(
            `Fragment "${node.name.value}" cannot condition on non composite type "${typeStr}".`,
            { nodes: node.typeCondition },
          ),
        );
      }
    },
  };
}
exports.FragmentsOnCompositeTypesRule = FragmentsOnCompositeTypesRule;
