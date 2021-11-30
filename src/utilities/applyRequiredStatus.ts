import type { GraphQLOutputType } from '../type/definition';
import {
  getNullableType,
  GraphQLNonNull,
  isNonNullType,
  assertListType,
  GraphQLList,
} from '../type/definition';
import type {
  SupportArrayNode,
  NullabilityModifierNode,
} from '../language/ast';
import type { ASTReducer } from '../language/visitor';
import { visit } from '../language/visitor';
import { GraphQLError } from '../error/GraphQLError';

/**
 * Implements the "Accounting For Client Controlled Nullability Designators"
 * section of the spec. In particular, this function figures out the true return
 * type of a field by taking into account both the nullability listed in the
 * schema, and the nullability providing by an operation.
 */
export function modifiedOutputType(
  type: GraphQLOutputType,
  nullabilityNode?: SupportArrayNode | NullabilityModifierNode,
): GraphQLOutputType {
  const typeStack: [GraphQLOutputType] = [type];

  const applyStatusReducer: ASTReducer<GraphQLOutputType> = {
    RequiredDesignator: {
      leave({ element }) {
        if (element) {
          return new GraphQLNonNull(getNullableType(element));
        }
        const nextType = typeStack.pop();

        if (!nextType) {
          throw new GraphQLError(
            'List nullability designator is too deep.',
            nullabilityNode,
          );
        }
        return new GraphQLNonNull(getNullableType(nextType));
      },
    },
    OptionalDesignator: {
      leave({ element }) {
        if (element) {
          return getNullableType(element);
        }
        const nextType = typeStack.pop();
        if (!nextType) {
          throw new GraphQLError(
            'List nullability designator is too deep.',
            nullabilityNode,
          );
        }

        return getNullableType(nextType);
      },
    },
    ListNullabilityDesignator: {
      enter() {
        const list = assertListType(getNullableType(typeStack.at(-1)));
        const elementType = list.ofType as GraphQLOutputType;
        typeStack.push(elementType);
      },
      leave({ element }) {
        const listType = typeStack.pop();
        if (!listType) {
          throw new GraphQLError(
            'List nullability designator is too deep.',
            nullabilityNode,
          );
        }
        const isRequired = isNonNullType(listType);
        if (element) {
          return isRequired
            ? new GraphQLNonNull(new GraphQLList(element))
            : new GraphQLList(element);
        }

        return isRequired
          ? new GraphQLNonNull(new GraphQLList(listType))
          : new GraphQLList(listType);
      },
    },
  };

  if (nullabilityNode) {
    return visit(nullabilityNode, applyStatusReducer);
  }

  return type;
}
