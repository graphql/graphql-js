import { parse } from 'graphql/language/parser.js';
import { buildSchema } from 'graphql/utilities/buildASTSchema.js';
import { validate } from 'graphql/validation/validate.js';

import { bigSchemaSDL } from './fixtures.js';

const schema = buildSchema(bigSchemaSDL, { assumeValid: true });
const queryAST = parse(`
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

export const benchmark = {
  name: 'Validate Invalid Query',
  count: 50,
  measure() {
    validate(schema, queryAST);
  },
};
