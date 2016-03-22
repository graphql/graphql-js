/* @flow */
/**
 *  Copyright (c) 2015, Facebook, Inc.
 *  All rights reserved.
 *
 *  This source code is licensed under the BSD-style license found in the
 *  LICENSE file in the root directory of this source tree. An additional grant
 *  of patent rights can be found in the PATENTS file in the same directory.
 */

import invariant from '../jsutils/invariant';


const NAME_RX = /^[_a-zA-Z][_a-zA-Z0-9]*$/;

// Helper to assert that provided names are valid.
export function assertValidName(name: string): void {
  invariant(
    NAME_RX.test(name),
    `Names must match /^[_a-zA-Z][_a-zA-Z0-9]*$/ but "${name}" does not.`
  );
}
