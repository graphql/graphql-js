/**
 *  Copyright (c) 2015, Facebook, Inc.
 *  All rights reserved.
 *
 *  This source code is licensed under the BSD-style license found in the
 *  LICENSE file in the root directory of this source tree. An additional grant
 *  of patent rights can be found in the PATENTS file in the same directory.
 */

import * as Kind from '../kinds';
import { expect } from 'chai';
import { describe, it } from 'mocha';
import { parse, parseValue, parseType } from '../parser';
import { Source } from '../source';
import { readFileSync } from 'fs';
import { join } from 'path';

describe('Parser', () => {

  it('parse provides useful errors', () => {

    let caughtError;
    try {
      parse('{');
    } catch (error) {
      caughtError = error;
    }

    expect(caughtError.message).to.equal(
      `Syntax Error GraphQL request (1:2) Expected Name, found <EOF>

1: {
    ^
`
    );

    expect(caughtError.positions).to.deep.equal([ 1 ]);

    expect(caughtError.locations).to.deep.equal([
      { line: 1, column: 2 }
    ]);

    expect(
      () => parse(
`{ ...MissingOn }
fragment MissingOn Type
`)
    ).to.throw(
      'Syntax Error GraphQL request (2:20) Expected "on", found Name "Type"'
    );

    expect(
      () => parse('{ field: {} }')
    ).to.throw('Syntax Error GraphQL request (1:10) Expected Name, found {');

    expect(
      () => parse('notanoperation Foo { field }')
    ).to.throw(
      'Syntax Error GraphQL request (1:1) Unexpected Name "notanoperation"'
    );

    expect(
      () => parse('...')
    ).to.throw('Syntax Error GraphQL request (1:1) Unexpected ...');

  });

  it('parse provides useful error when using source', () => {
    expect(
      () => parse(new Source('query', 'MyQuery.graphql'))
    ).to.throw('Syntax Error MyQuery.graphql (1:6) Expected {, found <EOF>');
  });

  it('parses variable inline values', () => {
    expect(
      () => parse('{ field(complex: { a: { b: [ $var ] } }) }')
    ).to.not.throw();
  });

  it('parses constant default values', () => {
    expect(
      () => parse('query Foo($x: Complex = { a: { b: [ $var ] } }) { field }')
    ).to.throw('Syntax Error GraphQL request (1:37) Unexpected $');
  });

  it('does not accept fragments named "on"', () => {
    expect(
      () => parse('fragment on on on { on }')
    ).to.throw('Syntax Error GraphQL request (1:10) Unexpected Name "on"');
  });

  it('does not accept fragments spread of "on"', () => {
    expect(
      () => parse('{ ...on }')
    ).to.throw('Syntax Error GraphQL request (1:9) Expected Name, found }');
  });

  it('parses multi-byte characters', async () => {
    // Note: \u0A0A could be naively interpretted as two line-feed chars.
    expect(
      parse(`
        # This comment has a \u0A0A multi-byte character.
        { field(arg: "Has a \u0A0A multi-byte character.") }
      `)
    ).to.containSubset({
      definitions: [ {
        selectionSet: {
          selections: [ {
            arguments: [ {
              value: {
                kind: Kind.STRING,
                value: 'Has a \u0A0A multi-byte character.'
              }
            } ]
          } ]
        }
      } ]
    });
  });

  const kitchenSink = readFileSync(
    join(__dirname, '/kitchen-sink.graphql'),
    { encoding: 'utf8' }
  );

  it('parses kitchen sink', () => {
    expect(() => parse(kitchenSink)).to.not.throw();
  });

  it('allows non-keywords anywhere a Name is allowed', () => {
    const nonKeywords = [
      'on',
      'fragment',
      'query',
      'mutation',
      'subscription',
      'true',
      'false'
    ];
    nonKeywords.forEach(keyword => {
      let fragmentName = keyword;
      // You can't define or reference a fragment named `on`.
      if (keyword === 'on') {
        fragmentName = 'a';
      }
      expect(() => {
        parse(`query ${keyword} {
  ... ${fragmentName}
  ... on ${keyword} { field }
}
fragment ${fragmentName} on Type {
  ${keyword}(${keyword}: $${keyword}) @${keyword}(${keyword}: ${keyword})
}`
        );
      }).to.not.throw();
    });
  });

  it('parses anonymous mutation operations', () => {
    expect(() => parse(`
      mutation {
        mutationField
      }
    `)).to.not.throw();
  });

  it('parses anonymous subscription operations', () => {
    expect(() => parse(`
      subscription {
        subscriptionField
      }
    `)).to.not.throw();
  });

  it('parses named mutation operations', () => {
    expect(() => parse(`
      mutation Foo {
        mutationField
      }
    `)).to.not.throw();
  });

  it('parses named subscription operations', () => {
    expect(() => parse(`
      subscription Foo {
        subscriptionField
      }
    `)).to.not.throw();
  });

  it('creates ast', () => {

    const source = new Source(`{
  node(id: 4) {
    id,
    name
  }
}
`);
    const result = parse(source);

    expect(result).to.containSubset(
      { kind: Kind.DOCUMENT,
        loc: { start: 0, end: 41 },
        definitions:
        [ { kind: Kind.OPERATION_DEFINITION,
          loc: { start: 0, end: 40 },
          operation: 'query',
          name: null,
          variableDefinitions: null,
          directives: [],
          selectionSet:
          { kind: Kind.SELECTION_SET,
            loc: { start: 0, end: 40 },
            selections:
            [ { kind: Kind.FIELD,
              loc: { start: 4, end: 38 },
              alias: null,
              name:
              { kind: Kind.NAME,
                loc: { start: 4, end: 8 },
                value: 'node' },
              arguments:
              [ { kind: Kind.ARGUMENT,
                name:
                { kind: Kind.NAME,
                  loc: { start: 9, end: 11 },
                  value: 'id' },
                value:
                { kind: Kind.INT,
                  loc: { start: 13, end: 14 },
                  value: '4' },
                loc: { start: 9, end: 14 } } ],
              directives: [],
              selectionSet:
              { kind: Kind.SELECTION_SET,
                loc: { start: 16, end: 38 },
                selections:
                [ { kind: Kind.FIELD,
                  loc: { start: 22, end: 24 },
                  alias: null,
                  name:
                  { kind: Kind.NAME,
                    loc: { start: 22, end: 24 },
                    value: 'id' },
                  arguments: [],
                  directives: [],
                  selectionSet: null },
                { kind: Kind.FIELD,
                  loc: { start: 30, end: 34 },
                  alias: null,
                  name:
                  { kind: Kind.NAME,
                    loc: { start: 30, end: 34 },
                    value: 'name' },
                  arguments: [],
                  directives: [],
                  selectionSet: null } ] } } ] } } ] }
    );
  });

  it('allows parsing without source location information', () => {
    const source = new Source('{ id }');
    const result = parse(source, { noLocation: true });
    expect(result.loc).to.equal(undefined);
  });

  it('contains location information that only stringifys start/end', () => {
    const source = new Source('{ id }');
    const result = parse(source);
    expect(JSON.stringify(result.loc)).to.equal(
      '{"start":0,"end":6}'
    );
    // NB: util.inspect used to suck
    if (parseFloat(process.version.slice(1)) > 0.10) {
      expect(require('util').inspect(result.loc)).to.equal(
        '{ start: 0, end: 6 }'
      );
    }
  });

  it('contains references to source', () => {
    const source = new Source('{ id }');
    const result = parse(source);
    expect(result.loc.source).to.equal(source);
  });

  it('contains references to start and end tokens', () => {
    const source = new Source('{ id }');
    const result = parse(source);
    expect(result.loc.startToken.kind).to.equal('<SOF>');
    expect(result.loc.endToken.kind).to.equal('<EOF>');
  });

  describe('parseValue', () => {

    it('parses null value', () => {
      expect(parseValue('null')).to.containSubset({
        kind: Kind.NULL,
        loc: { start: 0, end: 4 }
      });
    });

    it('parses list values', () => {
      expect(parseValue('[123 "abc"]')).to.containSubset({
        kind: Kind.LIST,
        loc: { start: 0, end: 11 },
        values: [
          { kind: Kind.INT,
            loc: { start: 1, end: 4},
            value: '123' },
          { kind: Kind.STRING,
            loc: { start: 5, end: 10},
            value: 'abc' } ]
      });
    });

  });

  describe('parseType', () => {

    it('parses well known types', () => {
      expect(parseType('String')).to.containSubset({
        kind: Kind.NAMED_TYPE,
        loc: { start: 0, end: 6 },
        name: {
          kind: Kind.NAME,
          loc: { start: 0, end: 6 },
          value: 'String' }
      });
    });

    it('parses custom types', () => {
      expect(parseType('MyType')).to.containSubset({
        kind: Kind.NAMED_TYPE,
        loc: { start: 0, end: 6 },
        name: {
          kind: Kind.NAME,
          loc: { start: 0, end: 6 },
          value: 'MyType' }
      });
    });

    it('parses list types', () => {
      expect(parseType('[MyType]')).to.containSubset({
        kind: Kind.LIST_TYPE,
        loc: { start: 0, end: 8 },
        type: {
          kind: Kind.NAMED_TYPE,
          loc: { start: 1, end: 7 },
          name: {
            kind: Kind.NAME,
            loc: { start: 1, end: 7 },
            value: 'MyType' } }
      });
    });

    it('parses non-null types', () => {
      expect(parseType('MyType!')).to.containSubset({
        kind: Kind.NON_NULL_TYPE,
        loc: { start: 0, end: 7 },
        type: {
          kind: Kind.NAMED_TYPE,
          loc: { start: 0, end: 6 },
          name: {
            kind: Kind.NAME,
            loc: { start: 0, end: 6 },
            value: 'MyType' } }
      });
    });

    it('parses nested types', () => {
      expect(parseType('[MyType!]')).to.containSubset({
        kind: Kind.LIST_TYPE,
        loc: { start: 0, end: 9 },
        type: {
          kind: Kind.NON_NULL_TYPE,
          loc: { start: 1, end: 8 },
          type: {
            kind: Kind.NAMED_TYPE,
            loc: { start: 1, end: 7 },
            name: {
              kind: Kind.NAME,
              loc: { start: 1, end: 7 },
              value: 'MyType' } } }
      });
    });

  });
});
