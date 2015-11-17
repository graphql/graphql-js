/* @flow */
/**
 *  Copyright (c) 2015, Facebook, Inc.
 *  All rights reserved.
 *
 *  This source code is licensed under the BSD-style license found in the
 *  LICENSE file in the root directory of this source tree. An additional grant
 *  of patent rights can be found in the PATENTS file in the same directory.
 */

import {
  isAbstractType,
  GraphQLObjectType,
  GraphQLList,
  GraphQLNonNull,
} from '../type/definition';
import type { GraphQLType, GraphQLAbstractType } from '../type/definition';


/**
 * Provided two types, return true if the types are equal (invariant).
 */
export function isEqualType(typeA: GraphQLType, typeB: GraphQLType): boolean {
  // Equivalent types are equal.
  if (typeA === typeB) {
    return true;
  }

  // If either type is non-null, the other must also be non-null.
  if (typeA instanceof GraphQLNonNull && typeB instanceof GraphQLNonNull) {
    return isEqualType(typeA.ofType, typeB.ofType);
  }

  // If either type is a list, the other must also be a list.
  if (typeA instanceof GraphQLList && typeB instanceof GraphQLList) {
    return isEqualType(typeA.ofType, typeB.ofType);
  }

  // Otherwise the types are not equal.
  return false;
}

/**
 * Provided a type and a super type, return true if the first type is either
 * equal or a subset of the second super type (covariant).
 */
export function isTypeSubTypeOf(
  maybeSubType: GraphQLType,
  superType: GraphQLType
): boolean {
  // Equivalent type is a valid subtype
  if (maybeSubType === superType) {
    return true;
  }

  // If superType is non-null, maybeSubType must also be nullable.
  if (superType instanceof GraphQLNonNull) {
    if (maybeSubType instanceof GraphQLNonNull) {
      return isTypeSubTypeOf(maybeSubType.ofType, superType.ofType);
    }
    return false;
  } else if (maybeSubType instanceof GraphQLNonNull) {
    // If superType is nullable, maybeSubType may be non-null.
    return isTypeSubTypeOf(maybeSubType.ofType, superType);
  }

  // If superType type is a list, maybeSubType type must also be a list.
  if (superType instanceof GraphQLList) {
    if (maybeSubType instanceof GraphQLList) {
      return isTypeSubTypeOf(maybeSubType.ofType, superType.ofType);
    }
    return false;
  } else if (maybeSubType instanceof GraphQLList) {
    // If superType is not a list, maybeSubType must also be not a list.
    return false;
  }

  // If superType type is an abstract type, maybeSubType type may be a currently
  // possible object type.
  if (isAbstractType(superType) &&
      maybeSubType instanceof GraphQLObjectType &&
      ((superType: any): GraphQLAbstractType).isPossibleType(maybeSubType)) {
    return true;
  }

  // Otherwise, the child type is not a valid subtype of the parent type.
  return false;
}
