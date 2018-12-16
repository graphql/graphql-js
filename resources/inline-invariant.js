/**
 * Copyright (c) 2015-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @noflow
 */

'use strict';

/**
 * Eliminates function call to `invariant` if the condition is met.
 *
 * Transforms:
 *
 *  invariant(<cond>, ...)
 *
 * to:
 *
 *  !<cond> ? invariant(0, ...) : undefined;
 */
module.exports = function inlineInvariant(context) {
  const t = context.types;

  return {
    visitor: {
      CallExpression: function(path) {
        var node = path.node;
        var parent = path.parent;

        if (!isAppropriateInvariantCall(node, parent)) {
          return;
        }

        var args = node.arguments.slice(0);
        args[0] = t.numericLiteral(0);

        path.replaceWith(
          t.ifStatement(
            t.unaryExpression('!', node.arguments[0]),
            t.expressionStatement(
              t.callExpression(t.identifier(node.callee.name), args)
            )
          )
        );
      },
    },
  };
};

function isAppropriateInvariantCall(node, parent) {
  return (
    node.callee.type === 'Identifier' &&
    node.callee.name === 'invariant' &&
    node.arguments.length > 0 &&
    parent.type === 'ExpressionStatement'
  );
}
