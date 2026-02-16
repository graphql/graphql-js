import { expect } from 'chai';
import { describe, it } from 'mocha';

import { GraphQLError } from '../error/GraphQLError.js';

import { Source } from '../language/source.js';

import { GraphQLObjectType } from '../type/definition.js';
import { GraphQLString } from '../type/scalars.js';
import { GraphQLSchema } from '../type/schema.js';

import type { ValidationRule } from '../validation/ValidationContext.js';

import { execute } from '../execution/execute.js';

import { graphql, graphqlSync } from '../graphql.js';
import { defaultHarness } from '../harness.js';

const schema = new GraphQLSchema({
  query: new GraphQLObjectType({
    name: 'Query',
    fields: {
      a: {
        type: GraphQLString,
        resolve: () => 'A',
      },
      b: {
        type: GraphQLString,
        resolve: () => 'B',
      },
      contextEcho: {
        type: GraphQLString,
        resolve: (_source, _args, contextValue) => String(contextValue),
      },
      syncField: {
        type: GraphQLString,
        resolve: (rootValue) => rootValue,
      },
      asyncField: {
        type: GraphQLString,
        resolve: (rootValue) => Promise.resolve(rootValue),
      },
    },
  }),
});

describe('graphql', () => {
  it('passes source through to parse', async () => {
    const source = new Source('{', 'custom-query.graphql');

    const result = await graphql({ schema, source });

    expect(result.errors?.[0]?.source?.name).to.equal('custom-query.graphql');
  });

  it('passes rules through to validate', async () => {
    const customRule: ValidationRule = (context) => ({
      Field(node) {
        context.reportError(
          new GraphQLError('custom rule error', {
            nodes: node,
          }),
        );
      },
    });

    const result = await graphql({
      schema,
      source: '{ a }',
      rules: [customRule],
    });

    expect(result.errors?.[0]?.message).to.equal('custom rule error');
  });

  it('passes parse options through to parse', async () => {
    const customRule: ValidationRule = (context) => ({
      OperationDefinition(node) {
        context.reportError(
          new GraphQLError(
            node.loc === undefined ? 'no location' : 'has location',
            {
              nodes: node,
            },
          ),
        );
      },
    });

    const result = await graphql({
      schema,
      source: '{ a }',
      noLocation: true,
      rules: [customRule],
    });

    expect(result.errors?.[0]?.message).to.equal('no location');
  });

  it('passes validation options through to validate', async () => {
    const result = await graphql({
      schema,
      source: '{ contextEho }',
      hideSuggestions: true,
    });

    expect(result.errors?.[0]?.message).to.equal(
      'Cannot query field "contextEho" on type "Query".',
    );
  });

  it('passes execution args through to execute', async () => {
    const result = await graphql({
      schema,
      source: `
        query First {
          a
        }

        query Second {
          b
        }
      `,
      operationName: 'Second',
    });

    expect(result).to.deep.equal({
      data: {
        b: 'B',
      },
    });
  });

  it('returns schema validation errors', async () => {
    const badSchema = new GraphQLSchema({});
    const result = await graphql({
      schema: badSchema,
      source: '{ __typename }',
    });

    expect(result.errors?.[0]?.message).to.equal(
      'Query root type must be provided.',
    );
  });

  it('works when a custom harness is provided', async () => {
    const result = await graphql({
      schema,
      source: '{ syncField }',
      rootValue: 'rootValue',
      harness: {
        ...defaultHarness,
        execute: (args) =>
          execute({ ...args, rootValue: `**${args.rootValue}**` }),
      },
    });

    expect(result).to.deep.equal({ data: { syncField: '**rootValue**' } });
  });

  it('returns parse errors thrown synchronously by a custom harness', async () => {
    const parseError = new GraphQLError('sync parse error');
    const result = await graphql({
      schema,
      source: '{ syncField }',
      harness: {
        ...defaultHarness,
        parse: () => {
          throw parseError;
        },
      },
    });

    expect(result).to.deep.equal({ errors: [parseError] });
  });

  it('works with asynchronous parse from a custom harness', async () => {
    const result = await graphql({
      schema,
      source: '{ syncField }',
      rootValue: 'rootValue',
      harness: {
        ...defaultHarness,
        parse: (source, options) =>
          Promise.resolve(defaultHarness.parse(source, options)),
      },
    });

    expect(result).to.deep.equal({ data: { syncField: 'rootValue' } });
  });

  it('handles errors from an asynchronous parse from a custom harness', async () => {
    const parseError = new GraphQLError('async parse error');
    const result = await graphql({
      schema,
      source: '{ syncField }',
      harness: {
        ...defaultHarness,
        parse: () => Promise.reject(parseError),
      },
    });

    expect(result).to.deep.equal({ errors: [parseError] });
  });

  it('works with asynchronous validation from a custom harness', async () => {
    const result = await graphql({
      schema,
      source: '{ syncField }',
      rootValue: 'rootValue',
      harness: {
        ...defaultHarness,
        validate: (s, document) =>
          Promise.resolve(defaultHarness.validate(s, document)),
      },
    });

    expect(result).to.deep.equal({ data: { syncField: 'rootValue' } });
  });

  it('returns validation errors from synchronous validation from a custom harness', async () => {
    const validationError = new GraphQLError('async validation error');
    const result = await graphql({
      schema,
      source: '{ syncField }',
      harness: {
        ...defaultHarness,
        validate: () => [validationError],
      },
    });

    expect(result).to.deep.equal({ errors: [validationError] });
  });

  it('returns validation errors from asynchronous validation from a custom harness', async () => {
    const validationError = new GraphQLError('async validation error');
    const result = await graphql({
      schema,
      source: '{ syncField }',
      harness: {
        ...defaultHarness,
        validate: () => Promise.resolve([validationError]),
      },
    });

    expect(result).to.deep.equal({ errors: [validationError] });
  });
});

describe('graphqlSync', () => {
  it('returns result for synchronous execution', () => {
    const result = graphqlSync({
      schema,
      source: '{ syncField }',
      rootValue: 'rootValue',
    });

    expect(result).to.deep.equal({ data: { syncField: 'rootValue' } });
  });

  it('throws for asynchronous execution', () => {
    expect(() => {
      graphqlSync({
        schema,
        source: '{ asyncField }',
        rootValue: 'rootValue',
      });
    }).to.throw('GraphQL execution failed to complete synchronously.');
  });
});
