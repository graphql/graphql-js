/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow strict
 */

import { expect } from 'chai';
import { describe, it } from 'mocha';
import instanceOf from '../instanceOf';

describe('instanceOf', () => {
  it('fails with descriptive error message', () => {
    function getFoo() {
      class Foo {}
      return Foo;
    }
    const Foo1 = getFoo();
    const Foo2 = getFoo();

    expect(() => instanceOf(new Foo1(), Foo2)).to.throw(
      /^Cannot use Foo "\[object Object\]" from another module or realm./m,
    );
    expect(() => instanceOf(new Foo2(), Foo1)).to.throw(
      /^Cannot use Foo "\[object Object\]" from another module or realm./m,
    );
  });
});
