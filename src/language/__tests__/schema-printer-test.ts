import { expect } from 'chai';
import { describe, it } from 'mocha';

import { dedent } from '../../__testUtils__/dedent';
import { kitchenSinkSDL } from '../../__testUtils__/kitchenSinkSDL';

import { Kind } from '../kinds';
import { parse } from '../parser';
import { print } from '../printer';

describe('Printer: SDL document', () => {
  it('prints minimal ast', () => {
    const ast = {
      kind: Kind.SCALAR_TYPE_DEFINITION,
      name: { kind: Kind.NAME, value: 'foo' },
    } as const;
    expect(print(ast)).to.equal('scalar foo');
  });

  it('produces helpful error messages', () => {
    const badAST = { random: 'Data' };

    // @ts-expect-error
    expect(() => print(badAST)).to.throw(
      'Invalid AST Node: { random: "Data" }.',
    );
  });

  it('prints kitchen sink without altering ast', () => {
    const ast = parse(kitchenSinkSDL, { noLocation: true });

    const astBeforePrintCall = JSON.stringify(ast);
    const printed = print(ast);
    const printedAST = parse(printed, { noLocation: true });

    expect(printedAST).to.deep.equal(ast);
    expect(JSON.stringify(ast)).to.equal(astBeforePrintCall);

    expect(printed).to.equal(dedent`
      """This is a description of the schema as a whole."""
      schema {
        query: QueryType
        mutation: MutationType
      }

      """
      This is a description
      of the \`Foo\` type.
      """
      type Foo implements Bar & Baz & Two {
        "Description of the \`one\` field."
        one: Type
        """This is a description of the \`two\` field."""
        two(
          """This is a description of the \`argument\` argument."""
          argument: InputType!
        ): Type
        """This is a description of the \`three\` field."""
        three(argument: InputType, other: String): Int
        four(argument: String = "string"): String
        five(argument: [String] = ["string", "string"]): String
        six(argument: InputType = {key: "value"}): Type
        seven(argument: Int = null): Type
      }

      type AnnotatedObject @onObject(arg: "value") {
        annotatedField(arg: Type = "default" @onArgumentDefinition): Type @onField
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
        annotatedField(arg: Type @onArgumentDefinition): Type @onField
      }

      interface UndefinedInterface

      extend interface Bar implements Two {
        two(argument: InputType!): Type
      }

      extend interface Bar @onInterface

      interface Baz implements Bar & Two {
        one: Type
        two(argument: InputType!): Type
        four(argument: String = "string"): String
      }

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
        """This is a description of the \`DESKTOP\` value"""
        DESKTOP
        """This is a description of the \`MOBILE\` value"""
        MOBILE
        "This is a description of the \`WEB\` value"
        WEB
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
        annotatedField: Type @onInputFieldDefinition
      }

      input UndefinedInput

      extend input InputType {
        other: Float = 1.23e4 @onInputFieldDefinition
      }

      extend input InputType @onInputObject

      """This is a description of the \`@skip\` directive"""
      directive @skip(
        """This is a description of the \`if\` argument"""
        if: Boolean! @onArgumentDefinition
      ) on FIELD | FRAGMENT_SPREAD | INLINE_FRAGMENT

      directive @include(if: Boolean!) on FIELD | FRAGMENT_SPREAD | INLINE_FRAGMENT

      directive @include2(if: Boolean!) on FIELD | FRAGMENT_SPREAD | INLINE_FRAGMENT

      directive @myRepeatableDir(name: String!) repeatable on OBJECT | INTERFACE

      extend schema @onSchema

      extend schema @onSchema {
        subscription: SubscriptionType
      }
    `);
  });
});
