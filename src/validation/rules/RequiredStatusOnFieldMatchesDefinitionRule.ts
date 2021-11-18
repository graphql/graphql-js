import { GraphQLError } from '../../error/GraphQLError';

import type { FieldNode } from '../../language/ast';
import type { ASTVisitor } from '../../language/visitor';

import type { GraphQLField } from '../../type/definition';

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
      if (context.getFieldDef()) {
        const fieldDef = context.getFieldDef() as GraphQLField<
          unknown,
          unknown
        >;
        try {
          modifiedOutputType(fieldDef.type, node.required);
        } catch {
          context.reportError(
            new GraphQLError(
              `Syntax Error: Something is wrong with the nullability designator on ${
                node.alias?.value ?? node.name.value
              }. The type for that field in the schema is ${
                fieldDef.type
              } Is the correct list depth being used?`,
              node,
            ),
          );
        }
      }
    },
  };
}
