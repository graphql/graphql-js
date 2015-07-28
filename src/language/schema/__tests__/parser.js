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
import { parseSchemaIntoAST } from '../parser';

function createLocFn(body) {
  return (start, end) => ({
    start: start,
    end: end,
    source: {
      body: body,
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
    loc: loc,
  };
}

function nameNode(name, loc) {
  return {
    kind: 'Name',
    value: name,
    loc: loc,
  };
}

function fieldNode(name, type, loc) {
  return fieldNodeWithArgs(name, type, [], loc);
}

function fieldNodeWithArgs(name, type, args, loc) {
  return {
    kind: 'FieldDefinition',
    name: name,
    arguments: args,
    type: type,
    loc: loc,
  };
}

function enumValueNode(name, loc) {
  return {
    kind: 'EnumValueDefinition',
    name: nameNode(name, loc),
    loc: loc,
  };
}

function inputFieldNode(name, type, loc) {
  return {
    kind: 'InputFieldDefinition',
    name: name,
    type: type,
    loc: loc,
  };
}

describe('Schema Parser', () => {
  it('Simple type', () => {
    var body = `
type Hello {
  world: String
}`;
    var doc = parseSchemaIntoAST(body);
    var loc = createLocFn(body);
    var expected = {
      kind: 'SchemaDocument',
      definitions: [
        {
          kind: 'TypeDefinition',
          name: nameNode('Hello', loc(6, 11)),
          interfaces: [],
          fields: [
            fieldNode(
              nameNode('world', loc(16, 21)),
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

  it('Simple non-null type', () => {
    var body = `
type Hello {
  world: String!
}`;
    var loc = createLocFn(body);
    var doc = parseSchemaIntoAST(body);
    var expected = {
      kind: 'SchemaDocument',
      definitions: [
        {
          kind: 'TypeDefinition',
          name: nameNode('Hello', loc(6, 11)),
          interfaces: [],
          fields: [
            fieldNode(
              nameNode('world', loc(16, 21)),
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
    var body = `type Hello implements World { }`;
    var loc = createLocFn(body);
    var doc = parseSchemaIntoAST(body);
    var expected = {
      kind: 'SchemaDocument',
      definitions: [
        {
          kind: 'TypeDefinition',
          name: nameNode('Hello', loc(5, 10)),
          interfaces: [typeNode('World', loc(22, 27))],
          fields: [],
          loc: loc(0, 31),
        }
      ],
      loc: loc(0, 31),
    };
    expect(printJson(doc)).to.equal(printJson(expected));
  });

  it('Simple type inheriting multiple interfaces', () => {
    var body = `type Hello implements Wo, rld { }`;
    var loc = createLocFn(body);
    var doc = parseSchemaIntoAST(body);
    var expected = {
      kind: 'SchemaDocument',
      definitions: [
        {
          kind: 'TypeDefinition',
          name: nameNode('Hello', loc(5, 10)),
          interfaces: [
            typeNode('Wo', loc(22, 24)),
            typeNode('rld', loc(26, 29))
          ],
          fields: [],
          loc: loc(0, 33),
        }
      ],
      loc: loc(0, 33),
    };
    expect(printJson(doc)).to.equal(printJson(expected));
  });

  it('Single value enum', () => {
    var body = `enum Hello { WORLD }`;
    var loc = createLocFn(body);
    var doc = parseSchemaIntoAST(body);
    var expected = {
      kind: 'SchemaDocument',
      definitions: [
        {
          kind: 'EnumDefinition',
          name: nameNode('Hello', loc(5, 10)),
          values: [enumValueNode('WORLD', loc(13, 18))],
          loc: loc(0, 20),
        }
      ],
      loc: loc(0, 20),
    };
    expect(printJson(doc)).to.equal(printJson(expected));
  });

  it('Double value enum', () => {
    var body = `enum Hello { WO, RLD }`;
    var loc = createLocFn(body);
    var doc = parseSchemaIntoAST(body);
    var expected = {
      kind: 'SchemaDocument',
      definitions: [
        {
          kind: 'EnumDefinition',
          name: nameNode('Hello', loc(5, 10)),
          values: [
            enumValueNode('WO', loc(13, 15)),
            enumValueNode('RLD', loc(17, 20)),
          ],
          loc: loc(0, 22),
        }
      ],
      loc: loc(0, 22),
    };
    expect(printJson(doc)).to.equal(printJson(expected));
  });

  it('Simple interface', () => {
    var body = `
interface Hello {
  world: String
}`;
    var doc = parseSchemaIntoAST(body);
    var loc = createLocFn(body);
    var expected = {
      kind: 'SchemaDocument',
      definitions: [
        {
          kind: 'InterfaceDefinition',
          name: nameNode('Hello', loc(11, 16)),
          fields: [
            fieldNode(
              nameNode('world', loc(21, 26)),
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
    var body = `
type Hello {
  world(flag: Boolean): String
}`;
    var doc = parseSchemaIntoAST(body);
    var loc = createLocFn(body);
    var expected = {
      kind: 'SchemaDocument',
      definitions: [
        {
          kind: 'TypeDefinition',
          name: nameNode('Hello', loc(6, 11)),
          interfaces: [],
          fields: [
            fieldNodeWithArgs(
              nameNode('world', loc(16, 21)),
              typeNode('String', loc(38, 44)),
              [
                {
                  kind: 'ArgumentDefinition',
                  name: nameNode('flag', loc(22, 26)),
                  type: typeNode('Boolean', loc(28, 35)),
                  defaultValue: null,
                  loc: loc(22, 35),
                }
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
    var body = `
type Hello {
  world(flag: Boolean = true): String
}`;
    var doc = parseSchemaIntoAST(body);
    var loc = createLocFn(body);
    var expected = {
      kind: 'SchemaDocument',
      definitions: [
        {
          kind: 'TypeDefinition',
          name: nameNode('Hello', loc(6, 11)),
          interfaces: [],
          fields: [
            fieldNodeWithArgs(
              nameNode('world', loc(16, 21)),
              typeNode('String', loc(45, 51)),
              [
                {
                  kind: 'ArgumentDefinition',
                  name: nameNode('flag', loc(22, 26)),
                  type: typeNode('Boolean', loc(28, 35)),
                  defaultValue: {
                    kind: 'BooleanValue',
                    value: true,
                    loc: loc(38, 42),
                  },
                  loc: loc(22, 42),
                }
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
    var body = `
type Hello {
  world(things: [String]): String
}`;
    var doc = parseSchemaIntoAST(body);
    var loc = createLocFn(body);
    var expected = {
      kind: 'SchemaDocument',
      definitions: [
        {
          kind: 'TypeDefinition',
          name: nameNode('Hello', loc(6, 11)),
          interfaces: [],
          fields: [
            fieldNodeWithArgs(
              nameNode('world', loc(16, 21)),
              typeNode('String', loc(41, 47)),
              [
                {
                  kind: 'ArgumentDefinition',
                  name: nameNode('things', loc(22, 28)),
                  type: {
                    kind: 'ListType',
                    type: typeNode('String', loc(31, 37)),
                    loc: loc(30, 38)
                  },
                  defaultValue: null,
                  loc: loc(22, 38),
                }
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
    var body = `
type Hello {
  world(argOne: Boolean, argTwo: Int): String
}`;
    var doc = parseSchemaIntoAST(body);
    var loc = createLocFn(body);
    var expected = {
      kind: 'SchemaDocument',
      definitions: [
        {
          kind: 'TypeDefinition',
          name: nameNode('Hello', loc(6, 11)),
          interfaces: [],
          fields: [
            fieldNodeWithArgs(
              nameNode('world', loc(16, 21)),
              typeNode('String', loc(53, 59)),
              [
                {
                  kind: 'ArgumentDefinition',
                  name: nameNode('argOne', loc(22, 28)),
                  type: typeNode('Boolean', loc(30, 37)),
                  defaultValue: null,
                  loc: loc(22, 37),
                },
                {
                  kind: 'ArgumentDefinition',
                  name: nameNode('argTwo', loc(39, 45)),
                  type: typeNode('Int', loc(47, 50)),
                  defaultValue: null,
                  loc: loc(39, 50),
                },
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
    var body = `union Hello = World`;
    var doc = parseSchemaIntoAST(body);
    var loc = createLocFn(body);
    var expected = {
      kind: 'SchemaDocument',
      definitions: [
        {
          kind: 'UnionDefinition',
          name: nameNode('Hello', loc(6, 11)),
          types: [typeNode('World', loc(14, 19))],
          loc: loc(0, 19),
        }
      ],
      loc: loc(0, 19),
    };
    expect(printJson(doc)).to.equal(printJson(expected));
  });

  it('Union with two types', () => {
    var body = `union Hello = Wo | Rld`;
    var doc = parseSchemaIntoAST(body);
    var loc = createLocFn(body);
    var expected = {
      kind: 'SchemaDocument',
      definitions: [
        {
          kind: 'UnionDefinition',
          name: nameNode('Hello', loc(6, 11)),
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
    var body = `scalar Hello`;
    var doc = parseSchemaIntoAST(body);
    var loc = createLocFn(body);
    var expected = {
      kind: 'SchemaDocument',
      definitions: [
        {
          kind: 'ScalarDefinition',
          name: nameNode('Hello', loc(7, 12)),
          loc: loc(0, 12),
        }
      ],
      loc: loc(0, 12),
    };
    expect(printJson(doc)).to.equal(printJson(expected));
  });

  it('Simple input object', () => {
    var body = `
input Hello {
  world: String
}`;
    var doc = parseSchemaIntoAST(body);
    var loc = createLocFn(body);
    var expected = {
      kind: 'SchemaDocument',
      definitions: [
        {
          kind: 'InputObjectDefinition',
          name: nameNode('Hello', loc(7, 12)),
          fields: [
            inputFieldNode(
              nameNode('world', loc(17, 22)),
              typeNode('String', loc(24, 30)),
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
    var body = `
input Hello {
  world(foo: Int): String
}`;
    expect(() => parseSchemaIntoAST(body)).to.throw('Error');
  });

  it('Reject query keywords', () => {
    var body = `query Foo { field }`;
    expect(() => parseSchemaIntoAST(body)).to.throw('Error');
  });

  it('Reject query shorthand', () => {
    var body = `{ field }`;
    expect(() => parseSchemaIntoAST(body)).to.throw('Error');
  });
});
