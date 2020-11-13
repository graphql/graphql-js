'use strict';

const { parse } = require('graphql/language/parser.js');
const { validate } = require('graphql/validation/validate.js');
const { buildSchema } = require('graphql/utilities/buildASTSchema.js');

const { bigSchemaSDL } = require('./fixtures.js');

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

module.exports = {
  name: 'Validate Invalid Query',
  count: 50,
  measure() {
    validate(schema, queryAST);
  },
};
