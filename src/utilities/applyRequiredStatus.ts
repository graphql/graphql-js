import type { GraphQLOutputType } from '../type/definition';
import {
  getNullableType,
  GraphQLNonNull,
  isNonNullType,
  assertListType,
  GraphQLList,
  isListType,
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

        // We're working with the inner-most type
        const nextType = typeStack.pop();

        if (!nextType) {
          throw new GraphQLError(
            'List nullability modifier is too deep.',
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

        // We're working with the inner-most type
        const nextType = typeStack.pop();

        if (!nextType) {
          throw new GraphQLError(
            'List nullability modifier is too deep.',
            nullabilityNode,
          );
        }

        return getNullableType(nextType);
      },
    },
    ListNullabilityDesignator: {
      enter() {
        try {
          const list = assertListType(getNullableType(typeStack.at(-1)));
          const elementType = list.ofType as GraphQLOutputType;
          typeStack.push(elementType);
        } catch (error) {
          // assertListType will throw an error if we try to dig into the type and it's not a list
          throw new GraphQLError(
            `${error} Was the list nullability modifier's depth more than the field types?`,
            nullabilityNode,
          );
        }
      },
      leave({ element }) {
        let listType = typeStack.pop();
        // Skip to the inner-most list
        if (!isListType(getNullableType(listType))) {
          listType = typeStack.pop();
        }

        if (!listType) {
          throw new GraphQLError(
            'List nullability modifier is too deep.',
            nullabilityNode,
          );
        }
        const isRequired = isNonNullType(listType);
        if (element) {
          return isRequired
            ? new GraphQLNonNull(new GraphQLList(element))
            : new GraphQLList(element);
        }

        // We're working with the inner-most list
        return isRequired ? new GraphQLNonNull(listType) : listType;
      },
    },
  };

  if (nullabilityNode) {
    const modified = visit(nullabilityNode, applyStatusReducer);
    // modifiers must be exactly the same depth as the field type
    if (typeStack.length > 0) {
      throw new GraphQLError(
        'List nullability modifier is too shallow.',
        nullabilityNode,
      );
    }
    return modified;
  }

  return type;
}
