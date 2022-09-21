'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.doTypesOverlap = exports.isTypeSubTypeOf = exports.isEqualType = void 0;
const definition_js_1 = require('../type/definition.js');
/**
 * Provided two types, return true if the types are equal (invariant).
 */
function isEqualType(typeA, typeB) {
  // Equivalent types are equal.
  if (typeA === typeB) {
    return true;
  }
  // If either type is non-null, the other must also be non-null.
  if (
    (0, definition_js_1.isNonNullType)(typeA) &&
    (0, definition_js_1.isNonNullType)(typeB)
  ) {
    return isEqualType(typeA.ofType, typeB.ofType);
  }
  // If either type is a list, the other must also be a list.
  if (
    (0, definition_js_1.isListType)(typeA) &&
    (0, definition_js_1.isListType)(typeB)
  ) {
    return isEqualType(typeA.ofType, typeB.ofType);
  }
  // Otherwise the types are not equal.
  return false;
}
exports.isEqualType = isEqualType;
/**
 * Provided a type and a super type, return true if the first type is either
 * equal or a subset of the second super type (covariant).
 */
function isTypeSubTypeOf(schema, maybeSubType, superType) {
  // Equivalent type is a valid subtype
  if (maybeSubType === superType) {
    return true;
  }
  // If superType is non-null, maybeSubType must also be non-null.
  if ((0, definition_js_1.isNonNullType)(superType)) {
    if ((0, definition_js_1.isNonNullType)(maybeSubType)) {
      return isTypeSubTypeOf(schema, maybeSubType.ofType, superType.ofType);
    }
    return false;
  }
  if ((0, definition_js_1.isNonNullType)(maybeSubType)) {
    // If superType is nullable, maybeSubType may be non-null or nullable.
    return isTypeSubTypeOf(schema, maybeSubType.ofType, superType);
  }
  // If superType type is a list, maybeSubType type must also be a list.
  if ((0, definition_js_1.isListType)(superType)) {
    if ((0, definition_js_1.isListType)(maybeSubType)) {
      return isTypeSubTypeOf(schema, maybeSubType.ofType, superType.ofType);
    }
    return false;
  }
  if ((0, definition_js_1.isListType)(maybeSubType)) {
    // If superType is not a list, maybeSubType must also be not a list.
    return false;
  }
  // If superType type is an abstract type, check if it is super type of maybeSubType.
  // Otherwise, the child type is not a valid subtype of the parent type.
  return (
    (0, definition_js_1.isAbstractType)(superType) &&
    ((0, definition_js_1.isInterfaceType)(maybeSubType) ||
      (0, definition_js_1.isObjectType)(maybeSubType)) &&
    schema.isSubType(superType, maybeSubType)
  );
}
exports.isTypeSubTypeOf = isTypeSubTypeOf;
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
  // Equivalent types overlap
  if (typeA === typeB) {
    return true;
  }
  if ((0, definition_js_1.isAbstractType)(typeA)) {
    if ((0, definition_js_1.isAbstractType)(typeB)) {
      // If both types are abstract, then determine if there is any intersection
      // between possible concrete types of each.
      return schema
        .getPossibleTypes(typeA)
        .some((type) => schema.isSubType(typeB, type));
    }
    // Determine if the latter type is a possible concrete type of the former.
    return schema.isSubType(typeA, typeB);
  }
  if ((0, definition_js_1.isAbstractType)(typeB)) {
    // Determine if the former type is a possible concrete type of the latter.
    return schema.isSubType(typeB, typeA);
  }
  // Otherwise the types do not overlap.
  return false;
}
exports.doTypesOverlap = doTypesOverlap;
