import type { GraphQLOutputType } from '../type/definition';
import {
  getNullableType,
  GraphQLNonNull,
  isNonNullType,
  assertListType,
  GraphQLList,
} from '../type/definition';
import type { ComplexRequiredStatus } from '../language/ast';
import { RequiredStatus } from '../language/ast';

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
  if (required === RequiredStatus.REQUIRED && !isNonNullType(type)) {
    return new GraphQLNonNull(type);
  } else if (required === RequiredStatus.OPTIONAL) {
    return getNullableType(type);
  }
  return type;
}

export function modifiedOutputType(
  type: GraphQLOutputType,
  required: ComplexRequiredStatus,
): GraphQLOutputType {
  if (!required.subStatus) {
    return simpleModifiedOutputType(type, required.status);
  }

  // If execution reaches this point, type is a list.
  const listType = assertListType(getNullableType(type));
  const elementType = listType.ofType as GraphQLOutputType;
  const prev = modifiedOutputType(elementType, required.subStatus);
  let constructedType = new GraphQLList(prev);

  if (isNonNullType(type)) {
    constructedType = new GraphQLNonNull(constructedType);
  }

  return simpleModifiedOutputType(constructedType, required.status);
}
