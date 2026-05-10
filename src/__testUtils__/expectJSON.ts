import { expect } from 'chai';

import { isObjectLike } from '../jsutils/isObjectLike.ts';
import { mapValue } from '../jsutils/mapValue.ts';

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

export function expectJSON(actual: unknown): {
  toDeepEqual: (expected: unknown) => ReturnType<typeof expect>;
  toDeepNestedProperty: (
    path: string,
    expected: unknown,
  ) => ReturnType<typeof expect>;
} {
  const actualJSON = toJSONDeep(actual);

  return {
    toDeepEqual(expected: unknown): ReturnType<typeof expect> {
      const expectedJSON = toJSONDeep(expected);
      return expect(actualJSON).to.deep.equal(expectedJSON);
    },
    toDeepNestedProperty(
      path: string,
      expected: unknown,
    ): ReturnType<typeof expect> {
      const expectedJSON = toJSONDeep(expected);
      return expect(actualJSON).to.deep.nested.property(path, expectedJSON);
    },
  };
}

export function expectToThrowJSON(
  fn: () => unknown,
): ReturnType<typeof expect> {
  function mapException(): unknown {
    try {
      return fn();
    } catch (error) {
      throw toJSONDeep(error);
    }
  }

  return expect(mapException).to.throw();
}
