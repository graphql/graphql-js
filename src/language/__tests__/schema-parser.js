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

function annotationNode(name, args, loc) {
  return {
    kind: 'Annotation',
    name,
    arguments: args,
    loc
  };
}

function fieldNode(name, type, loc) {
  return fieldNodeWithArgs(name, type, [], loc);
}

function fieldNodeWithArgs(name, type, args, loc) {
  return fieldNodeWithArgsAndAnnotations(name, type, args, [], loc);
}

function fieldNodeWithArgsAndAnnotations(name, type, args, annotations, loc) {
  return {
    kind: 'FieldDefinition',
    name,
    arguments: args,
    type,
    loc,
    annotations,
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
    var body = `
type Hello {
  world: String
}`;
    var doc = parse(body);
    var loc = createLocFn(body);
    var expected = {
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
    var body = `
extend type Hello {
  world: String
}`;
    var doc = parse(body);
    var loc = createLocFn(body);
    var expected = {
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
    var body = `
type Hello {
  world: String!
}`;
    var loc = createLocFn(body);
    var doc = parse(body);
    var expected = {
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
    var body = `type Hello implements World { }`;
    var loc = createLocFn(body);
    var doc = parse(body);
    var expected = {
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
    var body = `type Hello implements Wo, rld { }`;
    var loc = createLocFn(body);
    var doc = parse(body);
    var expected = {
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
    var body = `enum Hello { WORLD }`;
    var loc = createLocFn(body);
    var doc = parse(body);
    var expected = {
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
    var body = `enum Hello { WO, RLD }`;
    var loc = createLocFn(body);
    var doc = parse(body);
    var expected = {
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
    var body = `
interface Hello {
  world: String
}`;
    var doc = parse(body);
    var loc = createLocFn(body);
    var expected = {
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
    var body = `
type Hello {
  world(flag: Boolean): String
}`;
    var doc = parse(body);
    var loc = createLocFn(body);
    var expected = {
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
    var body = `
type Hello {
  world(flag: Boolean = true): String
}`;
    var doc = parse(body);
    var loc = createLocFn(body);
    var expected = {
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
    var body = `
type Hello {
  world(things: [String]): String
}`;
    var doc = parse(body);
    var loc = createLocFn(body);
    var expected = {
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
    var body = `
type Hello {
  world(argOne: Boolean, argTwo: Int): String
}`;
    var doc = parse(body);
    var loc = createLocFn(body);
    var expected = {
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
    var body = `union Hello = World`;
    var doc = parse(body);
    var loc = createLocFn(body);
    var expected = {
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
    var body = `union Hello = Wo | Rld`;
    var doc = parse(body);
    var loc = createLocFn(body);
    var expected = {
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
    var body = `scalar Hello`;
    var doc = parse(body);
    var loc = createLocFn(body);
    var expected = {
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
    var body = `
input Hello {
  world: String
}`;
    var doc = parse(body);
    var loc = createLocFn(body);
    var expected = {
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
    var body = `
input Hello {
  world(foo: Int): String
}`;
    expect(() => parse(body)).to.throw('Error');
  });

  it('Simple fields with annotations', () => {
    var body = `
type Hello {
  @mock(value: "hello")
  world: String
  @ignore
  @mock(value: 2)
  hello: Int
}`;
    var doc = parse(body);
    var loc = createLocFn(body);
    var expected = {
      kind: 'Document',
      definitions: [
        {
          kind: 'ObjectTypeDefinition',
          name: nameNode('Hello', loc(6, 11)),
          interfaces: [],
          fields: [
            fieldNodeWithArgsAndAnnotations(
              nameNode('world', loc(40, 45)),
              typeNode('String', loc(47, 53)),
              [],
              [
                annotationNode(
                  nameNode('mock', loc(17, 21)),
                  [
                    {
                      kind: 'Argument',
                      name: nameNode('value', loc(22, 27)),
                      value: {
                        kind: 'StringValue',
                        value: 'hello',
                        loc: loc(29, 36),
                      },
                      loc: loc(22, 36),
                    }
                  ],
                  loc(16, 37)
                ),
              ],
              loc(16, 53)
            ),
            fieldNodeWithArgsAndAnnotations(
              nameNode('hello', loc(84, 89)),
              typeNode('Int', loc(91, 94)),
              [],
              [
                annotationNode(
                  nameNode('ignore', loc(57, 63)),
                  [],
                  loc(56, 63)
                ),
                annotationNode(
                  nameNode('mock', loc(67, 71)),
                  [
                    {
                      kind: 'Argument',
                      name: nameNode('value', loc(72, 77)),
                      value: {
                        kind: 'IntValue',
                        value: '2',
                        loc: loc(79, 80),
                      },
                      loc: loc(72, 80),
                    }
                  ],
                  loc(66, 81)
                ),
              ],
              loc(56, 94)
            )
          ],
          loc: loc(1, 96),
        }
      ],
      loc: loc(1, 96),
    };
    expect(printJson(doc)).to.equal(printJson(expected));
  });


});
