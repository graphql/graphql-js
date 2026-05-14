/* eslint-disable no-unused-expressions */
import { describe, it } from 'node:test';

import { TypeKind } from '../index.ts';

describe('TypeKind', () => {
  it('is a term level namespace with term level enum members', () => {
    const a: TypeKind.SCALAR = TypeKind.SCALAR;
    a;
    const b: TypeKind = TypeKind.SCALAR;
    b;
    const c: TypeKind = TypeKind.NON_NULL;
    c;
  });

  it('is a type level namespace with type level enum members', () => {
    // @ts-expect-error
    const a: TypeKind.SCALAR = 'bad';
    a;
    const b: TypeKind.SCALAR = 'SCALAR';
    b;
    // @ts-expect-error
    const c: TypeKind = 'bad';
    c;
    const d: TypeKind = 'SCALAR';
    d;
    const e: TypeKind = 'NON_NULL';
    e;
  });
});
