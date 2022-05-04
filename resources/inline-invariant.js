'use strict';

const ts = require('typescript');

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
  const { factory } = context;

  return function visit(node) {
    if (ts.isCallExpression(node)) {
      const { expression, arguments: args } = node;

      if (ts.isIdentifier(expression) && args.length > 0) {
        const funcName = expression.escapedText;
        if (funcName === 'invariant' || funcName === 'devAssert') {
          const [condition, ...otherArgs] = args;

          return factory.createBinaryExpression(
            factory.createParenthesizedExpression(condition),
            ts.SyntaxKind.BarBarToken,
            factory.createCallExpression(
              factory.createIdentifier(funcName),
              undefined,
              [factory.createFalse(), ...otherArgs],
            ),
          );
        }
      }
    }
    return ts.visitEachChild(node, visit, context);
  };
};
