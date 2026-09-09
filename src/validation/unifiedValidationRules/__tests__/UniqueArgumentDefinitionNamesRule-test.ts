import { describe, it } from 'node:test';

import { UniqueArgumentDefinitionNamesTypeSystemValidation } from '../UniqueArgumentDefinitionNamesRule.ts';

import { expectSDLRuleErrors } from './harness.ts';

describe('Validate: UniqueArgumentDefinitionNamesRule', () => {
  it('validates SDL argument definition names', () => {
    expectSDLRuleErrors(
      UniqueArgumentDefinitionNamesTypeSystemValidation,
      `
        directive @empty on FIELD_DEFINITION
        directive @tag(arg: String, arg: Int) on FIELD_DEFINITION

        interface Node {
          field(arg: String, arg: Int): String
        }
        extend interface Node {
          other(arg: String, arg: Int): String
        }
        interface Empty

        type Query {
          field(arg: String, arg: Int): String
          single(arg: String): String
        }
        extend type Query {
          other(arg: String, arg: Int): String
        }
      `,
    ).toDeepEqual([
      { message: 'Argument "@tag(arg:)" can only be defined once.' },
      { message: 'Argument "Node.field(arg:)" can only be defined once.' },
      { message: 'Argument "Node.other(arg:)" can only be defined once.' },
      { message: 'Argument "Query.field(arg:)" can only be defined once.' },
      { message: 'Argument "Query.other(arg:)" can only be defined once.' },
    ]);
  });
});
