import { bench, describe } from 'vitest';

import { parse } from '../language/parser.js';

import { validate, validateSDL } from '../validation/validate.js';

import { buildSchema } from '../utilities/buildASTSchema.js';
import { getIntrospectionQuery } from '../utilities/getIntrospectionQuery.js';

import { bigSchemaSDL } from './fixtures.js';

const schema = buildSchema(bigSchemaSDL, { assumeValid: true });
const queryAST = parse(getIntrospectionQuery());

const sdlAST = parse(bigSchemaSDL);


const invalidQueryAST = parse(`
  {
    unknownField
    ... on unknownType {
      anotherUnknownField
      ...unknownFragment
    }
  }

  fragment TestFragment on anotherUnknownType {
    yetAnotherUnknownField
  }
`);

describe('GraphQL Parsing and Validation Benchmarks', () => {
  bench('Validate Introspection Query', () => {
    validate(schema, queryAST);
  });

  bench('Validate SDL Document', () => {
    validateSDL(sdlAST);
  });

  bench('Validate Invalid Query', () => {
    validate(schema, invalidQueryAST);
  });
});