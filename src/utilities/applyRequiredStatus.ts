import type { GraphQLOutputType } from '../type/definition';
import {
  getNullableType,
  GraphQLNonNull,
  isNonNullType,
  assertListType,
  GraphQLList,
  isListType
} from '../type/definition';
import type { SupportArrayNode, OptionalModifierNode, RequiredModifierNode, NullabilityModifierNode } from '../language/ast';
import { Kind } from '../language/kinds';
import { ASTReducer, visit } from '../language/visitor';
import { GraphQLBoolean } from '..';



/**
 * Implements the "Accounting For Client Controlled Nullability Designators"
 * section of the spec. In particular, this function figures out the true return
 * type of a field by taking into account both the nullability listed in the
 * schema, and the nullability providing by an operation.
 */
function simpleModifiedOutputType(
  type: GraphQLOutputType,
  nullabilityNode: NullabilityModifierNode,
): GraphQLOutputType {
  if (nullabilityNode.kind === Kind.REQUIRED_DESIGNATOR && !isNonNullType(type)) {
    return new GraphQLNonNull(type);
  } else if (nullabilityNode.kind === Kind.OPTIONAL_DESIGNATOR) {
    return getNullableType(type);
  }
  return type;
}

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
          return new GraphQLNonNull(element);
        } else {
          return new GraphQLNonNull(typeStack.pop()!);
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
          return typeStack.pop()!;
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
  

  // if (nullabilityNode.kind == Kind.LIST_NULLABILITY && isListType(type)) {
  //   // If execution reaches this point, type is a list.
  //   const listType = assertListType(getNullableType(type));
  //   const elementType = listType.ofType as GraphQLOutputType;
  //   const prev = modifiedOutputType(elementType, nullabilityNode.element!);
  //   let constructedType = new GraphQLList(prev);

  //   if (isNonNullType(type)) {
  //     constructedType = new GraphQLNonNull(constructedType);
  //   }
  //   return constructedType;
  // } else if (
  //   nullabilityNode.kind == Kind.REQUIRED_DESIGNATOR 
  //   || nullabilityNode.kind == Kind.OPTIONAL_DESIGNATOR
  // ) {
  //   return simpleModifiedOutputType(type, nullabilityNode as NullabilityModifierNode);
  // } else {
  //   return type;
  // }
}
