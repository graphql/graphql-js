/* global setTimeout */
import { expect } from 'chai';
import { describe, it } from 'mocha';

import { parse } from '../../language/parser';

import { GraphQLObjectType, GraphQLUnionType } from '../../type/definition';
import { GraphQLString } from '../../type/scalars';
import { GraphQLSchema } from '../../type/schema';

import { execute } from '../execute';

describe('defaultTypeResolver promise cleanup', () => {
  for (const throws of [false, true]) {
    it(`observes earlier rejections when a later type ${
      throws ? 'throws' : 'matches'
    }`, async () => {
      const first = new GraphQLObjectType({
        name: 'First',
        fields: { name: { type: GraphQLString } },
        isTypeOf: () => Promise.reject(new Error('Earlier rejection')),
      });
      const second = new GraphQLObjectType({
        name: 'Second',
        fields: { name: { type: GraphQLString } },
        isTypeOf: () => {
          if (throws) {
            throw new Error('Later throw');
          }
          return true;
        },
      });
      const union = new GraphQLUnionType({
        name: 'Union',
        types: [first, second],
      });
      const query = new GraphQLObjectType({
        name: 'Query',
        fields: { value: { type: union, resolve: () => ({}) } },
      });
      const result = await execute({
        schema: new GraphQLSchema({ query }),
        document: parse('{ value { __typename } }'),
      });
      if (throws) {
        expect(result.errors?.map((error) => error.message)).to.deep.equal([
          'Later throw',
        ]);
        expect(result.data).to.deep.equal({ value: null });
      } else {
        expect(result.errors).to.equal(undefined);
        expect(result.data).to.deep.equal({ value: { __typename: 'Second' } });
      }
      // Let unhandled rejections surface in the test runner.
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }
});
