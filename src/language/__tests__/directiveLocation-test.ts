/* eslint-disable no-unused-expressions */
import { describe, it } from 'node:test';

import { DirectiveLocation } from '../index.ts';

describe('DirectiveLocation', () => {
  it('is a term level namespace with term level enum members', () => {
    const a: DirectiveLocation.QUERY = DirectiveLocation.QUERY;
    a;
    const b: DirectiveLocation = DirectiveLocation.QUERY;
    b;
    const c: DirectiveLocation = DirectiveLocation.FIELD_DEFINITION;
    c;
  });

  it('is a type level namespace with type level enum members', () => {
    // @ts-expect-error
    const a: DirectiveLocation.QUERY = 'bad';
    a;
    const b: DirectiveLocation.QUERY = 'QUERY';
    b;
    // @ts-expect-error
    const c: DirectiveLocation = 'bad';
    c;
    const d: DirectiveLocation = 'QUERY';
    d;
    const e: DirectiveLocation = 'FIELD_DEFINITION';
    e;
  });
});
