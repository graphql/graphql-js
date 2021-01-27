import { expect } from 'chai';
import { describe, it } from 'mocha';

import { Source } from '../source';

describe('Source', () => {
  it('asserts that a body was provided', () => {
    // @ts-expect-error
    expect(() => new Source()).to.throw(
      'Body must be a string. Received: undefined.',
    );
  });

  it('asserts that a valid body was provided', () => {
    // @ts-expect-error
    expect(() => new Source({})).to.throw(
      'Body must be a string. Received: {}.',
    );
  });

  it('can be Object.toStringified', () => {
    const source = new Source('');

    expect(Object.prototype.toString.call(source)).to.equal('[object Source]');
  });

  it('rejects invalid locationOffset', () => {
    function createSource(locationOffset: { line: number; column: number }) {
      return new Source('', '', locationOffset);
    }

    expect(() => createSource({ line: 0, column: 1 })).to.throw(
      'line in locationOffset is 1-indexed and must be positive.',
    );
    expect(() => createSource({ line: -1, column: 1 })).to.throw(
      'line in locationOffset is 1-indexed and must be positive.',
    );

    expect(() => createSource({ line: 1, column: 0 })).to.throw(
      'column in locationOffset is 1-indexed and must be positive.',
    );
    expect(() => createSource({ line: 1, column: -1 })).to.throw(
      'column in locationOffset is 1-indexed and must be positive.',
    );
  });
});
