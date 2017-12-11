/**
 * Copyright (c) 2015-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
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
  GraphQLBoolean,
  getIntrospectionQuery,
} from '../../';

describe('Type System: Enum Values', () => {
  const ColorType = new GraphQLEnumType({
    name: 'Color',
    values: {
      RED: { value: 0 },
      GREEN: { value: 1 },
      BLUE: { value: 2 },
    },
  });

  const Complex1 = { someRandomFunction: () => {} };
  const Complex2 = { someRandomValue: 123 };

  const ComplexEnum = new GraphQLEnumType({
    name: 'Complex',
    values: {
      ONE: { value: Complex1 },
      TWO: { value: Complex2 },
    },
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
          return fromInt !== undefined
            ? fromInt
            : fromString !== undefined ? fromString : fromEnum;
        },
      },
      colorInt: {
        type: GraphQLInt,
        args: {
          fromEnum: { type: ColorType },
          fromInt: { type: GraphQLInt },
        },
        resolve(value, { fromEnum, fromInt }) {
          return fromInt !== undefined ? fromInt : fromEnum;
        },
      },
      complexEnum: {
        type: ComplexEnum,
        args: {
          fromEnum: {
            type: ComplexEnum,
            // Note: defaultValue is provided an *internal* representation for
            // Enums, rather than the string name.
            defaultValue: Complex1,
          },
          provideGoodValue: { type: GraphQLBoolean },
          provideBadValue: { type: GraphQLBoolean },
        },
        resolve(value, { fromEnum, provideGoodValue, provideBadValue }) {
          if (provideGoodValue) {
            // Note: this is one of the references of the internal values which
            // ComplexEnum allows.
            return Complex2;
          }
          if (provideBadValue) {
            // Note: similar shape, but not the same *reference*
            // as Complex2 above. Enum internal values require === equality.
            return { someRandomValue: 123 };
          }
          return fromEnum;
        },
      },
    },
  });

  const MutationType = new GraphQLObjectType({
    name: 'Mutation',
    fields: {
      favoriteEnum: {
        type: ColorType,
        args: { color: { type: ColorType } },
        resolve(value, { color }) {
          return color;
        },
      },
    },
  });

  const SubscriptionType = new GraphQLObjectType({
    name: 'Subscription',
    fields: {
      subscribeToEnum: {
        type: ColorType,
        args: { color: { type: ColorType } },
        resolve(value, { color }) {
          return color;
        },
      },
    },
  });

  const schema = new GraphQLSchema({
    query: QueryType,
    mutation: MutationType,
    subscription: SubscriptionType,
  });

  it('accepts enum literals as input', async () => {
    expect(await graphql(schema, '{ colorInt(fromEnum: GREEN) }')).to.jsonEqual(
      {
        data: {
          colorInt: 1,
        },
      },
    );
  });

  it('enum may be output type', async () => {
    expect(await graphql(schema, '{ colorEnum(fromInt: 1) }')).to.jsonEqual({
      data: {
        colorEnum: 'GREEN',
      },
    });
  });

  it('enum may be both input and output type', async () => {
    expect(
      await graphql(schema, '{ colorEnum(fromEnum: GREEN) }'),
    ).to.jsonEqual({
      data: {
        colorEnum: 'GREEN',
      },
    });
  });

  it('does not accept string literals', async () => {
    expect(
      await graphql(schema, '{ colorEnum(fromEnum: "GREEN") }'),
    ).to.jsonEqual({
      errors: [
        {
          message:
            'Argument "fromEnum" has invalid value "GREEN".' +
            '\nExpected type "Color", found "GREEN".',
          locations: [{ line: 1, column: 23 }],
        },
      ],
    });
  });

  it('does not accept incorrect internal value', async () => {
    expect(
      await graphql(schema, '{ colorEnum(fromString: "GREEN") }'),
    ).to.containSubset({
      data: {
        colorEnum: null,
      },
      errors: [
        {
          message: 'Expected a value of type "Color" but received: GREEN',
          locations: [{ line: 1, column: 3 }],
        },
      ],
    });
  });

  it('does not accept internal value in place of enum literal', async () => {
    expect(await graphql(schema, '{ colorEnum(fromEnum: 1) }')).to.jsonEqual({
      errors: [
        {
          message:
            'Argument "fromEnum" has invalid value 1.' +
            '\nExpected type "Color", found 1.',
          locations: [{ line: 1, column: 23 }],
        },
      ],
    });
  });

  it('does not accept enum literal in place of int', async () => {
    expect(await graphql(schema, '{ colorEnum(fromInt: GREEN) }')).to.jsonEqual(
      {
        errors: [
          {
            message:
              'Argument "fromInt" has invalid value GREEN.' +
              '\nExpected type "Int", found GREEN.',
            locations: [{ line: 1, column: 22 }],
          },
        ],
      },
    );
  });

  it('accepts JSON string as enum variable', async () => {
    expect(
      await graphql(
        schema,
        'query test($color: Color!) { colorEnum(fromEnum: $color) }',
        null,
        null,
        { color: 'BLUE' },
      ),
    ).to.jsonEqual({
      data: {
        colorEnum: 'BLUE',
      },
    });
  });

  it('accepts enum literals as input arguments to mutations', async () => {
    expect(
      await graphql(
        schema,
        'mutation x($color: Color!) { favoriteEnum(color: $color) }',
        null,
        null,
        { color: 'GREEN' },
      ),
    ).to.jsonEqual({
      data: {
        favoriteEnum: 'GREEN',
      },
    });
  });

  it('accepts enum literals as input arguments to subscriptions', async () => {
    expect(
      await graphql(
        schema,
        'subscription x($color: Color!) { subscribeToEnum(color: $color) }',
        null,
        null,
        { color: 'GREEN' },
      ),
    ).to.jsonEqual({
      data: {
        subscribeToEnum: 'GREEN',
      },
    });
  });

  it('does not accept internal value as enum variable', async () => {
    expect(
      await graphql(
        schema,
        'query test($color: Color!) { colorEnum(fromEnum: $color) }',
        null,
        null,
        { color: 2 },
      ),
    ).to.jsonEqual({
      errors: [
        {
          message:
            'Variable "$color" got invalid value 2; Expected type Color.',
          locations: [{ line: 1, column: 12 }],
        },
      ],
    });
  });

  it('does not accept string variables as enum input', async () => {
    expect(
      await graphql(
        schema,
        'query test($color: String!) { colorEnum(fromEnum: $color) }',
        null,
        null,
        { color: 'BLUE' },
      ),
    ).to.jsonEqual({
      errors: [
        {
          message:
            'Variable "$color" of type "String!" used in position ' +
            'expecting type "Color".',
          locations: [{ line: 1, column: 12 }, { line: 1, column: 51 }],
        },
      ],
    });
  });

  it('does not accept internal value variable as enum input', async () => {
    expect(
      await graphql(
        schema,
        'query test($color: Int!) { colorEnum(fromEnum: $color) }',
        null,
        null,
        { color: 2 },
      ),
    ).to.jsonEqual({
      errors: [
        {
          message:
            'Variable "$color" of type "Int!" used in position ' +
            'expecting type "Color".',
          locations: [{ line: 1, column: 12 }, { line: 1, column: 48 }],
        },
      ],
    });
  });

  it('enum value may have an internal value of 0', async () => {
    expect(
      await graphql(
        schema,
        `
          {
            colorEnum(fromEnum: RED)
            colorInt(fromEnum: RED)
          }
        `,
      ),
    ).to.jsonEqual({
      data: {
        colorEnum: 'RED',
        colorInt: 0,
      },
    });
  });

  it('enum inputs may be nullable', async () => {
    expect(
      await graphql(
        schema,
        `
          {
            colorEnum
            colorInt
          }
        `,
      ),
    ).to.jsonEqual({
      data: {
        colorEnum: null,
        colorInt: null,
      },
    });
  });

  it('presents a getValues() API for complex enums', () => {
    const values = ComplexEnum.getValues();
    expect(values.length).to.equal(2);
    expect(values[0].name).to.equal('ONE');
    expect(values[0].value).to.equal(Complex1);
    expect(values[1].name).to.equal('TWO');
    expect(values[1].value).to.equal(Complex2);
  });

  it('presents a getValue() API for complex enums', () => {
    const oneValue = ComplexEnum.getValue('ONE');
    expect(oneValue.name).to.equal('ONE');
    expect(oneValue.value).to.equal(Complex1);

    const badUsage = ComplexEnum.getValue(Complex1);
    expect(badUsage).to.equal(undefined);
  });

  it('may be internally represented with complex values', async () => {
    expect(
      await graphql(
        schema,
        `
          {
            first: complexEnum
            second: complexEnum(fromEnum: TWO)
            good: complexEnum(provideGoodValue: true)
            bad: complexEnum(provideBadValue: true)
          }
        `,
      ),
    ).to.containSubset({
      data: {
        first: 'ONE',
        second: 'TWO',
        good: 'TWO',
        bad: null,
      },
      errors: [
        {
          message:
            'Expected a value of type "Complex" but received: [object Object]',
          locations: [{ line: 6, column: 13 }],
        },
      ],
    });
  });

  it('can be introspected without error', async () => {
    const result = await graphql(schema, getIntrospectionQuery());
    expect(result).to.not.have.property('errors');
  });
});
