/* @flow */
/**
 *  Copyright (c) 2015, Facebook, Inc.
 *  All rights reserved.
 *
 *  This source code is licensed under the BSD-style license found in the
 *  LICENSE file in the root directory of this source tree. An additional grant
 *  of patent rights can be found in the PATENTS file in the same directory.
 */

export const TAG = {
  SUBTREE_START: 'SUBTREE_START',
  SUBTREE_END: 'SUBTREE_END',
  SUBTREE_ERROR: 'SUBTREE_ERROR',
  RESOLVER_START: 'RESOLVER_START',
  RESOLVER_END: 'RESOLVER_END',
  RESOLVER_ERROR: 'RESOLVER_ERROR',
};

export type GraphQLLoggingTagType = $Keys<typeof TAG>; // eslint-disable-line

export function passThroughResultAndLog(
  logFn: any,
  tag: GraphQLLoggingTagType,
  payload: any,
  info: any
): any {
  return function (result) {
    logFn(tag, payload, info);
    return result;
  };
}
