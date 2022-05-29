import { expect } from 'chai';
import { describe, it } from 'mocha';

import type { GraphQLFieldConfigMap } from '../../type/definition';
import {
  GraphQLInterfaceTypeImpl,
  GraphQLListImpl,
  GraphQLNonNullImpl,
  GraphQLObjectTypeImpl,
  GraphQLUnionTypeImpl,
} from '../../type/definition';
import { GraphQLFloat, GraphQLInt, GraphQLString } from '../../type/scalars';
import { GraphQLSchemaImpl } from '../../type/schema';

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
        isEqualType(
          new GraphQLListImpl(GraphQLInt),
          new GraphQLListImpl(GraphQLInt),
        ),
      ).to.equal(true);
    });

    it('lists is not equal to item', () => {
      expect(isEqualType(new GraphQLListImpl(GraphQLInt), GraphQLInt)).to.equal(
        false,
      );
    });

    it('non-null of same type are equal', () => {
      expect(
        isEqualType(
          new GraphQLNonNullImpl(GraphQLInt),
          new GraphQLNonNullImpl(GraphQLInt),
        ),
      ).to.equal(true);
    });

    it('non-null is not equal to nullable', () => {
      expect(
        isEqualType(new GraphQLNonNullImpl(GraphQLInt), GraphQLInt),
      ).to.equal(false);
    });
  });

  describe('isTypeSubTypeOf', () => {
    function testSchema(fields: GraphQLFieldConfigMap<unknown, unknown>) {
      return new GraphQLSchemaImpl({
        query: new GraphQLObjectTypeImpl({
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
        isTypeSubTypeOf(schema, new GraphQLNonNullImpl(GraphQLInt), GraphQLInt),
      ).to.equal(true);
    });

    it('nullable is not subtype of non-null', () => {
      const schema = testSchema({ field: { type: GraphQLString } });
      expect(
        isTypeSubTypeOf(schema, GraphQLInt, new GraphQLNonNullImpl(GraphQLInt)),
      ).to.equal(false);
    });

    it('item is not subtype of list', () => {
      const schema = testSchema({ field: { type: GraphQLString } });
      expect(
        isTypeSubTypeOf(schema, GraphQLInt, new GraphQLListImpl(GraphQLInt)),
      ).to.equal(false);
    });

    it('list is not subtype of item', () => {
      const schema = testSchema({ field: { type: GraphQLString } });
      expect(
        isTypeSubTypeOf(schema, new GraphQLListImpl(GraphQLInt), GraphQLInt),
      ).to.equal(false);
    });

    it('member is subtype of union', () => {
      const member = new GraphQLObjectTypeImpl({
        name: 'Object',
        fields: {
          field: { type: GraphQLString },
        },
      });
      const union = new GraphQLUnionTypeImpl({
        name: 'Union',
        types: [member],
      });
      const schema = testSchema({ field: { type: union } });
      expect(isTypeSubTypeOf(schema, member, union)).to.equal(true);
    });

    it('implementing object is subtype of interface', () => {
      const iface = new GraphQLInterfaceTypeImpl({
        name: 'Interface',
        fields: {
          field: { type: GraphQLString },
        },
      });
      const impl = new GraphQLObjectTypeImpl({
        name: 'Object',
        interfaces: [iface],
        fields: {
          field: { type: GraphQLString },
        },
      });
      const schema = testSchema({ field: { type: impl } });
      expect(isTypeSubTypeOf(schema, impl, iface)).to.equal(true);
    });

    it('implementing interface is subtype of interface', () => {
      const iface = new GraphQLInterfaceTypeImpl({
        name: 'Interface',
        fields: {
          field: { type: GraphQLString },
        },
      });
      const iface2 = new GraphQLInterfaceTypeImpl({
        name: 'Interface2',
        interfaces: [iface],
        fields: {
          field: { type: GraphQLString },
        },
      });
      const impl = new GraphQLObjectTypeImpl({
        name: 'Object',
        interfaces: [iface2, iface],
        fields: {
          field: { type: GraphQLString },
        },
      });
      const schema = testSchema({ field: { type: impl } });
      expect(isTypeSubTypeOf(schema, iface2, iface)).to.equal(true);
    });
  });
});
