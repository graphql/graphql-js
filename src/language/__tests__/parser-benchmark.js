// @flow strict

import { kitchenSinkQuery } from '../../__fixtures__';
import { parse } from '../parser';

export const name = 'Parse kitchen sink';
export const count = 1000;
export function measure() {
  parse(kitchenSinkQuery);
}
