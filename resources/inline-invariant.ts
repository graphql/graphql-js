import ts from 'typescript';

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
export function inlineInvariant(context: ts.TransformationContext) {
  const { factory } = context;

  return visitSourceFile;

  function visitSourceFile(sourceFile: ts.SourceFile) {
    return ts.visitNode(sourceFile, visitNode, ts.isSourceFile);
  }

  function visitNode(node: ts.Node): ts.Node {
    if (ts.isCallExpression(node)) {
      const { expression, arguments: args } = node;

      if (ts.isIdentifier(expression) && args.length > 0) {
        const funcName = expression.escapedText;
        if (funcName === 'invariant' || funcName === 'devAssert') {
          const [condition, ...otherArgs] = args;

          return factory.createBinaryExpression(
            factory.createParenthesizedExpression(condition),
            ts.SyntaxKind.BarBarToken,
            factory.createCallExpression(expression, undefined, [
              factory.createFalse(),
              ...otherArgs,
            ]),
          );
        }
      }
    }
    return ts.visitEachChild(node, visitNode, context);
  }
}
