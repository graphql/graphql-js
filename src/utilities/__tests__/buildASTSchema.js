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
import { parse } from '../../language';
import { printSchema } from '../schemaPrinter';
import { buildASTSchema } from '../buildASTSchema';

/**
 * This function does a full cycle of going from a
 * string with the contents of the DSL, parsed
 * in a schema AST, materializing that schema AST
 * into an in-memory GraphQLSchema, and then finally
 * printing that GraphQL into the DSL
 */
function cycleOutput(body, queryType, mutationType, subscriptionType) {
  var ast = parse(body);
  var schema = buildASTSchema(ast, queryType, mutationType, subscriptionType);
  return '\n' + printSchema(schema);
}

describe('Schema Materializer', () => {
  it('Simple type', () => {
    var body = `
type HelloScalars {
  str: String
  int: Int
  float: Float
  id: ID
  bool: Boolean
}
`;
    var output = cycleOutput(body, 'HelloScalars');
    expect(output).to.equal(body);
  });

  it('Type modifiers', () => {
    var body = `
type HelloScalars {
  nonNullStr: String!
  listOfStrs: [String]
  listOfNonNullStrs: [String!]
  nonNullListOfStrs: [String]!
  nonNullListOfNonNullStrs: [String!]!
}
`;
    var output = cycleOutput(body, 'HelloScalars');
    expect(output).to.equal(body);
  });


  it('Recursive type', () => {
    var body = `
type Recurse {
  str: String
  recurse: Recurse
}
`;
    var output = cycleOutput(body, 'Recurse');
    expect(output).to.equal(body);
  });

  it('Two types circular', () => {
    var body = `
type TypeOne {
  str: String
  typeTwo: TypeTwo
}

type TypeTwo {
  str: String
  typeOne: TypeOne
}
`;
    var output = cycleOutput(body, 'TypeOne');
    expect(output).to.equal(body);
  });

  it('Single argument field', () => {
    var body = `
type Hello {
  str(int: Int): String
  floatToStr(float: Float): String
  idToStr(id: ID): String
  booleanToStr(bool: Boolean): String
  strToStr(bool: String): String
}
`;
    var output = cycleOutput(body, 'Hello');
    expect(output).to.equal(body);
  });

  it('Simple type with multiple arguments', () => {
    var body = `
type Hello {
  str(int: Int, bool: Boolean): String
}
`;
    var output = cycleOutput(body, 'Hello');
    expect(output).to.equal(body);
  });

  it('Simple type with interface', () => {
    var body = `
type HelloInterface implements WorldInterface {
  str: String
}

interface WorldInterface {
  str: String
}
`;
    var output = cycleOutput(body, 'HelloInterface');
    expect(output).to.equal(body);
  });

  it('Simple output enum', () => {
    var body = `
enum Hello {
  WORLD
}

type OutputEnumRoot {
  hello: Hello
}
`;
    var output = cycleOutput(body, 'OutputEnumRoot');
    expect(output).to.equal(body);
  });

  it('Simple input enum', () => {
    var body = `
enum Hello {
  WORLD
}

type InputEnumRoot {
  str(hello: Hello): String
}
`;
    var output = cycleOutput(body, 'InputEnumRoot');
    expect(output).to.equal(body);
  });

  it('Multiple value enum', () => {
    var body = `
enum Hello {
  WO
  RLD
}

type OutputEnumRoot {
  hello: Hello
}
`;
    var output = cycleOutput(body, 'OutputEnumRoot');
    expect(output).to.equal(body);
  });

  it('Simple Union', () => {
    var body = `
union Hello = World

type Root {
  hello: Hello
}

type World {
  str: String
}
`;
    var output = cycleOutput(body, 'Root');
    expect(output).to.equal(body);
  });

  it('Multiple Union', () => {
    var body = `
union Hello = WorldOne | WorldTwo

type Root {
  hello: Hello
}

type WorldOne {
  str: String
}

type WorldTwo {
  str: String
}
`;
    var output = cycleOutput(body, 'Root');
    expect(output).to.equal(body);
  });

  it('Custom Scalar', () => {
    var body = `
scalar CustomScalar

type Root {
  customScalar: CustomScalar
}
`;

    var output = cycleOutput(body, 'Root');
    expect(output).to.equal(body);
  });

  it('Input Object', async() => {
    var body = `
input Input {
  int: Int
}

type Root {
  field(in: Input): String
}
`;

    var output = cycleOutput(body, 'Root');
    expect(output).to.equal(body);
  });

  it('Simple argument field with default', () => {
    var body = `
type Hello {
  str(int: Int = 2): String
}
`;
    var output = cycleOutput(body, 'Hello');
    expect(output).to.equal(body);
  });

  it('Simple type with mutation', () => {
    var body = `
type HelloScalars {
  str: String
  int: Int
  bool: Boolean
}

type Mutation {
  addHelloScalars(str: String, int: Int, bool: Boolean): HelloScalars
}
`;
    var output = cycleOutput(body, 'HelloScalars', 'Mutation');
    expect(output).to.equal(body);
  });

  it('Simple type with subscription', () => {
    var body = `
type HelloScalars {
  str: String
  int: Int
  bool: Boolean
}

type Subscription {
  subscribeHelloScalars(str: String, int: Int, bool: Boolean): HelloScalars
}
`;
    var output = cycleOutput(body, 'HelloScalars', null, 'Subscription');
    expect(output).to.equal(body);
  });

  it('Unreferenced type implementing referenced interface', () => {
    var body = `
type Concrete implements Iface {
  key: String
}

interface Iface {
  key: String
}

type Query {
  iface: Iface
}
`;
    var output = cycleOutput(body, 'Query');
    expect(output).to.equal(body);
  });

  it('Unreferenced type implementing referenced union', () => {
    var body = `
type Concrete {
  key: String
}

type Query {
  union: Union
}

union Union = Concrete
`;
    var output = cycleOutput(body, 'Query');
    expect(output).to.equal(body);
  });
});

describe('Schema Parser Failures', () => {
  it('Unknown type referenced', () => {
    var body = `
type Hello {
  bar: Bar
}
`;
    var doc = parse(body);
    expect(() => buildASTSchema(doc, 'Hello'))
      .to.throw('Type Bar not found in document');
  });

  it('Unknown type in interface list', () => {
    var body = `
type Hello implements Bar { }
`;
    var doc = parse(body);
    expect(() => buildASTSchema(doc, 'Hello'))
      .to.throw('Type Bar not found in document');
  });

  it('Unknown type in union list', () => {
    var body = `
union TestUnion = Bar
type Hello { testUnion: TestUnion }
`;
    var doc = parse(body);
    expect(() => buildASTSchema(doc, 'Hello'))
      .to.throw('Type Bar not found in document');
  });

  it('Unknown query type', () => {
    var body = `
type Hello {
  str: String
}
`;
    var doc = parse(body);
    expect(() => buildASTSchema(doc, 'Wat'))
      .to.throw('Specified query type Wat not found in document');
  });

  it('Unknown mutation type', () => {
    var body = `
type Hello {
  str: String
}
`;
    var doc = parse(body);
    expect(() => buildASTSchema(doc, 'Hello', 'Wat'))
      .to.throw('Specified mutation type Wat not found in document');
  });

  it('Unknown subscription type', () => {
    var body = `
type Hello {
  str: String
}

type Wat {
  str: String
}
`;
    var doc = parse(body);
    expect(() => buildASTSchema(doc, 'Hello', 'Wat', 'Awesome'))
      .to.throw('Specified subscription type Awesome not found in document');
  });

  it('Rejects query names', () => {
    var body = `query Foo { field }`;
    var doc = parse(body);
    expect(() => buildASTSchema(doc, 'Foo'))
      .to.throw('Specified query type Foo not found in document.');
  });

  it('Rejects fragment names', () => {
    var body = `fragment Foo on Type { field }`;
    var doc = parse(body);
    expect(() => buildASTSchema(doc, 'Foo'))
      .to.throw('Specified query type Foo not found in document.');
  });

});
