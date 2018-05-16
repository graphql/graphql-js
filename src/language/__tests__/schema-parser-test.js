/**
 * Copyright (c) 2015-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { expect } from 'chai';
import { describe, it } from 'mocha';
import { parse } from '../parser';
import toJSONDeep from './toJSONDeep';

function expectSyntaxError(text, message, location) {
  expect(() => parse(text))
    .to.throw(message)
    .with.deep.property('locations', [location]);
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
    description: undefined,
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
    description: undefined,
    directives: [],
    loc,
  };
}

function inputValueNode(name, type, defaultValue, loc) {
  return {
    kind: 'InputValueDefinition',
    name,
    description: undefined,
    type,
    defaultValue,
    directives: [],
    loc,
  };
}

describe('Schema Parser', () => {
  it('Simple type', () => {
    const doc = parse(`
type Hello {
  world: String
}`);

    expect(toJSONDeep(doc)).to.deep.equal({
      kind: 'Document',
      definitions: [
        {
          kind: 'ObjectTypeDefinition',
          name: nameNode('Hello', { start: 6, end: 11 }),
          description: undefined,
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
    });
  });

  it('parses type with description string', () => {
    const doc = parse(`
"Description"
type Hello {
  world: String
}`);

    expect(toJSONDeep(doc)).to.nested.deep.property(
      'definitions[0].description',
      {
        kind: 'StringValue',
        value: 'Description',
        block: false,
        loc: { start: 1, end: 14 },
      },
    );
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

    expect(toJSONDeep(doc)).to.nested.deep.property(
      'definitions[0].description',
      {
        kind: 'StringValue',
        value: 'Description',
        block: true,
        loc: { start: 1, end: 20 },
      },
    );
  });

  it('Simple extension', () => {
    const doc = parse(`
extend type Hello {
  world: String
}
`);

    expect(toJSONDeep(doc)).to.deep.equal({
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
    });
  });

  it('Extension without fields', () => {
    const doc = parse('extend type Hello implements Greeting');

    expect(toJSONDeep(doc)).to.deep.equal({
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
    });
  });

  it('Extension without fields followed by extension', () => {
    const doc = parse(`
      extend type Hello implements Greeting

      extend type Hello implements SecondGreeting
    `);

    expect(toJSONDeep(doc)).to.deep.equal({
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
    });
  });

  it('Extension without anything throws', () => {
    expectSyntaxError('extend type Hello', 'Unexpected <EOF>', {
      line: 1,
      column: 18,
    });
  });

  it('Extension do not include descriptions', () => {
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

  it('Schema extension', () => {
    const body = `
      extend schema {
        mutation: Mutation
      }`;
    const doc = parse(body);
    expect(toJSONDeep(doc)).to.deep.equal({
      kind: 'Document',
      definitions: [
        {
          kind: 'SchemaExtension',
          directives: [],
          operationTypes: [
            {
              kind: 'OperationTypeDefinition',
              operation: 'mutation',
              type: typeNode('Mutation', { start: 41, end: 49 }),
              loc: { start: 31, end: 49 },
            },
          ],
          loc: { start: 7, end: 57 },
        },
      ],
      loc: { start: 0, end: 57 },
    });
  });

  it('Schema extension with only directives', () => {
    const body = 'extend schema @directive';
    const doc = parse(body);
    expect(toJSONDeep(doc)).to.deep.equal({
      kind: 'Document',
      definitions: [
        {
          kind: 'SchemaExtension',
          directives: [
            {
              kind: 'Directive',
              name: nameNode('directive', { start: 15, end: 24 }),
              arguments: [],
              loc: { start: 14, end: 24 },
            },
          ],
          operationTypes: [],
          loc: { start: 0, end: 24 },
        },
      ],
      loc: { start: 0, end: 24 },
    });
  });

  it('Schema extension without anything throws', () => {
    expectSyntaxError('extend schema', 'Unexpected <EOF>', {
      line: 1,
      column: 14,
    });
  });

  it('Simple non-null type', () => {
    const doc = parse(`
type Hello {
  world: String!
}`);

    expect(toJSONDeep(doc)).to.deep.equal({
      kind: 'Document',
      definitions: [
        {
          kind: 'ObjectTypeDefinition',
          name: nameNode('Hello', { start: 6, end: 11 }),
          description: undefined,
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
    });
  });

  it('Simple type inheriting interface', () => {
    const doc = parse('type Hello implements World { field: String }');

    expect(toJSONDeep(doc)).to.deep.equal({
      kind: 'Document',
      definitions: [
        {
          kind: 'ObjectTypeDefinition',
          name: nameNode('Hello', { start: 5, end: 10 }),
          description: undefined,
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
    });
  });

  it('Simple type inheriting multiple interfaces', () => {
    const doc = parse('type Hello implements Wo & rld { field: String }');

    expect(toJSONDeep(doc)).to.deep.equal({
      kind: 'Document',
      definitions: [
        {
          kind: 'ObjectTypeDefinition',
          name: nameNode('Hello', { start: 5, end: 10 }),
          description: undefined,
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
    });
  });

  it('Simple type inheriting multiple interfaces with leading ampersand', () => {
    const doc = parse('type Hello implements & Wo & rld { field: String }');

    expect(toJSONDeep(doc)).to.deep.equal({
      kind: 'Document',
      definitions: [
        {
          kind: 'ObjectTypeDefinition',
          name: nameNode('Hello', { start: 5, end: 10 }),
          description: undefined,
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
    });
  });

  it('Single value enum', () => {
    const doc = parse('enum Hello { WORLD }');

    expect(toJSONDeep(doc)).to.deep.equal({
      kind: 'Document',
      definitions: [
        {
          kind: 'EnumTypeDefinition',
          name: nameNode('Hello', { start: 5, end: 10 }),
          description: undefined,
          directives: [],
          values: [enumValueNode('WORLD', { start: 13, end: 18 })],
          loc: { start: 0, end: 20 },
        },
      ],
      loc: { start: 0, end: 20 },
    });
  });

  it('Double value enum', () => {
    const doc = parse('enum Hello { WO, RLD }');

    expect(toJSONDeep(doc)).to.deep.equal({
      kind: 'Document',
      definitions: [
        {
          kind: 'EnumTypeDefinition',
          name: nameNode('Hello', { start: 5, end: 10 }),
          description: undefined,
          directives: [],
          values: [
            enumValueNode('WO', { start: 13, end: 15 }),
            enumValueNode('RLD', { start: 17, end: 20 }),
          ],
          loc: { start: 0, end: 22 },
        },
      ],
      loc: { start: 0, end: 22 },
    });
  });

  it('Simple interface', () => {
    const doc = parse(`
interface Hello {
  world: String
}`);

    expect(toJSONDeep(doc)).to.deep.equal({
      kind: 'Document',
      definitions: [
        {
          kind: 'InterfaceTypeDefinition',
          name: nameNode('Hello', { start: 11, end: 16 }),
          description: undefined,
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
    });
  });

  it('Simple field with arg', () => {
    const doc = parse(`
type Hello {
  world(flag: Boolean): String
}`);

    expect(toJSONDeep(doc)).to.deep.equal({
      kind: 'Document',
      definitions: [
        {
          kind: 'ObjectTypeDefinition',
          name: nameNode('Hello', { start: 6, end: 11 }),
          description: undefined,
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
    });
  });

  it('Simple field with arg with default value', () => {
    const doc = parse(`
type Hello {
  world(flag: Boolean = true): String
}`);

    expect(toJSONDeep(doc)).to.deep.equal({
      kind: 'Document',
      definitions: [
        {
          kind: 'ObjectTypeDefinition',
          name: nameNode('Hello', { start: 6, end: 11 }),
          description: undefined,
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
    });
  });

  it('Simple field with list arg', () => {
    const doc = parse(`
type Hello {
  world(things: [String]): String
}`);

    expect(toJSONDeep(doc)).to.deep.equal({
      kind: 'Document',
      definitions: [
        {
          kind: 'ObjectTypeDefinition',
          name: nameNode('Hello', { start: 6, end: 11 }),
          description: undefined,
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
    });
  });

  it('Simple field with two args', () => {
    const doc = parse(`
type Hello {
  world(argOne: Boolean, argTwo: Int): String
}`);

    expect(toJSONDeep(doc)).to.deep.equal({
      kind: 'Document',
      definitions: [
        {
          kind: 'ObjectTypeDefinition',
          name: nameNode('Hello', { start: 6, end: 11 }),
          description: undefined,
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
    });
  });

  it('Simple union', () => {
    const doc = parse('union Hello = World');

    expect(toJSONDeep(doc)).to.deep.equal({
      kind: 'Document',
      definitions: [
        {
          kind: 'UnionTypeDefinition',
          name: nameNode('Hello', { start: 6, end: 11 }),
          description: undefined,
          directives: [],
          types: [typeNode('World', { start: 14, end: 19 })],
          loc: { start: 0, end: 19 },
        },
      ],
      loc: { start: 0, end: 19 },
    });
  });

  it('Union with two types', () => {
    const doc = parse('union Hello = Wo | Rld');

    expect(toJSONDeep(doc)).to.deep.equal({
      kind: 'Document',
      definitions: [
        {
          kind: 'UnionTypeDefinition',
          name: nameNode('Hello', { start: 6, end: 11 }),
          description: undefined,
          directives: [],
          types: [
            typeNode('Wo', { start: 14, end: 16 }),
            typeNode('Rld', { start: 19, end: 22 }),
          ],
          loc: { start: 0, end: 22 },
        },
      ],
      loc: { start: 0, end: 22 },
    });
  });

  it('Union with two types and leading pipe', () => {
    const doc = parse('union Hello = | Wo | Rld');

    expect(toJSONDeep(doc)).to.deep.equal({
      kind: 'Document',
      definitions: [
        {
          kind: 'UnionTypeDefinition',
          name: nameNode('Hello', { start: 6, end: 11 }),
          description: undefined,
          directives: [],
          types: [
            typeNode('Wo', { start: 16, end: 18 }),
            typeNode('Rld', { start: 21, end: 24 }),
          ],
          loc: { start: 0, end: 24 },
        },
      ],
      loc: { start: 0, end: 24 },
    });
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
    const doc = parse('scalar Hello');

    expect(toJSONDeep(doc)).to.deep.equal({
      kind: 'Document',
      definitions: [
        {
          kind: 'ScalarTypeDefinition',
          name: nameNode('Hello', { start: 7, end: 12 }),
          description: undefined,
          directives: [],
          loc: { start: 0, end: 12 },
        },
      ],
      loc: { start: 0, end: 12 },
    });
  });

  it('Simple input object', () => {
    const doc = parse(`
input Hello {
  world: String
}`);

    expect(toJSONDeep(doc)).to.deep.equal({
      kind: 'Document',
      definitions: [
        {
          kind: 'InputObjectTypeDefinition',
          name: nameNode('Hello', { start: 7, end: 12 }),
          description: undefined,
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
    });
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

  it('Allow simple input object with nullable circular reference', () => {
    expect(() =>
      parse(`
        input Hello {
          world: String
          self: Hello
        }`),
    ).to.not.throw();
  });

  it('Allow input object with circular reference broken up by a list', () => {
    expect(() =>
      parse(`
        input Hello {
          world: String
          self: [Hello!]!
        }`),
    ).to.not.throw();
  });

  it('Reject simple input object with non-nullable circular reference', () => {
    expectSyntaxError(
      `
      input Hello {
        self: Hello!
        string: String
      }`,
      'input: Hello contains non-nullable circular reference through field: self',
      { line: 3, column: 8 },
    );
  });

  it('Reject input object with non-nullable circular reference spread across multiple inputs', () => {
    expectSyntaxError(
      `
      input Hello {
        world: World!
        string: String
      }
      input World {
        hello: Hello!
        string: String
      }`,
      'input: Hello contains non-nullable circular reference through field: world',
      { line: 3, column: 8 },
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
    expect(doc).to.have.deep.nested.property('definitions[0].fields', []);
  });

  it('Option: allowLegacySDLImplementsInterfaces', () => {
    const body = 'type Hello implements Wo rld { field: String }';
    expect(() => parse(body)).to.throw('Syntax Error: Unexpected Name "rld"');
    const doc = parse(body, { allowLegacySDLImplementsInterfaces: true });
    expect(toJSONDeep(doc)).to.have.deep.nested.property(
      'definitions[0].interfaces',
      [
        typeNode('Wo', { start: 22, end: 24 }),
        typeNode('rld', { start: 25, end: 28 }),
      ],
    );
  });
});
