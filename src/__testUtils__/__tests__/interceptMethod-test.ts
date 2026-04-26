import { expect } from 'chai';
import { describe, it } from 'mocha';

import { interceptMethod } from '../interceptMethod.js';

describe('interceptMethod', () => {
  it('wraps a method and preserves this binding', () => {
    const calls: Array<number> = [];
    const target = {
      value: 3,
      add(delta: number): number {
        return this.value + delta;
      },
    };

    const restore = interceptMethod(
      target,
      'add',
      (original) =>
        function interceptedAdd(this: unknown, ...args: Array<unknown>) {
          const [delta] = args as [number];
          calls.push(delta);
          return original.call(this, delta * 2);
        },
    );

    expect(target.add(4)).to.equal(11);
    expect(calls).to.deep.equal([4]);

    restore();

    expect(target.add(4)).to.equal(7);
  });

  it('restores the original method', () => {
    const target = {
      value(): string {
        return 'original';
      },
    };
    const original = target.value;

    const restore = interceptMethod(target, 'value', () => () => 'wrapped');

    expect(target.value()).to.equal('wrapped');

    restore();

    expect(target.value).to.equal(original);
    expect(target.value()).to.equal('original');
  });
});
