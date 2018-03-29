/**
 * Copyright (c) 2015-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { expect } from 'chai';
import { describe, it } from 'mocha';
import { readFileSync } from 'fs';
import { join } from 'path';
import { parse } from '../parser';
import { print } from '../printer';
import dedent from '../../jsutils/dedent';

describe('Printer: SDL document', () => {
  it('prints minimal ast', () => {
    const ast = {
      kind: 'ScalarTypeDefinition',
      name: { kind: 'Name', value: 'foo' },
    };
    expect(print(ast)).to.equal('scalar foo');
  });

  it('produces helpful error messages', () => {
    const badAst1 = { random: 'Data' };
    expect(() => print(badAst1)).to.throw(
      'Invalid AST Node: {"random":"Data"}',
    );
  });

  const kitchenSink = readFileSync(
    join(__dirname, '/schema-kitchen-sink.graphql'),
    { encoding: 'utf8' },
  );

  it('does not alter ast', () => {
    const ast = parse(kitchenSink);
    const astBefore = JSON.stringify(ast);
    print(ast);
    expect(JSON.stringify(ast)).to.equal(astBefore);
  });

  it('prints kitchen sink', () => {
    const ast = parse(kitchenSink);

    const printed = print(ast);

    expect(printed).to.equal(dedent`
      schema {
        query: QueryType
        mutation: MutationType
      }

      """
      This is a description
      of the \`Foo\` type.
      """
      type Foo implements Bar & Baz {
        one: Type
        """
        This is a description of the \`two\` field.
        """
        two(
          """
          This is a description of the \`argument\` argument.
          """
          argument: InputType!
        ): Type
        three(argument: InputType, other: String): Int
        four(argument: String = "string"): String
        five(argument: [String] = ["string", "string"]): String
        six(argument: InputType = {key: "value"}): Type
        seven(argument: Int = null): Type
      }

      type AnnotatedObject @onObject(arg: "value") {
        annotatedField(arg: Type = "default" @onArg): Type @onField
      }

      type UndefinedType

      extend type Foo {
        seven(argument: [String]): Type
      }

      extend type Foo @onType

      interface Bar {
        one: Type
        four(argument: String = "string"): String
      }

      interface AnnotatedInterface @onInterface {
        annotatedField(arg: Type @onArg): Type @onField
      }

      interface UndefinedInterface

      extend interface Bar {
        two(argument: InputType!): Type
      }

      extend interface Bar @onInterface

      union Feed = Story | Article | Advert

      union AnnotatedUnion @onUnion = A | B

      union AnnotatedUnionTwo @onUnion = A | B

      union UndefinedUnion

      extend union Feed = Photo | Video

      extend union Feed @onUnion

      scalar CustomScalar

      scalar AnnotatedScalar @onScalar

      extend scalar CustomScalar @onScalar

      enum Site {
        DESKTOP
        MOBILE
      }

      enum AnnotatedEnum @onEnum {
        ANNOTATED_VALUE @onEnumValue
        OTHER_VALUE
      }

      enum UndefinedEnum

      extend enum Site {
        VR
      }

      extend enum Site @onEnum

      input InputType {
        key: String!
        answer: Int = 42
      }

      input AnnotatedInput @onInputObject {
        annotatedField: Type @onField
      }

      input UndefinedInput

      extend input InputType {
        other: Float = 1.23e4
      }

      extend input InputType @onInputObject

      directive @skip(if: Boolean!) on FIELD | FRAGMENT_SPREAD | INLINE_FRAGMENT

      directive @include(if: Boolean!) on FIELD | FRAGMENT_SPREAD | INLINE_FRAGMENT

      directive @include2(if: Boolean!) on FIELD | FRAGMENT_SPREAD | INLINE_FRAGMENT
    `);
  });
});
