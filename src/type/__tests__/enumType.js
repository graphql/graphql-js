/**
 *  Copyright (c) 2015, Facebook, Inc.
 *  All rights reserved.
 *
 *  This source code is licensed under the BSD-style license found in the
 *  LICENSE file in the root directory of this source tree. An additional grant
 *  of patent rights can be found in the PATENTS file in the same directory.
 */

import { describe, it } from 'mocha';
import { expect } from 'chai';
import {
  graphql,
  GraphQLSchema,
  GraphQLEnumType,
  GraphQLObjectType,
  GraphQLInt,
  GraphQLString,
} from '../../';


describe('Type System: Enum Values', () => {

  const ColorType = new GraphQLEnumType({
    name: 'Color',
    values: {
      RED: { value: 0 },
      GREEN: { value: 1 },
      BLUE: { value: 2 },
    }
  });

  const QueryType = new GraphQLObjectType({
    name: 'Query',
    fields: {
      colorEnum: {
        type: ColorType,
        args: {
          fromEnum: { type: ColorType },
          fromInt: { type: GraphQLInt },
          fromString: { type: GraphQLString },
        },
        resolve(value, { fromEnum, fromInt, fromString }) {
          return fromInt !== undefined ? fromInt :
            fromString !== undefined ? fromString :
            fromEnum;
        }
      },
      colorInt: {
        type: GraphQLInt,
        args: {
          fromEnum: { type: ColorType },
          fromInt: { type: GraphQLInt },
        },
        resolve(value, { fromEnum, fromInt }) {
          return fromInt !== undefined ? fromInt : fromEnum;
        }
      }
    }
  });

  const MutationType = new GraphQLObjectType({
    name: 'Mutation',
    fields: {
      favoriteEnum: {
        type: ColorType,
        args: { color: { type: ColorType } },
        resolve(value, { color }) { return color; }
      }
    }
  });

  const SubscriptionType = new GraphQLObjectType({
    name: 'Subscription',
    fields: {
      subscribeToEnum: {
        type: ColorType,
        args: { color: { type: ColorType } },
        resolve(value, { color }) { return color; }
      }
    }
  });

  const schema = new GraphQLSchema({
    query: QueryType,
    mutation: MutationType,
    subscription: SubscriptionType
  });

  it('accepts enum literals as input', async () => {
    expect(
      await graphql(schema, '{ colorInt(fromEnum: GREEN) }')
    ).to.deep.equal({
      data: {
        colorInt: 1
      }
    });
  });

  it('enum may be output type', async () => {
    expect(
      await graphql(schema, '{ colorEnum(fromInt: 1) }')
    ).to.deep.equal({
      data: {
        colorEnum: 'GREEN'
      }
    });
  });

  it('enum may be both input and output type', async () => {
    expect(
      await graphql(schema, '{ colorEnum(fromEnum: GREEN) }')
    ).to.deep.equal({
      data: {
        colorEnum: 'GREEN'
      }
    });
  });

  it('does not accept string literals', async () => {
    expect(
      await graphql(schema, '{ colorEnum(fromEnum: "GREEN") }')
    ).to.deep.equal({
      errors: [
        {
          message: 'Argument "fromEnum" has invalid value "GREEN".' +
            '\nExpected type \"Color\", found "GREEN".'
        }
      ]
    });
  });

  it('does not accept incorrect internal value', async () => {
    expect(
      await graphql(schema, '{ colorEnum(fromString: "GREEN") }')
    ).to.deep.equal({
      data: {
        colorEnum: null
      }
    });
  });

  it('does not accept internal value in place of enum literal', async () => {
    expect(
      await graphql(schema, '{ colorEnum(fromEnum: 1) }')
    ).to.deep.equal({
      errors: [
        { message: 'Argument "fromEnum" has invalid value 1.' +
            '\nExpected type "Color", found 1.' }
      ]
    });
  });

  it('does not accept enum literal in place of int', async () => {
    expect(
      await graphql(schema, '{ colorEnum(fromInt: GREEN) }')
    ).to.deep.equal({
      errors: [
        { message: 'Argument "fromInt" has invalid value GREEN.' +
            '\nExpected type "Int", found GREEN.' }
      ]
    });
  });

  it('accepts JSON string as enum variable', async () => {
    expect(
      await graphql(
        schema,
        'query test($color: Color!) { colorEnum(fromEnum: $color) }',
        null,
        { color: 'BLUE' }
      )
    ).to.deep.equal({
      data: {
        colorEnum: 'BLUE'
      }
    });
  });

  it('accepts enum literals as input arguments to mutations', async () => {
    expect(
      await graphql(
        schema,
        'mutation x($color: Color!) { favoriteEnum(color: $color) }',
        null,
        { color: 'GREEN' }
      )
    ).to.deep.equal({
      data: {
        favoriteEnum: 'GREEN'
      }
    });
  });

  it('accepts enum literals as input arguments to subscriptions', async () => {
    expect(
      await graphql(
        schema,
        'subscription x($color: Color!) { subscribeToEnum(color: $color) }',
        null,
        { color: 'GREEN' }
      )
    ).to.deep.equal({
      data: {
        subscribeToEnum: 'GREEN'
      }
    });
  });

  it('does not accept internal value as enum variable', async () => {
    expect(
      await graphql(
        schema,
        'query test($color: Color!) { colorEnum(fromEnum: $color) }',
        null,
        { color: 2 }
      )
    ).to.deep.equal({
      errors: [
        {
          message:
            'Variable "\$color" got invalid value 2.' +
            '\nExpected type "Color", found 2.'
        }
      ]
    });
  });

  it('does not accept string variables as enum input', async () => {
    expect(
      await graphql(
        schema,
        'query test($color: String!) { colorEnum(fromEnum: $color) }',
        null,
        { color: 'BLUE' }
      )
    ).to.deep.equal({
      errors: [
        { message: 'Variable "$color" of type "String!" used in position ' +
          'expecting type "Color".' }
      ]
    });
  });

  it('does not accept internal value variable as enum input', async () => {
    expect(
      await graphql(
        schema,
        'query test($color: Int!) { colorEnum(fromEnum: $color) }',
        null,
        { color: 2 }
      )
    ).to.deep.equal({
      errors: [
        { message: 'Variable "$color" of type "Int!" used in position ' +
          'expecting type "Color".' }
      ]
    });
  });

  it('enum value may have an internal value of 0', async () => {
    expect(
      await graphql(schema, `{
        colorEnum(fromEnum: RED)
        colorInt(fromEnum: RED)
      }`)
    ).to.deep.equal({
      data: {
        colorEnum: 'RED',
        colorInt: 0
      }
    });
  });

  it('enum inputs may be nullable', async () => {
    expect(
      await graphql(schema, `{
        colorEnum
        colorInt
      }`)
    ).to.deep.equal({
      data: {
        colorEnum: null,
        colorInt: null
      }
    });
  });

});
