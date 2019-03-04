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
const MAX_RECURSIVE_DEPTH = 2;

/**
 * Used to print values in error messages.
 */
export default function inspect(value: mixed): string {
  return formatValue(value, 0);
}

function formatValue(value, recurseTimes) {
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
            : formatValue(customValue, recurseTimes);
        } else if (Array.isArray(value)) {
          return formatArray(value, recurseTimes);
        }

        return formatObject(value, recurseTimes);
      }

      return String(value);
    default:
      return String(value);
  }
}

function formatObject(object, recurseTimes) {
  const keys = Object.keys(object);
  if (keys.length === 0) {
    return '{}';
  }

  if (recurseTimes === MAX_RECURSIVE_DEPTH) {
    return '[' + getObjectTag(object) + ']';
  }

  const properties = keys.map(key => {
    const value = formatValue(object[key], recurseTimes + 1);
    return key + ': ' + value;
  });

  return '{ ' + properties.join(', ') + ' }';
}

function formatArray(array, recurseTimes) {
  if (array.length === 0) {
    return '[]';
  }

  if (recurseTimes === MAX_RECURSIVE_DEPTH) {
    return '[Array]';
  }

  const len = Math.min(MAX_ARRAY_LENGTH, array.length);
  const remaining = array.length - len;
  const items = [];

  for (let i = 0; i < len; ++i) {
    items.push(formatValue(array[i], recurseTimes + 1));
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

function getObjectTag(object) {
  const tag = Object.prototype.toString
    .call(object)
    .replace(/^\[object /, '')
    .replace(/]$/, '');

  if (tag === 'Object' && typeof object.constructor === 'function') {
    const name = object.constructor.name;
    if (typeof name === 'string') {
      return name;
    }
  }

  return tag;
}
