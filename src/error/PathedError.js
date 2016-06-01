/* @flow */
/**
 *  Copyright (c) 2015, Facebook, Inc.
 *  All rights reserved.
 *
 *  This source code is licensed under the BSD-style license found in the
 *  LICENSE file in the root directory of this source tree. An additional grant
 *  of patent rights can be found in the PATENTS file in the same directory.
 */


export class PathedError extends Error {
  message: string;
  stack: string;
  executionPath: Array<string | number>;

  constructor(
    message: string,
    stack?: ?string,
    executionPath: Array<string | number>
  ) {
    super(message);
    this.message = message;
    this.executionPath = executionPath;

    Object.defineProperty(this, 'stack', { value: stack || message });
  }
}
