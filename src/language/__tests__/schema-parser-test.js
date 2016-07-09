/**
 *  Copyright (c) 2015, Facebook, Inc.
 *  All rights reserved.
 *
 *  This source code is licensed under the BSD-style license found in the
 *  LICENSE file in the root directory of this source tree. An additional grant
 *  of patent rights can be found in the PATENTS file in the same directory.
 */

import { expect } from 'chai';
import { describe, it } from 'mocha';
import { parse } from '../parser';

function createLocFn(body) {
  return (start, end) => ({
    start,
    end,
    source: {
      body,
      name: 'GraphQL',
    },
  });
}

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

function descriptionNode(value, loc) {
  return {
    kind: 'Description',
    value,
    loc,
  };
}

function fieldNode(name, description, type, loc) {
  return fieldNodeWithArgs(name, description, type, [], loc);
}

function fieldNodeWithArgs(name, description, type, args, loc) {
  return {
    kind: 'FieldDefinition',
    name,
    description,
    arguments: args,
    type,
    directives: [],
    loc,
  };
}

function enumValueNode(name, description, loc) {
  return {
    kind: 'EnumValueDefinition',
    name: nameNode(name, loc),
    description,
    directives: [],
    loc,
  };
}

function inputValueNode(name, description, type, defaultValue, loc) {
  return {
    kind: 'InputValueDefinition',
    name,
    description,
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
    const loc = createLocFn(body);
    const expected = {
      kind: 'Document',
      definitions: [
        {
          kind: 'ObjectTypeDefinition',
          name: nameNode('Hello', loc(6, 11)),
          description: null,
          interfaces: [],
          directives: [],
          fields: [
            fieldNode(
              nameNode('world', loc(16, 21)),
              null,
              typeNode('String', loc(23, 29)),
              loc(16, 29)
            )
          ],
          loc: loc(1, 31),
        }
      ],
      loc: loc(1, 31),
    };
    expect(printJson(doc)).to.equal(printJson(expected));
  });

  it('Simple type with description', () => {
    const body = `
## description of 'Hello'
type Hello {
  world: String
}`;
    const doc = parse(body);
    const loc = createLocFn(body);
    const expected = {
      kind: 'Document',
      definitions: [
        {
          kind: 'ObjectTypeDefinition',
          name: nameNode('Hello', loc(32, 37)),
          description: descriptionNode(
            'description of \'Hello\'',
            loc(1, 26)
          ),
          interfaces: [],
          directives: [],
          fields: [
            fieldNode(
              nameNode('world', loc(42, 47)),
              null,
              typeNode('String', loc(49, 55)),
              loc(42, 55)
            )
          ],
          loc: loc(27, 57),
        }
      ],
      loc: loc(1, 57),
    };
    expect(printJson(doc)).to.equal(printJson(expected));
  });

  it('Simple type with multi-line description', () => {
    const body = `
## description of 'Hello'
## on multiple lines
type Hello {
  world: String
}`;
    const doc = parse(body);
    const loc = createLocFn(body);
    const expected = {
      kind: 'Document',
      definitions: [
        {
          kind: 'ObjectTypeDefinition',
          name: nameNode('Hello', loc(53, 58)),
          description: descriptionNode(
            'description of \'Hello\'\non multiple lines',
            loc(1, 47)
          ),
          interfaces: [],
          directives: [],
          fields: [
            fieldNode(
              nameNode('world', loc(63, 68)),
              null,
              typeNode('String', loc(70, 76)),
              loc(63, 76)
            )
          ],
          loc: loc(48, 78),
        }
      ],
      loc: loc(1, 78),
    };
    expect(printJson(doc)).to.equal(printJson(expected));
  });

  it('Simple type with field description', () => {
    const body = `
type Hello {
  ## description of field 'world'
  world: String
}`;
    const doc = parse(body);
    const loc = createLocFn(body);
    const expected = {
      kind: 'Document',
      definitions: [
        {
          kind: 'ObjectTypeDefinition',
          name: nameNode('Hello', loc(6, 11)),
          description: null,
          interfaces: [],
          directives: [],
          fields: [
            fieldNode(
              nameNode('world', loc(50, 55)),
              descriptionNode(
                'description of field \'world\'',
                loc(16, 47)
              ),
              typeNode('String', loc(57, 63)),
              loc(50, 63)
            )
          ],
          loc: loc(1, 65),
        }
      ],
      loc: loc(1, 65),
    };
    expect(printJson(doc)).to.equal(printJson(expected));
  });

  it('Simple extension', () => {
    const body = `
extend type Hello {
  world: String
}`;
    const doc = parse(body);
    const loc = createLocFn(body);
    const expected = {
      kind: 'Document',
      definitions: [
        {
          kind: 'TypeExtensionDefinition',
          definition: {
            kind: 'ObjectTypeDefinition',
            name: nameNode('Hello', loc(13, 18)),
            description: null,
            interfaces: [],
            directives: [],
            fields: [
              fieldNode(
                nameNode('world', loc(23, 28)),
                null,
                typeNode('String', loc(30, 36)),
                loc(23, 36)
              )
            ],
            loc: loc(8, 38),
          },
          loc: loc(1, 38),
        }
      ],
      loc: loc(1, 38)
    };
    expect(printJson(doc)).to.equal(printJson(expected));
  });

  it('Simple non-null type', () => {
    const body = `
type Hello {
  world: String!
}`;
    const loc = createLocFn(body);
    const doc = parse(body);
    const expected = {
      kind: 'Document',
      definitions: [
        {
          kind: 'ObjectTypeDefinition',
          name: nameNode('Hello', loc(6, 11)),
          description: null,
          interfaces: [],
          directives: [],
          fields: [
            fieldNode(
              nameNode('world', loc(16, 21)),
              null,
              {
                kind: 'NonNullType',
                type: typeNode('String', loc(23, 29)),
                loc: loc(23, 30),
              },
              loc(16, 30)
            )
          ],
          loc: loc(1, 32),
        }
      ],
      loc: loc(1, 32),
    };
    expect(printJson(doc)).to.equal(printJson(expected));
  });


  it('Simple type inheriting interface', () => {
    const body = 'type Hello implements World { }';
    const loc = createLocFn(body);
    const doc = parse(body);
    const expected = {
      kind: 'Document',
      definitions: [
        {
          kind: 'ObjectTypeDefinition',
          name: nameNode('Hello', loc(5, 10)),
          description: null,
          interfaces: [ typeNode('World', loc(22, 27)) ],
          directives: [],
          fields: [],
          loc: loc(0, 31),
        }
      ],
      loc: loc(0, 31),
    };
    expect(printJson(doc)).to.equal(printJson(expected));
  });

  it('Simple type inheriting multiple interfaces', () => {
    const body = 'type Hello implements Wo, rld { }';
    const loc = createLocFn(body);
    const doc = parse(body);
    const expected = {
      kind: 'Document',
      definitions: [
        {
          kind: 'ObjectTypeDefinition',
          name: nameNode('Hello', loc(5, 10)),
          description: null,
          interfaces: [
            typeNode('Wo', loc(22, 24)),
            typeNode('rld', loc(26, 29))
          ],
          directives: [],
          fields: [],
          loc: loc(0, 33),
        }
      ],
      loc: loc(0, 33),
    };
    expect(printJson(doc)).to.equal(printJson(expected));
  });

  it('Single value enum', () => {
    const body = 'enum Hello { WORLD }';
    const loc = createLocFn(body);
    const doc = parse(body);
    const expected = {
      kind: 'Document',
      definitions: [
        {
          kind: 'EnumTypeDefinition',
          name: nameNode('Hello', loc(5, 10)),
          description: null,
          directives: [],
          values: [ enumValueNode('WORLD', null, loc(13, 18)) ],
          loc: loc(0, 20),
        }
      ],
      loc: loc(0, 20),
    };
    expect(printJson(doc)).to.equal(printJson(expected));
  });

  it('Double value enum', () => {
    const body = 'enum Hello { WO, RLD }';
    const loc = createLocFn(body);
    const doc = parse(body);
    const expected = {
      kind: 'Document',
      definitions: [
        {
          kind: 'EnumTypeDefinition',
          name: nameNode('Hello', loc(5, 10)),
          description: null,
          directives: [],
          values: [
            enumValueNode('WO', null, loc(13, 15)),
            enumValueNode('RLD', null, loc(17, 20)),
          ],
          loc: loc(0, 22),
        }
      ],
      loc: loc(0, 22),
    };
    expect(printJson(doc)).to.equal(printJson(expected));
  });

  it('Simple enum with descriptions on type and value', () => {
    const body = `
## description of 'Hello'
enum Hello {
  ## description of enum value 'WORLD'
  WORLD
}
`;
    const loc = createLocFn(body);
    const doc = parse(body);
    const expected = {
      kind: 'Document',
      definitions: [
        {
          kind: 'EnumTypeDefinition',
          name: nameNode('Hello', loc(32, 37)),
          description: descriptionNode(
            'description of \'Hello\'',
            loc(1, 26)
          ),
          directives: [],
          values: [
            enumValueNode(
              'WORLD',
              descriptionNode(
                'description of enum value \'WORLD\'',
                loc(42, 78)
              ),
              loc(81, 86)
            )
          ],
          loc: loc(27, 88),
        }
      ],
      loc: loc(1, 89),
    };
    expect(printJson(doc)).to.equal(printJson(expected));
  });

  it('Simple interface', () => {
    const body = `
interface Hello {
  world: String
}`;
    const doc = parse(body);
    const loc = createLocFn(body);
    const expected = {
      kind: 'Document',
      definitions: [
        {
          kind: 'InterfaceTypeDefinition',
          name: nameNode('Hello', loc(11, 16)),
          description: null,
          directives: [],
          fields: [
            fieldNode(
              nameNode('world', loc(21, 26)),
              null,
              typeNode('String', loc(28, 34)),
              loc(21, 34)
            )
          ],
          loc: loc(1, 36),
        }
      ],
      loc: loc(1, 36),
    };
    expect(printJson(doc)).to.equal(printJson(expected));
  });

  it('Simple field with arg', () => {
    const body = `
type Hello {
  world(flag: Boolean): String
}`;
    const doc = parse(body);
    const loc = createLocFn(body);
    const expected = {
      kind: 'Document',
      definitions: [
        {
          kind: 'ObjectTypeDefinition',
          name: nameNode('Hello', loc(6, 11)),
          description: null,
          interfaces: [],
          directives: [],
          fields: [
            fieldNodeWithArgs(
              nameNode('world', loc(16, 21)),
              null,
              typeNode('String', loc(38, 44)),
              [
                inputValueNode(
                  nameNode('flag', loc(22, 26)),
                  null,
                  typeNode('Boolean', loc(28, 35)),
                  null,
                  loc(22, 35)
                )
              ],
              loc(16, 44)
            )
          ],
          loc: loc(1, 46),
        }
      ],
      loc: loc(1, 46),
    };
    expect(printJson(doc)).to.equal(printJson(expected));
  });

  it('Simple field with arg with default value', () => {
    const body = `
type Hello {
  world(flag: Boolean = true): String
}`;
    const doc = parse(body);
    const loc = createLocFn(body);
    const expected = {
      kind: 'Document',
      definitions: [
        {
          kind: 'ObjectTypeDefinition',
          name: nameNode('Hello', loc(6, 11)),
          description: null,
          interfaces: [],
          directives: [],
          fields: [
            fieldNodeWithArgs(
              nameNode('world', loc(16, 21)),
              null,
              typeNode('String', loc(45, 51)),
              [
                inputValueNode(
                  nameNode('flag', loc(22, 26)),
                  null,
                  typeNode('Boolean', loc(28, 35)),
                  {
                    kind: 'BooleanValue',
                    value: true,
                    loc: loc(38, 42),
                  },
                  loc(22, 42)
                )
              ],
              loc(16, 51)
            )
          ],
          loc: loc(1, 53),
        }
      ],
      loc: loc(1, 53),
    };
    expect(printJson(doc)).to.equal(printJson(expected));
  });

  it('Simple field with list arg', () => {
    const body = `
type Hello {
  world(things: [String]): String
}`;
    const doc = parse(body);
    const loc = createLocFn(body);
    const expected = {
      kind: 'Document',
      definitions: [
        {
          kind: 'ObjectTypeDefinition',
          name: nameNode('Hello', loc(6, 11)),
          description: null,
          interfaces: [],
          directives: [],
          fields: [
            fieldNodeWithArgs(
              nameNode('world', loc(16, 21)),
              null,
              typeNode('String', loc(41, 47)),
              [
                inputValueNode(
                  nameNode('things', loc(22, 28)),
                  null,
                  {
                    kind: 'ListType',
                    type: typeNode('String', loc(31, 37)),
                    loc: loc(30, 38)
                  },
                  null,
                  loc(22, 38)
                )
              ],
              loc(16, 47)
            )
          ],
          loc: loc(1, 49),
        }
      ],
      loc: loc(1, 49),
    };
    expect(printJson(doc)).to.equal(printJson(expected));
  });

  it('Simple field with two args', () => {
    const body = `
type Hello {
  world(argOne: Boolean, argTwo: Int): String
}`;
    const doc = parse(body);
    const loc = createLocFn(body);
    const expected = {
      kind: 'Document',
      definitions: [
        {
          kind: 'ObjectTypeDefinition',
          name: nameNode('Hello', loc(6, 11)),
          description: null,
          interfaces: [],
          directives: [],
          fields: [
            fieldNodeWithArgs(
              nameNode('world', loc(16, 21)),
              null,
              typeNode('String', loc(53, 59)),
              [
                inputValueNode(
                  nameNode('argOne', loc(22, 28)),
                  null,
                  typeNode('Boolean', loc(30, 37)),
                  null,
                  loc(22, 37)
                ),
                inputValueNode(
                  nameNode('argTwo', loc(39, 45)),
                  null,
                  typeNode('Int', loc(47, 50)),
                  null,
                  loc(39, 50)
                ),
              ],
              loc(16, 59)
            )
          ],
          loc: loc(1, 61),
        }
      ],
      loc: loc(1, 61),
    };
    expect(printJson(doc)).to.equal(printJson(expected));
  });

  it('Simple union', () => {
    const body = 'union Hello = World';
    const doc = parse(body);
    const loc = createLocFn(body);
    const expected = {
      kind: 'Document',
      definitions: [
        {
          kind: 'UnionTypeDefinition',
          name: nameNode('Hello', loc(6, 11)),
          description: null,
          directives: [],
          types: [ typeNode('World', loc(14, 19)) ],
          loc: loc(0, 19),
        }
      ],
      loc: loc(0, 19),
    };
    expect(printJson(doc)).to.equal(printJson(expected));
  });

  it('Union with two types', () => {
    const body = 'union Hello = Wo | Rld';
    const doc = parse(body);
    const loc = createLocFn(body);
    const expected = {
      kind: 'Document',
      definitions: [
        {
          kind: 'UnionTypeDefinition',
          name: nameNode('Hello', loc(6, 11)),
          description: null,
          directives: [],
          types: [
            typeNode('Wo', loc(14, 16)),
            typeNode('Rld', loc(19, 22)),
          ],
          loc: loc(0, 22),
        }
      ],
      loc: loc(0, 22),
    };
    expect(printJson(doc)).to.equal(printJson(expected));
  });

  it('Scalar', () => {
    const body = 'scalar Hello';
    const doc = parse(body);
    const loc = createLocFn(body);
    const expected = {
      kind: 'Document',
      definitions: [
        {
          kind: 'ScalarTypeDefinition',
          name: nameNode('Hello', loc(7, 12)),
          description: null,
          directives: [],
          loc: loc(0, 12),
        }
      ],
      loc: loc(0, 12),
    };
    expect(printJson(doc)).to.equal(printJson(expected));
  });

  it('Simple input object', () => {
    const body = `
input Hello {
  world: String
}`;
    const doc = parse(body);
    const loc = createLocFn(body);
    const expected = {
      kind: 'Document',
      definitions: [
        {
          kind: 'InputObjectTypeDefinition',
          name: nameNode('Hello', loc(7, 12)),
          description: null,
          directives: [],
          fields: [
            inputValueNode(
              nameNode('world', loc(17, 22)),
              null,
              typeNode('String', loc(24, 30)),
              null,
              loc(17, 30)
            )
          ],
          loc: loc(1, 32),
        }
      ],
      loc: loc(1, 32),
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

});
