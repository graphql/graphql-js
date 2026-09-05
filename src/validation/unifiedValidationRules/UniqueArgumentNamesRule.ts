/** @category Validation Rules */

import { groupBy } from '../../jsutils/groupBy.ts';

import { GraphQLError } from '../../error/GraphQLError.ts';

import type { ArgumentNode } from '../../language/ast.ts';

import type { ASTVisitorFn } from './ASTValidationContext.ts';

/**
 * Arguments must be unique at each argument location.
 *
 * See https://spec.graphql.org/draft/#sec-Argument-Names
 * @category Validation Rules
 
 * @internal
 */
export const UniqueArgumentNamesASTVisitor: ASTVisitorFn = (context) => {
  return {
    Field: checkArgUniqueness,
    Directive: checkArgUniqueness,
  };

  function checkArgUniqueness(parentNode: {
    arguments?: ReadonlyArray<ArgumentNode> | undefined;
  }): void {
    checkArgUniquenessWithReporter(parentNode, (message, nodes) => {
      context.reportError(new GraphQLError(message, { nodes }));
    });
  }
};

function checkArgUniquenessWithReporter(
  parentNode: {
    arguments?: ReadonlyArray<ArgumentNode> | undefined;
  },
  reportError: (
    message: string,
    nodes: ReadonlyArray<ArgumentNode['name']>,
  ) => void,
): void {
  const argumentNodes = parentNode.arguments;
  if (argumentNodes == null) {
    return;
  }
  const seenArgs = groupBy(argumentNodes, (arg) => arg.name.value);

  for (const [argName, argNodes] of seenArgs) {
    if (argNodes.length > 1) {
      reportError(
        `There can be only one argument named "${argName}".`,
        argNodes.map((node) => node.name),
      );
    }
  }
}
