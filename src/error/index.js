/* @flow */
/**
 *  Copyright (c) 2015, Facebook, Inc.
 *  All rights reserved.
 *
 *  This source code is licensed under the BSD-style license found in the
 *  LICENSE file in the root directory of this source tree. An additional grant
 *  of patent rights can be found in the PATENTS file in the same directory.
 */

export { GraphQLError } from './GraphQLError';
export { syntaxError } from './syntaxError';
export { locatedError } from './locatedError';
export { formatError } from './formatError';

export type {
  GraphQLFormattedError,
  GraphQLErrorLocation
} from './formatError';
