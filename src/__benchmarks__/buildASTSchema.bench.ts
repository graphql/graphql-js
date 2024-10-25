import { bench, describe } from 'vitest';

import { parse } from '../language/parser.js';

import { buildASTSchema } from '../utilities/buildASTSchema.js';

import { bigSchemaSDL } from './fixtures.js';

const schemaAST = parse(bigSchemaSDL);

describe('Build Schema from AST', () => {
  bench('build schema', () => {
    buildASTSchema(schemaAST, { assumeValid: true });
  });
});
