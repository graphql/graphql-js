import { Kind } from '../../language/kinds.js';
import { isValueNode } from '../../language/predicates.js';
import type { ASTVisitor } from '../../language/visitor.js';

import { validateInputLiteral } from '../../utilities/validateInputValue.js';

import type { ValidationContext } from '../ValidationContext.js';

/**
 * Value literals of correct type
 *
 * A GraphQL document is only valid if all value literals are of the type
 * expected at their position.
 *
 * See https://spec.graphql.org/draft/#sec-Values-of-Correct-Type
 */
export function ValuesOfCorrectTypeRule(
  context: ValidationContext,
): ASTVisitor {
  return {
    enter(node) {
      if (isValueNode(node)) {
        const inputType =
          node.kind === Kind.LIST
            ? context.getParentInputType()
            : context.getInputType();
        if (inputType) {
          validateInputLiteral(node, inputType, undefined, (error) => {
            context.reportError(error);
          });
        }
        return false;
      }
    },
  };
}
