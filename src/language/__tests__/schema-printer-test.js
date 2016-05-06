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
import { parse } from '../parser';
import { print } from '../printer';

describe('Printer', () => {

  it('prints minimal ast', () => {
    const ast = {
      kind: 'ScalarTypeDefinition',
      name: { kind: 'Name', value: 'foo' }
    };
    expect(print(ast)).to.equal('scalar foo');
  });

  it('produces helpful error messages', () => {
    const badAst1 = { random: 'Data' };
    expect(() => print(badAst1)).to.throw(
      'Invalid AST Node: {"random":"Data"}'
    );
  });

  const kitchenSink = readFileSync(
    join(__dirname, '/schema-kitchen-sink.graphql'),
    { encoding: 'utf8' }
  );

  it('does not alter ast', () => {
    const ast = parse(kitchenSink);
    const astCopy = JSON.parse(JSON.stringify(ast));
    print(ast);
    expect(ast).to.deep.equal(astCopy);
  });

  it('prints kitchen sink', () => {

    const ast = parse(kitchenSink);

    const printed = print(ast);

    /* eslint-disable max-len */
    expect(printed).to.equal(
`schema {
  query: QueryType
  mutation: MutationType
}

type Foo implements Bar {
  one: Type
  two(argument: InputType!): Type
  three(argument: InputType, other: String): Int
  four(argument: String = "string"): String
  five(argument: [String] = ["string", "string"]): String
  six(argument: InputType = {key: "value"}): Type
}

type AnnotatedObject @onObject(arg: "value") {
  annotatedField(arg: Type = "default" @onArg): Type @onField
}

interface Bar {
  one: Type
  four(argument: String = "string"): String
}

interface AnnotatedInterface @onInterface {
  annotatedField(arg: Type @onArg): Type @onField
}

union Feed = Story | Article | Advert

union AnnotatedUnion @onUnion = A | B

scalar CustomScalar

scalar AnnotatedScalar @onScalar

enum Site {
  DESKTOP
  MOBILE
}

enum AnnotatedEnum @onEnum {
  ANNOTATED_VALUE @onEnumValue
  OTHER_VALUE
}

input InputType {
  key: String!
  answer: Int = 42
}

input AnnotatedInput @onInputObjectType {
  annotatedField: Type @onField
}

extend type Foo {
  seven(argument: [String]): Type
}

extend type Foo @onType {}

type NoFields {}

directive @skip(if: Boolean!) on FIELD | FRAGMENT_SPREAD | INLINE_FRAGMENT

directive @include(if: Boolean!) on FIELD | FRAGMENT_SPREAD | INLINE_FRAGMENT
`);

  });
});
