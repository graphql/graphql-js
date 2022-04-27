import { expect } from 'chai';
import { describe, it } from 'mocha';

import { dedent, dedentString } from '../../__testUtils__/dedent';
import { kitchenSinkQuery } from '../../__testUtils__/kitchenSinkQuery';

import { Kind } from '../kinds';
import { parse } from '../parser';
import { print } from '../printer';

describe('Printer: Query document', () => {
  it('prints minimal ast', () => {
    const ast = {
      kind: Kind.FIELD,
      name: { kind: Kind.NAME, value: 'foo' },
    } as const;
    expect(print(ast)).to.equal('foo');
  });

  it('produces helpful error messages', () => {
    const badAST = { random: 'Data' };

    // @ts-expect-error
    expect(() => print(badAST)).to.throw(
      'Invalid AST Node: { random: "Data" }.',
    );
  });

  it('correctly prints non-query operations without name', () => {
    const queryASTShorthanded = parse('query { id, name }');
    expect(print(queryASTShorthanded)).to.equal(dedent`
      {
        id
        name
      }
    `);

    const mutationAST = parse('mutation { id, name }');
    expect(print(mutationAST)).to.equal(dedent`
      mutation {
        id
        name
      }
    `);

    const queryASTWithArtifacts = parse(
      '"Query description" query ($foo: TestType) @testDirective { id, name }',
    );
    expect(print(queryASTWithArtifacts)).to.equal(dedent`
      "Query description"
      query ($foo: TestType) @testDirective {
        id
        name
      }
    `);

    const mutationASTWithArtifacts = parse(
      '"Mutation description" mutation ($foo: TestType) @testDirective { id, name }',
    );
    expect(print(mutationASTWithArtifacts)).to.equal(dedent`
      "Mutation description"
      mutation ($foo: TestType) @testDirective {
        id
        name
      }
    `);
  });

  it('prints query with variable directives', () => {
    const queryASTWithVariableDirective = parse(
      'query ("Variable description" $foo: TestType = {a: 123} @testDirective(if: true) @test) { id }',
    );
    expect(print(queryASTWithVariableDirective)).to.equal(dedent`
      query (
        "Variable description"
        $foo: TestType = {a: 123} @testDirective(if: true) @test
      ) {
        id
      }
    `);
  });

  it('keeps arguments on one line if line is short (<= 80 chars)', () => {
    const printed = print(
      parse('{trip(wheelchair:false arriveBy:false){dateTime}}'),
    );

    expect(printed).to.equal(dedent`
      {
        trip(wheelchair: false, arriveBy: false) {
          dateTime
        }
      }
    `);
  });

  it('puts arguments on multiple lines if line is long (> 80 chars)', () => {
    const printed = print(
      parse(
        '{trip(wheelchair:false arriveBy:false includePlannedCancellations:true transitDistanceReluctance:2000){dateTime}}',
      ),
    );

    expect(printed).to.equal(dedent`
      {
        trip(
          wheelchair: false
          arriveBy: false
          includePlannedCancellations: true
          transitDistanceReluctance: 2000
        ) {
          dateTime
        }
      }
    `);
  });

  it('prints fragment', () => {
    const printed = print(
      parse('"Fragment description" fragment Foo on Bar { baz }'),
    );

    expect(printed).to.equal(dedent`
      "Fragment description"
      fragment Foo on Bar {
        baz
      }
    `);
  });

  it('Legacy: prints fragment with variable directives', () => {
    const queryASTWithVariableDirective = parse(
      'fragment Foo($foo: TestType @test) on TestType @testDirective { id }',
      { allowLegacyFragmentVariables: true },
    );
    expect(print(queryASTWithVariableDirective)).to.equal(dedent`
      fragment Foo($foo: TestType @test) on TestType @testDirective {
        id
      }
    `);
  });

  it('Legacy: correctly prints fragment defined variables', () => {
    const fragmentWithVariable = parse(
      `
        fragment Foo($a: ComplexType, $b: Boolean = false) on TestType {
          id
        }
      `,
      { allowLegacyFragmentVariables: true },
    );
    expect(print(fragmentWithVariable)).to.equal(dedent`
      fragment Foo($a: ComplexType, $b: Boolean = false) on TestType {
        id
      }
    `);
  });

  it('prints kitchen sink without altering ast', () => {
    const ast = parse(kitchenSinkQuery, { noLocation: true });

    const astBeforePrintCall = JSON.stringify(ast);
    const printed = print(ast);
    const printedAST = parse(printed, { noLocation: true });

    expect(printedAST).to.deep.equal(ast);
    expect(JSON.stringify(ast)).to.equal(astBeforePrintCall);

    expect(printed).to.equal(
      dedentString(String.raw`
      "Query description"
      query queryName(
        "Very complex variable"
        $foo: ComplexType
        $site: Site = MOBILE
      ) @onQuery {
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

      subscription StoryLikeSubscription($input: StoryLikeSubscribeInput @onVariableDefinition) @onSubscription {
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

      """Fragment description"""
      fragment frag on Friend @onFragmentDefinition {
        foo(
          size: $size
          bar: $b
          obj: {key: "value", block: """
          block string uses \"""
          """}
        )
      }

      {
        unnamed(truthy: true, falsy: false, nullish: null)
        query
      }

      {
        __typename
      }
    `),
    );
  });
});
