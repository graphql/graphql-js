// @flow strict

import { bigSchemaSDL } from '../../__fixtures__';

import { parse } from '../../';
import { validateSDL } from '../validate';

const sdlAST = parse(bigSchemaSDL);

export const name = 'Validate SDL Document';
export const count = 10;
export function measure() {
  validateSDL(sdlAST);
}
