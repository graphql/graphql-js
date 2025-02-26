import { describe, it } from 'mocha';

import { expectJSON } from '../../__testUtils__/expectJSON.js';

import type { DocumentNode } from '../../language/ast.js';
import { OperationTypeNode } from '../../language/ast.js';
import { Kind } from '../../language/kinds.js';

import { ScalarLeafsRule } from '../rules/ScalarLeafsRule.js';
import { validate } from '../validate.js';

import { expectValidationErrors, testSchema } from './harness.js';

function expectErrors(queryStr: string) {
  return expectValidationErrors(ScalarLeafsRule, queryStr);
}

function expectValid(queryStr: string) {
  expectErrors(queryStr).toDeepEqual([]);
}

describe('Validate: Scalar leafs', () => {
  it('valid scalar selection', () => {
    expectValid(`
      fragment scalarSelection on Dog {
        barks
      }
    `);
  });

  it('object type missing selection', () => {
    expectErrors(`
      query directQueryOnObjectWithoutSubFields {
        human
      }
    `).toDeepEqual([
      {
        message:
          'Field "human" of type "Human" must have a selection of subfields. Did you mean "human { ... }"?',
        locations: [{ line: 3, column: 9 }],
      },
    ]);
  });

  it('object type having only one selection', () => {
    const doc: DocumentNode = {
      kind: Kind.DOCUMENT,
      definitions: [
        {
          kind: Kind.OPERATION_DEFINITION,
          operation: OperationTypeNode.QUERY,
          selectionSet: {
            kind: Kind.SELECTION_SET,
            selections: [
              {
                kind: Kind.FIELD,
                name: { kind: Kind.NAME, value: 'human' },
                selectionSet: { kind: Kind.SELECTION_SET, selections: [] },
              },
            ],
          },
        },
      ],
    };

    // We can't leverage expectErrors since it doesn't support passing in the
    // documentNode directly. We have to do this because this is technically
    // an invalid document.
    const errors = validate(testSchema, doc, [ScalarLeafsRule]);
    expectJSON(errors).toDeepEqual([
      {
        message:
          'Field "human" of type "Human" must have at least one field selected.',
      },
    ]);
  });

  it('interface type missing selection', () => {
    expectErrors(`
      {
        human { pets }
      }
    `).toDeepEqual([
      {
        message:
          'Field "pets" of type "[Pet]" must have a selection of subfields. Did you mean "pets { ... }"?',
        locations: [{ line: 3, column: 17 }],
      },
    ]);
  });

  it('valid scalar selection with args', () => {
    expectValid(`
      fragment scalarSelectionWithArgs on Dog {
        doesKnowCommand(dogCommand: SIT)
      }
    `);
  });

  it('scalar selection not allowed on Boolean', () => {
    expectErrors(`
      fragment scalarSelectionsNotAllowedOnBoolean on Dog {
        barks { sinceWhen }
      }
    `).toDeepEqual([
      {
        message:
          'Field "barks" must not have a selection since type "Boolean" has no subfields.',
        locations: [{ line: 3, column: 15 }],
      },
    ]);
  });

  it('scalar selection not allowed on Enum', () => {
    expectErrors(`
      fragment scalarSelectionsNotAllowedOnEnum on Cat {
        furColor { inHexDec }
      }
    `).toDeepEqual([
      {
        message:
          'Field "furColor" must not have a selection since type "FurColor" has no subfields.',
        locations: [{ line: 3, column: 18 }],
      },
    ]);
  });

  it('scalar selection not allowed with args', () => {
    expectErrors(`
      fragment scalarSelectionsNotAllowedWithArgs on Dog {
        doesKnowCommand(dogCommand: SIT) { sinceWhen }
      }
    `).toDeepEqual([
      {
        message:
          'Field "doesKnowCommand" must not have a selection since type "Boolean" has no subfields.',
        locations: [{ line: 3, column: 42 }],
      },
    ]);
  });

  it('Scalar selection not allowed with directives', () => {
    expectErrors(`
      fragment scalarSelectionsNotAllowedWithDirectives on Dog {
        name @include(if: true) { isAlsoHumanName }
      }
    `).toDeepEqual([
      {
        message:
          'Field "name" must not have a selection since type "String" has no subfields.',
        locations: [{ line: 3, column: 33 }],
      },
    ]);
  });

  it('Scalar selection not allowed with directives and args', () => {
    expectErrors(`
      fragment scalarSelectionsNotAllowedWithDirectivesAndArgs on Dog {
        doesKnowCommand(dogCommand: SIT) @include(if: true) { sinceWhen }
      }
    `).toDeepEqual([
      {
        message:
          'Field "doesKnowCommand" must not have a selection since type "Boolean" has no subfields.',
        locations: [{ line: 3, column: 61 }],
      },
    ]);
  });
});
