import inspect from '../../jsutils/inspect';
import { GraphQLError } from '../../error/GraphQLError';
import { isCompositeType } from '../../type/definition';
import { typeFromAST } from '../../utilities/typeFromAST';
import { doTypesOverlap } from '../../utilities/typeComparators';

/**
 * Possible fragment spread
 *
 * A fragment spread is only valid if the type condition could ever possibly
 * be true: if there is a non-empty intersection of the possible parent types,
 * and possible types which pass the type condition.
 */
export function PossibleFragmentSpreads(context) {
  return {
    InlineFragment: function InlineFragment(node) {
      var fragType = context.getType();
      var parentType = context.getParentType();

      if (isCompositeType(fragType) && isCompositeType(parentType) && !doTypesOverlap(context.getSchema(), fragType, parentType)) {
        var parentTypeStr = inspect(parentType);
        var fragTypeStr = inspect(fragType);
        context.reportError(new GraphQLError("Fragment cannot be spread here as objects of type \"".concat(parentTypeStr, "\" can never be of type \"").concat(fragTypeStr, "\"."), node));
      }
    },
    FragmentSpread: function FragmentSpread(node) {
      var fragName = node.name.value;
      var fragType = getFragmentType(context, fragName);
      var parentType = context.getParentType();

      if (fragType && parentType && !doTypesOverlap(context.getSchema(), fragType, parentType)) {
        var parentTypeStr = inspect(parentType);
        var fragTypeStr = inspect(fragType);
        context.reportError(new GraphQLError("Fragment \"".concat(fragName, "\" cannot be spread here as objects of type \"").concat(parentTypeStr, "\" can never be of type \"").concat(fragTypeStr, "\"."), node));
      }
    }
  };
}

function getFragmentType(context, name) {
  var frag = context.getFragment(name);

  if (frag) {
    var type = typeFromAST(context.getSchema(), frag.typeCondition);

    if (isCompositeType(type)) {
      return type;
    }
  }
}
