/**
 *  Copyright (c) 2015, Facebook, Inc.
 *  All rights reserved.
 *
 *  This source code is licensed under the BSD-style license found in the
 *  LICENSE file in the root directory of this source tree. An additional grant
 *  of patent rights can be found in the PATENTS file in the same directory.
 */

import { describe, it } from 'mocha';
import { expect } from 'chai';
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

    expect(Object.keys(separatedASTs)).to.deep.equal([ '', 'One', 'Two' ]);

    expect(print(separatedASTs[''])).to.equal(
`{
  ...Y
  ...X
}

fragment X on T {
  fieldX
}

fragment Y on T {
  fieldY
}
`
    );

    expect(print(separatedASTs.One)).to.equal(
`query One {
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
`
    );

    expect(print(separatedASTs.Two)).to.equal(
`fragment A on T {
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
`
    );

  });

});
