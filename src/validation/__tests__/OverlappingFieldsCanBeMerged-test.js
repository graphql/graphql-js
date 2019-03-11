/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow strict
 */

import { expect } from 'chai';
import { describe, it } from 'mocha';
import { buildSchema } from '../../';
import {
  expectValidationErrors,
  expectValidationErrorsWithSchema,
} from './harness';

import {
  OverlappingFieldsCanBeMerged,
  fieldsConflictMessage,
} from '../rules/OverlappingFieldsCanBeMerged';

function expectErrors(queryStr) {
  return expectValidationErrors(OverlappingFieldsCanBeMerged, queryStr);
}

function expectValid(queryStr) {
  expectErrors(queryStr).to.deep.equal([]);
}

function expectErrorsWithSchema(schema, queryStr) {
  return expectValidationErrorsWithSchema(
    schema,
    OverlappingFieldsCanBeMerged,
    queryStr,
  );
}

function expectValidWithSchema(schema, queryStr) {
  expectErrorsWithSchema(schema, queryStr).to.deep.equal([]);
}

describe('Validate: Overlapping fields can be merged', () => {
  it('unique fields', () => {
    expectValid(`
      fragment uniqueFields on Dog {
        name
        nickname
      }
    `);
  });

  it('identical fields', () => {
    expectValid(`
      fragment mergeIdenticalFields on Dog {
        name
        name
      }
    `);
  });

  it('identical fields with identical args', () => {
    expectValid(`
      fragment mergeIdenticalFieldsWithIdenticalArgs on Dog {
        doesKnowCommand(dogCommand: SIT)
        doesKnowCommand(dogCommand: SIT)
      }
    `);
  });

  it('identical fields with identical directives', () => {
    expectValid(`
      fragment mergeSameFieldsWithSameDirectives on Dog {
        name @include(if: true)
        name @include(if: true)
      }
    `);
  });

  it('different args with different aliases', () => {
    expectValid(`
      fragment differentArgsWithDifferentAliases on Dog {
        knowsSit: doesKnowCommand(dogCommand: SIT)
        knowsDown: doesKnowCommand(dogCommand: DOWN)
      }
    `);
  });

  it('different directives with different aliases', () => {
    expectValid(`
      fragment differentDirectivesWithDifferentAliases on Dog {
        nameIfTrue: name @include(if: true)
        nameIfFalse: name @include(if: false)
      }
    `);
  });

  it('different skip/include directives accepted', () => {
    // Note: Differing skip/include directives don't create an ambiguous return
    // value and are acceptable in conditions where differing runtime values
    // may have the same desired effect of including or skipping a field.
    expectValid(`
      fragment differentDirectivesWithDifferentAliases on Dog {
        name @include(if: true)
        name @include(if: false)
      }
    `);
  });

  it('Same aliases with different field targets', () => {
    expectErrors(`
      fragment sameAliasesWithDifferentFieldTargets on Dog {
        fido: name
        fido: nickname
      }
    `).to.deep.equal([
      {
        message: fieldsConflictMessage(
          'fido',
          'name and nickname are different fields',
        ),
        locations: [{ line: 3, column: 9 }, { line: 4, column: 9 }],
      },
    ]);
  });

  it('Same aliases allowed on non-overlapping fields', () => {
    // This is valid since no object can be both a "Dog" and a "Cat", thus
    // these fields can never overlap.
    expectValid(`
      fragment sameAliasesWithDifferentFieldTargets on Pet {
        ... on Dog {
          name
        }
        ... on Cat {
          name: nickname
        }
      }
    `);
  });

  it('Alias masking direct field access', () => {
    expectErrors(`
      fragment aliasMaskingDirectFieldAccess on Dog {
        name: nickname
        name
      }
    `).to.deep.equal([
      {
        message: fieldsConflictMessage(
          'name',
          'nickname and name are different fields',
        ),
        locations: [{ line: 3, column: 9 }, { line: 4, column: 9 }],
      },
    ]);
  });

  it('different args, second adds an argument', () => {
    expectErrors(`
      fragment conflictingArgs on Dog {
        doesKnowCommand
        doesKnowCommand(dogCommand: HEEL)
      }
    `).to.deep.equal([
      {
        message: fieldsConflictMessage(
          'doesKnowCommand',
          'they have differing arguments',
        ),
        locations: [{ line: 3, column: 9 }, { line: 4, column: 9 }],
      },
    ]);
  });

  it('different args, second missing an argument', () => {
    expectErrors(`
      fragment conflictingArgs on Dog {
        doesKnowCommand(dogCommand: SIT)
        doesKnowCommand
      }
    `).to.deep.equal([
      {
        message: fieldsConflictMessage(
          'doesKnowCommand',
          'they have differing arguments',
        ),
        locations: [{ line: 3, column: 9 }, { line: 4, column: 9 }],
      },
    ]);
  });

  it('conflicting args', () => {
    expectErrors(`
      fragment conflictingArgs on Dog {
        doesKnowCommand(dogCommand: SIT)
        doesKnowCommand(dogCommand: HEEL)
      }
    `).to.deep.equal([
      {
        message: fieldsConflictMessage(
          'doesKnowCommand',
          'they have differing arguments',
        ),
        locations: [{ line: 3, column: 9 }, { line: 4, column: 9 }],
      },
    ]);
  });

  it('allows different args where no conflict is possible', () => {
    // This is valid since no object can be both a "Dog" and a "Cat", thus
    // these fields can never overlap.
    expectValid(`
      fragment conflictingArgs on Pet {
        ... on Dog {
          name(surname: true)
        }
        ... on Cat {
          name
        }
      }
    `);
  });

  it('encounters conflict in fragments', () => {
    expectErrors(`
      {
        ...A
        ...B
      }
      fragment A on Type {
        x: a
      }
      fragment B on Type {
        x: b
      }
    `).to.deep.equal([
      {
        message: fieldsConflictMessage('x', 'a and b are different fields'),
        locations: [{ line: 7, column: 9 }, { line: 10, column: 9 }],
      },
    ]);
  });

  it('reports each conflict once', () => {
    expectErrors(`
      {
        f1 {
          ...A
          ...B
        }
        f2 {
          ...B
          ...A
        }
        f3 {
          ...A
          ...B
          x: c
        }
      }
      fragment A on Type {
        x: a
      }
      fragment B on Type {
        x: b
      }
    `).to.deep.equal([
      {
        message: fieldsConflictMessage('x', 'a and b are different fields'),
        locations: [{ line: 18, column: 9 }, { line: 21, column: 9 }],
      },
      {
        message: fieldsConflictMessage('x', 'c and a are different fields'),
        locations: [{ line: 14, column: 11 }, { line: 18, column: 9 }],
      },
      {
        message: fieldsConflictMessage('x', 'c and b are different fields'),
        locations: [{ line: 14, column: 11 }, { line: 21, column: 9 }],
      },
    ]);
  });

  it('deep conflict', () => {
    expectErrors(`
      {
        field {
          x: a
        },
        field {
          x: b
        }
      }
    `).to.deep.equal([
      {
        message: fieldsConflictMessage('field', [
          ['x', 'a and b are different fields'],
        ]),
        locations: [
          { line: 3, column: 9 },
          { line: 4, column: 11 },
          { line: 6, column: 9 },
          { line: 7, column: 11 },
        ],
      },
    ]);
  });

  it('deep conflict with multiple issues', () => {
    expectErrors(`
      {
        field {
          x: a
          y: c
        },
        field {
          x: b
          y: d
        }
      }
    `).to.deep.equal([
      {
        message: fieldsConflictMessage('field', [
          ['x', 'a and b are different fields'],
          ['y', 'c and d are different fields'],
        ]),
        locations: [
          { line: 3, column: 9 },
          { line: 4, column: 11 },
          { line: 5, column: 11 },
          { line: 7, column: 9 },
          { line: 8, column: 11 },
          { line: 9, column: 11 },
        ],
      },
    ]);
  });

  it('very deep conflict', () => {
    expectErrors(`
      {
        field {
          deepField {
            x: a
          }
        },
        field {
          deepField {
            x: b
          }
        }
      }
    `).to.deep.equal([
      {
        message: fieldsConflictMessage('field', [
          ['deepField', [['x', 'a and b are different fields']]],
        ]),
        locations: [
          { line: 3, column: 9 },
          { line: 4, column: 11 },
          { line: 5, column: 13 },
          { line: 8, column: 9 },
          { line: 9, column: 11 },
          { line: 10, column: 13 },
        ],
      },
    ]);
  });

  it('reports deep conflict to nearest common ancestor', () => {
    expectErrors(`
      {
        field {
          deepField {
            x: a
          }
          deepField {
            x: b
          }
        },
        field {
          deepField {
            y
          }
        }
      }
    `).to.deep.equal([
      {
        message: fieldsConflictMessage('deepField', [
          ['x', 'a and b are different fields'],
        ]),
        locations: [
          { line: 4, column: 11 },
          { line: 5, column: 13 },
          { line: 7, column: 11 },
          { line: 8, column: 13 },
        ],
      },
    ]);
  });

  it('reports deep conflict to nearest common ancestor in fragments', () => {
    expectErrors(`
      {
        field {
          ...F
        }
        field {
          ...F
        }
      }
      fragment F on T {
        deepField {
          deeperField {
            x: a
          }
          deeperField {
            x: b
          }
        },
        deepField {
          deeperField {
            y
          }
        }
      }
    `).to.deep.equal([
      {
        message: fieldsConflictMessage('deeperField', [
          ['x', 'a and b are different fields'],
        ]),
        locations: [
          { line: 12, column: 11 },
          { line: 13, column: 13 },
          { line: 15, column: 11 },
          { line: 16, column: 13 },
        ],
      },
    ]);
  });

  it('reports deep conflict in nested fragments', () => {
    expectErrors(`
      {
        field {
          ...F
        }
        field {
          ...I
        }
      }
      fragment F on T {
        x: a
        ...G
      }
      fragment G on T {
        y: c
      }
      fragment I on T {
        y: d
        ...J
      }
      fragment J on T {
        x: b
      }
    `).to.deep.equal([
      {
        message: fieldsConflictMessage('field', [
          ['x', 'a and b are different fields'],
          ['y', 'c and d are different fields'],
        ]),
        locations: [
          { line: 3, column: 9 },
          { line: 11, column: 9 },
          { line: 15, column: 9 },
          { line: 6, column: 9 },
          { line: 22, column: 9 },
          { line: 18, column: 9 },
        ],
      },
    ]);
  });

  it('ignores unknown fragments', () => {
    expectValid(`
      {
        field
        ...Unknown
        ...Known
      }

      fragment Known on T {
        field
        ...OtherUnknown
      }
    `);
  });

  describe('return types must be unambiguous', () => {
    const schema = buildSchema(`
      interface SomeBox {
        deepBox: SomeBox
        unrelatedField: String
      }

      type StringBox implements SomeBox {
        scalar: String
        deepBox: StringBox
        unrelatedField: String
        listStringBox: [StringBox]
        stringBox: StringBox
        intBox: IntBox
      }

      type IntBox implements SomeBox {
        scalar: Int
        deepBox: IntBox
        unrelatedField: String
        listStringBox: [StringBox]
        stringBox: StringBox
        intBox: IntBox
      }

      interface NonNullStringBox1 {
        scalar: String!
      }

      type NonNullStringBox1Impl implements SomeBox & NonNullStringBox1 {
        scalar: String!
        unrelatedField: String
        deepBox: SomeBox
      }

      interface NonNullStringBox2 {
        scalar: String!
      }

      type NonNullStringBox2Impl implements SomeBox & NonNullStringBox2 {
        scalar: String!
        unrelatedField: String
        deepBox: SomeBox
      }

      type Connection {
        edges: [Edge]
      }

      type Edge {
        node: Node
      }

      type Node {
        id: ID
        name: String
      }

      type Query {
        someBox: SomeBox
        connection: Connection
      }
    `);

    it('conflicting return types which potentially overlap', () => {
      // This is invalid since an object could potentially be both the Object
      // type IntBox and the interface type NonNullStringBox1. While that
      // condition does not exist in the current schema, the schema could
      // expand in the future to allow this. Thus it is invalid.
      expectErrorsWithSchema(
        schema,
        `
          {
            someBox {
              ...on IntBox {
                scalar
              }
              ...on NonNullStringBox1 {
                scalar
              }
            }
          }
        `,
      ).to.deep.equal([
        {
          message: fieldsConflictMessage(
            'scalar',
            'they return conflicting types Int and String!',
          ),
          locations: [{ line: 5, column: 17 }, { line: 8, column: 17 }],
        },
      ]);
    });

    it('compatible return shapes on different return types', () => {
      // In this case `deepBox` returns `SomeBox` in the first usage, and
      // `StringBox` in the second usage. These return types are not the same!
      // however this is valid because the return *shapes* are compatible.
      expectValidWithSchema(
        schema,
        `
          {
            someBox {
              ... on SomeBox {
                deepBox {
                  unrelatedField
                }
              }
              ... on StringBox {
                deepBox {
                  unrelatedField
                }
              }
            }
          }
        `,
      );
    });

    it('disallows differing return types despite no overlap', () => {
      expectErrorsWithSchema(
        schema,
        `
          {
            someBox {
              ... on IntBox {
                scalar
              }
              ... on StringBox {
                scalar
              }
            }
          }
        `,
      ).to.deep.equal([
        {
          message: fieldsConflictMessage(
            'scalar',
            'they return conflicting types Int and String',
          ),
          locations: [{ line: 5, column: 17 }, { line: 8, column: 17 }],
        },
      ]);
    });

    it('reports correctly when a non-exclusive follows an exclusive', () => {
      expectErrorsWithSchema(
        schema,
        `
          {
            someBox {
              ... on IntBox {
                deepBox {
                  ...X
                }
              }
            }
            someBox {
              ... on StringBox {
                deepBox {
                  ...Y
                }
              }
            }
            memoed: someBox {
              ... on IntBox {
                deepBox {
                  ...X
                }
              }
            }
            memoed: someBox {
              ... on StringBox {
                deepBox {
                  ...Y
                }
              }
            }
            other: someBox {
              ...X
            }
            other: someBox {
              ...Y
            }
          }
          fragment X on SomeBox {
            scalar
          }
          fragment Y on SomeBox {
            scalar: unrelatedField
          }
        `,
      ).to.deep.equal([
        {
          message: fieldsConflictMessage('other', [
            ['scalar', 'scalar and unrelatedField are different fields'],
          ]),
          locations: [
            { line: 31, column: 13 },
            { line: 39, column: 13 },
            { line: 34, column: 13 },
            { line: 42, column: 13 },
          ],
        },
      ]);
    });

    it('disallows differing return type nullability despite no overlap', () => {
      expectErrorsWithSchema(
        schema,
        `
          {
            someBox {
              ... on NonNullStringBox1 {
                scalar
              }
              ... on StringBox {
                scalar
              }
            }
          }
        `,
      ).to.deep.equal([
        {
          message: fieldsConflictMessage(
            'scalar',
            'they return conflicting types String! and String',
          ),
          locations: [{ line: 5, column: 17 }, { line: 8, column: 17 }],
        },
      ]);
    });

    it('disallows differing return type list despite no overlap', () => {
      expectErrorsWithSchema(
        schema,
        `
          {
            someBox {
              ... on IntBox {
                box: listStringBox {
                  scalar
                }
              }
              ... on StringBox {
                box: stringBox {
                  scalar
                }
              }
            }
          }
        `,
      ).to.deep.equal([
        {
          message: fieldsConflictMessage(
            'box',
            'they return conflicting types [StringBox] and StringBox',
          ),
          locations: [{ line: 5, column: 17 }, { line: 10, column: 17 }],
        },
      ]);

      expectErrorsWithSchema(
        schema,
        `
          {
            someBox {
              ... on IntBox {
                box: stringBox {
                  scalar
                }
              }
              ... on StringBox {
                box: listStringBox {
                  scalar
                }
              }
            }
          }
        `,
      ).to.deep.equal([
        {
          message: fieldsConflictMessage(
            'box',
            'they return conflicting types StringBox and [StringBox]',
          ),
          locations: [{ line: 5, column: 17 }, { line: 10, column: 17 }],
        },
      ]);
    });

    it('disallows differing subfields', () => {
      expectErrorsWithSchema(
        schema,
        `
          {
            someBox {
              ... on IntBox {
                box: stringBox {
                  val: scalar
                  val: unrelatedField
                }
              }
              ... on StringBox {
                box: stringBox {
                  val: scalar
                }
              }
            }
          }
        `,
      ).to.deep.equal([
        {
          message: fieldsConflictMessage(
            'val',
            'scalar and unrelatedField are different fields',
          ),
          locations: [{ line: 6, column: 19 }, { line: 7, column: 19 }],
        },
      ]);
    });

    it('disallows differing deep return types despite no overlap', () => {
      expectErrorsWithSchema(
        schema,
        `
          {
            someBox {
              ... on IntBox {
                box: stringBox {
                  scalar
                }
              }
              ... on StringBox {
                box: intBox {
                  scalar
                }
              }
            }
          }
        `,
      ).to.deep.equal([
        {
          message: fieldsConflictMessage('box', [
            ['scalar', 'they return conflicting types String and Int'],
          ]),
          locations: [
            { line: 5, column: 17 },
            { line: 6, column: 19 },
            { line: 10, column: 17 },
            { line: 11, column: 19 },
          ],
        },
      ]);
    });

    it('allows non-conflicting overlapping types', () => {
      expectValidWithSchema(
        schema,
        `
          {
            someBox {
              ... on IntBox {
                scalar: unrelatedField
              }
              ... on StringBox {
                scalar
              }
            }
          }
        `,
      );
    });

    it('same wrapped scalar return types', () => {
      expectValidWithSchema(
        schema,
        `
          {
            someBox {
              ...on NonNullStringBox1 {
                scalar
              }
              ...on NonNullStringBox2 {
                scalar
              }
            }
          }
        `,
      );
    });

    it('allows inline typeless fragments', () => {
      expectValidWithSchema(
        schema,
        `
          {
            a
            ... {
              a
            }
          }
        `,
      );
    });

    it('compares deep types including list', () => {
      expectErrorsWithSchema(
        schema,
        `
          {
            connection {
              ...edgeID
              edges {
                node {
                  id: name
                }
              }
            }
          }

          fragment edgeID on Connection {
            edges {
              node {
                id
              }
            }
          }
        `,
      ).to.deep.equal([
        {
          message: fieldsConflictMessage('edges', [
            ['node', [['id', 'name and id are different fields']]],
          ]),
          locations: [
            { line: 5, column: 15 },
            { line: 6, column: 17 },
            { line: 7, column: 19 },
            { line: 14, column: 13 },
            { line: 15, column: 15 },
            { line: 16, column: 17 },
          ],
        },
      ]);
    });

    it('ignores unknown types', () => {
      expectValidWithSchema(
        schema,
        `
          {
            someBox {
              ...on UnknownType {
                scalar
              }
              ...on NonNullStringBox2 {
                scalar
              }
            }
          }
        `,
      );
    });

    it('error message contains hint for alias conflict', () => {
      // The error template should end with a hint for the user to try using
      // different aliases.
      const error = fieldsConflictMessage('x', 'a and b are different fields');
      expect(error).to.equal(
        'Fields "x" conflict because a and b are different fields. Use different aliases on the fields to fetch both if this was intentional.',
      );
    });

    it('works for field names that are JS keywords', () => {
      const schemaWithKeywords = buildSchema(`
        type Foo {
          constructor: String
        }

        type Query {
          foo: Foo
        }
      `);

      expectValidWithSchema(
        schemaWithKeywords,
        `
          {
            foo {
              constructor
            }
          }
        `,
      );
    });
  });

  it('does not infinite loop on recursive fragment', () => {
    expectValid(`
      fragment fragA on Human { name, relatives { name, ...fragA } }
    `);
  });

  it('does not infinite loop on immediately recursive fragment', () => {
    expectValid(`
      fragment fragA on Human { name, ...fragA }
    `);
  });

  it('does not infinite loop on transitively recursive fragment', () => {
    expectValid(`
      fragment fragA on Human { name, ...fragB }
      fragment fragB on Human { name, ...fragC }
      fragment fragC on Human { name, ...fragA }
    `);
  });

  it('finds invalid case even with immediately recursive fragment', () => {
    expectErrors(`
      fragment sameAliasesWithDifferentFieldTargets on Dog {
        ...sameAliasesWithDifferentFieldTargets
        fido: name
        fido: nickname
      }
    `).to.deep.equal([
      {
        message: fieldsConflictMessage(
          'fido',
          'name and nickname are different fields',
        ),
        locations: [{ line: 4, column: 9 }, { line: 5, column: 9 }],
      },
    ]);
  });
});
