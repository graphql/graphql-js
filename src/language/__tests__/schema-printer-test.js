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

## description of 'Foo'
## with multiple lines
type Foo implements Bar {
  ## description of field 'one'
  one: Type
  two(argument: InputType!): Type
  three(argument: InputType, other: String): Int
  four(argument: String = "string"): String
  five(argument: [String] = ["string", "string"]): String
  six(argument: InputType = {key: "value"}): Type
}

## description of 'AnnotatedObject'
type AnnotatedObject @onObject(arg: "value") {
  annotatedField(arg: Type = "default" @onArg): Type @onField
}

## description of 'Bar'
interface Bar {
  one: Type
  ## description of field 'four'
  four(argument: String = "string"): String
}

## description of 'AnnotatedInterface'
interface AnnotatedInterface @onInterface {
  annotatedField(arg: Type @onArg): Type @onField
}

## description of 'Feed'
union Feed = Story | Article | Advert

## description of 'AnnotatedUnion'
union AnnotatedUnion @onUnion = A | B

## description of 'CustomScalar'
scalar CustomScalar

## description of 'AnnotatedScalar'
scalar AnnotatedScalar @onScalar

## description of 'Site'
enum Site {
  DESKTOP
  ## description of enum value 'MOBILE'
  MOBILE
}

## description of 'AnnotatedEnum'
enum AnnotatedEnum @onEnum {
  ## description of enum value 'ANNOTATED_VALUE'
  ANNOTATED_VALUE @onEnumValue
  ## description of enum value 'OTHER_VALUE'
  OTHER_VALUE
}

## description of 'InputType'
input InputType {
  key: String!
  ## description of field 'answer'
  answer: Int = 42
}

## description of 'AnnotatedInput'
input AnnotatedInput @onInputObjectType {
  annotatedField: Type @onField
}

extend type Foo {
  ## description of field 'seven'
  seven(argument: [String]): Type
}

extend type Foo @onType {}

## description of 'NoFields'
type NoFields {}

## description of '@skip'
directive @skip(if: Boolean!) on FIELD | FRAGMENT_SPREAD | INLINE_FRAGMENT

## description of '@include'
directive @include(if: Boolean!) on FIELD | FRAGMENT_SPREAD | INLINE_FRAGMENT
`);

  });
});
