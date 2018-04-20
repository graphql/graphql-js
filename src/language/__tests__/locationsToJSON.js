/**
 * Copyright (c) 2017-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow strict
 */

export default function locationsToJSON(value: any): any {
  if (typeof value !== 'object') {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map(locationsToJSON);
  }

  if (value.constructor.name === 'Loc') {
    return value.toJSON();
  }

  if (value.constructor === Object) {
    const result = {};
    Object.keys(value).forEach(key => {
      result[key] = locationsToJSON(value[key]);
    });
    return result;
  }

  return value;
}
