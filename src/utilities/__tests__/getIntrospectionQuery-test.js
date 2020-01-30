// @flow strict

import { expect } from 'chai';
import { describe, it } from 'mocha';

import { getIntrospectionQuery } from '../getIntrospectionQuery';

describe('getIntrospectionQuery', () => {
  it('skip all "description" fields', () => {
    expect(getIntrospectionQuery()).to.match(/\bdescription\b/);

    expect(getIntrospectionQuery({ descriptions: true })).to.match(
      /\bdescription\b/,
    );

    expect(getIntrospectionQuery({ descriptions: false })).to.not.match(
      /\bdescription\b/,
    );
  });

  it('include "isRepeatable" field', () => {
    expect(getIntrospectionQuery()).to.not.match(/\bisRepeatable\b/);

    expect(getIntrospectionQuery({ directiveIsRepeatable: true })).to.match(
      /\bisRepeatable\b/,
    );

    expect(
      getIntrospectionQuery({ directiveIsRepeatable: false }),
    ).to.not.match(/\bisRepeatable\b/);
  });
});
