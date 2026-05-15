/** @category Type Comparisons */

import type { GraphQLCompositeType, GraphQLType } from '../type/definition.ts';
import {
  isAbstractType,
  isInterfaceType,
  isListType,
  isNonNullType,
  isObjectType,
} from '../type/definition.ts';
import type { GraphQLSchema } from '../type/schema.ts';

/**
 * Provided two types, return true if the types are equal (invariant).
 * @param typeA - The first GraphQL type to compare.
 * @param typeB - The second GraphQL type to compare.
 * @returns True when both types are equal.
 * @example
 * ```ts
 * import {
 *   GraphQLList,
 *   GraphQLNonNull,
 *   GraphQLString,
 * } from 'graphql/type';
 * import { isEqualType } from 'graphql/utilities';
 *
 * isEqualType(GraphQLString, GraphQLString); // => true
 * isEqualType(new GraphQLList(GraphQLString), new GraphQLList(GraphQLString)); // => true
 * isEqualType(new GraphQLNonNull(GraphQLString), GraphQLString); // => false
 * ```
 */
export function isEqualType(typeA: GraphQLType, typeB: GraphQLType): boolean {
  // Equivalent types are equal.
  if (typeA === typeB) {
    return true;
  }

  // If either type is non-null, the other must also be non-null.
  if (isNonNullType(typeA) && isNonNullType(typeB)) {
    return isEqualType(typeA.ofType, typeB.ofType);
  }

  // If either type is a list, the other must also be a list.
  if (isListType(typeA) && isListType(typeB)) {
    return isEqualType(typeA.ofType, typeB.ofType);
  }

  // Otherwise the types are not equal.
  return false;
}

/**
 * Provided a type and a super type, return true if the first type is either
 * equal or a subset of the second super type (covariant).
 * @param schema - GraphQL schema to use.
 * @param maybeSubType - The possible subtype to compare.
 * @param superType - The possible supertype to compare.
 * @returns True when `maybeSubType` is equal to or a subtype of `superType`.
 * @example
 * ```ts
 * import { buildSchema } from 'graphql/utilities';
 * import {
 *   GraphQLNonNull,
 *   assertInterfaceType,
 *   assertObjectType,
 * } from 'graphql/type';
 * import { isTypeSubTypeOf } from 'graphql/utilities';
 *
 * const schema = buildSchema(`
 *   interface Node {
 *     id: ID!
 *   }
 *
 *   type User implements Node {
 *     id: ID!
 *   }
 *
 *   type Query {
 *     node: Node
 *   }
 * `);
 * const Node = assertInterfaceType(schema.getType('Node'));
 * const User = assertObjectType(schema.getType('User'));
 *
 * isTypeSubTypeOf(schema, User, Node); // => true
 * isTypeSubTypeOf(schema, new GraphQLNonNull(User), Node); // => true
 * isTypeSubTypeOf(schema, Node, User); // => false
 * ```
 */
export function isTypeSubTypeOf(
  schema: GraphQLSchema,
  maybeSubType: GraphQLType,
  superType: GraphQLType,
): boolean {
  // Equivalent type is a valid subtype
  if (maybeSubType === superType) {
    return true;
  }

  // If superType is non-null, maybeSubType must also be non-null.
  if (isNonNullType(superType)) {
    if (isNonNullType(maybeSubType)) {
      return isTypeSubTypeOf(schema, maybeSubType.ofType, superType.ofType);
    }
    return false;
  }
  if (isNonNullType(maybeSubType)) {
    // If superType is nullable, maybeSubType may be non-null or nullable.
    return isTypeSubTypeOf(schema, maybeSubType.ofType, superType);
  }

  // If superType type is a list, maybeSubType type must also be a list.
  if (isListType(superType)) {
    if (isListType(maybeSubType)) {
      return isTypeSubTypeOf(schema, maybeSubType.ofType, superType.ofType);
    }
    return false;
  }
  if (isListType(maybeSubType)) {
    // If superType is not a list, maybeSubType must also be not a list.
    return false;
  }

  // If superType type is an abstract type, check if it is super type of maybeSubType.
  // Otherwise, the child type is not a valid subtype of the parent type.
  return (
    isAbstractType(superType) &&
    (isInterfaceType(maybeSubType) || isObjectType(maybeSubType)) &&
    schema.isSubType(superType, maybeSubType)
  );
}

/**
 * Provided two composite types, determine if they "overlap". Two composite
 * types overlap when the Sets of possible concrete types for each intersect.
 *
 * This is often used to determine if a fragment of a given type could possibly
 * be visited in a context of another type.
 *
 * This function is commutative.
 * @param schema - GraphQL schema to use.
 * @param typeA - The first GraphQL type to compare.
 * @param typeB - The second GraphQL type to compare.
 * @returns True when the two composite types can apply to at least one common object type.
 * @example
 * ```ts
 * import { buildSchema } from 'graphql/utilities';
 * import { assertObjectType, assertUnionType } from 'graphql/type';
 * import { doTypesOverlap } from 'graphql/utilities';
 *
 * const schema = buildSchema(`
 *   type Photo {
 *     url: String!
 *   }
 *
 *   type Video {
 *     url: String!
 *   }
 *
 *   union Media = Photo | Video
 *   union StillImage = Photo
 *
 *   type Query {
 *     media: [Media]
 *   }
 * `);
 * const Media = assertUnionType(schema.getType('Media'));
 * const StillImage = assertUnionType(schema.getType('StillImage'));
 * const Video = assertObjectType(schema.getType('Video'));
 *
 * doTypesOverlap(schema, Media, StillImage); // => true
 * doTypesOverlap(schema, StillImage, Video); // => false
 * ```
 */
export function doTypesOverlap(
  schema: GraphQLSchema,
  typeA: GraphQLCompositeType,
  typeB: GraphQLCompositeType,
): boolean {
  // Equivalent types overlap
  if (typeA === typeB) {
    return true;
  }

  if (isAbstractType(typeA)) {
    if (isAbstractType(typeB)) {
      // If both types are abstract, then determine if there is any intersection
      // between possible concrete types of each.
      return schema
        .getPossibleTypes(typeA)
        .some((type) => schema.isSubType(typeB, type));
    }
    // Determine if the latter type is a possible concrete type of the former.
    return schema.isSubType(typeA, typeB);
  }

  if (isAbstractType(typeB)) {
    // Determine if the former type is a possible concrete type of the latter.
    return schema.isSubType(typeB, typeA);
  }

  // Otherwise the types do not overlap.
  return false;
}
