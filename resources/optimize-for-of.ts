import assert from 'node:assert';

import ts from 'typescript';

/**
 * The following ES6 code:
 *
 * ```
 * for (let v of expr) { }
 * ```
 *
 * should be emitted as
 *
 * ```
 * for (let _i = 0, _a = expr; _i < _a.length; _i++) {
 *     let v = _a[_i];
 * }
 * ```
 *
 * where _a and _i are temps emitted to capture the RHS and the counter, respectively.
 * When the left hand side is a let/const, the v is renamed if there is another v in scope.
 * Note that all assignments to the LHS are emitted in the body, including all destructuring.
 *
 * Code is based on TS ES5 transpilation:
 * https://github.com/microsoft/TypeScript/blob/71e852922888337ef51a0e48416034a94a6c34d9/src/compiler/transformers/es2015.ts#L2521
 */
export const optimizeForOf = (program: ts.Program) => {
  const transformer: ts.TransformerFactory<ts.SourceFile> = (context: ts.TransformationContext) => {
    const typeChecker = program.getTypeChecker();
    const { factory } = context;

    return (node: ts.SourceFile) => {
      return visitSourceFile(node) as ts.SourceFile;
    };

    function visitSourceFile(sourceFile: ts.SourceFile) {
      return ts.visitNode(sourceFile, visitNode);

      function visitNode(node: ts.Node): ts.Node {
        if (isArrayForOfStatement(node)) {
          return convertForOfStatementForArray(node);
        }
        return ts.visitEachChild(node, visitNode, context);
      }

      function isArrayForOfStatement(node: ts.Node): node is ts.ForOfStatement {
        if (!ts.isForOfStatement(node) || node.awaitModifier != null) {
          return false;
        }

        const { expression } = node;

        const expressionType = typeChecker.getTypeAtLocation(expression);

        for (const subType of unionTypeParts(expressionType)) {
          assert(
            !(subType.flags & (ts.TypeFlags.Any | ts.TypeFlags.Unknown)),
            'Can not use any or uknown values in for-of loop: ' +
              nodeLocationString(node),
          );

          if (subType.flags & ts.TypeFlags.StringLike) {
            continue;
          }

          const typeName = subType.getSymbol()?.getName();
          assert(typeName != null);

          if (typeName === 'Array' || typeName === 'ReadonlyArray') {
            continue;
          }

          return false;
        }

        return true;
      }

      function nodeLocationString(node: ts.Node): string {
        const position = sourceFile.getLineAndCharacterOfPosition(
          node.getStart(),
        );
        return sourceFile.fileName + ':' + position.line;
      }

      function unionTypeParts(type: ts.Type): ReadonlyArray<ts.Type> {
        return isUnionType(type) ? type.types : [type];
      }

      function isUnionType(type: ts.Type): type is ts.UnionType {
        return (type.flags & ts.TypeFlags.Union) !== 0;
      }

      function convertForOfStatementForArray(
        forOfNode: ts.ForOfStatement,
      ): ts.Statement {
        const counter = factory.createLoopVariable();
        const forDeclarations = [
          factory.createVariableDeclaration(
            counter,
            undefined, // exclamationToken
            undefined, // type
            factory.createNumericLiteral(0),
          ),
        ];

        // In the case where the user wrote an identifier as the RHS, like this:
        //
        //     for (let v of arr) { }
        //
        // we don't want to emit a temporary variable for the RHS, just use it directly.
        let rhsReference;
        if (ts.isIdentifier(forOfNode.expression)) {
          rhsReference = forOfNode.expression;
        } else {
          rhsReference = factory.createTempVariable(
            undefined, // recordTempVariable
          );
          forDeclarations.push(
            factory.createVariableDeclaration(
              rhsReference,
              undefined, // exclamationToken
              undefined, // type
              forOfNode.expression,
            ),
          );
        }

        const forIntiliazer = factory.createVariableDeclarationList(
          forDeclarations,
          ts.NodeFlags.Let,
        );

        const forCondition = factory.createLessThan(
          counter,
          factory.createPropertyAccessExpression(rhsReference, 'length'),
        );
        const forIncrementor = factory.createPostfixIncrement(counter);

        assert(ts.isVariableDeclarationList(forOfNode.initializer));
        // It will use rhsIterationValue _a[_i] as the initializer.
        const itemAssigment = convertForOfInitializer(
          forOfNode.initializer,
          factory.createElementAccessExpression(rhsReference, counter),
        );

        assert(ts.isBlock(forOfNode.statement));
        const forBody = factory.updateBlock(forOfNode.statement, [
          itemAssigment,
          ...forOfNode.statement.statements,
        ]);

        return factory.createForStatement(
          forIntiliazer,
          forCondition,
          forIncrementor,
          forBody,
        );
      }

      function convertForOfInitializer(
        forOfDeclarationList: ts.VariableDeclarationList,
        itemAccessExpression: ts.Expression,
      ) {
        assert(forOfDeclarationList.declarations.length === 1);
        const [forOfDeclaration] = forOfDeclarationList.declarations;

        const updatedDeclaration = factory.updateVariableDeclaration(
          forOfDeclaration,
          forOfDeclaration.name,
          forOfDeclaration.exclamationToken,
          forOfDeclaration.type,
          itemAccessExpression,
        );

        return factory.createVariableStatement(
          undefined, // modifiers
          factory.updateVariableDeclarationList(forOfDeclarationList, [
            updatedDeclaration,
          ]),
        );
      }
    }
  };

  return transformer;
}
