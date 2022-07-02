import { GraphQLError } from '../error/GraphQLError';

import type { NullabilityAssertionNode } from '../language/ast';
import { Kind } from '../language/kinds';
import type { ASTReducer } from '../language/visitor';
import { visit } from '../language/visitor';

import type { GraphQLOutputType } from '../type/definition';
import {
  assertListType,
  getNullableType,
  GraphQLList,
  GraphQLNonNull,
  isListType,
  isNonNullType,
} from '../type/definition';

/**
 * Implements the "Accounting For Client Controlled Nullability Designators"
 * section of the spec. In particular, this function figures out the true return
 * type of a field by taking into account both the nullability listed in the
 * schema, and the nullability providing by an operation.
 *
 * @internal
 */
export function applyRequiredStatus(
  type: GraphQLOutputType,
  nullabilityNode: NullabilityAssertionNode | undefined,
): GraphQLOutputType {
  // If the field is marked with 0 or 1 nullability designator
  //  short-circuit
  if (nullabilityNode === undefined) {
    return type;
  } else if (nullabilityNode?.nullabilityAssertion === undefined) {
    if (nullabilityNode?.kind === Kind.NON_NULL_ASSERTION) {
      return new GraphQLNonNull(getNullableType(type));
    } else if (nullabilityNode?.kind === Kind.ERROR_BOUNDARY) {
      return getNullableType(type);
    }
  }

  const typeStack: [GraphQLOutputType] = [type];

  // Load the nullable version each type in the type definition to typeStack
  while (isListType(getNullableType(typeStack[typeStack.length - 1]))) {
    const list = assertListType(
      getNullableType(typeStack[typeStack.length - 1]),
    );
    const elementType = list.ofType as GraphQLOutputType;
    typeStack.push(elementType);
  }

  // Re-apply nullability to each level of the list from the outside in
  const applyStatusReducer: ASTReducer<GraphQLOutputType> = {
    NonNullAssertion: {
      leave({ nullabilityAssertion }) {
        if (nullabilityAssertion) {
          return new GraphQLNonNull(getNullableType(nullabilityAssertion));
        }

        // We're working with the inner-most type
        const nextType = typeStack.pop();

        // There's no way for nextType to be null if both type and nullabilityNode are valid
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        return new GraphQLNonNull(getNullableType(nextType!));
      },
    },
    ErrorBoundary: {
      leave({ nullabilityAssertion }) {
        if (nullabilityAssertion) {
          return getNullableType(nullabilityAssertion);
        }

        // We're working with the inner-most type
        const nextType = typeStack.pop();

        // There's no way for nextType to be null if both type and nullabilityNode are valid
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        return getNullableType(nextType!);
      },
    },
    ListNullabilityOperator: {
      leave({ nullabilityAssertion }) {
        let listType = typeStack.pop();
        // Skip to the inner-most list
        if (!isListType(getNullableType(listType))) {
          listType = typeStack.pop();
        }

        if (!listType) {
          throw new GraphQLError(
            'List nullability modifier is too deep.',
            {
              nodes: nullabilityNode
            },
          );
        }
        const isRequired = isNonNullType(listType);
        if (nullabilityAssertion) {
          return isRequired
            ? new GraphQLNonNull(new GraphQLList(nullabilityAssertion))
            : new GraphQLList(nullabilityAssertion);
        }

        // We're working with the inner-most list
        return listType;
      },
    },
  };

  const modified = visit(nullabilityNode, applyStatusReducer);
  // modifiers must be exactly the same depth as the field type
  if (typeStack.length > 0) {
    throw new GraphQLError(
      'List nullability modifier is too shallow.',
      {
        nodes: nullabilityNode
      },
    );
  }
  return modified;
}
