import { bench, describe } from "vitest";

import { parse } from '../language/parser.js';

import { executeSync } from '../execution/execute.js';

import { buildSchema } from '../utilities/buildASTSchema.js';
import { getIntrospectionQuery } from '../utilities/getIntrospectionQuery.js';

import { bigSchemaSDL } from './fixtures.js';

const schema = buildSchema(bigSchemaSDL, { assumeValid: true });
const document = parse(getIntrospectionQuery());

describe('Execute Introspection Query', () => {
  bench('Introspection Query Execution', () => {
    executeSync({ schema, document });
  }, { iterations: 20 });
});