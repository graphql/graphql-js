import { expect } from 'chai';
import { describe, it } from 'mocha';

import { dedent } from '../../__testUtils__/dedent';
import { expectJSON, expectToThrowJSON } from '../../__testUtils__/expectJSON';
import { kitchenSinkQuery } from '../../__testUtils__/kitchenSinkQuery';

import { inspect } from '../../jsutils/inspect';

import { Kind } from '../kinds';
import { parse, parseConstValue, parseType, parseValue } from '../parser';
import { Source } from '../source';
import { TokenKind } from '../tokenKind';

function expectSyntaxError(text: string) {
  return expectToThrowJSON(() => parse(text));
}

describe('Parser', () => {
  it('parse provides useful errors', () => {
    let caughtError;
    try {
      parse('{');
    } catch (error) {
      caughtError = error;
    }

    expect(caughtError).to.deep.contain({
      message: 'Syntax Error: Expected Name, found <EOF>.',
      positions: [1],
      locations: [{ line: 1, column: 2 }],
    });

    expect(String(caughtError)).to.equal(dedent`
      Syntax Error: Expected Name, found <EOF>.

      GraphQL request:1:2
      1 | {
        |  ^
    `);

    expectSyntaxError(`
      { ...MissingOn }
      fragment MissingOn Type
    `).to.deep.include({
      message: 'Syntax Error: Expected "on", found Name "Type".',
      locations: [{ line: 3, column: 26 }],
    });

    expectSyntaxError('{ field: {} }').to.deep.include({
      message: 'Syntax Error: Expected Name, found "{".',
      locations: [{ line: 1, column: 10 }],
    });

    expectSyntaxError('notAnOperation Foo { field }').to.deep.include({
      message: 'Syntax Error: Unexpected Name "notAnOperation".',
      locations: [{ line: 1, column: 1 }],
    });

    expectSyntaxError('...').to.deep.include({
      message: 'Syntax Error: Unexpected "...".',
      locations: [{ line: 1, column: 1 }],
    });

    expectSyntaxError('{ ""').to.deep.include({
      message: 'Syntax Error: Expected Name, found String "".',
      locations: [{ line: 1, column: 3 }],
    });
  });

  it('parse provides useful error when using source', () => {
    let caughtError;
    try {
      parse(new Source('query', 'MyQuery.graphql'));
    } catch (error) {
      caughtError = error;
    }
    expect(String(caughtError)).to.equal(dedent`
      Syntax Error: Expected "{", found <EOF>.

      MyQuery.graphql:1:6
      1 | query
        |      ^
    `);
  });

  it('parses variable inline values', () => {
    expect(() =>
      parse('{ field(complex: { a: { b: [ $var ] } }) }'),
    ).to.not.throw();
  });

  it('parses constant default values', () => {
    expectSyntaxError(
      'query Foo($x: Complex = { a: { b: [ $var ] } }) { field }',
    ).to.deep.equal({
      message: 'Syntax Error: Unexpected variable "$var" in constant value.',
      locations: [{ line: 1, column: 37 }],
    });
  });

  it('parses variable definition directives', () => {
    expect(() =>
      parse('query Foo($x: Boolean = false @bar) { field }'),
    ).to.not.throw();
  });

  it('does not accept fragments named "on"', () => {
    expectSyntaxError('fragment on on on { on }').to.deep.equal({
      message: 'Syntax Error: Unexpected Name "on".',
      locations: [{ line: 1, column: 10 }],
    });
  });

  it('does not accept fragments spread of "on"', () => {
    expectSyntaxError('{ ...on }').to.deep.equal({
      message: 'Syntax Error: Expected Name, found "}".',
      locations: [{ line: 1, column: 9 }],
    });
  });

  it('does not allow "true", "false", or "null" as enum value', () => {
    expectSyntaxError('enum Test { VALID, true }').to.deep.equal({
      message:
        'Syntax Error: Name "true" is reserved and cannot be used for an enum value.',
      locations: [{ line: 1, column: 20 }],
    });

    expectSyntaxError('enum Test { VALID, false }').to.deep.equal({
      message:
        'Syntax Error: Name "false" is reserved and cannot be used for an enum value.',
      locations: [{ line: 1, column: 20 }],
    });

    expectSyntaxError('enum Test { VALID, null }').to.deep.equal({
      message:
        'Syntax Error: Name "null" is reserved and cannot be used for an enum value.',
      locations: [{ line: 1, column: 20 }],
    });
  });

  it('parses multi-byte characters', () => {
    // Note: \u0A0A could be naively interpreted as two line-feed chars.
    const ast = parse(`
      # This comment has a \u0A0A multi-byte character.
      { field(arg: "Has a \u0A0A multi-byte character.") }
    `);

    expect(ast).to.have.nested.property(
      'definitions[0].selectionSet.selections[0].arguments[0].value.value',
      'Has a \u0A0A multi-byte character.',
    );
  });

  it('parses kitchen sink', () => {
    expect(() =>
      parse(kitchenSinkQuery, {
        experimentalClientControlledNullability: true,
      }),
    ).to.not.throw();
  });

  it('allows non-keywords anywhere a Name is allowed', () => {
    const nonKeywords = [
      'on',
      'fragment',
      'query',
      'mutation',
      'subscription',
      'true',
      'false',
    ];
    for (const keyword of nonKeywords) {
      // You can't define or reference a fragment named `on`.
      const fragmentName = keyword !== 'on' ? keyword : 'a';
      const document = `
        query ${keyword} {
          ... ${fragmentName}
          ... on ${keyword} { field }
        }
        fragment ${fragmentName} on Type {
          ${keyword}(${keyword}: $${keyword})
            @${keyword}(${keyword}: ${keyword})
        }
      `;

      expect(() => parse(document)).to.not.throw();
    }
  });

  it('parses anonymous mutation operations', () => {
    expect(() =>
      parse(`
      mutation {
        mutationField
      }
    `),
    ).to.not.throw();
  });

  it('parses anonymous subscription operations', () => {
    expect(() =>
      parse(`
      subscription {
        subscriptionField
      }
    `),
    ).to.not.throw();
  });

  it('parses named mutation operations', () => {
    expect(() =>
      parse(`
      mutation Foo {
        mutationField
      }
    `),
    ).to.not.throw();
  });

  it('parses named subscription operations', () => {
    expect(() =>
      parse(`
      subscription Foo {
        subscriptionField
      }
    `),
    ).to.not.throw();
  });

  it('parses required field', () => {
    const document = '{ requiredField! }';
    const parsedDocument = parse(document, {
      experimentalClientControlledNullability: true,
    });

    expectJSON(parsedDocument).toDeepEqual({
      kind: Kind.DOCUMENT,
      loc: { start: 0, end: 18 },
      definitions: [
        {
          kind: Kind.OPERATION_DEFINITION,
          loc: { start: 0, end: 18 },
          operation: 'query',
          name: undefined,
          variableDefinitions: [],
          directives: [],
          selectionSet: {
            kind: Kind.SELECTION_SET,
            loc: { start: 0, end: 18 },
            selections: [
              {
                kind: Kind.FIELD,
                loc: { start: 2, end: 16 },
                alias: undefined,
                name: {
                  kind: Kind.NAME,
                  loc: { start: 2, end: 15 },
                  value: 'requiredField',
                },
                arguments: [],
                directives: [],
                isInRequiredChain: true,
                selectionSet: undefined,
                required: {
                  kind: Kind.REQUIRED_DESIGNATOR,
                  loc: { start: 15, end: 16 },
                  element: undefined,
                },
              },
            ],
          },
        },
      ],
    });
  });

  it('parses optional field', () => {
    const document = ' { optionalField? }';

    expect(() =>
      parse(document, { experimentalClientControlledNullability: true }),
    ).to.not.throw();
  });

  it('does not parse field with multiple designators', () => {
    const document = '{ optionalField?! }';

    expect(() =>
      parse(document, { experimentalClientControlledNullability: true }),
    ).to.throw('Syntax Error: Expected Name, found "!".');

    const inverseDocument = '{ optionalField!? }';

    expect(() =>
      parse(inverseDocument, { experimentalClientControlledNullability: true }),
    ).to.throw('Syntax Error: Expected Name, found "?".');
  });

  it('parses required with alias', () => {
    const document = '{ requiredField: field! }';

    expect(() =>
      parse(document, { experimentalClientControlledNullability: true }),
    ).to.not.throw();
  });

  it('parses optional with alias', () => {
    const document = '{ requiredField: field? }';

    expect(() =>
      parse(document, { experimentalClientControlledNullability: true }),
    ).to.not.throw();
  });

  it('does not parse aliased field with bang on left of colon', () => {
    const document = '{ requiredField!: field }';

    expect(() =>
      parse(document, { experimentalClientControlledNullability: true }),
    ).to.throw();
  });

  it('does not parse aliased field with question mark on left of colon', () => {
    const document = '{ requiredField?: field }';

    expect(() =>
      parse(document, { experimentalClientControlledNullability: true }),
    ).to.throw();
  });

  it('does not parse aliased field with bang on left and right of colon', () => {
    const document = '{ requiredField!: field! }';

    expect(() =>
      parse(document, { experimentalClientControlledNullability: true }),
    ).to.throw();
  });

  it('does not parse aliased field with question mark on left and right of colon', () => {
    const document = '{ requiredField?: field? }';

    expect(() =>
      parse(document, { experimentalClientControlledNullability: true }),
    ).to.throw();
  });

  it('parses required within fragment', () => {
    const document = 'fragment MyFragment on Query { field! }';

    expect(() =>
      parse(document, { experimentalClientControlledNullability: true }),
    ).to.not.throw();
  });

  it('parses optional within fragment', () => {
    const document = 'fragment MyFragment on Query { field? }';

    expect(() =>
      parse(document, { experimentalClientControlledNullability: true }),
    ).to.not.throw();
  });

  it('parses field with required list elements', () => {
    const document = '{ field[!] }';
    const result = parse(document, {
      experimentalClientControlledNullability: true,
    });

    expectJSON(result).toDeepEqual({
      kind: Kind.DOCUMENT,
      loc: { start: 0, end: 12 },
      definitions: [
        {
          kind: Kind.OPERATION_DEFINITION,
          loc: { start: 0, end: 12 },
          operation: 'query',
          name: undefined,
          variableDefinitions: [],
          directives: [],
          selectionSet: {
            kind: Kind.SELECTION_SET,
            loc: { start: 0, end: 12 },
            selections: [
              {
                kind: Kind.FIELD,
                loc: { start: 2, end: 10 },
                alias: undefined,
                name: {
                  kind: Kind.NAME,
                  loc: { start: 2, end: 7 },
                  value: 'field',
                },
                arguments: [],
                directives: [],
                isInRequiredChain: true,
                required: {
                  kind: Kind.LIST_NULLABILITY,
                  loc: { start: 7, end: 10 },
                  element: {
                    kind: Kind.REQUIRED_DESIGNATOR,
                    loc: { start: 8, end: 9 },
                    element: undefined,
                  },
                },
                selectionSet: undefined,
              },
            ],
          },
        },
      ],
    });
  });

  it('parses field with optional list elements', () => {
    const document = '{ field[?] }';
    const result = parse(document, {
      experimentalClientControlledNullability: true,
    });

    expectJSON(result).toDeepEqual({
      kind: Kind.DOCUMENT,
      loc: { start: 0, end: 12 },
      definitions: [
        {
          kind: Kind.OPERATION_DEFINITION,
          loc: { start: 0, end: 12 },
          operation: 'query',
          name: undefined,
          variableDefinitions: [],
          directives: [],
          selectionSet: {
            kind: Kind.SELECTION_SET,
            loc: { start: 0, end: 12 },
            selections: [
              {
                kind: Kind.FIELD,
                loc: { start: 2, end: 10 },
                alias: undefined,
                name: {
                  kind: Kind.NAME,
                  loc: { start: 2, end: 7 },
                  value: 'field',
                },
                arguments: [],
                directives: [],
                isInRequiredChain: false,
                required: {
                  kind: Kind.LIST_NULLABILITY,
                  loc: { start: 7, end: 10 },
                  element: {
                    kind: Kind.OPTIONAL_DESIGNATOR,
                    loc: { start: 8, end: 9 },
                    element: undefined,
                  },
                },
                selectionSet: undefined,
              },
            ],
          },
        },
      ],
    });
  });

  it('parses field with required list', () => {
    const document = '{ field[]! }';
    const result = parse(document, {
      experimentalClientControlledNullability: true,
    });

    expectJSON(result).toDeepEqual({
      kind: Kind.DOCUMENT,
      loc: { start: 0, end: 12 },
      definitions: [
        {
          kind: Kind.OPERATION_DEFINITION,
          loc: { start: 0, end: 12 },
          operation: 'query',
          name: undefined,
          variableDefinitions: [],
          directives: [],
          selectionSet: {
            kind: Kind.SELECTION_SET,
            loc: { start: 0, end: 12 },
            selections: [
              {
                kind: Kind.FIELD,
                loc: { start: 2, end: 10 },
                alias: undefined,
                name: {
                  kind: Kind.NAME,
                  loc: { start: 2, end: 7 },
                  value: 'field',
                },
                arguments: [],
                directives: [],
                isInRequiredChain: true,
                selectionSet: undefined,
                required: {
                  kind: Kind.REQUIRED_DESIGNATOR,
                  loc: { start: 9, end: 10 },
                  element: {
                    kind: Kind.LIST_NULLABILITY,
                    element: undefined,
                    loc: { start: 7, end: 9 },
                  },
                },
              },
            ],
          },
        },
      ],
    });
  });

  it('parses field with optional list', () => {
    const document = '{ field[]? }';
    const result = parse(document, {
      experimentalClientControlledNullability: true,
    });

    expectJSON(result).toDeepEqual({
      kind: Kind.DOCUMENT,
      loc: { start: 0, end: 12 },
      definitions: [
        {
          kind: Kind.OPERATION_DEFINITION,
          loc: { start: 0, end: 12 },
          operation: 'query',
          name: undefined,
          variableDefinitions: [],
          directives: [],
          selectionSet: {
            kind: Kind.SELECTION_SET,
            loc: { start: 0, end: 12 },
            selections: [
              {
                kind: Kind.FIELD,
                loc: { start: 2, end: 10 },
                alias: undefined,
                name: {
                  kind: Kind.NAME,
                  loc: { start: 2, end: 7 },
                  value: 'field',
                },
                arguments: [],
                directives: [],
                isInRequiredChain: false,
                required: {
                  kind: Kind.OPTIONAL_DESIGNATOR,
                  loc: { start: 9, end: 10 },
                  element: {
                    kind: Kind.LIST_NULLABILITY,
                    loc: { start: 7, end: 9 },
                    element: undefined,
                  },
                },
                selectionSet: undefined,
              },
            ],
          },
        },
      ],
    });
  });

  it('parses multidimensional field with mixed list elements', () => {
    const document = '{ field[[[?]!]]! }';
    const result = parse(document, {
      experimentalClientControlledNullability: true,
    });

    expectJSON(result).toDeepEqual({
      kind: Kind.DOCUMENT,
      loc: { start: 0, end: 18 },
      definitions: [
        {
          kind: Kind.OPERATION_DEFINITION,
          loc: { start: 0, end: 18 },
          operation: 'query',
          name: undefined,
          variableDefinitions: [],
          directives: [],
          selectionSet: {
            kind: Kind.SELECTION_SET,
            loc: { start: 0, end: 18 },
            selections: [
              {
                kind: Kind.FIELD,
                loc: { start: 2, end: 16 },
                alias: undefined,
                name: {
                  kind: Kind.NAME,
                  loc: { start: 2, end: 7 },
                  value: 'field',
                },
                arguments: [],
                directives: [],
                isInRequiredChain: true,
                required: {
                  kind: Kind.REQUIRED_DESIGNATOR,
                  loc: { start: 15, end: 16 },
                  element: {
                    kind: Kind.LIST_NULLABILITY,
                    loc: { start: 7, end: 15 },
                    element: {
                      kind: Kind.LIST_NULLABILITY,
                      loc: { start: 8, end: 14 },
                      element: {
                        kind: Kind.REQUIRED_DESIGNATOR,
                        loc: { start: 12, end: 13 },
                        element: {
                          kind: Kind.LIST_NULLABILITY,
                          loc: { start: 9, end: 12 },
                          element: {
                            kind: Kind.OPTIONAL_DESIGNATOR,
                            loc: { start: 10, end: 11 },
                            element: undefined,
                          },
                        },
                      },
                    },
                  },
                },
                selectionSet: undefined,
              },
            ],
          },
        },
      ],
    });
  });

  it('does not parse field with unbalanced brackets', () => {
    const leftHeavyDocument = '{ field[[] }';
    expect(() =>
      parse(leftHeavyDocument, {
        experimentalClientControlledNullability: true,
      }),
    ).to.throw('Syntax Error: Expected "]", found "}".');

    const rightHeavyDocument = '{ field[]] }';
    expect(() =>
      parse(rightHeavyDocument, {
        experimentalClientControlledNullability: true,
      }),
    ).to.throw('Syntax Error: Expected Name, found "]".');

    const leftMissingDocument = '{ field] }';
    expect(() =>
      parse(leftMissingDocument, {
        experimentalClientControlledNullability: true,
      }),
    ).to.throw('Syntax Error: Expected Name, found "]".');

    const rightMissingDocument = '{ field[ }';
    expect(() =>
      parse(rightMissingDocument, {
        experimentalClientControlledNullability: true,
      }),
    ).to.throw('Syntax Error: Expected "]", found "}".');
  });

  it('does not parse field with assorted invalid nullability designators', () => {
    const doubleDocument = '{ field[][] }';
    expect(() =>
      parse(doubleDocument, { experimentalClientControlledNullability: true }),
    ).to.throw('Syntax Error: Expected Name, found "[".');

    const doubleBangDocument = '{ field[!!] }';
    expect(() =>
      parse(doubleBangDocument, {
        experimentalClientControlledNullability: true,
      }),
    ).to.throw('Syntax Error: Expected "]", found "!".');

    const multipleNullabilityDocument = '{ field[]?! }';
    expect(() =>
      parse(multipleNullabilityDocument, {
        experimentalClientControlledNullability: true,
      }),
    ).to.throw('Syntax Error: Expected Name, found "!".');
  });

  it('everything between ! and ? marked isRequiredChain true', () => {
    const document = dedent`
    {
      node(id: 4) {
        id
        business {
          name
          address!
        }
      }
    }
  `;
    const result = parse(document, {
      experimentalClientControlledNullability: true,
    });

    expectJSON(result).toDeepEqual({
      kind: Kind.DOCUMENT,
      loc: { start: 0, end: 77 },
      definitions: [
        {
          kind: Kind.OPERATION_DEFINITION,
          loc: { start: 0, end: 77 },
          operation: 'query',
          name: undefined,
          variableDefinitions: [],
          directives: [],
          selectionSet: {
            kind: Kind.SELECTION_SET,
            loc: { start: 0, end: 77 },
            selections: [
              {
                kind: Kind.FIELD,
                loc: { start: 4, end: 75 },
                alias: undefined,
                name: {
                  kind: Kind.NAME,
                  loc: { start: 4, end: 8 },
                  value: 'node',
                },
                required: undefined,
                isInRequiredChain: true,
                arguments: [
                  {
                    kind: Kind.ARGUMENT,
                    name: {
                      kind: Kind.NAME,
                      loc: { start: 9, end: 11 },
                      value: 'id',
                    },
                    value: {
                      kind: Kind.INT,
                      loc: { start: 13, end: 14 },
                      value: '4',
                    },
                    loc: { start: 9, end: 14 },
                  },
                ],
                directives: [],
                selectionSet: {
                  kind: Kind.SELECTION_SET,
                  loc: { start: 16, end: 75 },
                  selections: [
                    {
                      kind: Kind.FIELD,
                      loc: { start: 22, end: 24 },
                      alias: undefined,
                      name: {
                        kind: Kind.NAME,
                        loc: { start: 22, end: 24 },
                        value: 'id',
                      },
                      required: undefined,
                      arguments: [],
                      directives: [],
                      isInRequiredChain: false,
                      selectionSet: undefined,
                    },
                    {
                      kind: Kind.FIELD,
                      loc: { start: 29, end: 71 },
                      alias: undefined,
                      name: {
                        kind: Kind.NAME,
                        loc: { start: 29, end: 37 },
                        value: 'business',
                      },
                      required: undefined,
                      arguments: [],
                      directives: [],
                      isInRequiredChain: true,
                      selectionSet: {
                        kind: Kind.SELECTION_SET,
                        loc: { start: 38, end: 71 },
                        selections: [
                          {
                            kind: Kind.FIELD,
                            loc: { start: 46, end: 50 },
                            alias: undefined,
                            name: {
                              kind: Kind.NAME,
                              loc: { start: 46, end: 50 },
                              value: 'name',
                            },
                            required: undefined,
                            arguments: [],
                            directives: [],
                            isInRequiredChain: false,
                            selectionSet: undefined,
                          },
                          {
                            kind: Kind.FIELD,
                            loc: { start: 57, end: 65 },
                            alias: undefined,
                            name: {
                              kind: Kind.NAME,
                              loc: { start: 57, end: 64 },
                              value: 'address',
                            },
                            required: {
                              kind: Kind.REQUIRED_DESIGNATOR,
                              loc: { start: 64, end: 65 },
                              element: undefined,
                            },
                            arguments: [],
                            directives: [],
                            isInRequiredChain: true,
                            selectionSet: undefined,
                          },
                        ],
                      },
                    },
                  ],
                },
              },
            ],
          },
        },
      ],
    });
  });

  it('creates ast', () => {
    const result = parse(dedent`
      {
        node(id: 4) {
          id,
          name
        }
      }
    `);

    expectJSON(result).toDeepEqual({
      kind: Kind.DOCUMENT,
      loc: { start: 0, end: 40 },
      definitions: [
        {
          kind: Kind.OPERATION_DEFINITION,
          loc: { start: 0, end: 40 },
          operation: 'query',
          name: undefined,
          variableDefinitions: [],
          directives: [],
          selectionSet: {
            kind: Kind.SELECTION_SET,
            loc: { start: 0, end: 40 },
            selections: [
              {
                kind: Kind.FIELD,
                loc: { start: 4, end: 38 },
                alias: undefined,
                name: {
                  kind: Kind.NAME,
                  loc: { start: 4, end: 8 },
                  value: 'node',
                },
                required: undefined,
                isInRequiredChain: false,
                arguments: [
                  {
                    kind: Kind.ARGUMENT,
                    name: {
                      kind: Kind.NAME,
                      loc: { start: 9, end: 11 },
                      value: 'id',
                    },
                    value: {
                      kind: Kind.INT,
                      loc: { start: 13, end: 14 },
                      value: '4',
                    },
                    loc: { start: 9, end: 14 },
                  },
                ],
                directives: [],
                selectionSet: {
                  kind: Kind.SELECTION_SET,
                  loc: { start: 16, end: 38 },
                  selections: [
                    {
                      kind: Kind.FIELD,
                      loc: { start: 22, end: 24 },
                      alias: undefined,
                      name: {
                        kind: Kind.NAME,
                        loc: { start: 22, end: 24 },
                        value: 'id',
                      },
                      required: undefined,
                      arguments: [],
                      directives: [],
                      isInRequiredChain: false,
                      selectionSet: undefined,
                    },
                    {
                      kind: Kind.FIELD,
                      loc: { start: 30, end: 34 },
                      alias: undefined,
                      name: {
                        kind: Kind.NAME,
                        loc: { start: 30, end: 34 },
                        value: 'name',
                      },
                      required: undefined,
                      arguments: [],
                      directives: [],
                      isInRequiredChain: false,
                      selectionSet: undefined,
                    },
                  ],
                },
              },
            ],
          },
        },
      ],
    });
  });

  it('creates ast from nameless query without variables', () => {
    const result = parse(dedent`
      query {
        node {
          id
        }
      }
    `);

    expectJSON(result).toDeepEqual({
      kind: Kind.DOCUMENT,
      loc: { start: 0, end: 29 },
      definitions: [
        {
          kind: Kind.OPERATION_DEFINITION,
          loc: { start: 0, end: 29 },
          operation: 'query',
          name: undefined,
          variableDefinitions: [],
          directives: [],
          selectionSet: {
            kind: Kind.SELECTION_SET,
            loc: { start: 6, end: 29 },
            selections: [
              {
                kind: Kind.FIELD,
                loc: { start: 10, end: 27 },
                alias: undefined,
                name: {
                  kind: Kind.NAME,
                  loc: { start: 10, end: 14 },
                  value: 'node',
                },
                required: undefined,
                arguments: [],
                directives: [],
                isInRequiredChain: false,
                selectionSet: {
                  kind: Kind.SELECTION_SET,
                  loc: { start: 15, end: 27 },
                  selections: [
                    {
                      kind: Kind.FIELD,
                      loc: { start: 21, end: 23 },
                      alias: undefined,
                      name: {
                        kind: Kind.NAME,
                        loc: { start: 21, end: 23 },
                        value: 'id',
                      },
                      required: undefined,
                      arguments: [],
                      directives: [],
                      isInRequiredChain: false,
                      selectionSet: undefined,
                    },
                  ],
                },
              },
            ],
          },
        },
      ],
    });
  });

  it('allows parsing without source location information', () => {
    const result = parse('{ id }', { noLocation: true });
    expect('loc' in result).to.equal(false);
  });

  it('Legacy: allows parsing fragment defined variables', () => {
    const document = 'fragment a($v: Boolean = false) on t { f(v: $v) }';

    expect(() =>
      parse(document, { allowLegacyFragmentVariables: true }),
    ).to.not.throw();
    expect(() => parse(document)).to.throw('Syntax Error');
  });

  it('contains location that can be Object.toStringified, JSON.stringified, or jsutils.inspected', () => {
    const { loc } = parse('{ id }');

    expect(Object.prototype.toString.call(loc)).to.equal('[object Location]');
    expect(JSON.stringify(loc)).to.equal('{"start":0,"end":6}');
    expect(inspect(loc)).to.equal('{ start: 0, end: 6 }');
  });

  it('contains references to source', () => {
    const source = new Source('{ id }');
    const result = parse(source);

    expect(result).to.have.nested.property('loc.source', source);
  });

  it('contains references to start and end tokens', () => {
    const result = parse('{ id }');

    expect(result).to.have.nested.property(
      'loc.startToken.kind',
      TokenKind.SOF,
    );
    expect(result).to.have.nested.property('loc.endToken.kind', TokenKind.EOF);
  });

  describe('parseValue', () => {
    it('parses null value', () => {
      const result = parseValue('null');
      expectJSON(result).toDeepEqual({
        kind: Kind.NULL,
        loc: { start: 0, end: 4 },
      });
    });

    it('parses list values', () => {
      const result = parseValue('[123 "abc"]');
      expectJSON(result).toDeepEqual({
        kind: Kind.LIST,
        loc: { start: 0, end: 11 },
        values: [
          {
            kind: Kind.INT,
            loc: { start: 1, end: 4 },
            value: '123',
          },
          {
            kind: Kind.STRING,
            loc: { start: 5, end: 10 },
            value: 'abc',
            block: false,
          },
        ],
      });
    });

    it('parses block strings', () => {
      const result = parseValue('["""long""" "short"]');
      expectJSON(result).toDeepEqual({
        kind: Kind.LIST,
        loc: { start: 0, end: 20 },
        values: [
          {
            kind: Kind.STRING,
            loc: { start: 1, end: 11 },
            value: 'long',
            block: true,
          },
          {
            kind: Kind.STRING,
            loc: { start: 12, end: 19 },
            value: 'short',
            block: false,
          },
        ],
      });
    });

    it('allows variables', () => {
      const result = parseValue('{ field: $var }');
      expectJSON(result).toDeepEqual({
        kind: Kind.OBJECT,
        loc: { start: 0, end: 15 },
        fields: [
          {
            kind: Kind.OBJECT_FIELD,
            loc: { start: 2, end: 13 },
            name: {
              kind: Kind.NAME,
              loc: { start: 2, end: 7 },
              value: 'field',
            },
            value: {
              kind: Kind.VARIABLE,
              loc: { start: 9, end: 13 },
              name: {
                kind: Kind.NAME,
                loc: { start: 10, end: 13 },
                value: 'var',
              },
            },
          },
        ],
      });
    });

    it('correct message for incomplete variable', () => {
      expect(() => parseValue('$'))
        .to.throw()
        .to.deep.include({
          message: 'Syntax Error: Expected Name, found <EOF>.',
          locations: [{ line: 1, column: 2 }],
        });
    });

    it('correct message for unexpected token', () => {
      expect(() => parseValue(':'))
        .to.throw()
        .to.deep.include({
          message: 'Syntax Error: Unexpected ":".',
          locations: [{ line: 1, column: 1 }],
        });
    });
  });

  describe('parseConstValue', () => {
    it('parses values', () => {
      const result = parseConstValue('[123 "abc"]');
      expectJSON(result).toDeepEqual({
        kind: Kind.LIST,
        loc: { start: 0, end: 11 },
        values: [
          {
            kind: Kind.INT,
            loc: { start: 1, end: 4 },
            value: '123',
          },
          {
            kind: Kind.STRING,
            loc: { start: 5, end: 10 },
            value: 'abc',
            block: false,
          },
        ],
      });
    });

    it('does not allow variables', () => {
      expect(() => parseConstValue('{ field: $var }'))
        .to.throw()
        .to.deep.include({
          message:
            'Syntax Error: Unexpected variable "$var" in constant value.',
          locations: [{ line: 1, column: 10 }],
        });
    });

    it('correct message for unexpected token', () => {
      expect(() => parseConstValue('$'))
        .to.throw()
        .to.deep.include({
          message: 'Syntax Error: Unexpected "$".',
          locations: [{ line: 1, column: 1 }],
        });
    });
  });

  describe('parseType', () => {
    it('parses well known types', () => {
      const result = parseType('String');
      expectJSON(result).toDeepEqual({
        kind: Kind.NAMED_TYPE,
        loc: { start: 0, end: 6 },
        name: {
          kind: Kind.NAME,
          loc: { start: 0, end: 6 },
          value: 'String',
        },
      });
    });

    it('parses custom types', () => {
      const result = parseType('MyType');
      expectJSON(result).toDeepEqual({
        kind: Kind.NAMED_TYPE,
        loc: { start: 0, end: 6 },
        name: {
          kind: Kind.NAME,
          loc: { start: 0, end: 6 },
          value: 'MyType',
        },
      });
    });

    it('parses list types', () => {
      const result = parseType('[MyType]');
      expectJSON(result).toDeepEqual({
        kind: Kind.LIST_TYPE,
        loc: { start: 0, end: 8 },
        type: {
          kind: Kind.NAMED_TYPE,
          loc: { start: 1, end: 7 },
          name: {
            kind: Kind.NAME,
            loc: { start: 1, end: 7 },
            value: 'MyType',
          },
        },
      });
    });

    it('parses non-null types', () => {
      const result = parseType('MyType!');
      expectJSON(result).toDeepEqual({
        kind: Kind.NON_NULL_TYPE,
        loc: { start: 0, end: 7 },
        type: {
          kind: Kind.NAMED_TYPE,
          loc: { start: 0, end: 6 },
          name: {
            kind: Kind.NAME,
            loc: { start: 0, end: 6 },
            value: 'MyType',
          },
        },
      });
    });

    it('parses nested types', () => {
      const result = parseType('[MyType!]');
      expectJSON(result).toDeepEqual({
        kind: Kind.LIST_TYPE,
        loc: { start: 0, end: 9 },
        type: {
          kind: Kind.NON_NULL_TYPE,
          loc: { start: 1, end: 8 },
          type: {
            kind: Kind.NAMED_TYPE,
            loc: { start: 1, end: 7 },
            name: {
              kind: Kind.NAME,
              loc: { start: 1, end: 7 },
              value: 'MyType',
            },
          },
        },
      });
    });
  });
});
