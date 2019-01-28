/**
 * Copyright (c) 2015-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow strict
 */

import { expect } from 'chai';
import { describe, it } from 'mocha';
import { Source } from '../../language/source';
import { parse } from '../../language/parser';
import { print } from '../../language/printer';
import dedent from '../../jsutils/dedent';
import { stripIgnoredTokens } from '../stripIgnoredTokens';
import {
  kitchenSinkQuery,
  kitchenSinkSDL,
  strippedKitchenSinkQuery,
  strippedKitchenSinkSDL,
} from '../../__fixtures__';

describe('stripIgnoredTokens: Query document', () => {
  const kitchenSink = kitchenSinkQuery;

  it('does not alter ast', () => {
    const ast = parse(kitchenSink);
    const astBefore = JSON.stringify(ast);
    stripIgnoredTokens(print(ast));
    expect(JSON.stringify(ast)).to.equal(astBefore);
  });

  it('prints minimal ast', () => {
    const ast = { kind: 'Field', name: { kind: 'Name', value: 'foo' } };
    expect(stripIgnoredTokens(print(ast))).to.equal('foo');
  });

  it('produces helpful error messages', () => {
    const badAst1 = { random: 'Data' };
    expect(() => stripIgnoredTokens(print(badAst1))).to.throw(
      'Invalid AST Node: { random: "Data" }',
    );
  });

  it('prints Source', () => {
    expect(stripIgnoredTokens(new Source('query { id, name }'))).to.equal(
      'query{id name}',
    );
  });

  it('throws TypeError when not Source or string', () => {
    expect(() =>
      // $FlowFixMe
      stripIgnoredTokens(new Error('query { id, name }')),
    ).to.throw('Must provide Source. Received: {}');
  });

  it('correctly prints non-query operations without name', () => {
    const queryAstShorthanded = parse('query { id, name }');
    expect(stripIgnoredTokens(print(queryAstShorthanded))).to.equal(
      '{id name}',
    );
    expect(() =>
      parse(stripIgnoredTokens(print(queryAstShorthanded))),
    ).to.not.throw();

    const mutationAst = parse('mutation { id, name }');
    expect(stripIgnoredTokens(print(mutationAst))).to.equal(
      'mutation{id name}',
    );
    expect(() => parse(stripIgnoredTokens(print(mutationAst)))).to.not.throw();

    const queryAstWithArtifacts = parse(
      'query ($foo: TestType) @testDirective { id, name }',
    );
    expect(stripIgnoredTokens(print(queryAstWithArtifacts))).to.equal(
      'query($foo:TestType)@testDirective{id name}',
    );
    expect(() =>
      parse(stripIgnoredTokens(print(queryAstWithArtifacts))),
    ).to.not.throw();

    const mutationAstWithArtifacts = parse(
      'mutation ($foo: TestType) @testDirective { id, name }',
    );
    expect(stripIgnoredTokens(print(mutationAstWithArtifacts))).to.equal(
      'mutation($foo:TestType)@testDirective{id name}',
    );
    expect(() =>
      parse(stripIgnoredTokens(print(mutationAstWithArtifacts))),
    ).to.not.throw();
  });

  it('prints query with variable directives', () => {
    const queryAstWithVariableDirective = parse(
      'query ($foo: TestType = {a: 123} @testDirective(if: true) @test) { id }',
    );
    expect(stripIgnoredTokens(print(queryAstWithVariableDirective))).to.equal(
      'query($foo:TestType={a:123}@testDirective(if:true)@test){id}',
    );
    expect(() =>
      parse(stripIgnoredTokens(print(queryAstWithVariableDirective))),
    ).to.not.throw();
  });

  it('Experimental: prints fragment with variable directives', () => {
    const queryAstWithVariableDirective = parse(
      'fragment Foo($foo: TestType @test) on TestType @testDirective { id }',
      {
        experimentalFragmentVariables: true,
      },
    );
    const printedQueryAstWithVariableDirective = dedent`
      fragment Foo($foo: TestType @test) on TestType @testDirective {
        id
      }
    `;

    expect(stripIgnoredTokens(print(queryAstWithVariableDirective))).to.equal(
      'fragment Foo($foo:TestType@test)on TestType@testDirective{id}',
    );
    expect(() =>
      parse(stripIgnoredTokens(print(queryAstWithVariableDirective)), {
        experimentalFragmentVariables: true,
      }),
    ).to.not.throw();
    expect(
      print(
        parse(stripIgnoredTokens(print(queryAstWithVariableDirective)), {
          experimentalFragmentVariables: true,
        }),
      ),
    ).to.equal(printedQueryAstWithVariableDirective);
  });

  describe('block string', () => {
    it('correctly prints single-line with leading space', () => {
      const mutationAstWithArtifacts = parse(
        '{ field(arg: """    space-led value""") }',
      );
      expect(stripIgnoredTokens(print(mutationAstWithArtifacts))).to.equal(
        '{field(arg:"""    space-led value""")}',
      );
      expect(() =>
        parse(stripIgnoredTokens(print(mutationAstWithArtifacts))),
      ).to.not.throw();
    });

    it('correctly prints string with a first line indentation', () => {
      const mutationAstWithArtifacts = parse(`
        {
          field(arg: """
                first
              line
            indentation
          """)
        }
      `);
      expect(stripIgnoredTokens(print(mutationAstWithArtifacts))).to.equal(
        `{field(arg:"""
        first
      line
    indentation
  """)}`,
      );
      expect(() =>
        parse(stripIgnoredTokens(print(mutationAstWithArtifacts))),
      ).to.not.throw();
    });

    it('correctly prints single-line with leading space and quotation', () => {
      const mutationAstWithArtifacts = parse(`
        {
          field(arg: """    space-led value "quoted string"
          """)
        }
      `);
      expect(stripIgnoredTokens(print(mutationAstWithArtifacts))).to.equal(
        `{field(arg:"""    space-led value "quoted string"
  """)}`,
      );
      expect(() =>
        parse(stripIgnoredTokens(print(mutationAstWithArtifacts))),
      ).to.not.throw();
    });
  });

  it('Experimental: correctly prints fragment defined variables', () => {
    const fragmentWithVariable = parse(
      `
        fragment Foo($a: ComplexType, $b: Boolean = false) on TestType {
          id
        }
      `,
      { experimentalFragmentVariables: true },
    );
    expect(stripIgnoredTokens(print(fragmentWithVariable))).to.equal(
      'fragment Foo($a:ComplexType$b:Boolean=false)on TestType{id}',
    );
    expect(() =>
      parse(stripIgnoredTokens(print(fragmentWithVariable)), {
        experimentalFragmentVariables: true,
      }),
    ).to.not.throw();
  });

  it('prints kitchen sink', () => {
    const ast = parse(kitchenSink);

    const printed = print(ast);

    // $FlowFixMe workaround for: https://github.com/facebook/flow/issues/2616
    const result = dedent(String.raw`
      query queryName($foo: ComplexType, $site: Site = MOBILE) @onQuery {
        whoever123is: node(id: [123, 456]) {
          id
          ... on User @onInlineFragment {
            field2 {
              id
              alias: field1(first: 10, after: $foo) @include(if: $foo) {
                id
                ...frag @onFragmentSpread
              }
            }
          }
          ... @skip(unless: $foo) {
            id
          }
          ... {
            id
          }
        }
      }

      mutation likeStory @onMutation {
        like(story: 123) @onField {
          story {
            id @onField
          }
        }
      }

      subscription StoryLikeSubscription($input: StoryLikeSubscribeInput) @onSubscription {
        storyLikeSubscribe(input: $input) {
          story {
            likers {
              count
            }
            likeSentence {
              text
            }
          }
        }
      }

      fragment frag on Friend @onFragmentDefinition {
        foo(size: $size, bar: $b, obj: {key: "value", block: """
          block string uses \"""
        """})
      }

      {
        unnamed(truthy: true, falsey: false, nullish: null)
        query
      }

      {
        __typename
      }
    `);

    expect(printed).to.equal(result);

    const printedStripped = stripIgnoredTokens(print(ast));

    const resultStripped = strippedKitchenSinkQuery;

    expect(printedStripped).to.equal(resultStripped);

    expect(() => parse(printedStripped)).to.not.throw();

    const parsedStrippedAst = parse(printedStripped);

    const printedAgain = print(parsedStrippedAst);

    expect(printedAgain).to.equal(result);
  });
});

describe('stripIgnoredTokens: SDL document', () => {
  it('prints minimal ast', () => {
    const ast = {
      kind: 'ScalarTypeDefinition',
      name: { kind: 'Name', value: 'foo' },
    };
    expect(stripIgnoredTokens(print(ast))).to.equal('scalar foo');
  });

  it('produces helpful error messages', () => {
    const badAst1 = { random: 'Data' };
    expect(() => stripIgnoredTokens(print(badAst1))).to.throw(
      'Invalid AST Node: { random: "Data" }',
    );
  });

  const kitchenSink = kitchenSinkSDL;

  it('does not alter ast', () => {
    const ast = parse(kitchenSink);
    const astBefore = JSON.stringify(ast);
    stripIgnoredTokens(print(ast));
    expect(JSON.stringify(ast)).to.equal(astBefore);
  });

  it('prints kitchen sink', () => {
    const ast = parse(kitchenSink);

    const printed = print(ast);

    const result = dedent`
      schema {
        query: QueryType
        mutation: MutationType
      }

      """
      This is a description
      of the \`Foo\` type.
      """
      type Foo implements Bar & Baz {
        "Description of the \`one\` field."
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
        """
        This is a description of the \`three\` field.
        """
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
        """
        This is a description of the \`DESKTOP\` value
        """
        DESKTOP
        """
        This is a description of the \`MOBILE\` value
        """
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

      """
      This is a description of the \`@skip\` directive
      """
      directive @skip(if: Boolean! @onArgumentDefinition) on FIELD | FRAGMENT_SPREAD | INLINE_FRAGMENT

      directive @include(if: Boolean!) on FIELD | FRAGMENT_SPREAD | INLINE_FRAGMENT

      directive @include2(if: Boolean!) on FIELD | FRAGMENT_SPREAD | INLINE_FRAGMENT

      extend schema @onSchema

      extend schema @onSchema {
        subscription: SubscriptionType
      }
    `;

    expect(printed).to.equal(result);

    const printedStripped = stripIgnoredTokens(print(ast));

    const resultStripped = strippedKitchenSinkSDL;

    expect(printedStripped).to.equal(resultStripped);

    expect(() => parse(printedStripped)).to.not.throw();

    const parsedStrippedAst = parse(printedStripped);

    const printedAgain = print(parsedStrippedAst);

    expect(printedAgain).to.equal(result);
  });
});
