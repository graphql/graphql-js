import { describe, it } from 'node:test';

import { expect } from 'chai';

import { expectMatchingValues } from '../../../__testUtils__/expectMatchingValues.ts';

import { invariant } from '../../../jsutils/invariant.ts';
import type { ReadOnlyObjMap } from '../../../jsutils/ObjMap.ts';

import { Parser } from '../../../language/parser.ts';
import { TokenKind } from '../../../language/tokenKind.ts';

import {
  GraphQLInputObjectType,
  GraphQLObjectType,
} from '../../../type/definition.ts';
import { GraphQLString } from '../../../type/scalars.ts';
import { GraphQLSchema } from '../../../type/schema.ts';

import { buildSchema } from '../../../utilities/buildASTSchema.ts';

import { getVariableValues } from '../../values.ts';

import { compileVariableValues } from '../compileVariableValues.ts';
import { getCompiledVariableValues } from '../getCompiledVariableValues.ts';

const schema = buildSchema(`
  input Input {
    required: Boolean!
    optional: Int = 7
  }

  enum Color {
    RED
    GREEN
  }

  type Query {
    dummy: String
  }
`);

describe('getCompiledVariableValues', () => {
  it('matches valid variable coercion, defaults, and omitted values', () => {
    const result = testVariableValues(
      '($required: Boolean!, $optional: Int = 3, $nullable: Boolean, $input: Input, $list: [Boolean!])',
      {
        required: false,
        input: { required: true },
        list: [true],
      },
    );

    invariant(result.variableValues !== undefined);
    expect(result.variableValues.coerced).to.deep.equal({
      required: false,
      optional: 3,
      input: { required: true, optional: 7 },
      list: [true],
    });
    expect(result.variableValues.sources).to.have.keys([
      'required',
      'optional',
      'nullable',
      'input',
      'list',
    ]);
  });

  it('matches invalid variable coercion errors', () => {
    const result = testVariableValues(
      '($required: Boolean!, $input: Input, $color: Color)',
      {
        required: null,
        input: { required: null, extra: true },
        color: 'BLUE',
      },
    );

    invariant(result.errors !== undefined);
    expect(result.errors).to.have.length(4);
  });

  it('matches omitted required variable errors', () => {
    const result = testVariableValues('($required: Boolean!)', {});

    invariant(result.errors !== undefined);
    expect(result.errors).to.have.length(1);
    expect(result.errors[0].message).to.equal(
      'Variable "$required" has invalid value: Expected a value of non-null type "Boolean!" to be provided.',
    );
  });

  it('matches max coercion error handling', () => {
    const result = testVariableValues(
      '($a: Boolean!, $b: Boolean!)',
      { a: null, b: null },
      { maxErrors: 1 },
    );

    invariant(result.errors !== undefined);
    expect(result.errors).to.have.length(2);
    expect(result.errors[1].message).to.equal(
      'Too many errors processing variables, error limit reached. Execution aborted.',
    );
  });

  it('matches invalid variable defaults', () => {
    const result = testVariableValues('($value: Int = "bad")', {});

    invariant(result.errors !== undefined);
    expect(result.errors).to.have.length(1);
    expect(result.errors[0].message).to.contain(
      'Variable "$value" has invalid default value',
    );
  });

  it('matches nested default coercion errors', () => {
    const invalidDefaultSchema = new GraphQLSchema({
      query: new GraphQLObjectType({
        name: 'Query',
        fields: {
          dummy: { type: GraphQLString },
        },
      }),
      types: [
        new GraphQLInputObjectType({
          name: 'InputWithInvalidFieldDefault',
          fields: {
            value: { type: GraphQLString, default: { value: 123 } },
          },
        }),
      ],
    });
    const result = testVariableValues(
      '($value: InputWithInvalidFieldDefault = {})',
      {},
      undefined,
      invalidDefaultSchema,
    );

    invariant(result.errors !== undefined);
    expect(result.errors).to.have.length(1);
    expect(result.errors[0].message).to.equal(
      'Variable "$value" has invalid default value: Expected value of type "String" to be valid, found: 123.',
    );
  });

  it('matches invalid variable signatures', () => {
    const result = testVariableValues('($value: Missing)', {});

    invariant(result.errors !== undefined);
    expect(result.errors).to.have.length(1);
    expect(result.errors[0].message).to.equal(
      'Variable "$value" expected value of type "Missing" which cannot be used as an input type.',
    );
  });

  it('matches hidden suggestion behavior', () => {
    const result = testVariableValues(
      '($color: Color!)',
      { color: 'INVALID' },
      { hideSuggestions: true },
    );

    invariant(result.errors !== undefined);
    expect(result.errors[0].message).to.contain(
      'Value "INVALID" does not exist in "Color" enum.',
    );
    expect(result.errors[0].message).not.to.contain('Did you mean');
  });
});

function testVariableValues(
  variableDefinitions: string,
  inputs: ReadOnlyObjMap<unknown>,
  options?: { maxErrors?: number; hideSuggestions?: boolean },
  testSchema = schema,
) {
  const parser = new Parser(variableDefinitions);
  parser.expectToken(TokenKind.SOF);
  const varDefNodes = parser.parseVariableDefinitions() ?? [];
  const genericOptions =
    options === undefined
      ? undefined
      : {
          ...(options.maxErrors === undefined
            ? undefined
            : { maxErrors: options.maxErrors }),
          ...(options.hideSuggestions === undefined
            ? undefined
            : { hideSuggestions: options.hideSuggestions }),
        };
  return expectMatchingValues([
    () => getVariableValues(testSchema, varDefNodes, inputs, genericOptions),
    () => {
      const compiled = compileVariableValues(
        testSchema,
        varDefNodes,
        options?.hideSuggestions ?? false,
      );
      return getCompiledVariableValues(
        compiled,
        inputs,
        options?.maxErrors ?? 50,
      );
    },
  ]);
}
