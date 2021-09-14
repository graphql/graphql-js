import { expect } from 'chai';

import { mapValue } from '../jsutils/mapValue';
import { isObjectLike } from '../jsutils/isObjectLike';

/**
 * Deeply transforms an arbitrary value to a JSON-safe value by calling toJSON
 * on any nested value which defines it.
 */
function toJSONDeep(value: unknown): unknown {
  if (!isObjectLike(value)) {
    return value;
  }

  if (typeof value.toJSON === 'function') {
    return value.toJSON();
  }

  if (Array.isArray(value)) {
    return value.map(toJSONDeep);
  }

  return mapValue(value, toJSONDeep);
}

export function expectJSON(value: unknown) {
  return expect(toJSONDeep(value));
}

export function expectToThrowJSON(fn: () => unknown) {
  function mapException(): unknown {
    try {
      return fn();
    } catch (error) {
      throw toJSONDeep(error);
    }
  }

  return expect(mapException).to.throw();
}
