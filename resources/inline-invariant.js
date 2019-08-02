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
  const invariantTemplate = context.template(`
    (%%cond%%) || invariant(0, %%args%%)
  `);
  const assertTemplate = context.template(`
    (%%cond%%) || devAssert(0, %%args%%)
  `);

  const t = context.types;
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

          // Check if it is unreachable invariant: "invariant(false, ...)"
          if (cond.type === 'BooleanLiteral' && cond.value === false) {
            addIstanbulIgnoreElse(path);
          } else {
            path.replaceWith(invariantTemplate({ cond, args }));
          }
          path.addComment('leading', ' istanbul ignore next ');
        } else if (calleeName === 'devAssert') {
          const [cond, args] = node.arguments;
          path.replaceWith(assertTemplate({ cond, args }));
        }
      },
    },
  };

  function addIstanbulIgnoreElse(path) {
    const parentStatement = path.getStatementParent();
    const previousStatement =
      parentStatement.container[parentStatement.key - 1];
    if (
      previousStatement != null &&
      previousStatement.type === 'IfStatement' &&
      previousStatement.alternate == null
    ) {
      t.addComment(previousStatement, 'leading', ' istanbul ignore else ');
    }
  }
};
