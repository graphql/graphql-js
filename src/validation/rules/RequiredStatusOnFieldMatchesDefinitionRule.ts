import type {
  FieldNode,
  NullabilityModifierNode,
  SupportArrayNode,
} from '../../language/ast';

import type { ASTReducer, ASTVisitor } from '../../language/visitor';
import { visit } from '../../language/visitor';

import type { ValidationContext } from '../ValidationContext';
import type { GraphQLOutputType } from '../../type/definition';
import {
  assertListType,
  getNullableType,
  isListType,
} from '../../type/definition';

import { GraphQLError } from '../../error/GraphQLError';

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
      const requiredNode = node.required;
      if (fieldDef && requiredNode) {
        const typeDepth = getTypeDepth(fieldDef.type);
        const designatorDepth = getDesignatorDepth(requiredNode);

        if (typeDepth > designatorDepth) {
          context.reportError(
            new GraphQLError(
              'List nullability modifier is too shallow.',
              node.required,
            ),
          );
        } else if (typeDepth < designatorDepth) {
          context.reportError(
            new GraphQLError(
              'List nullability modifier is too deep.',
              node.required,
            ),
          );
        }
      }
    },
  };

  function getTypeDepth(type: GraphQLOutputType): number {
    let currentType = type;
    let depthCount = 0;
    while (isListType(getNullableType(currentType))) {
      const list = assertListType(getNullableType(currentType));
      const elementType = list.ofType as GraphQLOutputType;
      currentType = elementType;
      depthCount += 1;
    }
    return depthCount;
  }

  function getDesignatorDepth(
    designator: SupportArrayNode | NullabilityModifierNode,
  ): number {
    const getDepth: ASTReducer<number> = {
      RequiredDesignator: {
        leave({ element }) {
          return element ?? 0;
        },
      },

      OptionalDesignator: {
        leave({ element }) {
          return element ?? 0;
        },
      },

      ListNullabilityDesignator: {
        leave({ element }) {
          return (element ?? 0) + 1;
        },
      },
    };

    return visit(designator, getDepth);
  }
}
