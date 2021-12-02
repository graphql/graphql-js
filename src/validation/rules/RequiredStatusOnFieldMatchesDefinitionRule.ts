import type { FieldNode } from '../../language/ast';
import type { ASTVisitor } from '../../language/visitor';

import type { ValidationContext } from '../ValidationContext';
import { modifiedOutputType } from '../../utilities/applyRequiredStatus';

/**
 * List element nullability designators need to use a depth that is the same as or less than the
 *   type of the field it's applied to.
 *
 * Otherwise the GraphQL document is invalid.
 *
 * See https://spec.graphql.org/draft/#sec-Field-Selections
 */
export function RequiredStatusOnFieldMatchesDefinitionRule(
  context: ValidationContext,
): ASTVisitor {
  return {
    Field(node: FieldNode) {
      const fieldDef = context.getFieldDef();
      if (fieldDef) {
        try {
          modifiedOutputType(fieldDef.type, node.required);
        } catch (error) {
          context.reportError(error);
        }
      }
    },
  };
}
