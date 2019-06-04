/**
 *  Copyright (c) Facebook, Inc. and its affiliates.
 *
 *  This source code is licensed under the MIT license found in the
 *  LICENSE file in the root directory of this source tree.
 *
 * @flow strict
 */

import { expect } from 'chai';
import { describe, it } from 'mocha';
import dedent from '../../jsutils/dedent';
import { parse } from '../../language/parser';
import { print } from '../../language/printer';
import { inlineNamedFragments } from '../inlineNamedFragments';
import { fixtures } from './inlineNamedFragments-fixture';

describe('inlineNamedFragments', () => {
  fixtures.forEach(fixture => {
    it(fixture.desc, () => {
      const result = print(inlineNamedFragments(parse(fixture.query)));
      expect(result).to.equal(dedent(fixture.resultQuery));
    });
  });
});
