// @flow strict

import { expect } from 'chai';
import { describe, it } from 'mocha';

import dedent from '../../jsutils/dedent';
import invariant from '../../jsutils/invariant';
import { GraphQLError } from '../GraphQLError';
import { printError } from '../printError';
import { Kind, parse, Source } from '../../language';

describe('printError', () => {
  it('prints an error without location', () => {
    const error = new GraphQLError('Error without location');
    expect(printError(error)).to.equal('Error without location');
  });

  it('prints an error using node without location', () => {
    const error = new GraphQLError(
      'Error attached to node without location',
      parse('{ foo }', { noLocation: true }),
    );
    expect(printError(error)).to.equal(
      'Error attached to node without location',
    );
  });

  it('prints an line numbers with correct padding', () => {
    const singleDigit = new GraphQLError(
      'Single digit line number with no padding',
      null,
      new Source('*', 'Test', { line: 9, column: 1 }),
      [0],
    );
    expect(printError(singleDigit) + '\n').to.equal(dedent`
      Single digit line number with no padding

      Test:9:1
      9: *
         ^
    `);

    const doubleDigit = new GraphQLError(
      'Left padded first line number',
      null,
      new Source('*\n', 'Test', { line: 9, column: 1 }),
      [0],
    );
    expect(printError(doubleDigit) + '\n').to.equal(dedent`
      Left padded first line number

      Test:9:1
       9: *
          ^
      10: 
    `);
  });

  it('prints an error with nodes from different sources', () => {
    const docA = parse(
      new Source(
        dedent`
          type Foo {
            field: String
          }
        `,
        'SourceA',
      ),
    );
    const opA = docA.definitions[0];
    invariant(opA && opA.kind === Kind.OBJECT_TYPE_DEFINITION && opA.fields);
    const fieldA = opA.fields[0];

    const docB = parse(
      new Source(
        dedent`
          type Foo {
            field: Int
          }
        `,
        'SourceB',
      ),
    );
    const opB = docB.definitions[0];
    invariant(opB && opB.kind === Kind.OBJECT_TYPE_DEFINITION && opB.fields);
    const fieldB = opB.fields[0];

    const error = new GraphQLError('Example error with two nodes', [
      fieldA.type,
      fieldB.type,
    ]);

    expect(printError(error) + '\n').to.equal(dedent`
      Example error with two nodes

      SourceA:2:10
      1: type Foo {
      2:   field: String
                  ^
      3: }

      SourceB:2:10
      1: type Foo {
      2:   field: Int
                  ^
      3: }
    `);
  });
});
