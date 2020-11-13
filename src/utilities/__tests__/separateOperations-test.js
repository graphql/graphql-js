import { expect } from 'chai';
import { describe, it } from 'mocha';

import dedent from '../../__testUtils__/dedent';

import { parse } from '../../language/parser';
import { print } from '../../language/printer';

import { separateOperations } from '../separateOperations';

describe('separateOperations', () => {
  it('separates one AST into multiple, maintaining document order', () => {
    const ast = parse(`
      {
        ...Y
        ...X
      }

      query One {
        foo
        bar
        ...A
        ...X
      }

      fragment A on T {
        field
        ...B
      }

      fragment X on T {
        fieldX
      }

      query Two {
        ...A
        ...Y
        baz
      }

      fragment Y on T {
        fieldY
      }

      fragment B on T {
        something
      }
    `);

    const separatedASTs = separateOperations(ast);

    expect(separatedASTs).to.have.all.keys('', 'One', 'Two');

    expect(print(separatedASTs[''])).to.equal(dedent`
      {
        ...Y
        ...X
      }

      fragment X on T {
        fieldX
      }

      fragment Y on T {
        fieldY
      }
    `);

    expect(print(separatedASTs.One)).to.equal(dedent`
      query One {
        foo
        bar
        ...A
        ...X
      }

      fragment A on T {
        field
        ...B
      }

      fragment X on T {
        fieldX
      }

      fragment B on T {
        something
      }
    `);

    expect(print(separatedASTs.Two)).to.equal(dedent`
      fragment A on T {
        field
        ...B
      }

      query Two {
        ...A
        ...Y
        baz
      }

      fragment Y on T {
        fieldY
      }

      fragment B on T {
        something
      }
    `);
  });

  it('survives circular dependencies', () => {
    const ast = parse(`
      query One {
        ...A
      }

      fragment A on T {
        ...B
      }

      fragment B on T {
        ...A
      }

      query Two {
        ...B
      }
    `);

    const separatedASTs = separateOperations(ast);

    expect(separatedASTs).to.have.all.keys('One', 'Two');

    expect(print(separatedASTs.One)).to.equal(dedent`
      query One {
        ...A
      }

      fragment A on T {
        ...B
      }

      fragment B on T {
        ...A
      }
    `);

    expect(print(separatedASTs.Two)).to.equal(dedent`
      fragment A on T {
        ...B
      }

      fragment B on T {
        ...A
      }

      query Two {
        ...B
      }
    `);
  });
});
