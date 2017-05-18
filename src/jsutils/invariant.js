/* @flow */
/**
 *  Copyright (c) 2015, Facebook, Inc.
 *  All rights reserved.
 *
 *  This source code is licensed under the BSD-style license found in the
 *  LICENSE file in the root directory of this source tree. An additional grant
 *  of patent rights can be found in the PATENTS file in the same directory.
 */

export default function invariant(condition: mixed, message: string | Error) {
  if (!condition) {
    if (message instanceof Error) {
      throw message;
    }
    throw new Error(message);
  }
}
