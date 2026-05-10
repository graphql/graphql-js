import { describe, it } from 'node:test';

import { expect } from 'chai';

import { spyOn, spyOnMethod } from '../spyOn.ts';

describe('spyOn', () => {
  it('tracks invocations while preserving original behavior', () => {
    const spy = spyOn((a: number, b: number) => a + b);

    expect(spy(2, 3)).to.equal(5);
    expect(spy(4, 5)).to.equal(9);
    expect(spy.callCount).to.equal(2);
  });

  it('preserves this binding', () => {
    const obj = {
      base: 10,
      addToBase: spyOn(function addToBase(
        this: { base: number },
        value: number,
      ) {
        return this.base + value;
      }),
    };

    expect(obj.addToBase(5)).to.equal(15);
    expect(obj.addToBase.callCount).to.equal(1);
  });
});

describe('spyOnMethod', () => {
  it('tracks method invocations while preserving original behavior', () => {
    const calculator = {
      add(a: number, b: number) {
        return a + b;
      },
    };

    const spy = spyOnMethod(calculator, 'add');

    expect(calculator.add(2, 3)).to.equal(5);
    expect(calculator.add(4, 5)).to.equal(9);
    expect(spy.callCount).to.equal(2);
  });

  it('preserves method this binding', () => {
    const accumulator = {
      base: 10,
      addToBase(value: number) {
        return this.base + value;
      },
    };

    const spy = spyOnMethod(accumulator, 'addToBase');

    expect(accumulator.addToBase(5)).to.equal(15);
    expect(spy.callCount).to.equal(1);
  });

  it('throws when target property is not a function', () => {
    const obj: { maybeMethod?: (value: string) => string } = {};

    expect(() => spyOnMethod(obj, 'maybeMethod')).to.throw(
      "Cannot spy on 'maybeMethod' because it is not a function.",
    );
  });
});
