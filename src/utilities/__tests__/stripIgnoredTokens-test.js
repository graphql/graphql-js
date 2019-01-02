/**
 * Copyright (c) 2015-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @noflow
 */

import { expect } from 'chai';
import { describe, it } from 'mocha';
import { parse } from '../../language/parser';
import { readFileSync } from 'fs';
import { print } from '../../language/printer';
import { join } from 'path';
import dedent from '../../jsutils/dedent';
import { stripIgnoredTokens } from '../stripIgnoredTokens';

describe('Strip ignored tokens: Query document', () => {
  const kitchenSink = readFileSync(
    join(
      __dirname,
      '../',
      '../',
      '/language',
      '/__tests__',
      '/kitchen-sink.graphql',
    ),
    {
      encoding: 'utf8',
    },
  );

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
        String.raw`{field(arg:"""
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
        String.raw`{field(arg:"""    space-led value "quoted string"
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

    const resultStripped = String.raw`query queryName($foo:ComplexType$site:Site=MOBILE)@onQuery{whoever123is:node(id:[123 456]){id...on User@onInlineFragment{field2{id alias:field1(first:10 after:$foo)@include(if:$foo){id...frag@onFragmentSpread}}}...@skip(unless:$foo){id}...{id}}}mutation likeStory@onMutation{like(story:123)@onField{story{id@onField}}}subscription StoryLikeSubscription($input:StoryLikeSubscribeInput)@onSubscription{storyLikeSubscribe(input:$input){story{likers{count}likeSentence{text}}}}fragment frag on Friend@onFragmentDefinition{foo(size:$size bar:$b obj:{key:"value" block:"""
    block string uses \"""
  """})}{unnamed(truthy:true falsey:false nullish:null)query}{__typename}`;

    expect(printedStripped).to.equal(resultStripped);

    expect(() => parse(printedStripped)).to.not.throw();

    const parsedStrippedAst = parse(printedStripped);

    const printedAgain = print(parsedStrippedAst);

    expect(printedAgain).to.equal(result);
  });
});
