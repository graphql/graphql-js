/* eslint-disable no-unused-expressions */
import { describe, it } from 'node:test';

import { Kind } from '../index.ts';

describe('Kind', () => {
  it('is a term level namespace with term level enum members', () => {
    const a: Kind.NAME = Kind.NAME;
    a;
    const b: Kind = Kind.NAME;
    b;
    const c: Kind = Kind.ARGUMENT;
    c;
  });

  it('is a type level namespace with type level enum members', () => {
    // @ts-expect-error
    const a: Kind.NAME = 'bad';
    a;
    const b: Kind.NAME = 'Name';
    b;
    // @ts-expect-error
    const c: Kind = 'bad';
    c;
    const d: Kind = 'Name';
    d;
    const e: Kind = 'Argument';
    e;
  });
});
