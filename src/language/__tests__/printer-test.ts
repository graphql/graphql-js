import { expect } from 'chai';
import { describe, it } from 'mocha';

import { dedent, dedentString } from '../../__testUtils__/dedent.js';
import { kitchenSinkQuery } from '../../__testUtils__/kitchenSinkQuery.js';

import { Kind } from '../kinds.js';
import { parse } from '../parser.js';
import { print } from '../printer.js';

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
      'query ($foo: TestType) @testDirective { id, name }',
    );
    expect(print(queryASTWithArtifacts)).to.equal(dedent`
      query ($foo: TestType) @testDirective {
        id
        name
      }
    `);

    const mutationASTWithArtifacts = parse(
      'mutation ($foo: TestType) @testDirective { id, name }',
    );
    expect(print(mutationASTWithArtifacts)).to.equal(dedent`
      mutation ($foo: TestType) @testDirective {
        id
        name
      }
    `);
  });

  it('prints query with variable directives', () => {
    const queryASTWithVariableDirective = parse(
      'query ($foo: TestType = { a: 123 } @testDirective(if: true) @test) { id }',
    );
    expect(print(queryASTWithVariableDirective)).to.equal(dedent`
      query ($foo: TestType = { a: 123 } @testDirective(if: true) @test) {
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

  it('puts large object values on multiple lines if line is long (> 80 chars)', () => {
    const printed = print(
      parse(
        '{trip(obj:{wheelchair:false,smallObj:{a: 1},largeObj:{wheelchair:false,smallObj:{a: 1},arriveBy:false,includePlannedCancellations:true,transitDistanceReluctance:2000,anotherLongFieldName:"Lots and lots and lots and lots of text"},arriveBy:false,includePlannedCancellations:true,transitDistanceReluctance:2000,anotherLongFieldName:"Lots and lots and lots and lots of text"}){dateTime}}',
      ),
    );

    expect(printed).to.equal(dedent`
      {
        trip(
          obj: {
            wheelchair: false
            smallObj: { a: 1 }
            largeObj: {
              wheelchair: false
              smallObj: { a: 1 }
              arriveBy: false
              includePlannedCancellations: true
              transitDistanceReluctance: 2000
              anotherLongFieldName: "Lots and lots and lots and lots of text"
            }
            arriveBy: false
            includePlannedCancellations: true
            transitDistanceReluctance: 2000
            anotherLongFieldName: "Lots and lots and lots and lots of text"
          }
        ) {
          dateTime
        }
      }
    `);
  });

  it('puts large list values on multiple lines if line is long (> 80 chars)', () => {
    const printed = print(
      parse(
        '{trip(list:[["small array", "small", "small"], ["Lots and lots and lots and lots of text", "Lots and lots and lots and lots of text", "Lots and lots and lots and lots of text"]]){dateTime}}',
      ),
    );

    expect(printed).to.equal(dedent`
      {
        trip(
          list: [
            ["small array", "small", "small"]
            [
              "Lots and lots and lots and lots of text"
              "Lots and lots and lots and lots of text"
              "Lots and lots and lots and lots of text"
            ]
          ]
        ) {
          dateTime
        }
      }
    `);
  });

  it('prints fragment with argument definition directives', () => {
    const fragmentWithArgumentDefinitionDirective = parse(
      'fragment Foo($foo: TestType @test) on TestType @testDirective { id }',
      { experimentalFragmentArguments: true },
    );
    expect(print(fragmentWithArgumentDefinitionDirective)).to.equal(dedent`
      fragment Foo($foo: TestType @test) on TestType @testDirective {
        id
      }
    `);
  });

  it('correctly prints fragment defined arguments', () => {
    const fragmentWithArgumentDefinition = parse(
      `
        fragment Foo($a: ComplexType, $b: Boolean = false) on TestType {
          id
        }
      `,
      { experimentalFragmentArguments: true },
    );
    expect(print(fragmentWithArgumentDefinition)).to.equal(dedent`
      fragment Foo($a: ComplexType, $b: Boolean = false) on TestType {
        id
      }
    `);
  });

  it('prints fragment spread with arguments', () => {
    const fragmentSpreadWithArguments = parse(
      'fragment Foo on TestType { ...Bar(a: {x: $x}, b: true) }',
      { experimentalFragmentArguments: true },
    );
    expect(print(fragmentSpreadWithArguments)).to.equal(dedent`
      fragment Foo on TestType {
        ...Bar(a: { x: $x }, b: true)
      }
    `);
  });

  it('prints fragment spread with multi-line arguments', () => {
    const fragmentSpreadWithArguments = parse(
      'fragment Foo on TestType { ...Bar(a: {x: $x, y: $y, z: $z, xy: $xy}, b: true, c: "a long string extending arguments over max length") }',
      { experimentalFragmentArguments: true },
    );
    expect(print(fragmentSpreadWithArguments)).to.equal(dedent`
      fragment Foo on TestType {
        ...Bar(
          a: { x: $x, y: $y, z: $z, xy: $xy }
          b: true
          c: "a long string extending arguments over max length"
        )
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

      fragment frag on Friend @onFragmentDefinition {
        foo(
          size: $size
          bar: $b
          obj: { key: "value", block: """
          block string uses \"""
          """ }
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
