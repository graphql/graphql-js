import type { GraphQLOutputType } from '../type/definition';
import {
  getNullableType,
  GraphQLNonNull,
  isNonNullType,
  assertListType,
  GraphQLList
} from '../type/definition';
import type { SupportArrayNode, NullabilityModifierNode } from '../language/ast';
import { ASTReducer, visit } from '../language/visitor';

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
  let typeStack: [GraphQLOutputType] = [type];

  const applyStatusReducer: ASTReducer<GraphQLOutputType> = {
    RequiredDesignator: {
      leave({
        element
      }) {
        if (element){
          return new GraphQLNonNull(getNullableType(element));
        } else {
          return new GraphQLNonNull(getNullableType(typeStack.pop()!));
        }
      },
    },
    OptionalDesignator: {
      leave({
        element
      }) {
        if (element) {
          return getNullableType(element);
        } else {
          return getNullableType(typeStack.pop()!);
        }
      }
    },
    ListNullabilityDesignator: {
      enter() {
        let list = assertListType(getNullableType(typeStack.at(-1)));
        let elementType = list.ofType as GraphQLOutputType;
        typeStack.push(elementType);
      },
      leave({
        element
      }) {
        let listType = typeStack.pop()!;
        let isRequired = isNonNullType(listType);
        if (element) {
          return isRequired 
            ? new GraphQLNonNull(new GraphQLList(element))
            : new GraphQLList(element);
        } else {
          return isRequired 
          ? new GraphQLNonNull(new GraphQLList(listType))
          : new GraphQLList(listType);
        }
      }
    }
  }

  if (nullabilityNode) {
    return visit(nullabilityNode, applyStatusReducer);
  } else {
    return type;
  }
}
