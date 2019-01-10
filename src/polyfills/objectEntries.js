/**
 * Copyright (c) 2019-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow strict
 */

import type { ObjMap } from '../jsutils/ObjMap';

declare function objectEntries<T>(obj: ObjMap<T>): Array<[string, T]>;

/* eslint-disable no-redeclare */
// $FlowFixMe workaround for: https://github.com/facebook/flow/issues/5838
const objectEntries =
  Object.entries || (obj => Object.keys(obj).map(key => [key, obj[key]]));

export default objectEntries;
