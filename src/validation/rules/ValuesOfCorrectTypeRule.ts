import type { ASTVisitor } from '../../language/visitor';
import { Kind } from '../../language/kinds';
import { isValueNode } from '../../language/predicates';

import type { ValidationContext } from '../ValidationContext';
import { validateInputLiteral } from '../../utilities/validateInputValue';

/**
 * Value literals of correct type
 *
 * A GraphQL document is only valid if all value literals are of the type
 * expected at their position.
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
