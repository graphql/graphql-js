import { expect } from 'chai';
import { describe, it } from 'mocha';

import { assertHasValidName } from '../assertHasValidName.js';
import type { GraphQLEnumValue } from '../index.js';
import { __Type, GraphQLEnumType, GraphQLObjectType } from '../index.js';

describe(assertHasValidName.name, () => {
  it('passthrough valid name', () => {
    expect(
      assertHasValidName(
        new GraphQLObjectType({
          name: '_ValidName123',
          fields: {},
        }),
      ),
    ).to.equal('_ValidName123');
  });

  it('throws on empty strings', () => {
    expect(() =>
      assertHasValidName(
        new GraphQLObjectType({
          name: '',
          fields: {},
        }),
      ),
    ).to.throw('Expected name of type "" to be a non-empty string.');
  });

  it('throws for names with invalid characters', () => {
    expect(() =>
      assertHasValidName(
        new GraphQLObjectType({
          name: 'Some-Object',
          fields: {},
        }),
      ),
    ).to.throw('Name of type "Some-Object" must only contain [_a-zA-Z0-9].');
  });

  it('throws for names starting with invalid characters', () => {
    expect(() =>
      assertHasValidName(
        new GraphQLObjectType({
          name: '1_ObjectType',
          fields: {},
        }),
      ),
    ).to.throw('Name of type "1_ObjectType" must start with [_a-zA-Z].');
  });

  it('throws for reserved names', () => {
    expect(() =>
      assertHasValidName(
        new GraphQLObjectType({
          name: '__SomeObject',
          fields: {},
        }),
      ),
    ).to.throw(
      'Name of type "__SomeObject" must not begin with "__", which is reserved by GraphQL introspection.',
    );
  });

  it('allows reserved names when specified', () => {
    expect(assertHasValidName(__Type, true)).to.equal('__Type');
  });

  it('throws for reserved names in enum values', () => {
    const someEnum = new GraphQLEnumType({
      name: 'SomeEnum',
      values: {
        true: {},
      },
    });
    const value = someEnum.getValue('true') as GraphQLEnumValue;
    expect(() => assertHasValidName(value)).to.throw(
      'Name "true" of enum value "SomeEnum.true" cannot be: true.',
    );
  });
});
