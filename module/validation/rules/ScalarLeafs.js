
import { GraphQLError } from '../../error'; /**
                                             * Copyright (c) 2015-present, Facebook, Inc.
                                             *
                                             * This source code is licensed under the MIT license found in the
                                             * LICENSE file in the root directory of this source tree.
                                             *
                                             * 
                                             */

import { getNamedType, isLeafType } from '../../type/definition';


export function noSubselectionAllowedMessage(fieldName, type) {
  return 'Field "' + fieldName + '" must not have a selection since ' + ('type "' + String(type) + '" has no subfields.');
}

export function requiredSubselectionMessage(fieldName, type) {
  return 'Field "' + fieldName + '" of type "' + String(type) + '" must have a ' + ('selection of subfields. Did you mean "' + fieldName + ' { ... }"?');
}

/**
 * Scalar leafs
 *
 * A GraphQL document is valid only if all leaf fields (fields without
 * sub selections) are of scalar or enum types.
 */
export function ScalarLeafs(context) {
  return {
    Field: function Field(node) {
      var type = context.getType();
      var selectionSet = node.selectionSet;
      if (type) {
        if (isLeafType(getNamedType(type))) {
          if (selectionSet) {
            context.reportError(new GraphQLError(noSubselectionAllowedMessage(node.name.value, type), [selectionSet]));
          }
        } else if (!selectionSet) {
          context.reportError(new GraphQLError(requiredSubselectionMessage(node.name.value, type), [node]));
        }
      }
    }
  };
}