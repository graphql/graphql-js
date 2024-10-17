import { bench, describe } from "vitest";
import { bigSchemaSDL } from './fixtures';
import { parse } from '../language/parser';
import { buildASTSchema } from '../utilities/buildASTSchema';

const schemaAST = parse(bigSchemaSDL);

describe("Build Schema from AST", () => {
  bench("build schema", () => {
    buildASTSchema(schemaAST, { assumeValid: true });
  });
});