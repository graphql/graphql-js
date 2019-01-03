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
import { parse } from '../parser';
import { print } from '../printer';
import dedent from '../../jsutils/dedent';
import { kitchenSinkQuery } from '../../__fixtures__';

describe('Printer: Query document', () => {
  it('does not alter ast', () => {
    const ast = parse(kitchenSinkQuery);
    const astBefore = JSON.stringify(ast);
    print(ast);
    expect(JSON.stringify(ast)).to.equal(astBefore);
  });

  it('prints minimal ast', () => {
    const ast = { kind: 'Field', name: { kind: 'Name', value: 'foo' } };
    expect(print(ast)).to.equal('foo');
  });

  it('produces helpful error messages', () => {
    const badAst1 = { random: 'Data' };
    expect(() => print(badAst1)).to.throw(
      'Invalid AST Node: { random: "Data" }',
    );
  });

  it('correctly prints non-query operations without name', () => {
    const queryAstShorthanded = parse('query { id, name }');
    expect(print(queryAstShorthanded)).to.equal(dedent`
      {
        id
        name
      }
    `);

    const mutationAst = parse('mutation { id, name }');
    expect(print(mutationAst)).to.equal(dedent`
      mutation {
        id
        name
      }
    `);

    const queryAstWithArtifacts = parse(
      'query ($foo: TestType) @testDirective { id, name }',
    );
    expect(print(queryAstWithArtifacts)).to.equal(dedent`
      query ($foo: TestType) @testDirective {
        id
        name
      }
    `);

    const mutationAstWithArtifacts = parse(
      'mutation ($foo: TestType) @testDirective { id, name }',
    );
    expect(print(mutationAstWithArtifacts)).to.equal(dedent`
      mutation ($foo: TestType) @testDirective {
        id
        name
      }
    `);
  });

  it('prints query with variable directives', () => {
    const queryAstWithVariableDirective = parse(
      'query ($foo: TestType = {a: 123} @testDirective(if: true) @test) { id }',
    );
    expect(print(queryAstWithVariableDirective)).to.equal(dedent`
      query ($foo: TestType = {a: 123} @testDirective(if: true) @test) {
        id
      }
    `);
  });

  it('Experimental: prints fragment with variable directives', () => {
    const queryAstWithVariableDirective = parse(
      'fragment Foo($foo: TestType @test) on TestType @testDirective { id }',
      {
        experimentalFragmentVariables: true,
      },
    );
    expect(print(queryAstWithVariableDirective)).to.equal(dedent`
      fragment Foo($foo: TestType @test) on TestType @testDirective {
        id
      }
    `);
  });

  describe('block string', () => {
    it('correctly prints single-line with leading space', () => {
      const mutationAstWithArtifacts = parse(
        '{ field(arg: """    space-led value""") }',
      );
      expect(print(mutationAstWithArtifacts)).to.equal(dedent`
        {
          field(arg: """    space-led value""")
        }
      `);
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
      expect(print(mutationAstWithArtifacts)).to.equal(dedent`
        {
          field(arg: """
                first
              line
            indentation
          """)
        }
      `);
    });

    it('correctly prints single-line with leading space and quotation', () => {
      const mutationAstWithArtifacts = parse(`
        {
          field(arg: """    space-led value "quoted string"
          """)
        }
      `);
      expect(print(mutationAstWithArtifacts)).to.equal(dedent`
        {
          field(arg: """    space-led value "quoted string"
          """)
        }
      `);
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
    expect(print(fragmentWithVariable)).to.equal(dedent`
      fragment Foo($a: ComplexType, $b: Boolean = false) on TestType {
        id
      }
    `);
  });

  it('prints kitchen sink', () => {
    const printed = print(parse(kitchenSinkQuery));

    expect(printed).to.equal(
      dedent(String.raw`
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
    `),
    );
  });
});
