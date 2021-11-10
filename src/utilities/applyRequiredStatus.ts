import type { RequiredStatus } from '../language/ast';
import type { GraphQLOutputType } from '../type/definition';
import {
  getNullableType,
  GraphQLNonNull,
  isNonNullType,
  isListType,
  assertListType,
  GraphQLList
} from '../type/definition';
import { ComplexRequiredStatus } from '../language/ast';

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

  // We expect this to only be used on lists. Everything that's not a list that the [!] operator
  //   was applied to should have been caught by the validator
  let listType = assertListType(type);
  let elementType = listType.ofType as GraphQLOutputType;
  return simpleModifiedOutputType(new GraphQLList(modifiedOutputType(elementType, required.subStatus)), required.status);
}
