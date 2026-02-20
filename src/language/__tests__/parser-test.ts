import { expect } from 'chai';
import { describe, it } from 'mocha';

import { dedent } from '../../__testUtils__/dedent.js';
import {
  expectJSON,
  expectToThrowJSON,
} from '../../__testUtils__/expectJSON.js';
import { kitchenSinkQuery } from '../../__testUtils__/kitchenSinkQuery.js';

import { inspect } from '../../jsutils/inspect.js';

import { Kind } from '../kinds.js';
import {
  parse,
  parseConstValue,
  parseSchemaCoordinate,
  parseType,
  parseValue,
} from '../parser.js';
import { Source } from '../source.js';
import { TokenKind } from '../tokenKind.js';

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

  it('limits by a maximum number of tokens', () => {
    expect(() => parse('{ foo }', { maxTokens: 3 })).to.not.throw();
    expect(() => parse('{ foo }', { maxTokens: 2 })).to.throw(
      'Syntax Error: Document contains more than 2 tokens. Parsing aborted.',
    );

    expect(() => parse('{ foo(bar: "baz") }', { maxTokens: 8 })).to.not.throw();

    expect(() => parse('{ foo(bar: "baz") }', { maxTokens: 7 })).to.throw(
      'Syntax Error: Document contains more than 7 tokens. Parsing aborted.',
    );
  });

  it('exposes the tokenCount', () => {
    expect(parse('{ foo }').tokenCount).to.equal(3);
    expect(parse('{ foo(bar: "baz") }').tokenCount).to.equal(8);
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
    expect(() => parse(kitchenSinkQuery)).to.not.throw();
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
          description: undefined,
          loc: { start: 0, end: 40 },
          operation: 'query',
          name: undefined,
          variableDefinitions: undefined,
          directives: undefined,
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
                directives: undefined,
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
                      arguments: undefined,
                      directives: undefined,
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
                      arguments: undefined,
                      directives: undefined,
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
          description: undefined,
          loc: { start: 0, end: 29 },
          operation: 'query',
          name: undefined,
          variableDefinitions: undefined,
          directives: undefined,
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
                arguments: undefined,
                directives: undefined,
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
                      arguments: undefined,
                      directives: undefined,
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

  it('creates ast from nameless query with description', () => {
    const result = parse(dedent`
      "Description"
      query {
        node {
          id
        }
      }
    `);

    expectJSON(result).toDeepEqual({
      kind: Kind.DOCUMENT,
      loc: { start: 0, end: 43 },
      definitions: [
        {
          kind: Kind.OPERATION_DEFINITION,
          loc: { start: 0, end: 43 },
          description: {
            kind: Kind.STRING,
            loc: { start: 0, end: 13 },
            value: 'Description',
            block: false,
          },
          operation: 'query',
          name: undefined,
          variableDefinitions: undefined,
          directives: undefined,
          selectionSet: {
            kind: Kind.SELECTION_SET,
            loc: { start: 20, end: 43 },
            selections: [
              {
                kind: Kind.FIELD,
                loc: { start: 24, end: 41 },
                alias: undefined,
                name: {
                  kind: Kind.NAME,
                  loc: { start: 24, end: 28 },
                  value: 'node',
                },
                arguments: undefined,
                directives: undefined,
                selectionSet: {
                  kind: Kind.SELECTION_SET,
                  loc: { start: 29, end: 41 },
                  selections: [
                    {
                      kind: Kind.FIELD,
                      loc: { start: 35, end: 37 },
                      alias: undefined,
                      name: {
                        kind: Kind.NAME,
                        loc: { start: 35, end: 37 },
                        value: 'id',
                      },
                      arguments: undefined,
                      directives: undefined,
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

  it('allows parsing fragment defined variables', () => {
    const document = 'fragment a($v: Boolean = false) on t { f(v: $v) }';

    expect(() =>
      parse(document, { experimentalFragmentArguments: true }),
    ).to.not.throw();
  });

  it('disallows parsing fragment defined variables without experimental flag', () => {
    const document = 'fragment a($v: Boolean = false) on t { f(v: $v) }';

    expect(() => parse(document)).to.throw();
  });

  it('allows parsing fragment spread arguments', () => {
    const document = 'fragment a on t { ...b(v: $v) }';

    expect(() =>
      parse(document, { experimentalFragmentArguments: true }),
    ).to.not.throw();
  });

  it('disallows parsing fragment spread arguments without experimental flag', () => {
    const document = 'fragment a on t { ...b(v: $v) }';

    expect(() => parse(document)).to.throw();
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

  describe('parseSchemaCoordinate', () => {
    it('parses Name', () => {
      const result = parseSchemaCoordinate('MyType');
      expectJSON(result).toDeepEqual({
        kind: Kind.TYPE_COORDINATE,
        loc: { start: 0, end: 6 },
        name: {
          kind: Kind.NAME,
          loc: { start: 0, end: 6 },
          value: 'MyType',
        },
      });
    });

    it('parses Name . Name', () => {
      const result = parseSchemaCoordinate('MyType.field');
      expectJSON(result).toDeepEqual({
        kind: Kind.MEMBER_COORDINATE,
        loc: { start: 0, end: 12 },
        name: {
          kind: Kind.NAME,
          loc: { start: 0, end: 6 },
          value: 'MyType',
        },
        memberName: {
          kind: Kind.NAME,
          loc: { start: 7, end: 12 },
          value: 'field',
        },
      });
    });

    it('rejects Name . Name . Name', () => {
      expect(() => parseSchemaCoordinate('MyType.field.deep'))
        .to.throw()
        .to.deep.include({
          message: 'Syntax Error: Expected <EOF>, found ".".',
          locations: [{ line: 1, column: 13 }],
        });
    });

    it('parses Name . Name ( Name : )', () => {
      const result = parseSchemaCoordinate('MyType.field(arg:)');
      expectJSON(result).toDeepEqual({
        kind: Kind.ARGUMENT_COORDINATE,
        loc: { start: 0, end: 18 },
        name: {
          kind: Kind.NAME,
          loc: { start: 0, end: 6 },
          value: 'MyType',
        },
        fieldName: {
          kind: Kind.NAME,
          loc: { start: 7, end: 12 },
          value: 'field',
        },
        argumentName: {
          kind: Kind.NAME,
          loc: { start: 13, end: 16 },
          value: 'arg',
        },
      });
    });

    it('rejects Name . Name ( Name : Name )', () => {
      expect(() => parseSchemaCoordinate('MyType.field(arg: value)'))
        .to.throw()
        .to.deep.include({
          message: 'Syntax Error: Invalid character: " ".',
          locations: [{ line: 1, column: 18 }],
        });
    });

    it('parses @ Name', () => {
      const result = parseSchemaCoordinate('@myDirective');
      expectJSON(result).toDeepEqual({
        kind: Kind.DIRECTIVE_COORDINATE,
        loc: { start: 0, end: 12 },
        name: {
          kind: Kind.NAME,
          loc: { start: 1, end: 12 },
          value: 'myDirective',
        },
      });
    });

    it('parses @ Name ( Name : )', () => {
      const result = parseSchemaCoordinate('@myDirective(arg:)');
      expectJSON(result).toDeepEqual({
        kind: Kind.DIRECTIVE_ARGUMENT_COORDINATE,
        loc: { start: 0, end: 18 },
        name: {
          kind: Kind.NAME,
          loc: { start: 1, end: 12 },
          value: 'myDirective',
        },
        argumentName: {
          kind: Kind.NAME,
          loc: { start: 13, end: 16 },
          value: 'arg',
        },
      });
    });

    it('parses __Type', () => {
      const result = parseSchemaCoordinate('__Type');
      expectJSON(result).toDeepEqual({
        kind: Kind.TYPE_COORDINATE,
        loc: { start: 0, end: 6 },
        name: {
          kind: Kind.NAME,
          loc: { start: 0, end: 6 },
          value: '__Type',
        },
      });
    });

    it('parses Type.__metafield', () => {
      const result = parseSchemaCoordinate('Type.__metafield');
      expectJSON(result).toDeepEqual({
        kind: Kind.MEMBER_COORDINATE,
        loc: { start: 0, end: 16 },
        name: {
          kind: Kind.NAME,
          loc: { start: 0, end: 4 },
          value: 'Type',
        },
        memberName: {
          kind: Kind.NAME,
          loc: { start: 5, end: 16 },
          value: '__metafield',
        },
      });
    });

    it('parses Type.__metafield(arg:)', () => {
      const result = parseSchemaCoordinate('Type.__metafield(arg:)');
      expectJSON(result).toDeepEqual({
        kind: Kind.ARGUMENT_COORDINATE,
        loc: { start: 0, end: 22 },
        name: {
          kind: Kind.NAME,
          loc: { start: 0, end: 4 },
          value: 'Type',
        },
        fieldName: {
          kind: Kind.NAME,
          loc: { start: 5, end: 16 },
          value: '__metafield',
        },
        argumentName: {
          kind: Kind.NAME,
          loc: { start: 17, end: 20 },
          value: 'arg',
        },
      });
    });

    it('rejects @ Name . Name', () => {
      expect(() => parseSchemaCoordinate('@myDirective.field'))
        .to.throw()
        .to.deep.include({
          message: 'Syntax Error: Expected <EOF>, found ".".',
          locations: [{ line: 1, column: 13 }],
        });
    });

    it('accepts a Source object', () => {
      expect(parseSchemaCoordinate('MyType')).to.deep.equal(
        parseSchemaCoordinate(new Source('MyType')),
      );
    });
  });

  describe('operation and variable definition descriptions', () => {
    it('parses operation with description and variable descriptions', () => {
      const result = parse(dedent`
        "Operation description"
        query myQuery(
          "Variable a description"
          $a: Int,
          """Variable b\nmultiline description"""
          $b: String
        ) {
          field(a: $a, b: $b)
        }
      `);

      // Find the operation definition
      const opDef = result.definitions.find(
        (d) => d.kind === Kind.OPERATION_DEFINITION,
      );
      if (!opDef || opDef.kind !== Kind.OPERATION_DEFINITION) {
        throw new Error('No operation definition found');
      }

      expectJSON(opDef).toDeepEqual({
        kind: Kind.OPERATION_DEFINITION,
        operation: 'query',
        description: {
          kind: Kind.STRING,
          value: 'Operation description',
          block: false,
          loc: { start: 0, end: 23 },
        },
        name: {
          kind: Kind.NAME,
          value: 'myQuery',
          loc: { start: 30, end: 37 },
        },
        variableDefinitions: [
          {
            kind: Kind.VARIABLE_DEFINITION,
            description: {
              kind: Kind.STRING,
              value: 'Variable a description',
              block: false,
              loc: { start: 41, end: 65 },
            },
            variable: {
              kind: Kind.VARIABLE,
              name: {
                kind: Kind.NAME,
                value: 'a',
                loc: { start: 69, end: 70 },
              },
              loc: { start: 68, end: 70 },
            },
            type: {
              kind: Kind.NAMED_TYPE,
              name: {
                kind: Kind.NAME,
                value: 'Int',
                loc: { start: 72, end: 75 },
              },
              loc: { start: 72, end: 75 },
            },
            defaultValue: undefined,
            directives: undefined,
            loc: { start: 41, end: 75 },
          },
          {
            kind: Kind.VARIABLE_DEFINITION,
            description: {
              kind: Kind.STRING,
              value: 'Variable b\nmultiline description',
              block: true,
              loc: { start: 79, end: 117 },
            },
            variable: {
              kind: Kind.VARIABLE,
              name: {
                kind: Kind.NAME,
                value: 'b',
                loc: { start: 121, end: 122 },
              },
              loc: { start: 120, end: 122 },
            },
            type: {
              kind: Kind.NAMED_TYPE,
              name: {
                kind: Kind.NAME,
                value: 'String',
                loc: { start: 124, end: 130 },
              },
              loc: { start: 124, end: 130 },
            },
            defaultValue: undefined,
            directives: undefined,
            loc: { start: 79, end: 130 },
          },
        ],
        directives: undefined,
        selectionSet: {
          kind: Kind.SELECTION_SET,
          selections: [
            {
              kind: Kind.FIELD,
              alias: undefined,
              name: {
                kind: Kind.NAME,
                value: 'field',
                loc: { start: 137, end: 142 },
              },
              arguments: [
                {
                  kind: Kind.ARGUMENT,
                  name: {
                    kind: Kind.NAME,
                    value: 'a',
                    loc: { start: 143, end: 144 },
                  },
                  value: {
                    kind: Kind.VARIABLE,
                    name: {
                      kind: Kind.NAME,
                      value: 'a',
                      loc: { start: 147, end: 148 },
                    },
                    loc: { start: 146, end: 148 },
                  },
                  loc: { start: 143, end: 148 },
                },
                {
                  kind: Kind.ARGUMENT,
                  name: {
                    kind: Kind.NAME,
                    value: 'b',
                    loc: { start: 150, end: 151 },
                  },
                  value: {
                    kind: Kind.VARIABLE,
                    name: {
                      kind: Kind.NAME,
                      value: 'b',
                      loc: { start: 154, end: 155 },
                    },
                    loc: { start: 153, end: 155 },
                  },
                  loc: { start: 150, end: 155 },
                },
              ],
              directives: undefined,
              selectionSet: undefined,
              loc: { start: 137, end: 156 },
            },
          ],
          loc: { start: 133, end: 158 },
        },
        loc: { start: 0, end: 158 },
      });
    });

    it('descriptions on a short-hand query produce a sensible error', () => {
      const input = `"""Invalid"""
        { __typename }`;
      expect(() => parse(input)).to.throw(
        'Syntax Error: Unexpected description, descriptions are not supported on shorthand queries.',
      );
    });

    it('parses variable definition with description, default value, and directives', () => {
      const result = parse(dedent`
        query (
          "desc"
          $foo: Int = 42 @dir
        ) {
          field(foo: $foo)
        }
      `);
      const opDef = result.definitions.find(
        (d) => d.kind === Kind.OPERATION_DEFINITION,
      );
      if (!opDef || opDef.kind !== Kind.OPERATION_DEFINITION) {
        throw new Error('No operation definition found');
      }
      const varDef = opDef.variableDefinitions?.[0];
      expectJSON(varDef).toDeepEqual({
        kind: Kind.VARIABLE_DEFINITION,
        defaultValue: {
          kind: Kind.INT,
          value: '42',
          loc: { start: 31, end: 33 },
        },
        directives: [
          {
            arguments: undefined,
            kind: Kind.DIRECTIVE,
            name: {
              kind: Kind.NAME,
              value: 'dir',
              loc: { start: 35, end: 38 },
            },
            loc: { start: 34, end: 38 },
          },
        ],
        description: {
          kind: Kind.STRING,
          value: 'desc',
          block: false,
          loc: { start: 10, end: 16 },
        },
        variable: {
          kind: Kind.VARIABLE,
          name: {
            kind: Kind.NAME,
            value: 'foo',
            loc: { start: 20, end: 23 },
          },
          loc: { start: 19, end: 23 },
        },
        type: {
          kind: Kind.NAMED_TYPE,
          name: {
            kind: Kind.NAME,
            value: 'Int',
            loc: { start: 25, end: 28 },
          },
          loc: { start: 25, end: 28 },
        },
        loc: { start: 10, end: 38 },
      });
    });

    it('parses fragment with variable description', () => {
      const result = parse('fragment Foo("desc" $foo: Int) on Bar { baz }', {
        experimentalFragmentArguments: true,
      });

      const fragDef = result.definitions.find(
        (d) => d.kind === Kind.FRAGMENT_DEFINITION,
      );
      if (!fragDef || fragDef.kind !== Kind.FRAGMENT_DEFINITION) {
        throw new Error('No fragment definition found');
      }
      const varDef = fragDef.variableDefinitions?.[0];

      expectJSON(varDef).toDeepEqual({
        kind: Kind.VARIABLE_DEFINITION,
        description: {
          kind: Kind.STRING,
          value: 'desc',
          block: false,
          loc: { start: 13, end: 19 },
        },
        variable: {
          kind: Kind.VARIABLE,
          name: {
            kind: Kind.NAME,
            value: 'foo',
            loc: { start: 21, end: 24 },
          },
          loc: { start: 20, end: 24 },
        },
        type: {
          kind: Kind.NAMED_TYPE,
          name: {
            kind: Kind.NAME,
            value: 'Int',
            loc: { start: 26, end: 29 },
          },
          loc: { start: 26, end: 29 },
        },
        defaultValue: undefined,
        directives: undefined,
        loc: { start: 13, end: 29 },
      });
    });
  });
});
