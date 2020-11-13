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
  const invariantTemplate = context.template(`
    (%%cond%%) || invariant(0, %%args%%)
  `);
  const assertTemplate = context.template(`
    (%%cond%%) || devAssert(0, %%args%%)
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
