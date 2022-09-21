'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.PossibleFragmentSpreadsRule = void 0;
const inspect_js_1 = require('../../jsutils/inspect.js');
const GraphQLError_js_1 = require('../../error/GraphQLError.js');
const definition_js_1 = require('../../type/definition.js');
const typeComparators_js_1 = require('../../utilities/typeComparators.js');
const typeFromAST_js_1 = require('../../utilities/typeFromAST.js');
/**
 * Possible fragment spread
 *
 * A fragment spread is only valid if the type condition could ever possibly
 * be true: if there is a non-empty intersection of the possible parent types,
 * and possible types which pass the type condition.
 */
function PossibleFragmentSpreadsRule(context) {
  return {
    InlineFragment(node) {
      const fragType = context.getType();
      const parentType = context.getParentType();
      if (
        (0, definition_js_1.isCompositeType)(fragType) &&
        (0, definition_js_1.isCompositeType)(parentType) &&
        !(0, typeComparators_js_1.doTypesOverlap)(
          context.getSchema(),
          fragType,
          parentType,
        )
      ) {
        const parentTypeStr = (0, inspect_js_1.inspect)(parentType);
        const fragTypeStr = (0, inspect_js_1.inspect)(fragType);
        context.reportError(
          new GraphQLError_js_1.GraphQLError(
            `Fragment cannot be spread here as objects of type "${parentTypeStr}" can never be of type "${fragTypeStr}".`,
            { nodes: node },
          ),
        );
      }
    },
    FragmentSpread(node) {
      const fragName = node.name.value;
      const fragType = getFragmentType(context, fragName);
      const parentType = context.getParentType();
      if (
        fragType &&
        parentType &&
        !(0, typeComparators_js_1.doTypesOverlap)(
          context.getSchema(),
          fragType,
          parentType,
        )
      ) {
        const parentTypeStr = (0, inspect_js_1.inspect)(parentType);
        const fragTypeStr = (0, inspect_js_1.inspect)(fragType);
        context.reportError(
          new GraphQLError_js_1.GraphQLError(
            `Fragment "${fragName}" cannot be spread here as objects of type "${parentTypeStr}" can never be of type "${fragTypeStr}".`,
            { nodes: node },
          ),
        );
      }
    },
  };
}
exports.PossibleFragmentSpreadsRule = PossibleFragmentSpreadsRule;
function getFragmentType(context, name) {
  const frag = context.getFragment(name);
  if (frag) {
    const type = (0, typeFromAST_js_1.typeFromAST)(
      context.getSchema(),
      frag.typeCondition,
    );
    if ((0, definition_js_1.isCompositeType)(type)) {
      return type;
    }
  }
}
