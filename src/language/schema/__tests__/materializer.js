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
import { parseSchema } from '../parser';
import { materializeSchema } from '../materializer';
import { printSchema } from '../../../type/printer';
import { introspectionQuery } from '../../../type/introspectionQuery';
import { graphql } from '../../../';

// 80+ char lines are useful in describe/it, so ignore in this file.
/*eslint-disable max-len */

function printForTest(result) {
  return '\n' + printSchema(result) + '\n';
}

async function getOutput(body, queryType) {
  var doc = parseSchema(body);
  var schema = materializeSchema(doc, queryType);
  var result = await graphql(schema, introspectionQuery);
  return await printForTest(result);
}

describe('Schema Materializer', () => {
  it('Simple type', async () => {
    var body = `
type HelloScalars {
  str: String
  int: Int
  bool: Boolean
}
`;
    var output = await getOutput(body, 'HelloScalars');
    expect(output).to.equal(body);
  });

  it('Type modifiers', async () => {
    var body = `
type HelloScalars {
  nonNullStr: String!
  listOfStrs: [String]
  listOfNonNullStrs: [String!]
  nonNullListOfStrs: [String]!
  nonNullListOfNonNullStrs: [String!]!
}
`;
    var output = await getOutput(body, 'HelloScalars');
    expect(output).to.equal(body);
  });


  it('Recursive type', async () => {
    var body = `
type Recurse {
  str: String
  recurse: Recurse
}
`;
    var output = await getOutput(body, 'Recurse');
    expect(output).to.equal(body);
  });

  it('Two types circular', async () => {
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
    var output = await getOutput(body, 'TypeOne');
    expect(output).to.equal(body);
  });

  it('Single argument field', async () => {
    var body = `
type Hello {
  str(int: Int): String
}
`;
    var output = await getOutput(body, 'Hello');
    expect(output).to.equal(body);
  });

  it('Simple type with multiple arguments', async () => {
    var body = `
type Hello {
  str(int: Int, bool: Boolean): String
}
`;
    var output = await getOutput(body, 'Hello');
    expect(output).to.equal(body);
  });

  it('Simple type with interface', async () => {
    var body = `
type HelloInterface implements WorldInterface {
  str: String
}

interface WorldInterface {
  str: String
}
`;
    var output = await getOutput(body, 'HelloInterface');
    expect(output).to.equal(body);
  });

  it('Simple output enum', async () => {
    var body = `
enum Hello {
  WORLD
}

type OutputEnumRoot {
  hello: Hello
}
`;
    var output = await getOutput(body, 'OutputEnumRoot');
    expect(output).to.equal(body);
  });

  it('Simple input enum', async () => {
    var body = `
enum Hello {
  WORLD
}

type InputEnumRoot {
  str(hello: Hello): String
}
`;
    var output = await getOutput(body, 'InputEnumRoot');
    expect(output).to.equal(body);
  });

  it('Multiple value enum', async () => {
    var body = `
enum Hello {
  WO
  RLD
}

type OutputEnumRoot {
  hello: Hello
}
`;
    var output = await getOutput(body, 'OutputEnumRoot');
    expect(output).to.equal(body);
  });

  it('Simple Union', async () => {
    var body = `
union Hello = World

type Root {
  hello: Hello
}

type World {
  str: String
}
`;
    var output = await getOutput(body, 'Root');
    expect(output).to.equal(body);
  });

  it('Multiple Union', async () => {
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
    var output = await getOutput(body, 'Root');
    expect(output).to.equal(body);
  });

  it('Simple Union', async () => {
    var body = `
scalar CustomScalar

type Root {
  customScalar: CustomScalar
}
`;

    var output = await getOutput(body, 'Root');
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

    var output = await getOutput(body, 'Root');
    expect(output).to.equal(body);
  });

  it('Simple argument field with default', async () => {
    var body = `
type Hello {
  str(int: Int = 2): String
}
`;
    var output = await getOutput(body, 'Hello');
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
    var doc = parseSchema(body);
    expect(() => materializeSchema(doc, 'Hello')).to.throw('Type Bar not found in document');
  });

  it('Unknown type in interface list', () => {
    var body = `
type Hello implements Bar { }
`;
    var doc = parseSchema(body);
    expect(() => materializeSchema(doc, 'Hello')).to.throw('Type Bar not found in document');
  });

  it('Unknown type in union list', () => {
    var body = `
union TestUnion = Bar
type Hello { testUnion: TestUnion }
`;
    var doc = parseSchema(body);
    expect(() => materializeSchema(doc, 'Hello')).to.throw('Type Bar not found in document');
  });


  it('Unknown query type', () => {
    var body = `
type Hello {
  str: String
}
`;
    var doc = parseSchema(body);
    expect(() => materializeSchema(doc, 'Wat')).to.throw('Type Wat not found in document');
  });
});
