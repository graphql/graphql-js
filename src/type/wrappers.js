/**
 * Copyright (c) 2015-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow strict
 */

import { assertType, assertNullableType } from './definition';
import type { GraphQLType, GraphQLNullableType } from './definition';

/**
 * List Type Wrapper
 *
 * A list is a wrapping type which points to another type.
 * Lists are often created within the context of defining the fields of
 * an object type.
 *
 * Example:
 *
 *     const PersonType = new GraphQLObjectType({
 *       name: 'Person',
 *       fields: () => ({
 *         parents: { type: GraphQLList(PersonType) },
 *         children: { type: GraphQLList(PersonType) },
 *       })
 *     })
 *
 */
declare class GraphQLList<+T: GraphQLType> {
  +ofType: T;
  static <T>(ofType: T): GraphQLList<T>;
  // Note: constructors cannot be used for covariant types. Drop the "new".
  constructor(ofType: any): void;
}
// eslint-disable-next-line no-redeclare
export function GraphQLList(ofType) {
  if (this instanceof GraphQLList) {
    this.ofType = assertType(ofType);
  } else {
    return new GraphQLList(ofType);
  }
}

// Also provide toJSON and inspect aliases for toString.
const listProto: any = GraphQLList.prototype;
listProto.toString = listProto.toJSON = listProto.inspect = function toString() {
  return '[' + String(this.ofType) + ']';
};

/**
 * Non-Null Type Wrapper
 *
 * A non-null is a wrapping type which points to another type.
 * Non-null types enforce that their values are never null and can ensure
 * an error is raised if this ever occurs during a request. It is useful for
 * fields which you can make a strong guarantee on non-nullability, for example
 * usually the id field of a database row will never be null.
 *
 * Example:
 *
 *     const RowType = new GraphQLObjectType({
 *       name: 'Row',
 *       fields: () => ({
 *         id: { type: GraphQLNonNull(GraphQLString) },
 *       })
 *     })
 *
 * Note: the enforcement of non-nullability occurs within the executor.
 */
declare class GraphQLNonNull<+T: GraphQLNullableType> {
  +ofType: T;
  static <T>(ofType: T): GraphQLNonNull<T>;
  // Note: constructors cannot be used for covariant types. Drop the "new".
  constructor(ofType: any): void;
}
// eslint-disable-next-line no-redeclare
export function GraphQLNonNull(ofType) {
  if (this instanceof GraphQLNonNull) {
    this.ofType = assertNullableType(ofType);
  } else {
    return new GraphQLNonNull(ofType);
  }
}

// Also provide toJSON and inspect aliases for toString.
const nonNullProto: any = GraphQLNonNull.prototype;
nonNullProto.toString = nonNullProto.toJSON = nonNullProto.inspect = function toString() {
  return String(this.ofType) + '!';
};
