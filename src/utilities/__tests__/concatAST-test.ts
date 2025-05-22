import { expect } from 'chai';
import { describe, it } from 'mocha';

import { dedent } from '../../__testUtils__/dedent.js';

import { parse } from '../../language/parser.js';
import { print } from '../../language/printer.js';
import { Source } from '../../language/source.js';

import { concatAST } from '../concatAST.js';

describe('concatAST', () => {
  it('concatenates two ASTs together', () => {
    const sourceA = new Source(`
      { a, b, ...Frag }
    `);

    const sourceB = new Source(`
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
