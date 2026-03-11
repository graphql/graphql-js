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
 *  if (!(<cond>)) invariant(false, ...)
 */
export function inlineInvariant(
  context: ts.TransformationContext,
): ts.Transformer<ts.SourceFile> {
  const { factory } = context;

  return visitSourceFile;

  function visitSourceFile(sourceFile: ts.SourceFile): ts.SourceFile {
    return ts.visitNode(sourceFile, visitNode, ts.isSourceFile);
  }

  function visitNode(node: ts.Node): ts.Node {
    if (ts.isExpressionStatement(node)) {
      const expression = node.expression;

      if (ts.isCallExpression(expression)) {
        const { arguments: args } = expression;

        if (ts.isIdentifier(expression.expression) && args.length > 0) {
          const funcName = expression.expression.escapedText;
          if (funcName === 'invariant' || funcName === 'devAssert') {
            const [condition, ...otherArgs] = args;
            if (condition.kind === ts.SyntaxKind.FalseKeyword) {
              return node;
            }
            const inverseCondition = factory.createPrefixUnaryExpression(
              ts.SyntaxKind.ExclamationToken,
              factory.createParenthesizedExpression(condition),
            );

            return factory.createIfStatement(
              inverseCondition,
              factory.createExpressionStatement(
                factory.createCallExpression(expression.expression, undefined, [
                  factory.createFalse(),
                  ...otherArgs,
                ]),
              ),
            );
          }
        }
      }
    }

    return ts.visitEachChild(node, visitNode, context);
  }
}
