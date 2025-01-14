import { expect } from 'chai';
import { describe, it } from 'mocha';

import { expectJSON } from '../../__testUtils__/expectJSON.js';

import { parse } from '../../language/parser.js';

import { GraphQLObjectType } from '../../type/definition.js';
import { GraphQLString } from '../../type/scalars.js';
import { GraphQLSchema } from '../../type/schema.js';

import { validate } from '../../validation/validate.js';

import { graphqlSync } from '../../graphql.js';

import { execute, executeSync } from './execute.js';

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
          resolve(rootValue) {
            return Promise.resolve(rootValue);
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
    expectJSON(result).toDeepEqual({
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

  describe('executeSync', () => {
    it('does not return a Promise for sync execution', () => {
      const doc = 'query Example { syncField }';
      const result = executeSync({
        schema,
        document: parse(doc),
        rootValue: 'rootValue',
      });
      expect(result).to.deep.equal({ data: { syncField: 'rootValue' } });
    });

    it('throws if encountering async execution', () => {
      const doc = 'query Example { syncField, asyncField }';
      expect(() => {
        executeSync({
          schema,
          document: parse(doc),
          rootValue: 'rootValue',
        });
      }).to.throw('GraphQL execution failed to complete synchronously.');
    });

    it('throws if encountering async iterable execution', () => {
      const doc = `
        query Example {
          ...deferFrag @defer(label: "deferLabel")
        }
        fragment deferFrag on Query {
          syncField
        }
      `;
      expect(() => {
        executeSync({
          schema,
          document: parse(doc),
          rootValue: 'rootValue',
        });
      }).to.throw('GraphQL execution failed to complete synchronously.');
    });
  });

  describe('graphqlSync', () => {
    it('report errors raised during schema validation', () => {
      const badSchema = new GraphQLSchema({});
      const result = graphqlSync({
        schema: badSchema,
        source: '{ __typename }',
      });
      expectJSON(result).toDeepEqual({
        errors: [{ message: 'Query root type must be provided.' }],
      });
    });

    it('does not return a Promise for syntax errors', () => {
      const doc = 'fragment Example on Query { { { syncField }';
      const result = graphqlSync({
        schema,
        source: doc,
      });
      expectJSON(result).toDeepEqual({
        errors: [
          {
            message: 'Syntax Error: Expected Name, found "{".',
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
