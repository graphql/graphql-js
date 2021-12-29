import { expect } from 'chai';
import { describe, it } from 'mocha';

import { dedent } from '../../__testUtils__/dedent';
import { expectJSON, expectToThrowJSON } from '../../__testUtils__/expectJSON';
import { kitchenSinkSDL } from '../../__testUtils__/kitchenSinkSDL';

import { parse } from '../parser';

function expectSyntaxError(text: string) {
  return expectToThrowJSON(() => parse(text));
}

function typeNode(name: unknown, loc: unknown) {
  return {
    kind: 'NamedType',
    name: nameNode(name, loc),
    loc,
  };
}

function nameNode(name: unknown, loc: unknown) {
  return {
    kind: 'Name',
    value: name,
    loc,
  };
}

function fieldNode(name: unknown, type: unknown, loc: unknown) {
  return fieldNodeWithArgs(name, type, [], loc);
}

function fieldNodeWithArgs(
  name: unknown,
  type: unknown,
  args: unknown,
  loc: unknown,
) {
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

function enumValueNode(name: unknown, loc: unknown) {
  return {
    kind: 'EnumValueDefinition',
    name: nameNode(name, loc),
    description: undefined,
    directives: [],
    loc,
  };
}

function inputValueNode(
  name: unknown,
  type: unknown,
  defaultValue: unknown,
  loc: unknown,
) {
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
    const doc = parse(dedent`
      type Hello {
        world: String
      }
    `);

    expectJSON(doc).toDeepEqual({
      kind: 'Document',
      definitions: [
        {
          kind: 'ObjectTypeDefinition',
          name: nameNode('Hello', { start: 5, end: 10 }),
          description: undefined,
          interfaces: [],
          directives: [],
          fields: [
            fieldNode(
              nameNode('world', { start: 15, end: 20 }),
              typeNode('String', { start: 22, end: 28 }),
              { start: 15, end: 28 },
            ),
          ],
          loc: { start: 0, end: 30 },
        },
      ],
      loc: { start: 0, end: 30 },
    });
  });

  it('parses type with description string', () => {
    const doc = parse(dedent`
      "Description"
      type Hello {
        world: String
      }
    `);

    expectJSON(doc).toDeepNestedProperty('definitions[0].description', {
      kind: 'StringValue',
      value: 'Description',
      block: false,
      loc: { start: 0, end: 13 },
    });
  });

  it('parses type with description multi-line string', () => {
    const doc = parse(dedent`
      """
      Description
      """
      # Even with comments between them
      type Hello {
        world: String
      }
    `);

    expectJSON(doc).toDeepNestedProperty('definitions[0].description', {
      kind: 'StringValue',
      value: 'Description',
      block: true,
      loc: { start: 0, end: 19 },
    });
  });

  it('parses schema with description string', () => {
    const doc = parse(dedent`
      "Description"
      schema {
        query: Foo
      }
    `);

    expectJSON(doc).toDeepNestedProperty('definitions[0].description', {
      kind: 'StringValue',
      value: 'Description',
      block: false,
      loc: { start: 0, end: 13 },
    });
  });

  it('Description followed by something other than type system definition throws', () => {
    expectSyntaxError('"Description" 1').to.deep.equal({
      message: 'Syntax Error: Unexpected Int "1".',
      locations: [{ line: 1, column: 15 }],
    });
  });

  it('Simple extension', () => {
    const doc = parse(dedent`
      extend type Hello {
        world: String
      }
    `);

    expectJSON(doc).toDeepEqual({
      kind: 'Document',
      definitions: [
        {
          kind: 'ObjectTypeExtension',
          name: nameNode('Hello', { start: 12, end: 17 }),
          interfaces: [],
          directives: [],
          fields: [
            fieldNode(
              nameNode('world', { start: 22, end: 27 }),
              typeNode('String', { start: 29, end: 35 }),
              { start: 22, end: 35 },
            ),
          ],
          loc: { start: 0, end: 37 },
        },
      ],
      loc: { start: 0, end: 37 },
    });
  });

  it('Object extension without fields', () => {
    const doc = parse('extend type Hello implements Greeting');

    expectJSON(doc).toDeepEqual({
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

  it('Interface extension without fields', () => {
    const doc = parse('extend interface Hello implements Greeting');
    expectJSON(doc).toDeepEqual({
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
    });
  });

  it('Object extension without fields followed by extension', () => {
    const doc = parse(`
      extend type Hello implements Greeting

      extend type Hello implements SecondGreeting
    `);

    expectJSON(doc).toDeepEqual({
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
    expectSyntaxError('extend scalar Hello').to.deep.equal({
      message: 'Syntax Error: Unexpected <EOF>.',
      locations: [{ line: 1, column: 20 }],
    });

    expectSyntaxError('extend type Hello').to.deep.equal({
      message: 'Syntax Error: Unexpected <EOF>.',
      locations: [{ line: 1, column: 18 }],
    });

    expectSyntaxError('extend interface Hello').to.deep.equal({
      message: 'Syntax Error: Unexpected <EOF>.',
      locations: [{ line: 1, column: 23 }],
    });

    expectSyntaxError('extend union Hello').to.deep.equal({
      message: 'Syntax Error: Unexpected <EOF>.',
      locations: [{ line: 1, column: 19 }],
    });

    expectSyntaxError('extend enum Hello').to.deep.equal({
      message: 'Syntax Error: Unexpected <EOF>.',
      locations: [{ line: 1, column: 18 }],
    });

    expectSyntaxError('extend input Hello').to.deep.equal({
      message: 'Syntax Error: Unexpected <EOF>.',
      locations: [{ line: 1, column: 19 }],
    });
  });

  it('Interface extension without fields followed by extension', () => {
    const doc = parse(`
      extend interface Hello implements Greeting

      extend interface Hello implements SecondGreeting
    `);
    expectJSON(doc).toDeepEqual({
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
    });
  });

  it('Object extension do not include descriptions', () => {
    expectSyntaxError(`
      "Description"
      extend type Hello {
        world: String
      }
    `).to.deep.equal({
      message:
        'Syntax Error: Unexpected description, descriptions are supported only on type definitions.',
      locations: [{ line: 2, column: 7 }],
    });

    expectSyntaxError(`
      extend "Description" type Hello {
        world: String
      }
    `).to.deep.equal({
      message: 'Syntax Error: Unexpected String "Description".',
      locations: [{ line: 2, column: 14 }],
    });
  });

  it('Interface extension do not include descriptions', () => {
    expectSyntaxError(`
      "Description"
      extend interface Hello {
        world: String
      }
    `).to.deep.equal({
      message:
        'Syntax Error: Unexpected description, descriptions are supported only on type definitions.',
      locations: [{ line: 2, column: 7 }],
    });

    expectSyntaxError(`
      extend "Description" interface Hello {
        world: String
      }
    `).to.deep.equal({
      message: 'Syntax Error: Unexpected String "Description".',
      locations: [{ line: 2, column: 14 }],
    });
  });

  it('Schema extension', () => {
    const body = `
      extend schema {
        mutation: Mutation
      }`;
    const doc = parse(body);
    expectJSON(doc).toDeepEqual({
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
    expectJSON(doc).toDeepEqual({
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
    expectSyntaxError('extend schema').to.deep.equal({
      message: 'Syntax Error: Unexpected <EOF>.',
      locations: [{ line: 1, column: 14 }],
    });
  });

  it('Schema extension with invalid operation type throws', () => {
    expectSyntaxError('extend schema { unknown: SomeType }').to.deep.equal({
      message: 'Syntax Error: Unexpected Name "unknown".',
      locations: [{ line: 1, column: 17 }],
    });
  });

  it('Simple non-null type', () => {
    const doc = parse(dedent`
      type Hello {
        world: String!
      }
    `);

    expectJSON(doc).toDeepEqual({
      kind: 'Document',
      definitions: [
        {
          kind: 'ObjectTypeDefinition',
          name: nameNode('Hello', { start: 5, end: 10 }),
          description: undefined,
          interfaces: [],
          directives: [],
          fields: [
            fieldNode(
              nameNode('world', { start: 15, end: 20 }),
              {
                kind: 'NonNullType',
                type: typeNode('String', { start: 22, end: 28 }),
                loc: { start: 22, end: 29 },
              },
              { start: 15, end: 29 },
            ),
          ],
          loc: { start: 0, end: 31 },
        },
      ],
      loc: { start: 0, end: 31 },
    });
  });

  it('Simple interface inheriting interface', () => {
    const doc = parse('interface Hello implements World { field: String }');
    expectJSON(doc).toDeepEqual({
      kind: 'Document',
      definitions: [
        {
          kind: 'InterfaceTypeDefinition',
          name: nameNode('Hello', { start: 10, end: 15 }),
          description: undefined,
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
    });
  });

  it('Simple type inheriting interface', () => {
    const doc = parse('type Hello implements World { field: String }');

    expectJSON(doc).toDeepEqual({
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

    expectJSON(doc).toDeepEqual({
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

  it('Simple interface inheriting multiple interfaces', () => {
    const doc = parse('interface Hello implements Wo & rld { field: String }');
    expectJSON(doc).toDeepEqual({
      kind: 'Document',
      definitions: [
        {
          kind: 'InterfaceTypeDefinition',
          name: nameNode('Hello', { start: 10, end: 15 }),
          description: undefined,
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
    });
  });

  it('Simple type inheriting multiple interfaces with leading ampersand', () => {
    const doc = parse('type Hello implements & Wo & rld { field: String }');

    expectJSON(doc).toDeepEqual({
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

  it('Simple interface inheriting multiple interfaces with leading ampersand', () => {
    const doc = parse(
      'interface Hello implements & Wo & rld { field: String }',
    );
    expectJSON(doc).toDeepEqual({
      kind: 'Document',
      definitions: [
        {
          kind: 'InterfaceTypeDefinition',
          name: nameNode('Hello', { start: 10, end: 15 }),
          description: undefined,
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
    });
  });

  it('Single value enum', () => {
    const doc = parse('enum Hello { WORLD }');

    expectJSON(doc).toDeepEqual({
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

    expectJSON(doc).toDeepEqual({
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
    const doc = parse(dedent`
      interface Hello {
        world: String
      }
    `);

    expectJSON(doc).toDeepEqual({
      kind: 'Document',
      definitions: [
        {
          kind: 'InterfaceTypeDefinition',
          name: nameNode('Hello', { start: 10, end: 15 }),
          description: undefined,
          interfaces: [],
          directives: [],
          fields: [
            fieldNode(
              nameNode('world', { start: 20, end: 25 }),
              typeNode('String', { start: 27, end: 33 }),
              { start: 20, end: 33 },
            ),
          ],
          loc: { start: 0, end: 35 },
        },
      ],
      loc: { start: 0, end: 35 },
    });
  });

  it('Simple field with arg', () => {
    const doc = parse(dedent`
      type Hello {
        world(flag: Boolean): String
      }
    `);

    expectJSON(doc).toDeepEqual({
      kind: 'Document',
      definitions: [
        {
          kind: 'ObjectTypeDefinition',
          name: nameNode('Hello', { start: 5, end: 10 }),
          description: undefined,
          interfaces: [],
          directives: [],
          fields: [
            fieldNodeWithArgs(
              nameNode('world', { start: 15, end: 20 }),
              typeNode('String', { start: 37, end: 43 }),
              [
                inputValueNode(
                  nameNode('flag', { start: 21, end: 25 }),
                  typeNode('Boolean', { start: 27, end: 34 }),
                  undefined,
                  { start: 21, end: 34 },
                ),
              ],
              { start: 15, end: 43 },
            ),
          ],
          loc: { start: 0, end: 45 },
        },
      ],
      loc: { start: 0, end: 45 },
    });
  });

  it('Simple field with arg with default value', () => {
    const doc = parse(dedent`
      type Hello {
        world(flag: Boolean = true): String
      }
    `);

    expectJSON(doc).toDeepEqual({
      kind: 'Document',
      definitions: [
        {
          kind: 'ObjectTypeDefinition',
          name: nameNode('Hello', { start: 5, end: 10 }),
          description: undefined,
          interfaces: [],
          directives: [],
          fields: [
            fieldNodeWithArgs(
              nameNode('world', { start: 15, end: 20 }),
              typeNode('String', { start: 44, end: 50 }),
              [
                inputValueNode(
                  nameNode('flag', { start: 21, end: 25 }),
                  typeNode('Boolean', { start: 27, end: 34 }),
                  {
                    kind: 'BooleanValue',
                    value: true,
                    loc: { start: 37, end: 41 },
                  },
                  { start: 21, end: 41 },
                ),
              ],
              { start: 15, end: 50 },
            ),
          ],
          loc: { start: 0, end: 52 },
        },
      ],
      loc: { start: 0, end: 52 },
    });
  });

  it('Simple field with list arg', () => {
    const doc = parse(dedent`
      type Hello {
        world(things: [String]): String
      }
    `);

    expectJSON(doc).toDeepEqual({
      kind: 'Document',
      definitions: [
        {
          kind: 'ObjectTypeDefinition',
          name: nameNode('Hello', { start: 5, end: 10 }),
          description: undefined,
          interfaces: [],
          directives: [],
          fields: [
            fieldNodeWithArgs(
              nameNode('world', { start: 15, end: 20 }),
              typeNode('String', { start: 40, end: 46 }),
              [
                inputValueNode(
                  nameNode('things', { start: 21, end: 27 }),
                  {
                    kind: 'ListType',
                    type: typeNode('String', { start: 30, end: 36 }),
                    loc: { start: 29, end: 37 },
                  },
                  undefined,
                  { start: 21, end: 37 },
                ),
              ],
              { start: 15, end: 46 },
            ),
          ],
          loc: { start: 0, end: 48 },
        },
      ],
      loc: { start: 0, end: 48 },
    });
  });

  it('Simple field with two args', () => {
    const doc = parse(dedent`
      type Hello {
        world(argOne: Boolean, argTwo: Int): String
      }
    `);

    expectJSON(doc).toDeepEqual({
      kind: 'Document',
      definitions: [
        {
          kind: 'ObjectTypeDefinition',
          name: nameNode('Hello', { start: 5, end: 10 }),
          description: undefined,
          interfaces: [],
          directives: [],
          fields: [
            fieldNodeWithArgs(
              nameNode('world', { start: 15, end: 20 }),
              typeNode('String', { start: 52, end: 58 }),
              [
                inputValueNode(
                  nameNode('argOne', { start: 21, end: 27 }),
                  typeNode('Boolean', { start: 29, end: 36 }),
                  undefined,
                  { start: 21, end: 36 },
                ),
                inputValueNode(
                  nameNode('argTwo', { start: 38, end: 44 }),
                  typeNode('Int', { start: 46, end: 49 }),
                  undefined,
                  { start: 38, end: 49 },
                ),
              ],
              { start: 15, end: 58 },
            ),
          ],
          loc: { start: 0, end: 60 },
        },
      ],
      loc: { start: 0, end: 60 },
    });
  });

  it('Simple union', () => {
    const doc = parse('union Hello = World');

    expectJSON(doc).toDeepEqual({
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

    expectJSON(doc).toDeepEqual({
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

    expectJSON(doc).toDeepEqual({
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
    expectSyntaxError('union Hello = |').to.deep.equal({
      message: 'Syntax Error: Expected Name, found <EOF>.',
      locations: [{ line: 1, column: 16 }],
    });
  });

  it('Union fails with leading double pipe', () => {
    expectSyntaxError('union Hello = || Wo | Rld').to.deep.equal({
      message: 'Syntax Error: Expected Name, found "|".',
      locations: [{ line: 1, column: 16 }],
    });
  });

  it('Union fails with double pipe', () => {
    expectSyntaxError('union Hello = Wo || Rld').to.deep.equal({
      message: 'Syntax Error: Expected Name, found "|".',
      locations: [{ line: 1, column: 19 }],
    });
  });

  it('Union fails with trailing pipe', () => {
    expectSyntaxError('union Hello = | Wo | Rld |').to.deep.equal({
      message: 'Syntax Error: Expected Name, found <EOF>.',
      locations: [{ line: 1, column: 27 }],
    });
  });

  it('Scalar', () => {
    const doc = parse('scalar Hello');

    expectJSON(doc).toDeepEqual({
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

    expectJSON(doc).toDeepEqual({
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
    expectSyntaxError(`
      input Hello {
        world(foo: Int): String
      }
    `).to.deep.equal({
      message: 'Syntax Error: Expected ":", found "(".',
      locations: [{ line: 3, column: 14 }],
    });
  });

  it('Directive definition', () => {
    const body = 'directive @foo on OBJECT | INTERFACE';
    const doc = parse(body);

    expectJSON(doc).toDeepEqual({
      kind: 'Document',
      definitions: [
        {
          kind: 'DirectiveDefinition',
          description: undefined,
          name: {
            kind: 'Name',
            value: 'foo',
            loc: { start: 11, end: 14 },
          },
          arguments: [],
          repeatable: false,
          locations: [
            {
              kind: 'Name',
              value: 'OBJECT',
              loc: { start: 18, end: 24 },
            },
            {
              kind: 'Name',
              value: 'INTERFACE',
              loc: { start: 27, end: 36 },
            },
          ],
          loc: { start: 0, end: 36 },
        },
      ],
      loc: { start: 0, end: 36 },
    });
  });

  it('Repeatable directive definition', () => {
    const body = 'directive @foo repeatable on OBJECT | INTERFACE';
    const doc = parse(body);

    expectJSON(doc).toDeepEqual({
      kind: 'Document',
      definitions: [
        {
          kind: 'DirectiveDefinition',
          description: undefined,
          name: {
            kind: 'Name',
            value: 'foo',
            loc: { start: 11, end: 14 },
          },
          arguments: [],
          repeatable: true,
          locations: [
            {
              kind: 'Name',
              value: 'OBJECT',
              loc: { start: 29, end: 35 },
            },
            {
              kind: 'Name',
              value: 'INTERFACE',
              loc: { start: 38, end: 47 },
            },
          ],
          loc: { start: 0, end: 47 },
        },
      ],
      loc: { start: 0, end: 47 },
    });
  });

  it('Directive with incorrect locations', () => {
    expectSyntaxError(
      'directive @foo on FIELD | INCORRECT_LOCATION',
    ).to.deep.equal({
      message: 'Syntax Error: Unexpected Name "INCORRECT_LOCATION".',
      locations: [{ line: 1, column: 27 }],
    });
  });

  it('parses kitchen sink schema', () => {
    expect(() => parse(kitchenSinkSDL)).to.not.throw();
  });
});
