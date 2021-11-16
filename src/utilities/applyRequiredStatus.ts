import type { RequiredStatus } from '../language/ast';
import type { GraphQLOutputType } from '../type/definition';
import {
  getNullableType,
  GraphQLNonNull,
  isNonNullType,
  assertListType,
  GraphQLList,
  isListType
} from '../type/definition';
import { ComplexRequiredStatus } from '../language/ast';
import { print } from '..';

/**
 * Implements the "Accounting For Client Controlled Nullability Designators"
 * section of the spec. In particular, this function figures out the true return
 * type of a field by taking into account both the nullability listed in the
 * schema, and the nullability providing by an operation.
 */
 function simpleModifiedOutputType(
  type: GraphQLOutputType,
  required: RequiredStatus,
): GraphQLOutputType {
  if (required === 'required' && !isNonNullType(type)) {
    return new GraphQLNonNull(type);
  } else if (required === 'optional') {
    return getNullableType(type);
  }
  return type;
}

export function modifiedOutputType(
  type: GraphQLOutputType,
  required: ComplexRequiredStatus,
): GraphQLOutputType {
  if (!required.subStatus) {
    return simpleModifiedOutputType(type, required.status)
  }

  // If execution reaches this point, type is a list.
  let listType = assertListType(getNullableType(type));
  let elementType = listType.ofType as GraphQLOutputType;
  let prev = modifiedOutputType(elementType, required.subStatus);
  var constructedType = new GraphQLList(prev);

  if (isNonNullType(type)) {
    constructedType = new GraphQLNonNull(constructedType);
  }

  return simpleModifiedOutputType(constructedType, required.status);
}
