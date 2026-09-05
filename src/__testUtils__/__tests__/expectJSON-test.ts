import { describe, it } from 'node:test';

import { expectJSON } from '../expectJSON.ts';

describe('expectJSON', () => {
  it('normalizes values returned from toJSON', () => {
    const actual = {
      error: {
        toJSON() {
          return {
            extensions: { code: 'CUSTOM' },
          };
        },
      },
    };

    expectJSON(actual).toDeepEqual({
      error: {
        extensions: { code: 'CUSTOM' },
      },
    });
  });

  it('allows toJSON to return the source object', () => {
    const actual = {
      message: 'same object',
      toJSON() {
        return actual;
      },
    };

    expectJSON(actual).toDeepEqual(actual);
  });
});
