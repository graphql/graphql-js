import { parse } from '../../language/parser';

import { buildASTSchema } from '../buildASTSchema';

import { bigSchemaSDL } from '../../__fixtures__/index';

const schemaAST = parse(bigSchemaSDL);

export const name = 'Build Schema from AST';
export const count = 10;
export function measure() {
  buildASTSchema(schemaAST, { assumeValid: true });
}
