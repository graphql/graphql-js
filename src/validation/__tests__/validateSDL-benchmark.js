/**
 * Copyright (c) 2018-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { bigSchemaSDL } from '../../__fixtures__';

import { parse } from '../../';
import { validateSDL } from '../validate';

const sdlAST = parse(bigSchemaSDL);

export const name = 'Validate SDL Document';
export function measure() {
  validateSDL(sdlAST);
}
