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

function fieldNode(name, type, loc) {
  return fieldNodeWithArgs(name, type, [], loc);
}

function fieldNodeWithArgs(name, type, args, loc) {
  return {
    kind: 'FieldDefinition',
    name,
    arguments: args,
    type,
    loc,
  };
}

function enumValueNode(name, loc) {
  return {
    kind: 'EnumValueDefinition',
    name: nameNode(name, loc),
    loc,
  };
}

function inputValueNode(name, type, defaultValue, loc) {
  return {
    kind: 'InputValueDefinition',
    name,
    type,
    defaultValue,
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
            interfaces: [],
            fields: [
              fieldNode(
                nameNode('world', loc(23, 28)),
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
    const body = `type Hello implements World { }`;
    const loc = createLocFn(body);
    const doc = parse(body);
    const expected = {
      kind: 'Document',
      definitions: [
        {
          kind: 'ObjectTypeDefinition',
          name: nameNode('Hello', loc(5, 10)),
          interfaces: [ typeNode('World', loc(22, 27)) ],
          fields: [],
          loc: loc(0, 31),
        }
      ],
      loc: loc(0, 31),
    };
    expect(printJson(doc)).to.equal(printJson(expected));
  });

  it('Simple type inheriting multiple interfaces', () => {
    const body = `type Hello implements Wo, rld { }`;
    const loc = createLocFn(body);
    const doc = parse(body);
    const expected = {
      kind: 'Document',
      definitions: [
        {
          kind: 'ObjectTypeDefinition',
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
    const body = `enum Hello { WORLD }`;
    const loc = createLocFn(body);
    const doc = parse(body);
    const expected = {
      kind: 'Document',
      definitions: [
        {
          kind: 'EnumTypeDefinition',
          name: nameNode('Hello', loc(5, 10)),
          values: [ enumValueNode('WORLD', loc(13, 18)) ],
          loc: loc(0, 20),
        }
      ],
      loc: loc(0, 20),
    };
    expect(printJson(doc)).to.equal(printJson(expected));
  });

  it('Double value enum', () => {
    const body = `enum Hello { WO, RLD }`;
    const loc = createLocFn(body);
    const doc = parse(body);
    const expected = {
      kind: 'Document',
      definitions: [
        {
          kind: 'EnumTypeDefinition',
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
          interfaces: [],
          fields: [
            fieldNodeWithArgs(
              nameNode('world', loc(16, 21)),
              typeNode('String', loc(38, 44)),
              [
                inputValueNode(
                  nameNode('flag', loc(22, 26)),
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
          interfaces: [],
          fields: [
            fieldNodeWithArgs(
              nameNode('world', loc(16, 21)),
              typeNode('String', loc(45, 51)),
              [
                inputValueNode(
                  nameNode('flag', loc(22, 26)),
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
          interfaces: [],
          fields: [
            fieldNodeWithArgs(
              nameNode('world', loc(16, 21)),
              typeNode('String', loc(41, 47)),
              [
                inputValueNode(
                  nameNode('things', loc(22, 28)),
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
          interfaces: [],
          fields: [
            fieldNodeWithArgs(
              nameNode('world', loc(16, 21)),
              typeNode('String', loc(53, 59)),
              [
                inputValueNode(
                  nameNode('argOne', loc(22, 28)),
                  typeNode('Boolean', loc(30, 37)),
                  null,
                  loc(22, 37)
                ),
                inputValueNode(
                  nameNode('argTwo', loc(39, 45)),
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
    const body = `union Hello = World`;
    const doc = parse(body);
    const loc = createLocFn(body);
    const expected = {
      kind: 'Document',
      definitions: [
        {
          kind: 'UnionTypeDefinition',
          name: nameNode('Hello', loc(6, 11)),
          types: [ typeNode('World', loc(14, 19)) ],
          loc: loc(0, 19),
        }
      ],
      loc: loc(0, 19),
    };
    expect(printJson(doc)).to.equal(printJson(expected));
  });

  it('Union with two types', () => {
    const body = `union Hello = Wo | Rld`;
    const doc = parse(body);
    const loc = createLocFn(body);
    const expected = {
      kind: 'Document',
      definitions: [
        {
          kind: 'UnionTypeDefinition',
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
    const body = `scalar Hello`;
    const doc = parse(body);
    const loc = createLocFn(body);
    const expected = {
      kind: 'Document',
      definitions: [
        {
          kind: 'ScalarTypeDefinition',
          name: nameNode('Hello', loc(7, 12)),
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
          fields: [
            inputValueNode(
              nameNode('world', loc(17, 22)),
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
