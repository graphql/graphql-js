// @flow strict

import { bigSchemaSDL } from '../../__fixtures__';

import { parse } from '../../';
import { buildASTSchema } from '../buildASTSchema';

const schemaAST = parse(bigSchemaSDL);

export const name = 'Build Schema from AST';
export function measure() {
  buildASTSchema(schemaAST, { assumeValid: true });
}
