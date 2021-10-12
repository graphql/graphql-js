import { describe, it } from 'mocha';

import { buildSchema } from '../../utilities/buildASTSchema';

import { NoSchemaIntrospectionCustomRule } from '../rules/custom/NoSchemaIntrospectionCustomRule';

import { expectValidationErrorsWithSchema } from './harness';

function expectErrors(queryStr: string) {
  return expectValidationErrorsWithSchema(
    schema,
    NoSchemaIntrospectionCustomRule,
    queryStr,
  );
}

function expectValid(queryStr: string) {
  expectErrors(queryStr).toDeepEqual([]);
}

const schema = buildSchema(`
  type Query {
    someQuery: SomeType
  }

  type SomeType {
    someField: String
    introspectionField: __EnumValue
  }
`);

describe('Validate: Prohibit introspection queries', () => {
  it('ignores valid fields including __typename', () => {
    expectValid(`
      {
        someQuery {
          __typename
          someField
        }
      }
    `);
  });

  it('ignores fields not in the schema', () => {
    expectValid(`
      {
        __introspect
      }
    `);
  });

  it('reports error when a field with an introspection type is requested', () => {
    expectErrors(`
      {
        __schema {
          queryType {
            name
          }
        }
      }
    `).toDeepEqual([
      {
        message:
          'GraphQL introspection has been disabled, but the requested query contained the field "__schema".',
        locations: [{ line: 3, column: 9 }],
      },
      {
        message:
          'GraphQL introspection has been disabled, but the requested query contained the field "queryType".',
        locations: [{ line: 4, column: 11 }],
      },
    ]);
  });

  it('reports error when a field with an introspection type is requested and aliased', () => {
    expectErrors(`
      {
        s: __schema {
          queryType {
            name
          }
        }
      }
      `).toDeepEqual([
      {
        message:
          'GraphQL introspection has been disabled, but the requested query contained the field "__schema".',
        locations: [{ line: 3, column: 9 }],
      },
      {
        message:
          'GraphQL introspection has been disabled, but the requested query contained the field "queryType".',
        locations: [{ line: 4, column: 11 }],
      },
    ]);
  });

  it('reports error when using a fragment with a field with an introspection type', () => {
    expectErrors(`
      {
        ...QueryFragment
      }

      fragment QueryFragment on Query {
        __schema {
          queryType {
            name
          }
        }
      }
    `).toDeepEqual([
      {
        message:
          'GraphQL introspection has been disabled, but the requested query contained the field "__schema".',
        locations: [{ line: 7, column: 9 }],
      },
      {
        message:
          'GraphQL introspection has been disabled, but the requested query contained the field "queryType".',
        locations: [{ line: 8, column: 11 }],
      },
    ]);
  });

  it('reports error for non-standard introspection fields', () => {
    expectErrors(`
      {
        someQuery {
          introspectionField
        }
      }
    `).toDeepEqual([
      {
        message:
          'GraphQL introspection has been disabled, but the requested query contained the field "introspectionField".',
        locations: [{ line: 4, column: 11 }],
      },
    ]);
  });
});
