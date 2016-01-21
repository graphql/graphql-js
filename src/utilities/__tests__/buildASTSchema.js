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
  const ast = parse(body);
  const schema = buildASTSchema(ast, queryType, mutationType, subscriptionType);
  return '\n' + printSchema(schema);
}

describe('Schema Materializer', () => {
  it('Simple type', () => {
    const body = `
type HelloScalars {
  str: String
  int: Int
  float: Float
  id: ID
  bool: Boolean
}
`;
    const output = cycleOutput(body, 'HelloScalars');
    expect(output).to.equal(body);
  });

  it('Type modifiers', () => {
    const body = `
type HelloScalars {
  nonNullStr: String!
  listOfStrs: [String]
  listOfNonNullStrs: [String!]
  nonNullListOfStrs: [String]!
  nonNullListOfNonNullStrs: [String!]!
}
`;
    const output = cycleOutput(body, 'HelloScalars');
    expect(output).to.equal(body);
  });


  it('Recursive type', () => {
    const body = `
type Recurse {
  str: String
  recurse: Recurse
}
`;
    const output = cycleOutput(body, 'Recurse');
    expect(output).to.equal(body);
  });

  it('Two types circular', () => {
    const body = `
type TypeOne {
  str: String
  typeTwo: TypeTwo
}

type TypeTwo {
  str: String
  typeOne: TypeOne
}
`;
    const output = cycleOutput(body, 'TypeOne');
    expect(output).to.equal(body);
  });

  it('Single argument field', () => {
    const body = `
type Hello {
  str(int: Int): String
  floatToStr(float: Float): String
  idToStr(id: ID): String
  booleanToStr(bool: Boolean): String
  strToStr(bool: String): String
}
`;
    const output = cycleOutput(body, 'Hello');
    expect(output).to.equal(body);
  });

  it('Simple type with multiple arguments', () => {
    const body = `
type Hello {
  str(int: Int, bool: Boolean): String
}
`;
    const output = cycleOutput(body, 'Hello');
    expect(output).to.equal(body);
  });

  it('Simple type with interface', () => {
    const body = `
type HelloInterface implements WorldInterface {
  str: String
}

interface WorldInterface {
  str: String
}
`;
    const output = cycleOutput(body, 'HelloInterface');
    expect(output).to.equal(body);
  });

  it('Simple output enum', () => {
    const body = `
enum Hello {
  WORLD
}

type OutputEnumRoot {
  hello: Hello
}
`;
    const output = cycleOutput(body, 'OutputEnumRoot');
    expect(output).to.equal(body);
  });

  it('Simple input enum', () => {
    const body = `
enum Hello {
  WORLD
}

type InputEnumRoot {
  str(hello: Hello): String
}
`;
    const output = cycleOutput(body, 'InputEnumRoot');
    expect(output).to.equal(body);
  });

  it('Multiple value enum', () => {
    const body = `
enum Hello {
  WO
  RLD
}

type OutputEnumRoot {
  hello: Hello
}
`;
    const output = cycleOutput(body, 'OutputEnumRoot');
    expect(output).to.equal(body);
  });

  it('Simple Union', () => {
    const body = `
union Hello = World

type Root {
  hello: Hello
}

type World {
  str: String
}
`;
    const output = cycleOutput(body, 'Root');
    expect(output).to.equal(body);
  });

  it('Multiple Union', () => {
    const body = `
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
    const output = cycleOutput(body, 'Root');
    expect(output).to.equal(body);
  });

  it('Custom Scalar', () => {
    const body = `
scalar CustomScalar

type Root {
  customScalar: CustomScalar
}
`;

    const output = cycleOutput(body, 'Root');
    expect(output).to.equal(body);
  });

  it('Input Object', async() => {
    const body = `
input Input {
  int: Int
}

type Root {
  field(in: Input): String
}
`;

    const output = cycleOutput(body, 'Root');
    expect(output).to.equal(body);
  });

  it('Simple argument field with default', () => {
    const body = `
type Hello {
  str(int: Int = 2): String
}
`;
    const output = cycleOutput(body, 'Hello');
    expect(output).to.equal(body);
  });

  it('Simple type with mutation', () => {
    const body = `
type HelloScalars {
  str: String
  int: Int
  bool: Boolean
}

type Mutation {
  addHelloScalars(str: String, int: Int, bool: Boolean): HelloScalars
}
`;
    const output = cycleOutput(body, 'HelloScalars', 'Mutation');
    expect(output).to.equal(body);
  });

  it('Simple type with subscription', () => {
    const body = `
type HelloScalars {
  str: String
  int: Int
  bool: Boolean
}

type Subscription {
  subscribeHelloScalars(str: String, int: Int, bool: Boolean): HelloScalars
}
`;
    const output = cycleOutput(body, 'HelloScalars', null, 'Subscription');
    expect(output).to.equal(body);
  });

  it('Unreferenced type implementing referenced interface', () => {
    const body = `
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
    const output = cycleOutput(body, 'Query');
    expect(output).to.equal(body);
  });

  it('Unreferenced type implementing referenced union', () => {
    const body = `
type Concrete {
  key: String
}

type Query {
  union: Union
}

union Union = Concrete
`;
    const output = cycleOutput(body, 'Query');
    expect(output).to.equal(body);
  });
});

describe('Schema Parser Failures', () => {
  it('Unknown type referenced', () => {
    const body = `
type Hello {
  bar: Bar
}
`;
    const doc = parse(body);
    expect(() => buildASTSchema(doc, 'Hello'))
      .to.throw('Type Bar not found in document');
  });

  it('Unknown type in interface list', () => {
    const body = `
type Hello implements Bar { }
`;
    const doc = parse(body);
    expect(() => buildASTSchema(doc, 'Hello'))
      .to.throw('Type Bar not found in document');
  });

  it('Unknown type in union list', () => {
    const body = `
union TestUnion = Bar
type Hello { testUnion: TestUnion }
`;
    const doc = parse(body);
    expect(() => buildASTSchema(doc, 'Hello'))
      .to.throw('Type Bar not found in document');
  });

  it('Unknown query type', () => {
    const body = `
type Hello {
  str: String
}
`;
    const doc = parse(body);
    expect(() => buildASTSchema(doc, 'Wat'))
      .to.throw('Specified query type Wat not found in document');
  });

  it('Unknown mutation type', () => {
    const body = `
type Hello {
  str: String
}
`;
    const doc = parse(body);
    expect(() => buildASTSchema(doc, 'Hello', 'Wat'))
      .to.throw('Specified mutation type Wat not found in document');
  });

  it('Unknown subscription type', () => {
    const body = `
type Hello {
  str: String
}

type Wat {
  str: String
}
`;
    const doc = parse(body);
    expect(() => buildASTSchema(doc, 'Hello', 'Wat', 'Awesome'))
      .to.throw('Specified subscription type Awesome not found in document');
  });

  it('Rejects query names', () => {
    const body = `query Foo { field }`;
    const doc = parse(body);
    expect(() => buildASTSchema(doc, 'Foo'))
      .to.throw('Specified query type Foo not found in document.');
  });

  it('Rejects fragment names', () => {
    const body = `fragment Foo on Type { field }`;
    const doc = parse(body);
    expect(() => buildASTSchema(doc, 'Foo'))
      .to.throw('Specified query type Foo not found in document.');
  });

});
