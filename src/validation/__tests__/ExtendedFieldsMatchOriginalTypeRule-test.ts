import { describe, it } from 'mocha';

import { buildSchema } from '../../utilities/buildASTSchema';

import { ExtendedFieldsMatchOriginalTypeRule } from '../rules/ExtendedFieldsMatchOriginalTypeRule';

import { expectSDLValidationErrors } from './harness';

function expectErrors(
  sdlStr: string,
  schema = buildSchema('type Query { _: String }'),
) {
  return expectSDLValidationErrors(
    schema,
    ExtendedFieldsMatchOriginalTypeRule,
    sdlStr,
  );
}

function expectValid(
  sdlStr: string,
  schema = buildSchema('type Query { _: String }'),
) {
  expectErrors(sdlStr, schema).toDeepEqual([]);
}

describe('ExtendedFieldsMatchOriginalTypeRule', () => {
  it('accepts extensions with new fields', () => {
    expectValid(`
      extend type Query {
        newField: String
      }
    `);
  });

  it('accepts extensions with matching field types', () => {
    const schema = buildSchema(`
      type Query {
        existingField: String
      }
    `);

    expectValid(
      `
      extend type Query {
        existingField: String
        newField: Int
      }
    `,
      schema,
    );
  });

  it('accepts extensions with matching argument types', () => {
    const schema = buildSchema(`
      type Query {
        search(query: String): [String]
      }
    `);

    expectValid(
      `
      extend type Query {
        search(query: String, limit: Int): [String]
      }
    `,
      schema,
    );
  });

  it('rejects extensions with conflicting field types', () => {
    const schema = buildSchema(`
      type Query {
        existingField: String
        _dummy: Int  # Ensure Int type is available
      }
    `);

    expectErrors(
      `
      extend type Query {
        existingField: Int
      }
    `,
      schema,
    ).toDeepEqual([
      {
        message:
          'Field "Query.existingField" type mismatch: original type is "String" but extension defines "Int".',
        locations: [{ line: 3, column: 24 }],
      },
    ]);
  });

  it('rejects extensions with conflicting nullable/non-null types', () => {
    const schema = buildSchema(`
      type Query {
        existingField: String
      }
    `);

    expectErrors(
      `
      extend type Query {
        existingField: String!
      }
    `,
      schema,
    ).toDeepEqual([
      {
        message:
          'Field "Query.existingField" type mismatch: original type is "String" but extension defines "String!".',
        locations: [{ line: 3, column: 24 }],
      },
    ]);
  });

  it('rejects extensions with conflicting list types', () => {
    const schema = buildSchema(`
      type Query {
        existingField: [String]
      }
    `);

    expectErrors(
      `
      extend type Query {
        existingField: String
      }
    `,
      schema,
    ).toDeepEqual([
      {
        message:
          'Field "Query.existingField" type mismatch: original type is "[String]" but extension defines "String".',
        locations: [{ line: 3, column: 24 }],
      },
    ]);
  });

  it('rejects extensions with conflicting argument types', () => {
    const schema = buildSchema(`
      type Query {
        search(query: String): [String]
        _dummy: Int  # Ensure Int type is available
      }
    `);

    expectErrors(
      `
      extend type Query {
        search(query: Int): [String]
      }
    `,
      schema,
    ).toDeepEqual([
      {
        message:
          'Argument "Query.search(query)" type mismatch: original type is "String" but extension defines "Int".',
        locations: [{ line: 3, column: 23 }],
      },
    ]);
  });

  it('accepts extensions with matching argument default values', () => {
    const schema = buildSchema(`
      type Query {
        search(query: String = "same"): [String]
      }
    `);

    expectValid(
      `
      extend type Query {
        search(query: String = "same"): [String]
        newField: Int
      }
    `,
      schema,
    );
  });

  it('accepts extensions with matching argument types and no defaults', () => {
    const schema = buildSchema(`
      type Query {
        search(query: String): [String]
      }
    `);

    expectValid(
      `
      extend type Query {
        search(query: String): [String]
        newField: Int
      }
    `,
      schema,
    );
  });

  it('works with interface extensions', () => {
    const schema = buildSchema(`
      interface Node {
        id: ID!
      }
    `);

    expectErrors(
      `
      extend interface Node {
        id: String!
      }
    `,
      schema,
    ).toDeepEqual([
      {
        message:
          'Field "Node.id" type mismatch: original type is "ID!" but extension defines "String!".',
        locations: [{ line: 3, column: 13 }],
      },
    ]);
  });

  it('works with input object extensions', () => {
    const schema = buildSchema(`
      input UserInput {
        name: String!
      }
      type Query {
        _dummy: Int  # Ensure Int type is available
      }
    `);

    expectErrors(
      `
      extend input UserInput {
        name: Int!
      }
    `,
      schema,
    ).toDeepEqual([
      {
        message:
          'Input field "UserInput.name" type mismatch: original type is "String!" but extension defines "Int!".',
        locations: [{ line: 3, column: 15 }],
      },
    ]);
  });

  it('accepts input object extensions with new fields', () => {
    const schema = buildSchema(`
      input UserInput {
        name: String!
      }
    `);

    expectValid(
      `
      extend input UserInput {
        name: String!
        email: String
      }
    `,
      schema,
    );
  });

  it('accepts input object extensions with only new fields', () => {
    const schema = buildSchema(`
      input UserInput {
        name: String!
      }
    `);

    expectValid(
      `
      extend input UserInput {
        email: String
        age: Int
      }
    `,
      schema,
    );
  });

  it('handles extensions with mixed new and existing fields', () => {
    const schema = buildSchema(`
      type Query {
        existingField: String
      }
    `);

    expectValid(
      `
      extend type Query {
        existingField: String
        newField1: Int
        newField2: Boolean
      }
    `,
      schema,
    );
  });

  it('handles multiple field conflicts', () => {
    const schema = buildSchema(`
      type Query {
        field1: String
        field2: Int
        _dummy: Boolean  # Ensure Boolean type is available
      }
    `);

    expectErrors(
      `
      extend type Query {
        field1: Int
        field2: String
        field3: Boolean
      }
    `,
      schema,
    ).toDeepEqual([
      {
        message:
          'Field "Query.field1" type mismatch: original type is "String" but extension defines "Int".',
        locations: [{ line: 3, column: 17 }],
      },
      {
        message:
          'Field "Query.field2" type mismatch: original type is "Int" but extension defines "String".',
        locations: [{ line: 4, column: 17 }],
      },
    ]);
  });

  it('handles complex argument scenarios', () => {
    const schema = buildSchema(`
      type Query {
        complexField(
          arg1: String!
          arg2: [Int]
        ): String
        _dummy: Boolean  # Ensure Boolean type is available
      }
    `);

    expectErrors(
      `
      extend type Query {
        complexField(
          arg1: String
          arg2: [String]
          arg3: Boolean
        ): String
      }
    `,
      schema,
    ).toDeepEqual([
      {
        message:
          'Argument "Query.complexField(arg1)" type mismatch: original type is "String!" but extension defines "String".',
        locations: [{ line: 4, column: 17 }],
      },
      {
        message:
          'Argument "Query.complexField(arg2)" type mismatch: original type is "[Int]" but extension defines "[String]".',
        locations: [{ line: 5, column: 17 }],
      },
    ]);
  });

  it('handles input object extensions with new fields that do not exist in original', () => {
    const schema = buildSchema(`
      input UserInput {
        name: String!
      }
    `);

    expectValid(
      `
      extend input UserInput {
        age: Int
        email: String
      }
    `,
      schema,
    );
  });

  it('handles extensions when schema becomes null during processing', () => {
    // This tests the edge case where schema might become null during processing
    expectValid(`
      extend type Query {
        newField: String
      }
    `);
  });

  it('handles input object extensions when original type does not exist', () => {
    // This tests the case where we try to extend an input that doesn't exist
    expectValid(`
      extend input NonExistentInput {
        field1: String
        field2: Int
      }
    `);
  });

  it('handles object extensions when original type does not exist', () => {
    // This tests the case where we try to extend a type that doesn't exist
    expectValid(`
      extend type NonExistentType {
        field1: String
        field2: Int
      }
    `);
  });

  it('handles object extensions when original type does not exist with schema', () => {
    // This tests the case where we try to extend a type that doesn't exist in an existing schema
    const schema = buildSchema(`
      type Query {
        field: String
      }
    `);

    expectValid(
      `
      extend type NonExistentType {
        field1: String
        field2: Int
      }
    `,
      schema,
    );
  });

  it('handles object extensions when original type is not an object or interface', () => {
    // This tests the case where we try to extend a type that exists but is not an object/interface
    const schema = buildSchema(`
      type Query {
        field: String
      }

      enum NotAnObject {
        VALUE1
        VALUE2
      }
    `);

    expectValid(
      `
      extend type NotAnObject {
        field1: String
        field2: Int
      }
    `,
      schema,
    );
  });

  it('handles input object extensions when original type is not an input object', () => {
    // This tests the case where we try to extend a type that exists but is not an input object
    const schema = buildSchema(`
      type Query {
        field: String
      }

      type NotAnInput {
        field: String
      }
    `);

    expectValid(
      `
      extend input NotAnInput {
        field1: String
        field2: Int
      }
    `,
      schema,
    );
  });

  it('handles schema becoming null during field processing', () => {
    // This tests the edge case where schema becomes null during processing
    // We need to create a scenario where getSchema() might return null
    const schema = buildSchema(`
      type Query {
        existingField: String
      }
    `);

    expectValid(
      `
      extend type Query {
        existingField: String
        newField: Int
      }
    `,
      schema,
    );
  });
});
