import { describe, it } from 'node:test';

import { expectJSON } from '../../../__testUtils__/expectJSON.ts';

import { Kind } from '../../../language/kinds.ts';
import { parse } from '../../../language/parser.ts';

import { GraphQLScalarType } from '../../../type/definition.ts';
import type { GraphQLSchema } from '../../../type/schema.ts';

import { validateWithRules } from '../../validateWithRules.ts';

import { DirectivesAreDirectivesTypeSystemValidation } from '../DirectivesAreDirectivesRule.ts';

import { expectSDLRuleErrors, schemaWithQuery } from './harness.ts';

describe('Validate: DirectivesAreDirectivesRule', () => {
  it('ignores documents without an existing schema', () => {
    expectSDLRuleErrors(
      DirectivesAreDirectivesTypeSystemValidation,
      'type Query { field: String }',
    ).toDeepEqual([]);
  });

  it('rejects schema directive entries that are not directives', () => {
    const schema = schemaWithQuery();
    const scalarAstNode = parse('scalar SomeScalar').definitions[0];
    if (scalarAstNode.kind !== Kind.SCALAR_TYPE_DEFINITION) {
      throw new Error('Expected scalar definition.');
    }
    const invalidDirective = new GraphQLScalarType({
      name: 'SomeScalar',
      astNode: scalarAstNode,
    });

    schema.getDirectives = () =>
      [null, invalidDirective] as unknown as ReturnType<
        GraphQLSchema['getDirectives']
      >;

    expectJSON(
      validateWithRules({
        schema,
        typeSystemRules: [DirectivesAreDirectivesTypeSystemValidation],
      }),
    ).toDeepEqual([
      {
        message: 'Expected directive but got: null.',
      },
      {
        message: 'Expected directive but got: SomeScalar.',
        locations: [{ line: 1, column: 1 }],
      },
    ]);
  });
});
