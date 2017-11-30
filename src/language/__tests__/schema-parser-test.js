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
              { start: 16, end: 29 }
            )
          ],
          loc: { start: 1, end: 31 },
        }
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
          }
        }
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
          }
        }
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
              { start: 23, end: 36 }
            )
          ],
          loc: { start: 1, end: 38 },
        }
      ],
      loc: { start: 0, end: 39 }
    };
    expect(printJson(doc)).to.equal(printJson(expected));
  });

  it('Extension without fields', () => {
    const body = 'extend type Hello implements Greeting';
    const doc = parse(body);
    const expected = {
      kind: 'Document',
      definitions: [
        {
          kind: 'ObjectTypeExtension',
          name: nameNode('Hello', { start: 12, end: 17 }),
          interfaces: [ typeNode('Greeting', { start: 29, end: 37 }) ],
          directives: [],
          fields: [],
          loc: { start: 0, end: 37 },
        }
      ],
      loc: { start: 0, end: 37 }
    };
    expect(printJson(doc)).to.equal(printJson(expected));
  });

  it('Extension without anything throws', () => {
    expect(() => parse(`
      extend type Hello
    `)).to.throw('Syntax Error GraphQL request (3:5) Unexpected <EOF>');
  });

  it('Extension do not include descriptions', () => {
    expect(() => parse(`
      "Description"
      extend type Hello {
        world: String
      }
    `)).to.throw('Syntax Error GraphQL request (3:7)');

    expect(() => parse(`
      extend "Description" type Hello {
        world: String
      }
    `)).to.throw('Syntax Error GraphQL request (2:14)');
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
              { start: 16, end: 30 }
            )
          ],
          loc: { start: 1, end: 32 },
        }
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
          interfaces: [ typeNode('World', { start: 22, end: 27 }) ],
          directives: [],
          fields: [
            fieldNode(
              nameNode('field', { start: 30, end: 35 }),
              typeNode('String', { start: 37, end: 43 }),
              { start: 30, end: 43 }
            )
          ],
          loc: { start: 0, end: 45 },
        }
      ],
      loc: { start: 0, end: 45 },
    };
    expect(printJson(doc)).to.equal(printJson(expected));
  });

  it('Simple type inheriting multiple interfaces', () => {
    const body = 'type Hello implements Wo, rld { field: String }';
    const doc = parse(body);
    const expected = {
      kind: 'Document',
      definitions: [
        {
          kind: 'ObjectTypeDefinition',
          name: nameNode('Hello', { start: 5, end: 10 }),
          interfaces: [
            typeNode('Wo', { start: 22, end: 24 }),
            typeNode('rld', { start: 26, end: 29 })
          ],
          directives: [],
          fields: [
            fieldNode(
              nameNode('field', { start: 32, end: 37 }),
              typeNode('String', { start: 39, end: 45 }),
              { start: 32, end: 45 }
            )
          ],
          loc: { start: 0, end: 47 },
        }
      ],
      loc: { start: 0, end: 47 },
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
          values: [ enumValueNode('WORLD', { start: 13, end: 18 }) ],
          loc: { start: 0, end: 20 },
        }
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
        }
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
          directives: [],
          fields: [
            fieldNode(
              nameNode('world', { start: 21, end: 26 }),
              typeNode('String', { start: 28, end: 34 }),
              { start: 21, end: 34 }
            )
          ],
          loc: { start: 1, end: 36 },
        }
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
                  null,
                  { start: 22, end: 35 }
                )
              ],
              { start: 16, end: 44 }
            )
          ],
          loc: { start: 1, end: 46 },
        }
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
                  { start: 22, end: 42 }
                )
              ],
              { start: 16, end: 51 }
            )
          ],
          loc: { start: 1, end: 53 },
        }
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
                    loc: { start: 30, end: 38 }
                  },
                  null,
                  { start: 22, end: 38 }
                )
              ],
              { start: 16, end: 47 }
            )
          ],
          loc: { start: 1, end: 49 },
        }
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
                  null,
                  { start: 22, end: 37 }
                ),
                inputValueNode(
                  nameNode('argTwo', { start: 39, end: 45 }),
                  typeNode('Int', { start: 47, end: 50 }),
                  null,
                  { start: 39, end: 50 }
                ),
              ],
              { start: 16, end: 59 }
            )
          ],
          loc: { start: 1, end: 61 },
        }
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
          types: [ typeNode('World', { start: 14, end: 19 }) ],
          loc: { start: 0, end: 19 },
        }
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
        }
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
        }
      ],
      loc: { start: 0, end: 24 },
    };
    expect(printJson(doc)).to.equal(printJson(expected));
  });

  it('Union fails with no types', () => {
    const body = 'union Hello = |';
    expect(() => parse(body)).to.throw();
  });

  it('Union fails with leading douple pipe', () => {
    const body = 'union Hello = || Wo | Rld';
    expect(() => parse(body)).to.throw();
  });

  it('Union fails with double pipe', () => {
    const body = 'union Hello = Wo || Rld';
    expect(() => parse(body)).to.throw();
  });

  it('Union fails with trailing pipe', () => {
    const body = 'union Hello = | Wo | Rld |';
    expect(() => parse(body)).to.throw();
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
        }
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
              null,
              { start: 17, end: 30 }
            )
          ],
          loc: { start: 1, end: 32 },
        }
      ],
      loc: { start: 0, end: 32 },
    };
    expect(printJson(doc)).to.equal(printJson(expected));
  });

  it('Simple input object with args should fail', () => {
    const body = `
input Hello {
  world(foo: Int): String
}`;
    expect(() => parse(body)).to.throw('Error');
  });

  it('Directive with incorrect locations', () => {
    expect(() => parse(`
      directive @foo on FIELD | INCORRECT_LOCATION
    `)).to.throw(
      'Syntax Error GraphQL request (2:33) Unexpected Name "INCORRECT_LOCATION"'
    );
  });

});
