/* @flow */
/**
 *  Copyright (c) 2016, Facebook, Inc.
 *  All rights reserved.
 *
 *  This source code is licensed under the BSD-style license found in the
 *  LICENSE file in the root directory of this source tree. An additional grant
 *  of patent rights can be found in the PATENTS file in the same directory.
 */

// import invariant from './invariant';
import {
  castToNamedType,
  castToInputType,
  castToOutputType,
} from '../type/definition';

/**
 * These functions are Dynamic checks which will give the checked value
 * a right Flow Type.
**/

let dev = {
  castToNamedType,
  castToInputType,
  castToOutputType
};

if (process.env.NODE_ENV !== 'dev') {
  dev = {
    castToNamedType: (v: any): any => v,
    castToInputType: (v: any): any => v,
    castToOutputType: (v: any): any => v,
  };
}

export {
  castToNamedType,
  castToInputType,
  castToOutputType,
  dev
};
