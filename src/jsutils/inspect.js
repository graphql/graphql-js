/**
 * Copyright (c) 2015-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow strict
 */

import nodejsCustomInspectSymbol from './nodejsCustomInspectSymbol';

/**
 * Used to print values in error messages.
 */
export default function inspect(value: mixed): string {
  switch (typeof value) {
    case 'string':
      return JSON.stringify(value);
    case 'function':
      return value.name ? `[function ${value.name}]` : '[function]';
    case 'object':
      if (value) {
        const customInspectFn = getCustomFn(value);

        if (customInspectFn) {
          // $FlowFixMe(>=0.90.0)
          const customValue = customInspectFn.call(value);
          return typeof customValue === 'string'
            ? customValue
            : inspect(customValue);
        } else if (Array.isArray(value)) {
          return '[' + value.map(inspect).join(', ') + ']';
        }

        const properties = Object.keys(value)
          .map(k => `${k}: ${inspect(value[k])}`)
          .join(', ');
        return properties ? '{ ' + properties + ' }' : '{}';
      }
      return String(value);
    default:
      return String(value);
  }
}

function getCustomFn(object) {
  const customInspectFn = object[String(nodejsCustomInspectSymbol)];

  if (typeof customInspectFn === 'function') {
    return customInspectFn;
  }

  if (typeof object.inspect === 'function') {
    return object.inspect;
  }
}
