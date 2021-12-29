import { expect } from 'chai';

import { isObjectLike } from '../jsutils/isObjectLike';
import { mapValue } from '../jsutils/mapValue';

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

export function expectJSON(actual: unknown) {
  const actualJSON = toJSONDeep(actual);

  return {
    toDeepEqual(expected: unknown) {
      const expectedJSON = toJSONDeep(expected);
      expect(actualJSON).to.deep.equal(expectedJSON);
    },
    toDeepNestedProperty(path: string, expected: unknown) {
      const expectedJSON = toJSONDeep(expected);
      expect(actualJSON).to.deep.nested.property(path, expectedJSON);
    },
  };
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
