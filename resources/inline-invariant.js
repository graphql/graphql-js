// @noflow

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
  const replaceTemplate = context.template(`
    (%%cond%%) || invariant(0, %%args%%)
  `);

  return {
    visitor: {
      CallExpression(path) {
        const node = path.node;
        const parent = path.parent;

        if (!isAppropriateInvariantCall(node, parent)) {
          return;
        }

        const [cond, args] = node.arguments;
        path.replaceWith(replaceTemplate({ cond, args }));
      },
    },
  };
};

function isAppropriateInvariantCall(node, parent) {
  return (
    parent.type === 'ExpressionStatement' &&
    node.callee.type === 'Identifier' &&
    node.callee.name === 'invariant' &&
    node.arguments.length > 0
  );
}
