/**
 * Copyright (c) 2015-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow strict
 */

import { expect } from 'chai';
import { describe, it } from 'mocha';
import { graphqlSync } from '../../graphql';
import { execute } from '../execute';
import { parse } from '../../language';
import { validate } from '../../validation/validate';
import { GraphQLSchema, GraphQLObjectType, GraphQLString } from '../../type';

describe('Execute: synchronously when possible', () => {
  const schema = new GraphQLSchema({
    query: new GraphQLObjectType({
      name: 'Query',
      fields: {
        syncField: {
          type: GraphQLString,
          resolve(rootValue) {
            return rootValue;
          },
        },
        asyncField: {
          type: GraphQLString,
          async resolve(rootValue) {
            return rootValue;
          },
        },
      },
    }),
    mutation: new GraphQLObjectType({
      name: 'Mutation',
      fields: {
        syncMutationField: {
          type: GraphQLString,
          resolve(rootValue) {
            return rootValue;
          },
        },
      },
    }),
  });

  it('does not return a Promise for initial errors', () => {
    const doc = 'fragment Example on Query { syncField }';
    const result = execute({
      schema,
      document: parse(doc),
      rootValue: 'rootValue',
    });
    expect(result).to.deep.equal({
      errors: [{ message: 'Must provide an operation.' }],
    });
  });

  it('does not return a Promise if fields are all synchronous', () => {
    const doc = 'query Example { syncField }';
    const result = execute({
      schema,
      document: parse(doc),
      rootValue: 'rootValue',
    });
    expect(result).to.deep.equal({ data: { syncField: 'rootValue' } });
  });

  it('does not return a Promise if mutation fields are all synchronous', () => {
    const doc = 'mutation Example { syncMutationField }';
    const result = execute({
      schema,
      document: parse(doc),
      rootValue: 'rootValue',
    });
    expect(result).to.deep.equal({ data: { syncMutationField: 'rootValue' } });
  });

  it('returns a Promise if any field is asynchronous', async () => {
    const doc = 'query Example { syncField, asyncField }';
    const result = execute({
      schema,
      document: parse(doc),
      rootValue: 'rootValue',
    });
    expect(result).to.be.instanceOf(Promise);
    expect(await result).to.deep.equal({
      data: { syncField: 'rootValue', asyncField: 'rootValue' },
    });
  });

  describe('graphqlSync', () => {
    it('does not return a Promise for syntax errors', () => {
      const doc = 'fragment Example on Query { { { syncField }';
      const result = graphqlSync({
        schema,
        source: doc,
      });
      expect(result).to.deep.equal({
        errors: [
          {
            message: 'Syntax Error: Expected Name, found {',
            locations: [{ line: 1, column: 29 }],
          },
        ],
      });
    });

    it('does not return a Promise for validation errors', () => {
      const doc = 'fragment Example on Query { unknownField }';
      const validationErrors = validate(schema, parse(doc));
      const result = graphqlSync({
        schema,
        source: doc,
      });
      expect(result).to.deep.equal({ errors: validationErrors });
    });

    it('does not return a Promise for sync execution', () => {
      const doc = 'query Example { syncField }';
      const result = graphqlSync({
        schema,
        source: doc,
        rootValue: 'rootValue',
      });
      expect(result).to.deep.equal({ data: { syncField: 'rootValue' } });
    });

    it('throws if encountering async execution', () => {
      const doc = 'query Example { syncField, asyncField }';
      expect(() => {
        graphqlSync({
          schema,
          source: doc,
          rootValue: 'rootValue',
        });
      }).to.throw('GraphQL execution failed to complete synchronously.');
    });
  });
});
