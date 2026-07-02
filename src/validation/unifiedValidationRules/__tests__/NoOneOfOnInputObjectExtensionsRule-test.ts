import { describe, it } from 'node:test';

import { expectJSON } from '../../../__testUtils__/expectJSON.ts';

import { parse } from '../../../language/parser.ts';

import { validateWithRules } from '../../index.ts';

import { NoOneOfOnInputObjectExtensionsTypeSystemValidation } from '../NoOneOfOnInputObjectExtensionsRule.ts';

function expectSDLErrors(sdlStr: string) {
  const doc = parse(sdlStr, { noLocation: true });
  const errors = validateWithRules({
    documentAST: doc,
    typeSystemRules: [NoOneOfOnInputObjectExtensionsTypeSystemValidation],
  });
  return expectJSON(errors);
}

function expectSDLErrorsWithLocations(sdlStr: string) {
  const doc = parse(sdlStr);
  const errors = validateWithRules({
    documentAST: doc,
    typeSystemRules: [NoOneOfOnInputObjectExtensionsTypeSystemValidation],
  });
  return expectJSON(errors);
}

describe('Validate: NoOneOfOnInputObjectExtensionsRule', () => {
  it('rejects @oneOf on SDL input object extensions', () => {
    expectSDLErrorsWithLocations(
      'input Input { field: String }\nextend input Input @oneOf { other: String }',
    ).toDeepEqual([
      {
        message:
          'Directive "@oneOf" must not be used on input object type extension "Input".',
        locations: [{ line: 2, column: 20 }],
      },
    ]);
  });

  it('accepts @oneOf on SDL input object definitions', () => {
    expectSDLErrors('input Input @oneOf { field: String }').toDeepEqual([]);
  });

  it('accepts SDL input object extensions without @oneOf', () => {
    expectSDLErrors(`
      input Input {
        field: String
      }

      extend input Input @tag {
        other: String
      }

      extend input Input {
        another: String
      }
    `).toDeepEqual([]);
  });
});
