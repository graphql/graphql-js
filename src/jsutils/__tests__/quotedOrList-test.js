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
import quotedOrList from '../quotedOrList';

describe('quotedOrList', () => {
  it('Does not accept an empty list', () => {
    expect(() => quotedOrList([])).to.throw(Error);
  });

  it('Returns single quoted item', () => {
    expect(quotedOrList(['A'])).to.equal('"A"');
  });

  it('Returns two item list', () => {
    expect(quotedOrList(['A', 'B'])).to.equal('"A" or "B"');
  });

  it('Returns comma separated many item list', () => {
    expect(quotedOrList(['A', 'B', 'C'])).to.equal('"A", "B", or "C"');
  });

  it('Limits to five items', () => {
    expect(quotedOrList(['A', 'B', 'C', 'D', 'E', 'F'])).to.equal(
      '"A", "B", "C", "D", or "E"',
    );
  });
});
