/**
 * Copyright (c) 2015-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 *  strict
 */
import { GraphQLError } from '../../error/GraphQLError';
export function unusedFragMessage(fragName) {
  return "Fragment \"".concat(fragName, "\" is never used.");
}
/**
 * No unused fragments
 *
 * A GraphQL document is only valid if all fragment definitions are spread
 * within operations, or spread within other fragments spread within operations.
 */

export function NoUnusedFragments(context) {
  var operationDefs = [];
  var fragmentDefs = [];
  return {
    OperationDefinition: function OperationDefinition(node) {
      operationDefs.push(node);
      return false;
    },
    FragmentDefinition: function FragmentDefinition(node) {
      fragmentDefs.push(node);
      return false;
    },
    Document: {
      leave: function leave() {
        var fragmentNameUsed = Object.create(null);

        for (var _i = 0; _i < operationDefs.length; _i++) {
          var operation = operationDefs[_i];
          var _iteratorNormalCompletion = true;
          var _didIteratorError = false;
          var _iteratorError = undefined;

          try {
            for (var _iterator = context.getRecursivelyReferencedFragments(operation)[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
              var fragment = _step.value;
              fragmentNameUsed[fragment.name.value] = true;
            }
          } catch (err) {
            _didIteratorError = true;
            _iteratorError = err;
          } finally {
            try {
              if (!_iteratorNormalCompletion && _iterator.return != null) {
                _iterator.return();
              }
            } finally {
              if (_didIteratorError) {
                throw _iteratorError;
              }
            }
          }
        }

        for (var _i2 = 0; _i2 < fragmentDefs.length; _i2++) {
          var fragmentDef = fragmentDefs[_i2];
          var fragName = fragmentDef.name.value;

          if (fragmentNameUsed[fragName] !== true) {
            context.reportError(new GraphQLError(unusedFragMessage(fragName), [fragmentDef]));
          }
        }
      }
    }
  };
}