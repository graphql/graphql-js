import { parse } from '../../language/parser';

import { validateSDL } from '../validate';

import { bigSchemaSDL } from '../../__fixtures__/index';

const sdlAST = parse(bigSchemaSDL);

export const name = 'Validate SDL Document';
export const count = 10;
export function measure() {
  validateSDL(sdlAST);
}
