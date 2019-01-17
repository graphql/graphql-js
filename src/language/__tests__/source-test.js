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
import { Source } from '../source';

describe('Source', () => {
  it('can be Object.toStringified', () => {
    const source = new Source('');

    expect(Object.prototype.toString.call(source)).to.equal('[object Source]');
  });
});
