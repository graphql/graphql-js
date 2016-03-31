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
function cycleOutput(body) {
  const ast = parse(body);
  const schema = buildASTSchema(ast);
  return '\n' + printSchema(schema);
}

describe('Schema Builder', () => {
  it('Simple type', () => {
    const body = `
schema {
  query: HelloScalars
}

type HelloScalars {
  str: String
  int: Int
  float: Float
  id: ID
  bool: Boolean
}
`;
    const output = cycleOutput(body);
    expect(output).to.equal(body);
  });

  it('With directives', () => {
    const body = `
schema {
  query: Hello
}

directive @foo(arg: Int) on FIELD

type Hello {
  str: String
}
`;
    const output = cycleOutput(body);
    expect(output).to.equal(body);
  });

  it('Type modifiers', () => {
    const body = `
schema {
  query: HelloScalars
}

type HelloScalars {
  nonNullStr: String!
  listOfStrs: [String]
  listOfNonNullStrs: [String!]
  nonNullListOfStrs: [String]!
  nonNullListOfNonNullStrs: [String!]!
}
`;
    const output = cycleOutput(body);
    expect(output).to.equal(body);
  });


  it('Recursive type', () => {
    const body = `
schema {
  query: Recurse
}

type Recurse {
  str: String
  recurse: Recurse
}
`;
    const output = cycleOutput(body);
    expect(output).to.equal(body);
  });

  it('Two types circular', () => {
    const body = `
schema {
  query: TypeOne
}

type TypeOne {
  str: String
  typeTwo: TypeTwo
}

type TypeTwo {
  str: String
  typeOne: TypeOne
}
`;
    const output = cycleOutput(body);
    expect(output).to.equal(body);
  });

  it('Single argument field', () => {
    const body = `
schema {
  query: Hello
}

type Hello {
  str(int: Int): String
  floatToStr(float: Float): String
  idToStr(id: ID): String
  booleanToStr(bool: Boolean): String
  strToStr(bool: String): String
}
`;
    const output = cycleOutput(body);
    expect(output).to.equal(body);
  });

  it('Simple type with multiple arguments', () => {
    const body = `
schema {
  query: Hello
}

type Hello {
  str(int: Int, bool: Boolean): String
}
`;
    const output = cycleOutput(body, 'Hello');
    expect(output).to.equal(body);
  });

  it('Simple type with interface', () => {
    const body = `
schema {
  query: Hello
}

type Hello implements WorldInterface {
  str: String
}

interface WorldInterface {
  str: String
}
`;
    const output = cycleOutput(body, 'Hello');
    expect(output).to.equal(body);
  });

  it('Simple output enum', () => {
    const body = `
schema {
  query: OutputEnumRoot
}

enum Hello {
  WORLD
}

type OutputEnumRoot {
  hello: Hello
}
`;
    const output = cycleOutput(body);
    expect(output).to.equal(body);
  });

  it('Simple input enum', () => {
    const body = `
schema {
  query: InputEnumRoot
}

enum Hello {
  WORLD
}

type InputEnumRoot {
  str(hello: Hello): String
}
`;
    const output = cycleOutput(body);
    expect(output).to.equal(body);
  });

  it('Multiple value enum', () => {
    const body = `
schema {
  query: OutputEnumRoot
}

enum Hello {
  WO
  RLD
}

type OutputEnumRoot {
  hello: Hello
}
`;
    const output = cycleOutput(body);
    expect(output).to.equal(body);
  });

  it('Simple Union', () => {
    const body = `
schema {
  query: Root
}

union Hello = World

type Root {
  hello: Hello
}

type World {
  str: String
}
`;
    const output = cycleOutput(body);
    expect(output).to.equal(body);
  });

  it('Multiple Union', () => {
    const body = `
schema {
  query: Root
}

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
    const output = cycleOutput(body);
    expect(output).to.equal(body);
  });

  it('Custom Scalar', () => {
    const body = `
schema {
  query: Root
}

scalar CustomScalar

type Root {
  customScalar: CustomScalar
}
`;

    const output = cycleOutput(body);
    expect(output).to.equal(body);
  });

  it('Input Object', async() => {
    const body = `
schema {
  query: Root
}

input Input {
  int: Int
}

type Root {
  field(in: Input): String
}
`;

    const output = cycleOutput(body);
    expect(output).to.equal(body);
  });

  it('Simple argument field with default', () => {
    const body = `
schema {
  query: Hello
}

type Hello {
  str(int: Int = 2): String
}
`;
    const output = cycleOutput(body);
    expect(output).to.equal(body);
  });

  it('Simple type with mutation', () => {
    const body = `
schema {
  query: HelloScalars
  mutation: Mutation
}

type HelloScalars {
  str: String
  int: Int
  bool: Boolean
}

type Mutation {
  addHelloScalars(str: String, int: Int, bool: Boolean): HelloScalars
}
`;
    const output = cycleOutput(body);
    expect(output).to.equal(body);
  });

  it('Simple type with subscription', () => {
    const body = `
schema {
  query: HelloScalars
  subscription: Subscription
}

type HelloScalars {
  str: String
  int: Int
  bool: Boolean
}

type Subscription {
  subscribeHelloScalars(str: String, int: Int, bool: Boolean): HelloScalars
}
`;
    const output = cycleOutput(body);
    expect(output).to.equal(body);
  });

  it('Unreferenced type implementing referenced interface', () => {
    const body = `
schema {
  query: Query
}

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
    const output = cycleOutput(body);
    expect(output).to.equal(body);
  });

  it('Unreferenced type implementing referenced union', () => {
    const body = `
schema {
  query: Query
}

type Concrete {
  key: String
}

type Query {
  union: Union
}

union Union = Concrete
`;
    const output = cycleOutput(body);
    expect(output).to.equal(body);
  });
});

describe('Failures', () => {

  it('Requires a schema definition', () => {
    const body = `
type Hello {
  bar: Bar
}
`;
    const doc = parse(body);
    expect(() => buildASTSchema(doc))
      .to.throw('Must provide a schema definition.');
  });

  it('Allows only a single schema definition', () => {
    const body = `
schema {
  query: Hello
}

schema {
  query: Hello
}

type Hello {
  bar: Bar
}
`;
    const doc = parse(body);
    expect(() => buildASTSchema(doc))
      .to.throw('Must provide only one schema definition.');
  });

  it('Requires a query type', () => {
    const body = `
schema {
  mutation: Hello
}

type Hello {
  bar: Bar
}
`;
    const doc = parse(body);
    expect(() => buildASTSchema(doc))
      .to.throw('Must provide schema definition with query type.');
  });

  it('Allows only a single query type', () => {
    const body = `
schema {
  query: Hello
  query: Yellow
}

type Hello {
  bar: Bar
}

type Yellow {
  isColor: Boolean
}
`;
    const doc = parse(body);
    expect(() => buildASTSchema(doc))
      .to.throw('Must provide only one query type in schema.');
  });

  it('Allows only a single mutation type', () => {
    const body = `
schema {
  query: Hello
  mutation: Hello
  mutation: Yellow
}

type Hello {
  bar: Bar
}

type Yellow {
  isColor: Boolean
}
`;
    const doc = parse(body);
    expect(() => buildASTSchema(doc))
      .to.throw('Must provide only one mutation type in schema.');
  });

  it('Allows only a single subscription type', () => {
    const body = `
schema {
  query: Hello
  subscription: Hello
  subscription: Yellow
}

type Hello {
  bar: Bar
}

type Yellow {
  isColor: Boolean
}
`;
    const doc = parse(body);
    expect(() => buildASTSchema(doc))
      .to.throw('Must provide only one subscription type in schema.');
  });

  it('Unknown type referenced', () => {
    const body = `
schema {
  query: Hello
}

type Hello {
  bar: Bar
}
`;
    const doc = parse(body);
    expect(() => buildASTSchema(doc))
      .to.throw('Type "Bar" not found in document.');
  });

  it('Unknown type in interface list', () => {
    const body = `
schema {
  query: Hello
}

type Hello implements Bar { }
`;
    const doc = parse(body);
    expect(() => buildASTSchema(doc))
      .to.throw('Type "Bar" not found in document.');
  });

  it('Unknown type in union list', () => {
    const body = `
schema {
  query: Hello
}

union TestUnion = Bar
type Hello { testUnion: TestUnion }
`;
    const doc = parse(body);
    expect(() => buildASTSchema(doc))
      .to.throw('Type "Bar" not found in document.');
  });

  it('Unknown query type', () => {
    const body = `
schema {
  query: Wat
}

type Hello {
  str: String
}
`;
    const doc = parse(body);
    expect(() => buildASTSchema(doc))
      .to.throw('Specified query type "Wat" not found in document.');
  });

  it('Unknown mutation type', () => {
    const body = `
schema {
  query: Hello
  mutation: Wat
}

type Hello {
  str: String
}
`;
    const doc = parse(body);
    expect(() => buildASTSchema(doc))
      .to.throw('Specified mutation type "Wat" not found in document.');
  });

  it('Unknown subscription type', () => {
    const body = `
schema {
  query: Hello
  mutation: Wat
  subscription: Awesome
}

type Hello {
  str: String
}

type Wat {
  str: String
}
`;
    const doc = parse(body);
    expect(() => buildASTSchema(doc))
      .to.throw('Specified subscription type "Awesome" not found in document.');
  });

  it('Does not consider operation names', () => {
    const body = `
schema {
  query: Foo
}

query Foo { field }
`;
    const doc = parse(body);
    expect(() => buildASTSchema(doc))
      .to.throw('Specified query type "Foo" not found in document.');
  });

  it('Does not consider fragment names', () => {
    const body = `
schema {
  query: Foo
}

fragment Foo on Type { field }
`;
    const doc = parse(body);
    expect(() => buildASTSchema(doc))
      .to.throw('Specified query type "Foo" not found in document.');
  });

});
