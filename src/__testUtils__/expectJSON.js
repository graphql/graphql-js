import { expect } from 'chai';

import toJSONDeep from '../language/__tests__/toJSONDeep';

export default function expectJSON(actual: mixed) {
  const actualJSON = toJSONDeep(actual);

  return {
    toDeepEqual(expected: mixed) {
      const expectedJSON = toJSONDeep(expected);
      expect(actualJSON).to.deep.equal(expectedJSON);
    },
    toDeepNestedProperty(path: string, expected: mixed) {
      const expectedJSON = toJSONDeep(expected);
      expect(actualJSON).to.deep.nested.property(path, expectedJSON);
    },
  };
}
