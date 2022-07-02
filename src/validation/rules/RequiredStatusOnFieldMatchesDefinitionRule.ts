import { GraphQLError } from '../../error/GraphQLError';

import type {
  FieldNode,
  ListNullabilityOperatorNode,
  NullabilityAssertionNode,
} from '../../language/ast';
import type { ASTReducer, ASTVisitor } from '../../language/visitor';
import { visit } from '../../language/visitor';

import type { GraphQLOutputType } from '../../type/definition';
import {
  assertListType,
  getNullableType,
  isListType,
} from '../../type/definition';

import type { ValidationContext } from '../ValidationContext';

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
      const requiredNode = node.nullabilityAssertion;
      if (fieldDef && requiredNode) {
        const typeDepth = getTypeDepth(fieldDef.type);
        const designatorDepth = getDesignatorDepth(requiredNode);

        if (typeDepth > designatorDepth) {
          context.reportError(
            new GraphQLError('List nullability modifier is too shallow.', {
              nodes: node.nullabilityAssertion,
            }),
          );
        } else if (typeDepth < designatorDepth) {
          context.reportError(
            new GraphQLError('List nullability modifier is too deep.', {
              nodes: node.nullabilityAssertion,
            }),
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
    designator: ListNullabilityOperatorNode | NullabilityAssertionNode,
  ): number {
    const getDepth: ASTReducer<number> = {
      NonNullAssertion: {
        leave({ nullabilityAssertion }) {
          return nullabilityAssertion ?? 0;
        },
      },

      ErrorBoundary: {
        leave({ nullabilityAssertion }) {
          return nullabilityAssertion ?? 0;
        },
      },

      ListNullabilityOperator: {
        leave({ nullabilityAssertion }) {
          return (nullabilityAssertion ?? 0) + 1;
        },
      },
    };

    return visit(designator, getDepth);
  }
}
