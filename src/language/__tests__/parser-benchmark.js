// @flow strict

import { parse } from '../parser';

import { kitchenSinkQuery } from '../../__fixtures__';

export const name = 'Parse kitchen sink';
export const count = 1000;

/**
 * @internal
 */
export function measure() {
  parse(kitchenSinkQuery);
}
