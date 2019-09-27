// @flow strict

import { parse } from '../../language/parser';

import { validateSDL } from '../validate';

import { bigSchemaSDL } from '../../__fixtures__';

const sdlAST = parse(bigSchemaSDL);

export const name = 'Validate SDL Document';
export const count = 10;

/**
 * @internal
 */
export function measure() {
  validateSDL(sdlAST);
}
