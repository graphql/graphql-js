import { expect } from 'chai';
import { describe, it } from 'mocha';

import { GraphQLScalarTypeImpl } from '../../type/definition';

import {
  GRAPHQL_VERSION_SYMBOL,
  GraphQLEntityKind,
} from '../../utilities/entities';

import { identityFunc } from '../identityFunc';
import { instanceOf } from '../instanceOf';

describe('instanceOf', () => {
  it('do not throw on unknown entities', () => {
    // @ts-expect-error
    expect(instanceOf(true, '')).to.equal(false);
    // @ts-expect-error
    expect(instanceOf(null, '')).to.equal(false);
    // @ts-expect-error
    expect(instanceOf(Object.create(null), '')).to.equal(false);
  });

  it('detect name clashes with older versions of this lib', () => {
    const scalar = new GraphQLScalarTypeImpl({
      name: 'Scalar',
      serialize: identityFunc,
    });

    // @ts-expect-error
    delete scalar[GRAPHQL_VERSION_SYMBOL];

    expect(() => instanceOf(scalar, GraphQLEntityKind.SCALAR_TYPE)).to.throw();
  });

  it('fails with descriptive error message', () => {
    const scalar = new GraphQLScalarTypeImpl({
      name: 'Scalar',
      serialize: identityFunc,
    });

    // @ts-expect-error
    delete scalar[GRAPHQL_VERSION_SYMBOL];

    expect(() => instanceOf(scalar, GraphQLEntityKind.SCALAR_TYPE)).to.throw(
      /^Cannot use value "Scalar" for entity type "ScalarType"./m,
    );
  });
});
