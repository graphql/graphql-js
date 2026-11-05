import { describe, it } from 'node:test';

import { expect } from 'chai';

import { GraphQLError } from '../error/GraphQLError.ts';

import { Source } from '../language/source.ts';

import { GraphQLObjectType } from '../type/definition.ts';
import { GraphQLString } from '../type/scalars.ts';
import { GraphQLSchema } from '../type/schema.ts';

import type { ValidationRule } from '../validation/ValidationContext.ts';

import { execute } from '../execution/execute.ts';

import { buildSchema } from '../utilities/buildASTSchema.ts';

import { graphql, graphqlSync } from '../graphql.ts';
import { defaultHarness } from '../harness.ts';

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

for (const run of [graphql, graphqlSync]) {
  describe(`${run.name}: variable usage validation`, () => {
    const variableSchema = buildSchema('type Query { value(n: Int!): Int }');
    const source = 'query Q($v: Int = 3) { value(n: $v) }';

    it('rejects legacy variable usages by default before execution', async () => {
      let executed = false;
      const warnings: Array<GraphQLError> = [];
      const result = await run({
        schema: variableSchema,
        source,
        variableValues: { v: 5 },
        rootValue: {
          value: () => {
            executed = true;
          },
        },
        onLegacyVariableUsage: (warning) => {
          warnings.push(warning);
        },
      });
      expect(result.errors?.[0].message).to.equal(
        'Variable "$v" of type "Int" used in position expecting type "Int!".',
      );
      expect(executed).to.equal(false);
      expect(warnings).to.deep.equal([]);
    });

    it('executes legacy operations with optional migration logging', async () => {
      const warnings: Array<GraphQLError> = [];
      const args = {
        schema: variableSchema,
        source,
        allowLegacyVariableUsage: true,
        rootValue: { value: ({ n }: { n: number }) => n },
      };
      const silentResult = await run(args);
      const result = await run({
        ...args,
        maxErrors: 0,
        maxWarnings: 1,
        onLegacyVariableUsage(warning, operation) {
          expect(operation.name?.value).to.equal('Q');
          warnings.push(warning);
        },
      });
      expect(result).to.deep.equal({ data: { value: 3 } });
      expect(result).to.deep.equal(silentResult);
      expect(warnings).to.have.lengthOf(1);
    });

    it('preserves runtime null errors in legacy mode', async () => {
      const result = await run({
        schema: variableSchema,
        source,
        allowLegacyVariableUsage: true,
        variableValues: { v: null },
      });
      expect(result.data).to.deep.equal({ value: null });
      expect(result.errors).to.have.lengthOf(1);
      expect(result.errors?.[0].path).to.deep.equal(['value']);
    });

    it('allows omission but rejects null after migrating the variable type', async () => {
      const args = {
        schema: variableSchema,
        source: 'query Q($v: Int! = 3) { value(n: $v) }',
        rootValue: { value: ({ n }: { n: number }) => n },
      };
      expect(await run(args)).to.deep.equal({ data: { value: 3 } });
      const result = await run({ ...args, variableValues: { v: null } });
      expect(result.data).to.equal(undefined);
      expect(result.errors).to.have.lengthOf(1);
      expect(result.errors?.[0].path).to.equal(undefined);
    });
  });
}

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
