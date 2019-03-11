/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow strict
 */

import { describe, it } from 'mocha';
import { expect } from 'chai';
import dedent from '../../jsutils/dedent';
import { separateOperations } from '../separateOperations';
import { parse, print } from '../../language';

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
