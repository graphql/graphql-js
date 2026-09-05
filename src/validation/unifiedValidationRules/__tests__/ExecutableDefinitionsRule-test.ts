import { describe, it } from 'node:test';

import { expectJSON } from '../../../__testUtils__/expectJSON.ts';

import { parse } from '../../../language/parser.ts';

import { validateWithRules } from '../../validateWithRules.ts';

import { ExecutableDefinitionsTypeSystemValidation } from '../ExecutableDefinitionsRule.ts';

describe('Validate: ExecutableDefinitionsRule', () => {
  it('accepts executable definitions', () => {
    expectJSON(
      validateWithRules({
        documentAST: parse(`
          query Foo {
            field
          }

          fragment Frag on Query {
            field
          }
        `),
        typeSystemRules: [ExecutableDefinitionsTypeSystemValidation],
      }),
    ).toDeepEqual([]);
  });

  it('rejects type-system definitions', () => {
    expectJSON(
      validateWithRules({
        documentAST: parse(`
          schema {
            query: Query
          }

          type Query {
            field: String
          }

          extend schema @directive
        `),
        typeSystemRules: [ExecutableDefinitionsTypeSystemValidation],
      }),
    ).toDeepEqual([
      {
        message: 'The schema definition is not executable.',
        locations: [{ line: 2, column: 11 }],
      },
      {
        message: 'The "Query" definition is not executable.',
        locations: [{ line: 6, column: 11 }],
      },
      {
        message: 'The schema definition is not executable.',
        locations: [{ line: 10, column: 11 }],
      },
    ]);
  });
});
