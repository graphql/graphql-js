import type { GraphQLOutputType } from '../../../type/definition.ts';
import {
  isLeafType,
  isListType,
  isNonNullType,
} from '../../../type/definition.ts';

/**
 * Returns whether two output types have different response shapes according to
 * SameResponseShape.
 *
 * @internal
 */
export function doTypesConflict(
  type1: GraphQLOutputType,
  type2: GraphQLOutputType,
): boolean {
  if (isListType(type1)) {
    return isListType(type2)
      ? doTypesConflict(type1.ofType, type2.ofType)
      : true;
  }
  if (isListType(type2)) {
    return true;
  }
  if (isNonNullType(type1)) {
    return isNonNullType(type2)
      ? doTypesConflict(type1.ofType, type2.ofType)
      : true;
  }
  if (isNonNullType(type2)) {
    return true;
  }
  if (isLeafType(type1) || isLeafType(type2)) {
    return type1 !== type2;
  }
  return false;
}
