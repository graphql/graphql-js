'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.isEqualType = isEqualType;
exports.isTypeSubTypeOf = isTypeSubTypeOf;
exports.doTypesOverlap = doTypesOverlap;

var _definition = require('../type/definition');

/**
 * Provided two types, return true if the types are equal (invariant).
 */
function isEqualType(typeA, typeB) {
  // Equivalent types are equal.
  if (typeA === typeB) {
    return true;
  }

  // If either type is non-null, the other must also be non-null.
  if (typeA instanceof _definition.GraphQLNonNull && typeB instanceof _definition.GraphQLNonNull) {
    return isEqualType(typeA.ofType, typeB.ofType);
  }

  // If either type is a list, the other must also be a list.
  if (typeA instanceof _definition.GraphQLList && typeB instanceof _definition.GraphQLList) {
    return isEqualType(typeA.ofType, typeB.ofType);
  }

  // Otherwise the types are not equal.
  return false;
}

/**
 * Provided a type and a super type, return true if the first type is either
 * equal or a subset of the second super type (covariant).
 */

/**
 *  Copyright (c) 2015, Facebook, Inc.
 *  All rights reserved.
 *
 *  This source code is licensed under the BSD-style license found in the
 *  LICENSE file in the root directory of this source tree. An additional grant
 *  of patent rights can be found in the PATENTS file in the same directory.
 */

function isTypeSubTypeOf(schema, maybeSubType, superType) {
  // Equivalent type is a valid subtype
  if (maybeSubType === superType) {
    return true;
  }

  // If superType is non-null, maybeSubType must also be non-null.
  if (superType instanceof _definition.GraphQLNonNull) {
    if (maybeSubType instanceof _definition.GraphQLNonNull) {
      return isTypeSubTypeOf(schema, maybeSubType.ofType, superType.ofType);
    }
    return false;
  } else if (maybeSubType instanceof _definition.GraphQLNonNull) {
    // If superType is nullable, maybeSubType may be non-null or nullable.
    return isTypeSubTypeOf(schema, maybeSubType.ofType, superType);
  }

  // If superType type is a list, maybeSubType type must also be a list.
  if (superType instanceof _definition.GraphQLList) {
    if (maybeSubType instanceof _definition.GraphQLList) {
      return isTypeSubTypeOf(schema, maybeSubType.ofType, superType.ofType);
    }
    return false;
  } else if (maybeSubType instanceof _definition.GraphQLList) {
    // If superType is not a list, maybeSubType must also be not a list.
    return false;
  }

  // If superType type is an abstract type, maybeSubType type may be a currently
  // possible object type.
  if ((0, _definition.isAbstractType)(superType) && maybeSubType instanceof _definition.GraphQLObjectType && schema.isPossibleType(superType, maybeSubType)) {
    return true;
  }

  // Otherwise, the child type is not a valid subtype of the parent type.
  return false;
}

/**
 * Provided two composite types, determine if they "overlap". Two composite
 * types overlap when the Sets of possible concrete types for each intersect.
 *
 * This is often used to determine if a fragment of a given type could possibly
 * be visited in a context of another type.
 *
 * This function is commutative.
 */
function doTypesOverlap(schema, typeA, typeB) {
  // So flow is aware this is constant
  var _typeB = typeB;

  // Equivalent types overlap
  if (typeA === _typeB) {
    return true;
  }

  if (typeA instanceof _definition.GraphQLInterfaceType || typeA instanceof _definition.GraphQLUnionType) {
    if (_typeB instanceof _definition.GraphQLInterfaceType || _typeB instanceof _definition.GraphQLUnionType) {
      // If both types are abstract, then determine if there is any intersection
      // between possible concrete types of each.
      return schema.getPossibleTypes(typeA).some(function (type) {
        return schema.isPossibleType(_typeB, type);
      });
    }
    // Determine if the latter type is a possible concrete type of the former.
    return schema.isPossibleType(typeA, _typeB);
  }

  if (_typeB instanceof _definition.GraphQLInterfaceType || _typeB instanceof _definition.GraphQLUnionType) {
    // Determine if the former type is a possible concrete type of the latter.
    return schema.isPossibleType(_typeB, typeA);
  }

  // Otherwise the types do not overlap.
  return false;
}