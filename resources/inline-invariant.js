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
 *  (<cond>) || invariant(false ...)
 */
module.exports = function inlineInvariant(context) {
  const invariantTemplate = context.template(`
    (%%cond%%) || invariant(false, %%args%%)
  `);
  const assertTemplate = context.template(`
    (%%cond%%) || devAssert(false, %%args%%)
  `);

  return {
    visitor: {
      CallExpression(path) {
        const node = path.node;
        const parent = path.parent;

        if (
          parent.type !== 'ExpressionStatement' ||
          node.callee.type !== 'Identifier' ||
          node.arguments.length === 0
        ) {
          return;
        }

        const calleeName = node.callee.name;
        if (calleeName === 'invariant') {
          const [cond, args] = node.arguments;

          path.replaceWith(invariantTemplate({ cond, args }));
        } else if (calleeName === 'devAssert') {
          const [cond, args] = node.arguments;
          path.replaceWith(assertTemplate({ cond, args }));
        }
      },
    },
  };
};
