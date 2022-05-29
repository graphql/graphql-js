import { expect } from 'chai';
import { describe, it } from 'mocha';

import { dedent } from '../../__testUtils__/dedent';

import { parse } from '../../language/parser';
import { print } from '../../language/printer';
import { SourceImpl } from '../../language/source';

import { concatAST } from '../concatAST';

describe('concatAST', () => {
  it('concatenates two ASTs together', () => {
    const sourceA = new SourceImpl(`
      { a, b, ...Frag }
    `);

    const sourceB = new SourceImpl(`
      fragment Frag on T {
        c
      }
    `);

    const astA = parse(sourceA);
    const astB = parse(sourceB);
    const astC = concatAST([astA, astB]);

    expect(print(astC)).to.equal(dedent`
      {
        a
        b
        ...Frag
      }

      fragment Frag on T {
        c
      }
    `);
  });
});
