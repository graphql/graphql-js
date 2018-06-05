/**
 * Copyright (c) 2015-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow strict
 */

import type { ObjMap } from './ObjMap';

declare function objectValues<T>(obj: ObjMap<T>): Array<T>;

/* eslint-disable no-redeclare */
// $FlowFixMe workaround for: https://github.com/facebook/flow/issues/2221
const objectValues =
  Object.values || (obj => Object.keys(obj).map(key => obj[key]));
export default objectValues;
