// @flow strict

import { expect } from 'chai';
import { describe, it } from 'mocha';

import dedent from '../../jsutils/dedent';

import { Source } from '../source';
import { printSourceLocation } from '../printLocation';

describe('printSourceLocation', () => {
  it('prints minified documents', () => {
    const minifiedSource = new Source(
      'query SomeMiniFiedQueryWithErrorInside($foo:String!=FIRST_ERROR_HERE$bar:String){someField(foo:$foo bar:$bar baz:SECOND_ERROR_HERE){fieldA fieldB{fieldC fieldD...on THIRD_ERROR_HERE}}}',
    );

    const firstLocation = printSourceLocation(minifiedSource, {
      line: 1,
      column: minifiedSource.body.indexOf('FIRST_ERROR_HERE') + 1,
    });
    expect(firstLocation + '\n').to.equal(dedent`
      GraphQL request:1:53
      1 | query SomeMiniFiedQueryWithErrorInside($foo:String!=FIRST_ERROR_HERE$bar:String)
        |                                                     ^
        | {someField(foo:$foo bar:$bar baz:SECOND_ERROR_HERE){fieldA fieldB{fieldC fieldD.
    `);

    const secondLocation = printSourceLocation(minifiedSource, {
      line: 1,
      column: minifiedSource.body.indexOf('SECOND_ERROR_HERE') + 1,
    });
    expect(secondLocation + '\n').to.equal(dedent`
      GraphQL request:1:114
      1 | query SomeMiniFiedQueryWithErrorInside($foo:String!=FIRST_ERROR_HERE$bar:String)
        | {someField(foo:$foo bar:$bar baz:SECOND_ERROR_HERE){fieldA fieldB{fieldC fieldD.
        |                                  ^
        | ..on THIRD_ERROR_HERE}}}
    `);

    const thirdLocation = printSourceLocation(minifiedSource, {
      line: 1,
      column: minifiedSource.body.indexOf('THIRD_ERROR_HERE') + 1,
    });
    expect(thirdLocation + '\n').to.equal(dedent`
      GraphQL request:1:166
      1 | query SomeMiniFiedQueryWithErrorInside($foo:String!=FIRST_ERROR_HERE$bar:String)
        | {someField(foo:$foo bar:$bar baz:SECOND_ERROR_HERE){fieldA fieldB{fieldC fieldD.
        | ..on THIRD_ERROR_HERE}}}
        |      ^
    `);
  });

  it('prints single digit line number with no padding', () => {
    const result = printSourceLocation(
      new Source('*', 'Test', { line: 9, column: 1 }),
      { line: 1, column: 1 },
    );

    expect(result + '\n').to.equal(dedent`
      Test:9:1
      9 | *
        | ^
    `);
  });

  it('prints an line numbers with correct padding', () => {
    const result = printSourceLocation(
      new Source('*\n', 'Test', { line: 9, column: 1 }),
      { line: 1, column: 1 },
    );

    expect(result + '\n').to.equal(dedent`
      Test:9:1
       9 | *
         | ^
      10 | 
    `);
  });
});
