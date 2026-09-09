/** @category Validation Rules */

import { invariant } from '../../jsutils/invariant.ts';

import { GraphQLError } from '../../error/GraphQLError.ts';

import type { NameNode } from '../../language/ast.ts';

import type { ASTVisitorFn } from './ASTValidationContext.ts';

/**
 * Input object values must not provide the same field more than once.
 *
 * See https://spec.graphql.org/draft/#sec-Input-Object-Field-Uniqueness
 * @category Validation Rules
 
 * @internal
 */
export const UniqueInputFieldNamesASTVisitor: ASTVisitorFn = (context) => {
  const knownNameStack: Array<Map<string, NameNode>> = [];
  let knownNames = new Map<string, NameNode>();

  return {
    ObjectValue: {
      enter() {
        knownNameStack.push(knownNames);
        knownNames = new Map();
      },
      leave() {
        const prevKnownNames = knownNameStack.pop();
        invariant(prevKnownNames != null);
        knownNames = prevKnownNames;
      },
    },
    ObjectField(node) {
      const fieldName = node.name.value;
      const knownName = knownNames.get(fieldName);
      if (knownName != null) {
        context.reportError(
          new GraphQLError(duplicateInputFieldMessage(fieldName), {
            nodes: [knownName, node.name],
          }),
        );
      } else {
        knownNames.set(fieldName, node.name);
      }
    },
  };
};

function duplicateInputFieldMessage(fieldName: string): string {
  return `There can be only one input field named "${fieldName}".`;
}
