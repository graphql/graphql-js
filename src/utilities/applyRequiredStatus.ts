import type { RequiredStatus } from '../language/ast';
import type { GraphQLOutputType } from '../type/definition';
import {
  getNullableType,
  GraphQLNonNull,
  isNonNullType,
} from '../type/definition';

/**
 * Implements the "Accounting For Client Controlled Nullability Designators"
 * section of the spec. In particular, this function figures out the true return
 * type of a field by taking into account both the nullability listed in the
 * schema, and the nullability providing by an operation.
 */
export function modifiedOutputType(
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
