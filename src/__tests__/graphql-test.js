// @flow strict

import { expect } from 'chai';
import { describe, it } from 'mocha';

import { GraphQLSchema } from '../type/schema';

import { graphqlSync } from '../graphql';

describe('graphql', () => {
  it('report errors raised during schema validation', () => {
    const schema = new GraphQLSchema({});
    const result = graphqlSync({ schema, source: '{ __typename }' });
    expect(result).to.deep.equal({
      errors: [{ message: 'Query root type must be provided.' }],
    });
  });
});
