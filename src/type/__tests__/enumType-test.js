/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow
 */

import { describe, it } from 'mocha';
import { expect } from 'chai';
import {
  graphqlSync,
  GraphQLSchema,
  GraphQLEnumType,
  GraphQLObjectType,
  GraphQLInt,
  GraphQLString,
  GraphQLBoolean,
  introspectionFromSchema,
} from '../../';

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
          : fromString !== undefined
          ? fromString
          : fromEnum;
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

function executeQuery(source, variableValues) {
  return graphqlSync({ schema, source, variableValues });
}

describe('Type System: Enum Values', () => {
  it('accepts enum literals as input', () => {
    const result = executeQuery('{ colorInt(fromEnum: GREEN) }');

    expect(result).to.deep.equal({
      data: { colorInt: 1 },
    });
  });

  it('enum may be output type', () => {
    const result = executeQuery('{ colorEnum(fromInt: 1) }');

    expect(result).to.deep.equal({
      data: { colorEnum: 'GREEN' },
    });
  });

  it('enum may be both input and output type', () => {
    const result = executeQuery('{ colorEnum(fromEnum: GREEN) }');

    expect(result).to.deep.equal({
      data: { colorEnum: 'GREEN' },
    });
  });

  it('does not accept string literals', () => {
    const result = executeQuery('{ colorEnum(fromEnum: "GREEN") }');

    expect(result).to.deep.equal({
      errors: [
        {
          message:
            'Expected type Color, found "GREEN"; Did you mean the enum value GREEN?',
          locations: [{ line: 1, column: 23 }],
        },
      ],
    });
  });

  it('does not accept values not in the enum', () => {
    const result = executeQuery('{ colorEnum(fromEnum: GREENISH) }');

    expect(result).to.deep.equal({
      errors: [
        {
          message:
            'Expected type Color, found GREENISH; Did you mean the enum value GREEN?',
          locations: [{ line: 1, column: 23 }],
        },
      ],
    });
  });

  it('does not accept values with incorrect casing', () => {
    const result = executeQuery('{ colorEnum(fromEnum: green) }');

    expect(result).to.deep.equal({
      errors: [
        {
          message:
            'Expected type Color, found green; Did you mean the enum value GREEN?',
          locations: [{ line: 1, column: 23 }],
        },
      ],
    });
  });

  it('does not accept incorrect internal value', () => {
    const result = executeQuery('{ colorEnum(fromString: "GREEN") }');

    expect(result).to.deep.equal({
      data: { colorEnum: null },
      errors: [
        {
          message: 'Expected a value of type "Color" but received: "GREEN"',
          locations: [{ line: 1, column: 3 }],
          path: ['colorEnum'],
        },
      ],
    });
  });

  it('does not accept internal value in place of enum literal', () => {
    const result = executeQuery('{ colorEnum(fromEnum: 1) }');

    expect(result).to.deep.equal({
      errors: [
        {
          message: 'Expected type Color, found 1.',
          locations: [{ line: 1, column: 23 }],
        },
      ],
    });
  });

  it('does not accept enum literal in place of int', () => {
    const result = executeQuery('{ colorEnum(fromInt: GREEN) }');

    expect(result).to.deep.equal({
      errors: [
        {
          message: 'Expected type Int, found GREEN.',
          locations: [{ line: 1, column: 22 }],
        },
      ],
    });
  });

  it('accepts JSON string as enum variable', () => {
    const doc = 'query ($color: Color!) { colorEnum(fromEnum: $color) }';
    const result = executeQuery(doc, { color: 'BLUE' });

    expect(result).to.deep.equal({
      data: { colorEnum: 'BLUE' },
    });
  });

  it('accepts enum literals as input arguments to mutations', () => {
    const doc = 'mutation ($color: Color!) { favoriteEnum(color: $color) }';
    const result = executeQuery(doc, { color: 'GREEN' });

    expect(result).to.deep.equal({
      data: { favoriteEnum: 'GREEN' },
    });
  });

  it('accepts enum literals as input arguments to subscriptions', () => {
    const doc =
      'subscription ($color: Color!) { subscribeToEnum(color: $color) }';
    const result = executeQuery(doc, { color: 'GREEN' });

    expect(result).to.deep.equal({
      data: { subscribeToEnum: 'GREEN' },
    });
  });

  it('does not accept internal value as enum variable', () => {
    const doc = 'query ($color: Color!) { colorEnum(fromEnum: $color) }';
    const result = executeQuery(doc, { color: 2 });

    expect(result).to.deep.equal({
      errors: [
        {
          message:
            'Variable "$color" got invalid value 2; Expected type Color.',
          locations: [{ line: 1, column: 8 }],
        },
      ],
    });
  });

  it('does not accept string variables as enum input', () => {
    const doc = 'query ($color: String!) { colorEnum(fromEnum: $color) }';
    const result = executeQuery(doc, { color: 'BLUE' });

    expect(result).to.deep.equal({
      errors: [
        {
          message:
            'Variable "$color" of type "String!" used in position expecting type "Color".',
          locations: [{ line: 1, column: 8 }, { line: 1, column: 47 }],
        },
      ],
    });
  });

  it('does not accept internal value variable as enum input', () => {
    const doc = 'query ($color: Int!) { colorEnum(fromEnum: $color) }';
    const result = executeQuery(doc, { color: 2 });

    expect(result).to.deep.equal({
      errors: [
        {
          message:
            'Variable "$color" of type "Int!" used in position expecting type "Color".',
          locations: [{ line: 1, column: 8 }, { line: 1, column: 44 }],
        },
      ],
    });
  });

  it('enum value may have an internal value of 0', () => {
    const result = executeQuery(`
      {
        colorEnum(fromEnum: RED)
        colorInt(fromEnum: RED)
      }
    `);

    expect(result).to.deep.equal({
      data: {
        colorEnum: 'RED',
        colorInt: 0,
      },
    });
  });

  it('enum inputs may be nullable', () => {
    const result = executeQuery(`
      {
        colorEnum
        colorInt
      }
    `);

    expect(result).to.deep.equal({
      data: {
        colorEnum: null,
        colorInt: null,
      },
    });
  });

  it('presents a getValues() API for complex enums', () => {
    const values = ComplexEnum.getValues();
    expect(values).to.have.deep.ordered.members([
      {
        name: 'ONE',
        value: Complex1,
        description: undefined,
        isDeprecated: false,
        deprecationReason: undefined,
        astNode: undefined,
      },
      {
        name: 'TWO',
        value: Complex2,
        description: undefined,
        isDeprecated: false,
        deprecationReason: undefined,
        astNode: undefined,
      },
    ]);
  });

  it('presents a getValue() API for complex enums', () => {
    const oneValue = ComplexEnum.getValue('ONE');
    expect(oneValue).to.include({ name: 'ONE', value: Complex1 });

    // $DisableFlowOnNegativeTest
    const badUsage = ComplexEnum.getValue(Complex1);
    expect(badUsage).to.equal(undefined);
  });

  it('may be internally represented with complex values', () => {
    const result = executeQuery(`
      {
        first: complexEnum
        second: complexEnum(fromEnum: TWO)
        good: complexEnum(provideGoodValue: true)
        bad: complexEnum(provideBadValue: true)
      }
    `);

    expect(result).to.deep.equal({
      data: {
        first: 'ONE',
        second: 'TWO',
        good: 'TWO',
        bad: null,
      },
      errors: [
        {
          message:
            'Expected a value of type "Complex" but received: { someRandomValue: 123 }',
          locations: [{ line: 6, column: 9 }],
          path: ['bad'],
        },
      ],
    });
  });

  it('can be introspected without error', () => {
    expect(() => introspectionFromSchema(schema)).to.not.throw();
  });
});
