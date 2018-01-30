/**
 * Copyright (c) 2015-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { expect } from 'chai';
import { describe, it } from 'mocha';
import { parse } from '../parser';

function printJson(obj) {
  return JSON.stringify(obj, null, 2);
}

function expectSyntaxError(text, message, location) {
  try {
    parse(text);
    expect.fail('Expected to throw syntax error');
  } catch (error) {
    expect(error.message).to.contain(message);
    expect(error.locations).to.deep.equal([location]);
  }
}

function typeNode(name, loc) {
  return {
    kind: 'NamedType',
    name: nameNode(name, loc),
    loc,
  };
}

function nameNode(name, loc) {
  return {
    kind: 'Name',
    value: name,
    loc,
  };
}

function fieldNode(name, type, loc) {
  return fieldNodeWithArgs(name, type, [], loc);
}

function fieldNodeWithArgs(name, type, args, loc) {
  return {
    kind: 'FieldDefinition',
    name,
    arguments: args,
    type,
    directives: [],
    loc,
  };
}

function enumValueNode(name, loc) {
  return {
    kind: 'EnumValueDefinition',
    name: nameNode(name, loc),
    directives: [],
    loc,
  };
}

function inputValueNode(name, type, defaultValue, loc) {
  return {
    kind: 'InputValueDefinition',
    name,
    type,
    defaultValue,
    directives: [],
    loc,
  };
}

describe('Schema Parser', () => {
  it('Simple type', () => {
    const body = `
type Hello {
  world: String
}`;
    const doc = parse(body);
    const expected = {
      kind: 'Document',
      definitions: [
        {
          kind: 'ObjectTypeDefinition',
          name: nameNode('Hello', { start: 6, end: 11 }),
          interfaces: [],
          directives: [],
          fields: [
            fieldNode(
              nameNode('world', { start: 16, end: 21 }),
              typeNode('String', { start: 23, end: 29 }),
              { start: 16, end: 29 },
            ),
          ],
          loc: { start: 1, end: 31 },
        },
      ],
      loc: { start: 0, end: 31 },
    };
    expect(printJson(doc)).to.equal(printJson(expected));
  });

  it('parses type with description string', () => {
    const doc = parse(`
"Description"
type Hello {
  world: String
}`);
    expect(doc).to.containSubset({
      kind: 'Document',
      definitions: [
        {
          kind: 'ObjectTypeDefinition',
          name: nameNode('Hello', { start: 20, end: 25 }),
          description: {
            kind: 'StringValue',
            value: 'Description',
            loc: { start: 1, end: 14 },
          },
        },
      ],
      loc: { start: 0, end: 45 },
    });
  });

  it('parses type with description multi-line string', () => {
    const doc = parse(`
"""
Description
"""
# Even with comments between them
type Hello {
  world: String
}`);
    expect(doc).to.containSubset({
      kind: 'Document',
      definitions: [
        {
          kind: 'ObjectTypeDefinition',
          name: nameNode('Hello', { start: 60, end: 65 }),
          description: {
            kind: 'StringValue',
            value: 'Description',
            loc: { start: 1, end: 20 },
          },
        },
      ],
      loc: { start: 0, end: 85 },
    });
  });

  it('Simple extension', () => {
    const body = `
extend type Hello {
  world: String
}
`;
    const doc = parse(body);
    const expected = {
      kind: 'Document',
      definitions: [
        {
          kind: 'ObjectTypeExtension',
          name: nameNode('Hello', { start: 13, end: 18 }),
          interfaces: [],
          directives: [],
          fields: [
            fieldNode(
              nameNode('world', { start: 23, end: 28 }),
              typeNode('String', { start: 30, end: 36 }),
              { start: 23, end: 36 },
            ),
          ],
          loc: { start: 1, end: 38 },
        },
      ],
      loc: { start: 0, end: 39 },
    };
    expect(printJson(doc)).to.equal(printJson(expected));
  });

  it('Object extension without fields', () => {
    const body = 'extend type Hello implements Greeting';
    const doc = parse(body);
    const expected = {
      kind: 'Document',
      definitions: [
        {
          kind: 'ObjectTypeExtension',
          name: nameNode('Hello', { start: 12, end: 17 }),
          interfaces: [typeNode('Greeting', { start: 29, end: 37 })],
          directives: [],
          fields: [],
          loc: { start: 0, end: 37 },
        },
      ],
      loc: { start: 0, end: 37 },
    };
    expect(printJson(doc)).to.equal(printJson(expected));
  });

  it('Interface extension without fields', () => {
    const body = 'extend interface Hello implements Greeting';
    const doc = parse(body);
    const expected = {
      kind: 'Document',
      definitions: [
        {
          kind: 'InterfaceTypeExtension',
          name: nameNode('Hello', { start: 17, end: 22 }),
          interfaces: [typeNode('Greeting', { start: 34, end: 42 })],
          directives: [],
          fields: [],
          loc: { start: 0, end: 42 },
        },
      ],
      loc: { start: 0, end: 42 },
    };
    expect(printJson(doc)).to.equal(printJson(expected));
  });

  it('Object extension without fields followed by extension', () => {
    const body = `
      extend type Hello implements Greeting

      extend type Hello implements SecondGreeting
    `;
    const doc = parse(body);
    const expected = {
      kind: 'Document',
      definitions: [
        {
          kind: 'ObjectTypeExtension',
          name: nameNode('Hello', { start: 19, end: 24 }),
          interfaces: [typeNode('Greeting', { start: 36, end: 44 })],
          directives: [],
          fields: [],
          loc: { start: 7, end: 44 },
        },
        {
          kind: 'ObjectTypeExtension',
          name: nameNode('Hello', { start: 64, end: 69 }),
          interfaces: [typeNode('SecondGreeting', { start: 81, end: 95 })],
          directives: [],
          fields: [],
          loc: { start: 52, end: 95 },
        },
      ],
      loc: { start: 0, end: 100 },
    };
    expect(printJson(doc)).to.equal(printJson(expected));
  });

  it('Interface extension without fields followed by extension', () => {
    const body = `
      extend interface Hello implements Greeting

      extend interface Hello implements SecondGreeting
    `;
    const doc = parse(body);
    const expected = {
      kind: 'Document',
      definitions: [
        {
          kind: 'InterfaceTypeExtension',
          name: nameNode('Hello', { start: 24, end: 29 }),
          interfaces: [typeNode('Greeting', { start: 41, end: 49 })],
          directives: [],
          fields: [],
          loc: { start: 7, end: 49 },
        },
        {
          kind: 'InterfaceTypeExtension',
          name: nameNode('Hello', { start: 74, end: 79 }),
          interfaces: [typeNode('SecondGreeting', { start: 91, end: 105 })],
          directives: [],
          fields: [],
          loc: { start: 57, end: 105 },
        },
      ],
      loc: { start: 0, end: 110 },
    };
    expect(printJson(doc)).to.equal(printJson(expected));
  });

  it('Object extension without anything throws', () => {
    expectSyntaxError('extend type Hello', 'Unexpected <EOF>', {
      line: 1,
      column: 18,
    });
  });

  it('Interface extension without anything throws', () => {
    expectSyntaxError('extend interface Hello', 'Unexpected <EOF>', {
      line: 1,
      column: 23,
    });
  });

  it('Object extension do not include descriptions', () => {
    expectSyntaxError(
      `
      "Description"
      extend type Hello {
        world: String
      }`,
      'Unexpected Name "extend"',
      { line: 3, column: 7 },
    );

    expectSyntaxError(
      `
      extend "Description" type Hello {
        world: String
      }`,
      'Unexpected String "Description"',
      { line: 2, column: 14 },
    );
  });

  it('Interface extension do not include descriptions', () => {
    expectSyntaxError(
      `
      "Description"
      extend interface Hello {
        world: String
      }`,
      'Unexpected Name "extend"',
      { line: 3, column: 7 },
    );

    expectSyntaxError(
      `
      extend "Description" interface Hello {
        world: String
      }`,
      'Unexpected String "Description"',
      { line: 2, column: 14 },
    );
  });

  it('Simple non-null type', () => {
    const body = `
type Hello {
  world: String!
}`;
    const doc = parse(body);
    const expected = {
      kind: 'Document',
      definitions: [
        {
          kind: 'ObjectTypeDefinition',
          name: nameNode('Hello', { start: 6, end: 11 }),
          interfaces: [],
          directives: [],
          fields: [
            fieldNode(
              nameNode('world', { start: 16, end: 21 }),
              {
                kind: 'NonNullType',
                type: typeNode('String', { start: 23, end: 29 }),
                loc: { start: 23, end: 30 },
              },
              { start: 16, end: 30 },
            ),
          ],
          loc: { start: 1, end: 32 },
        },
      ],
      loc: { start: 0, end: 32 },
    };
    expect(printJson(doc)).to.equal(printJson(expected));
  });

  it('Simple type inheriting interface', () => {
    const body = 'type Hello implements World { field: String }';
    const doc = parse(body);
    const expected = {
      kind: 'Document',
      definitions: [
        {
          kind: 'ObjectTypeDefinition',
          name: nameNode('Hello', { start: 5, end: 10 }),
          interfaces: [typeNode('World', { start: 22, end: 27 })],
          directives: [],
          fields: [
            fieldNode(
              nameNode('field', { start: 30, end: 35 }),
              typeNode('String', { start: 37, end: 43 }),
              { start: 30, end: 43 },
            ),
          ],
          loc: { start: 0, end: 45 },
        },
      ],
      loc: { start: 0, end: 45 },
    };
    expect(printJson(doc)).to.equal(printJson(expected));
  });

  it('Simple interface inheriting interface', () => {
    const body = 'interface Hello implements World { field: String }';
    const doc = parse(body);
    const expected = {
      kind: 'Document',
      definitions: [
        {
          kind: 'InterfaceTypeDefinition',
          name: nameNode('Hello', { start: 10, end: 15 }),
          interfaces: [typeNode('World', { start: 27, end: 32 })],
          directives: [],
          fields: [
            fieldNode(
              nameNode('field', { start: 35, end: 40 }),
              typeNode('String', { start: 42, end: 48 }),
              { start: 35, end: 48 },
            ),
          ],
          loc: { start: 0, end: 50 },
        },
      ],
      loc: { start: 0, end: 50 },
    };
    expect(printJson(doc)).to.equal(printJson(expected));
  });

  it('Simple type inheriting multiple interfaces', () => {
    const body = 'type Hello implements Wo & rld { field: String }';
    const doc = parse(body);
    const expected = {
      kind: 'Document',
      definitions: [
        {
          kind: 'ObjectTypeDefinition',
          name: nameNode('Hello', { start: 5, end: 10 }),
          interfaces: [
            typeNode('Wo', { start: 22, end: 24 }),
            typeNode('rld', { start: 27, end: 30 }),
          ],
          directives: [],
          fields: [
            fieldNode(
              nameNode('field', { start: 33, end: 38 }),
              typeNode('String', { start: 40, end: 46 }),
              { start: 33, end: 46 },
            ),
          ],
          loc: { start: 0, end: 48 },
        },
      ],
      loc: { start: 0, end: 48 },
    };
    expect(printJson(doc)).to.equal(printJson(expected));
  });

  it('Simple interface inheriting multiple interfaces', () => {
    const body = 'interface Hello implements Wo & rld { field: String }';
    const doc = parse(body);
    const expected = {
      kind: 'Document',
      definitions: [
        {
          kind: 'InterfaceTypeDefinition',
          name: nameNode('Hello', { start: 10, end: 15 }),
          interfaces: [
            typeNode('Wo', { start: 27, end: 29 }),
            typeNode('rld', { start: 32, end: 35 }),
          ],
          directives: [],
          fields: [
            fieldNode(
              nameNode('field', { start: 38, end: 43 }),
              typeNode('String', { start: 45, end: 51 }),
              { start: 38, end: 51 },
            ),
          ],
          loc: { start: 0, end: 53 },
        },
      ],
      loc: { start: 0, end: 53 },
    };
    expect(printJson(doc)).to.equal(printJson(expected));
  });

  it('Simple type inheriting multiple interfaces with leading ampersand', () => {
    const body = 'type Hello implements & Wo & rld { field: String }';
    const doc = parse(body);
    const expected = {
      kind: 'Document',
      definitions: [
        {
          kind: 'ObjectTypeDefinition',
          name: nameNode('Hello', { start: 5, end: 10 }),
          interfaces: [
            typeNode('Wo', { start: 24, end: 26 }),
            typeNode('rld', { start: 29, end: 32 }),
          ],
          directives: [],
          fields: [
            fieldNode(
              nameNode('field', { start: 35, end: 40 }),
              typeNode('String', { start: 42, end: 48 }),
              { start: 35, end: 48 },
            ),
          ],
          loc: { start: 0, end: 50 },
        },
      ],
      loc: { start: 0, end: 50 },
    };
    expect(printJson(doc)).to.equal(printJson(expected));
  });

  it('Simple interface inheriting multiple interfaces with leading ampersand', () => {
    const body = 'interface Hello implements & Wo & rld { field: String }';
    const doc = parse(body);
    const expected = {
      kind: 'Document',
      definitions: [
        {
          kind: 'InterfaceTypeDefinition',
          name: nameNode('Hello', { start: 10, end: 15 }),
          interfaces: [
            typeNode('Wo', { start: 29, end: 31 }),
            typeNode('rld', { start: 34, end: 37 }),
          ],
          directives: [],
          fields: [
            fieldNode(
              nameNode('field', { start: 40, end: 45 }),
              typeNode('String', { start: 47, end: 53 }),
              { start: 40, end: 53 },
            ),
          ],
          loc: { start: 0, end: 55 },
        },
      ],
      loc: { start: 0, end: 55 },
    };
    expect(printJson(doc)).to.equal(printJson(expected));
  });

  it('Single value enum', () => {
    const body = 'enum Hello { WORLD }';
    const doc = parse(body);
    const expected = {
      kind: 'Document',
      definitions: [
        {
          kind: 'EnumTypeDefinition',
          name: nameNode('Hello', { start: 5, end: 10 }),
          directives: [],
          values: [enumValueNode('WORLD', { start: 13, end: 18 })],
          loc: { start: 0, end: 20 },
        },
      ],
      loc: { start: 0, end: 20 },
    };
    expect(printJson(doc)).to.equal(printJson(expected));
  });

  it('Double value enum', () => {
    const body = 'enum Hello { WO, RLD }';
    const doc = parse(body);
    const expected = {
      kind: 'Document',
      definitions: [
        {
          kind: 'EnumTypeDefinition',
          name: nameNode('Hello', { start: 5, end: 10 }),
          directives: [],
          values: [
            enumValueNode('WO', { start: 13, end: 15 }),
            enumValueNode('RLD', { start: 17, end: 20 }),
          ],
          loc: { start: 0, end: 22 },
        },
      ],
      loc: { start: 0, end: 22 },
    };
    expect(printJson(doc)).to.equal(printJson(expected));
  });

  it('Simple interface', () => {
    const body = `
interface Hello {
  world: String
}`;
    const doc = parse(body);
    const expected = {
      kind: 'Document',
      definitions: [
        {
          kind: 'InterfaceTypeDefinition',
          name: nameNode('Hello', { start: 11, end: 16 }),
          interfaces: [],
          directives: [],
          fields: [
            fieldNode(
              nameNode('world', { start: 21, end: 26 }),
              typeNode('String', { start: 28, end: 34 }),
              { start: 21, end: 34 },
            ),
          ],
          loc: { start: 1, end: 36 },
        },
      ],
      loc: { start: 0, end: 36 },
    };
    expect(printJson(doc)).to.equal(printJson(expected));
  });

  it('Simple field with arg', () => {
    const body = `
type Hello {
  world(flag: Boolean): String
}`;
    const doc = parse(body);
    const expected = {
      kind: 'Document',
      definitions: [
        {
          kind: 'ObjectTypeDefinition',
          name: nameNode('Hello', { start: 6, end: 11 }),
          interfaces: [],
          directives: [],
          fields: [
            fieldNodeWithArgs(
              nameNode('world', { start: 16, end: 21 }),
              typeNode('String', { start: 38, end: 44 }),
              [
                inputValueNode(
                  nameNode('flag', { start: 22, end: 26 }),
                  typeNode('Boolean', { start: 28, end: 35 }),
                  undefined,
                  { start: 22, end: 35 },
                ),
              ],
              { start: 16, end: 44 },
            ),
          ],
          loc: { start: 1, end: 46 },
        },
      ],
      loc: { start: 0, end: 46 },
    };
    expect(printJson(doc)).to.equal(printJson(expected));
  });

  it('Simple field with arg with default value', () => {
    const body = `
type Hello {
  world(flag: Boolean = true): String
}`;
    const doc = parse(body);
    const expected = {
      kind: 'Document',
      definitions: [
        {
          kind: 'ObjectTypeDefinition',
          name: nameNode('Hello', { start: 6, end: 11 }),
          interfaces: [],
          directives: [],
          fields: [
            fieldNodeWithArgs(
              nameNode('world', { start: 16, end: 21 }),
              typeNode('String', { start: 45, end: 51 }),
              [
                inputValueNode(
                  nameNode('flag', { start: 22, end: 26 }),
                  typeNode('Boolean', { start: 28, end: 35 }),
                  {
                    kind: 'BooleanValue',
                    value: true,
                    loc: { start: 38, end: 42 },
                  },
                  { start: 22, end: 42 },
                ),
              ],
              { start: 16, end: 51 },
            ),
          ],
          loc: { start: 1, end: 53 },
        },
      ],
      loc: { start: 0, end: 53 },
    };
    expect(printJson(doc)).to.equal(printJson(expected));
  });

  it('Simple field with list arg', () => {
    const body = `
type Hello {
  world(things: [String]): String
}`;
    const doc = parse(body);
    const expected = {
      kind: 'Document',
      definitions: [
        {
          kind: 'ObjectTypeDefinition',
          name: nameNode('Hello', { start: 6, end: 11 }),
          interfaces: [],
          directives: [],
          fields: [
            fieldNodeWithArgs(
              nameNode('world', { start: 16, end: 21 }),
              typeNode('String', { start: 41, end: 47 }),
              [
                inputValueNode(
                  nameNode('things', { start: 22, end: 28 }),
                  {
                    kind: 'ListType',
                    type: typeNode('String', { start: 31, end: 37 }),
                    loc: { start: 30, end: 38 },
                  },
                  undefined,
                  { start: 22, end: 38 },
                ),
              ],
              { start: 16, end: 47 },
            ),
          ],
          loc: { start: 1, end: 49 },
        },
      ],
      loc: { start: 0, end: 49 },
    };
    expect(printJson(doc)).to.equal(printJson(expected));
  });

  it('Simple field with two args', () => {
    const body = `
type Hello {
  world(argOne: Boolean, argTwo: Int): String
}`;
    const doc = parse(body);
    const expected = {
      kind: 'Document',
      definitions: [
        {
          kind: 'ObjectTypeDefinition',
          name: nameNode('Hello', { start: 6, end: 11 }),
          interfaces: [],
          directives: [],
          fields: [
            fieldNodeWithArgs(
              nameNode('world', { start: 16, end: 21 }),
              typeNode('String', { start: 53, end: 59 }),
              [
                inputValueNode(
                  nameNode('argOne', { start: 22, end: 28 }),
                  typeNode('Boolean', { start: 30, end: 37 }),
                  undefined,
                  { start: 22, end: 37 },
                ),
                inputValueNode(
                  nameNode('argTwo', { start: 39, end: 45 }),
                  typeNode('Int', { start: 47, end: 50 }),
                  undefined,
                  { start: 39, end: 50 },
                ),
              ],
              { start: 16, end: 59 },
            ),
          ],
          loc: { start: 1, end: 61 },
        },
      ],
      loc: { start: 0, end: 61 },
    };
    expect(printJson(doc)).to.equal(printJson(expected));
  });

  it('Simple union', () => {
    const body = 'union Hello = World';
    const doc = parse(body);
    const expected = {
      kind: 'Document',
      definitions: [
        {
          kind: 'UnionTypeDefinition',
          name: nameNode('Hello', { start: 6, end: 11 }),
          directives: [],
          types: [typeNode('World', { start: 14, end: 19 })],
          loc: { start: 0, end: 19 },
        },
      ],
      loc: { start: 0, end: 19 },
    };
    expect(printJson(doc)).to.equal(printJson(expected));
  });

  it('Union with two types', () => {
    const body = 'union Hello = Wo | Rld';
    const doc = parse(body);
    const expected = {
      kind: 'Document',
      definitions: [
        {
          kind: 'UnionTypeDefinition',
          name: nameNode('Hello', { start: 6, end: 11 }),
          directives: [],
          types: [
            typeNode('Wo', { start: 14, end: 16 }),
            typeNode('Rld', { start: 19, end: 22 }),
          ],
          loc: { start: 0, end: 22 },
        },
      ],
      loc: { start: 0, end: 22 },
    };
    expect(printJson(doc)).to.equal(printJson(expected));
  });

  it('Union with two types and leading pipe', () => {
    const body = 'union Hello = | Wo | Rld';
    const doc = parse(body);
    const expected = {
      kind: 'Document',
      definitions: [
        {
          kind: 'UnionTypeDefinition',
          name: nameNode('Hello', { start: 6, end: 11 }),
          directives: [],
          types: [
            typeNode('Wo', { start: 16, end: 18 }),
            typeNode('Rld', { start: 21, end: 24 }),
          ],
          loc: { start: 0, end: 24 },
        },
      ],
      loc: { start: 0, end: 24 },
    };
    expect(printJson(doc)).to.equal(printJson(expected));
  });

  it('Union fails with no types', () => {
    expectSyntaxError('union Hello = |', 'Expected Name, found <EOF>', {
      line: 1,
      column: 16,
    });
  });

  it('Union fails with leading douple pipe', () => {
    expectSyntaxError('union Hello = || Wo | Rld', 'Expected Name, found |', {
      line: 1,
      column: 16,
    });
  });

  it('Union fails with double pipe', () => {
    expectSyntaxError('union Hello = Wo || Rld', 'Expected Name, found |', {
      line: 1,
      column: 19,
    });
  });

  it('Union fails with trailing pipe', () => {
    expectSyntaxError(
      'union Hello = | Wo | Rld |',
      'Expected Name, found <EOF>',
      { line: 1, column: 27 },
    );
  });

  it('Scalar', () => {
    const body = 'scalar Hello';
    const doc = parse(body);
    const expected = {
      kind: 'Document',
      definitions: [
        {
          kind: 'ScalarTypeDefinition',
          name: nameNode('Hello', { start: 7, end: 12 }),
          directives: [],
          loc: { start: 0, end: 12 },
        },
      ],
      loc: { start: 0, end: 12 },
    };
    expect(printJson(doc)).to.equal(printJson(expected));
  });

  it('Simple input object', () => {
    const body = `
input Hello {
  world: String
}`;
    const doc = parse(body);
    const expected = {
      kind: 'Document',
      definitions: [
        {
          kind: 'InputObjectTypeDefinition',
          name: nameNode('Hello', { start: 7, end: 12 }),
          directives: [],
          fields: [
            inputValueNode(
              nameNode('world', { start: 17, end: 22 }),
              typeNode('String', { start: 24, end: 30 }),
              undefined,
              { start: 17, end: 30 },
            ),
          ],
          loc: { start: 1, end: 32 },
        },
      ],
      loc: { start: 0, end: 32 },
    };
    expect(printJson(doc)).to.equal(printJson(expected));
  });

  it('Simple input object with args should fail', () => {
    expectSyntaxError(
      `
      input Hello {
        world(foo: Int): String
      }`,
      'Expected :, found (',
      { line: 3, column: 14 },
    );
  });

  it('Directive with incorrect locations', () => {
    expectSyntaxError(
      `
      directive @foo on FIELD | INCORRECT_LOCATION`,
      'Unexpected Name "INCORRECT_LOCATION"',
      { line: 2, column: 33 },
    );
  });

  it('Option: allowLegacySDLEmptyFields supports type with empty fields', () => {
    const body = 'type Hello { }';
    expect(() => parse(body)).to.throw('Syntax Error: Expected Name, found }');
    const doc = parse(body, { allowLegacySDLEmptyFields: true });
    expect(doc).to.containSubset({
      definitions: [
        {
          fields: [],
        },
      ],
    });
  });

  it('Option: allowLegacySDLImplementsInterfaces', () => {
    const body = 'type Hello implements Wo rld { field: String }';
    expect(() => parse(body)).to.throw('Syntax Error: Unexpected Name "rld"');
    const doc = parse(body, { allowLegacySDLImplementsInterfaces: true });
    expect(doc).to.containSubset({
      definitions: [
        {
          interfaces: [
            typeNode('Wo', { start: 22, end: 24 }),
            typeNode('rld', { start: 25, end: 28 }),
          ],
        },
      ],
    });
  });
});
