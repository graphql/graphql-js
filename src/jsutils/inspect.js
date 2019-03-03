/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow strict
 */

import nodejsCustomInspectSymbol from './nodejsCustomInspectSymbol';

const MAX_ARRAY_LENGTH = 10;

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
          return inspectArray(value);
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

function inspectArray(array) {
  const len = Math.min(MAX_ARRAY_LENGTH, array.length);
  const remaining = array.length - len;
  const items = [];

  for (let i = 0; i < len; ++i) {
    items.push(inspect(array[i]));
  }

  if (remaining === 1) {
    items.push('... 1 more item');
  } else if (remaining > 1) {
    items.push(`... ${remaining} more items`);
  }

  return '[' + items.join(', ') + ']';
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
