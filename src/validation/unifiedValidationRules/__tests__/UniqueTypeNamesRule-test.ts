import { describe, it } from 'node:test';

import { expectJSON } from '../../../__testUtils__/expectJSON.ts';

import { parse } from '../../../language/parser.ts';

import {
  GraphQLObjectType,
  GraphQLScalarType,
} from '../../../type/definition.ts';
import { GraphQLInt, GraphQLString } from '../../../type/scalars.ts';
import { GraphQLSchema } from '../../../type/schema.ts';

import { validateWithRules } from '../../index.ts';

import { UniqueTypeNamesTypeSystemValidation } from '../UniqueTypeNamesRule.ts';

import {
  expectSchemaValidationErrors,
  expectSDLRuleErrors,
  schemaWithQuery,
} from './harness.ts';

describe('Validate: UniqueTypeNamesRule', () => {
  it('validates SDL type names', () => {
    expectSDLRuleErrors(
      UniqueTypeNamesTypeSystemValidation,
      'type Query { a: String } type Query { b: String }',
    ).toDeepEqual([{ message: 'There can be only one type named "Query".' }]);
  });

  it('rejects SDL type definitions that redefine built-in scalars', () => {
    expectSDLRuleErrors(
      UniqueTypeNamesTypeSystemValidation,
      'scalar Int type Query { field: Int }',
    ).toDeepEqual([
      { message: 'Built-in scalar type "Int" cannot be redefined.' },
    ]);

    const errors = validateWithRules({
      documentAST: parse('scalar Int type Query { field: Int }', {
        noLocation: true,
      }),
    });
    expectJSON(errors).toDeepEqual([
      { message: 'Built-in scalar type "Int" cannot be redefined.' },
    ]);
  });

  it('rejects SDL type definitions that redefine existing schema types', () => {
    expectSDLRuleErrors(
      UniqueTypeNamesTypeSystemValidation,
      'type Query { other: String }',
      schemaWithQuery(),
    ).toDeepEqual([
      {
        message:
          'Type "Query" already exists in the schema. It cannot also be defined in this type definition.',
      },
    ]);
  });

  it('rejects schema types that redefine built-in scalars', () => {
    const CustomInt = new GraphQLScalarType({ name: 'Int' });
    const schema = new GraphQLSchema({
      query: new GraphQLObjectType({
        name: 'Query',
        fields: {
          field: { type: CustomInt },
        },
      }),
    });

    expectSchemaValidationErrors(
      UniqueTypeNamesTypeSystemValidation,
      schema,
    ).toDeepEqual([
      { message: 'Built-in scalar type "Int" cannot be redefined.' },
    ]);
  });

  it('accepts schema types that use built-in scalars', () => {
    const schema = new GraphQLSchema({
      query: new GraphQLObjectType({
        name: 'Query',
        fields: {
          field: { type: GraphQLInt },
          other: { type: GraphQLString },
        },
      }),
    });

    expectSchemaValidationErrors(
      UniqueTypeNamesTypeSystemValidation,
      schema,
    ).toDeepEqual([]);
  });
});
