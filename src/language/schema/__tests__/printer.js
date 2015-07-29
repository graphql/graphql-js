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
import { readFileSync } from 'fs';
import { join } from 'path';
import { parseSchemaIntoAST } from '../parser';
import { printSchema } from '../printer';

describe('Printer', () => {

  it('prints minimal ast', () => {
    var ast = {
      kind: 'ScalarDefinition',
      name: { kind: 'Name', value: 'foo' }
    };
    expect(printSchema(ast)).to.equal('scalar foo');
  });

  it('produces helpful error messages', () => {
    var badAst1 = { random: 'Data' };
    expect(() => printSchema(badAst1)).to.throw(
      'Invalid AST Node: {"random":"Data"}'
    );
  });

  var kitchenSink = readFileSync(
    join(__dirname, '/schema-kitchen-sink.graphql'),
    { encoding: 'utf8' }
  );

  it('does not alter ast', () => {
    var ast = parseSchemaIntoAST(kitchenSink);
    var astCopy = JSON.parse(JSON.stringify(ast));
    printSchema(ast);
    expect(ast).to.deep.equal(astCopy);
  });

  it('prints kitchen sink', () => {

    var ast = parseSchemaIntoAST(kitchenSink);

    var printed = printSchema(ast);

    expect(printed).to.equal(
`type Foo implements Bar {
  one: Type
  two(argument: InputType!): Type
  three(argument: InputType, other: String): Int
  four(argument: String = "string"): String
  five(argument: [String] = ["string", "string"]): String
  six(argument: InputType = {key: "value"}): Type
}

interface Bar {
  one: Type
  four(argument: String = "string"): String
}

union Feed = Story | Article | Advert

scalar CustomScalar

enum Site {
  DESKTOP
  MOBILE
}

input InputType {
  key: String!
  answer: Int = 42
}
`);

  });
});
