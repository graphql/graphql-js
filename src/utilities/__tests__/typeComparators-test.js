/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow strict
 */

import { describe, it } from 'mocha';
import { expect } from 'chai';
import {
  GraphQLSchema,
  GraphQLString,
  GraphQLInt,
  GraphQLFloat,
  GraphQLList,
  GraphQLNonNull,
  GraphQLObjectType,
  GraphQLInterfaceType,
  GraphQLUnionType,
} from '../../type';
import { isEqualType, isTypeSubTypeOf } from '../typeComparators';

describe('typeComparators', () => {
  describe('isEqualType', () => {
    it('same reference are equal', () => {
      expect(isEqualType(GraphQLString, GraphQLString)).to.equal(true);
    });

    it('int and float are not equal', () => {
      expect(isEqualType(GraphQLInt, GraphQLFloat)).to.equal(false);
    });

    it('lists of same type are equal', () => {
      expect(
        isEqualType(GraphQLList(GraphQLInt), GraphQLList(GraphQLInt)),
      ).to.equal(true);
    });

    it('lists is not equal to item', () => {
      expect(isEqualType(GraphQLList(GraphQLInt), GraphQLInt)).to.equal(false);
    });

    it('non-null of same type are equal', () => {
      expect(
        isEqualType(GraphQLNonNull(GraphQLInt), GraphQLNonNull(GraphQLInt)),
      ).to.equal(true);
    });

    it('non-null is not equal to nullable', () => {
      expect(isEqualType(GraphQLNonNull(GraphQLInt), GraphQLInt)).to.equal(
        false,
      );
    });
  });

  describe('isTypeSubTypeOf', () => {
    function testSchema(fields) {
      return new GraphQLSchema({
        query: new GraphQLObjectType({
          name: 'Query',
          fields,
        }),
      });
    }

    it('same reference is subtype', () => {
      const schema = testSchema({ field: { type: GraphQLString } });
      expect(isTypeSubTypeOf(schema, GraphQLString, GraphQLString)).to.equal(
        true,
      );
    });

    it('int is not subtype of float', () => {
      const schema = testSchema({ field: { type: GraphQLString } });
      expect(isTypeSubTypeOf(schema, GraphQLInt, GraphQLFloat)).to.equal(false);
    });

    it('non-null is subtype of nullable', () => {
      const schema = testSchema({ field: { type: GraphQLString } });
      expect(
        isTypeSubTypeOf(schema, GraphQLNonNull(GraphQLInt), GraphQLInt),
      ).to.equal(true);
    });

    it('nullable is not subtype of non-null', () => {
      const schema = testSchema({ field: { type: GraphQLString } });
      expect(
        isTypeSubTypeOf(schema, GraphQLInt, GraphQLNonNull(GraphQLInt)),
      ).to.equal(false);
    });

    it('item is not subtype of list', () => {
      const schema = testSchema({ field: { type: GraphQLString } });
      expect(
        isTypeSubTypeOf(schema, GraphQLInt, GraphQLList(GraphQLInt)),
      ).to.equal(false);
    });

    it('list is not subtype of item', () => {
      const schema = testSchema({ field: { type: GraphQLString } });
      expect(
        isTypeSubTypeOf(schema, GraphQLList(GraphQLInt), GraphQLInt),
      ).to.equal(false);
    });

    it('member is subtype of union', () => {
      const member = new GraphQLObjectType({
        name: 'Object',
        fields: {
          field: { type: GraphQLString },
        },
      });
      const union = new GraphQLUnionType({ name: 'Union', types: [member] });
      const schema = testSchema({ field: { type: union } });
      expect(isTypeSubTypeOf(schema, member, union)).to.equal(true);
    });

    it('implementation is subtype of interface', () => {
      const iface = new GraphQLInterfaceType({
        name: 'Interface',
        fields: {
          field: { type: GraphQLString },
        },
      });
      const impl = new GraphQLObjectType({
        name: 'Object',
        interfaces: [iface],
        fields: {
          field: { type: GraphQLString },
        },
      });
      const schema = testSchema({ field: { type: impl } });
      expect(isTypeSubTypeOf(schema, impl, iface)).to.equal(true);
    });
  });
});
