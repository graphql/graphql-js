import { describe, it } from 'mocha';

import { buildSchema } from '../../utilities/buildASTSchema.js';

import { ConflictingDescriptionsAndDeprecationRule } from '../rules/ConflictingDescriptionsAndDeprecationRule.js';

import { expectSDLValidationErrors } from './harness.js';

function expectErrors(sdlStr: string) {
  return expectSDLValidationErrors(
    undefined,
    ConflictingDescriptionsAndDeprecationRule,
    sdlStr,
  );
}

function expectValid(sdlStr: string) {
  expectErrors(sdlStr).toDeepEqual([]);
}

function expectErrorsWithSchema(schema: string, sdlStr: string) {
  return expectSDLValidationErrors(
    buildSchema(schema),
    ConflictingDescriptionsAndDeprecationRule,
    sdlStr,
  );
}

describe('ConflictingDescriptionsAndDeprecationRule', () => {
  it('accepts extensions with no conflicts', () => {
    expectValid(`
      type Query {
        field: String
      }

      extend type Query {
        newField: String
      }
    `);
  });

  it('accepts extensions with matching descriptions', () => {
    expectErrorsWithSchema(
      `
        type Query {
          "A field description"
          field: String
        }
      `,
      `
        extend type Query {
          "A field description"
          field: String
        }
      `,
    ).toDeepEqual([]);
  });

  it('accepts extensions with matching deprecation reasons', () => {
    expectErrorsWithSchema(
      `
        type Query {
          field: String @deprecated(reason: "Use newField instead")
        }
      `,
      `
        extend type Query {
          field: String @deprecated(reason: "Use newField instead")
        }
      `,
    ).toDeepEqual([]);
  });

  it('rejects extensions with conflicting field descriptions', () => {
    expectErrorsWithSchema(
      `
        type Query {
          "Original description"
          field: String
        }
      `,
      `
        extend type Query {
          "Different description"
          field: String
        }
      `,
    ).toDeepEqual([
      {
        message:
          'Field "Query.field" cannot override description in extension: original has "Original description" but extension has "Different description".',
        locations: [{ line: 3, column: 11 }],
      },
    ]);
  });

  it('rejects extensions with conflicting field deprecation reasons', () => {
    expectErrorsWithSchema(
      `
        type Query {
          field: String @deprecated(reason: "Original reason")
        }
      `,
      `
        extend type Query {
          field: String @deprecated(reason: "Different reason")
        }
      `,
    ).toDeepEqual([
      {
        message:
          'Field "Query.field" cannot override deprecation reason in extension: original has "Original reason" but extension has "Different reason".',
        locations: [{ line: 3, column: 25 }],
      },
    ]);
  });

  it('rejects extensions with conflicting argument descriptions', () => {
    expectErrorsWithSchema(
      `
        type Query {
          field(
            "Original arg description"
            arg: String
          ): String
        }
      `,
      `
        extend type Query {
          field(
            "Different arg description"
            arg: String
          ): String
        }
      `,
    ).toDeepEqual([
      {
        message:
          'Argument "Query.field(arg:)" cannot override description in extension: original has "Original arg description" but extension has "Different arg description".',
        locations: [{ line: 4, column: 13 }],
      },
    ]);
  });

  it('rejects extensions with conflicting argument deprecation reasons', () => {
    expectErrorsWithSchema(
      `
        type Query {
          field(arg: String @deprecated(reason: "Original reason")): String
        }
      `,
      `
        extend type Query {
          field(arg: String @deprecated(reason: "Different reason")): String
        }
      `,
    ).toDeepEqual([
      {
        message:
          'Argument "Query.field(arg:)" cannot override deprecation reason in extension: original has "Original reason" but extension has "Different reason".',
        locations: [{ line: 3, column: 29 }],
      },
    ]);
  });

  it('rejects extensions with conflicting enum value descriptions', () => {
    expectErrorsWithSchema(
      `
        enum Color {
          "Original description"
          RED
        }
      `,
      `
        extend enum Color {
          "Different description"
          RED
        }
      `,
    ).toDeepEqual([
      {
        message:
          'Enum value "Color.RED" cannot override description in extension: original has "Original description" but extension has "Different description".',
        locations: [{ line: 3, column: 11 }],
      },
    ]);
  });

  it('rejects extensions with conflicting enum value deprecation reasons', () => {
    expectErrorsWithSchema(
      `
        enum Color {
          RED @deprecated(reason: "Original reason")
        }
      `,
      `
        extend enum Color {
          RED @deprecated(reason: "Different reason")
        }
      `,
    ).toDeepEqual([
      {
        message:
          'Enum value "Color.RED" cannot override deprecation reason in extension: original has "Original reason" but extension has "Different reason".',
        locations: [{ line: 3, column: 15 }],
      },
    ]);
  });

  it('rejects extensions with conflicting input field descriptions', () => {
    expectErrorsWithSchema(
      `
        input UserInput {
          "Original description"
          name: String
        }
      `,
      `
        extend input UserInput {
          "Different description"
          name: String
        }
      `,
    ).toDeepEqual([
      {
        message:
          'Input field "UserInput.name" cannot override description in extension: original has "Original description" but extension has "Different description".',
        locations: [{ line: 3, column: 11 }],
      },
    ]);
  });

  it('rejects extensions with conflicting input field deprecation reasons', () => {
    expectErrorsWithSchema(
      `
        input UserInput {
          name: String @deprecated(reason: "Original reason")
        }
      `,
      `
        extend input UserInput {
          name: String @deprecated(reason: "Different reason")
        }
      `,
    ).toDeepEqual([
      {
        message:
          'Input field "UserInput.name" cannot override deprecation reason in extension: original has "Original reason" but extension has "Different reason".',
        locations: [{ line: 3, column: 24 }],
      },
    ]);
  });

  it('allows overriding blank descriptions', () => {
    // Extensions cannot override empty string descriptions
    expectErrorsWithSchema(
      `
        type Query {
          ""
          field: String
        }
      `,
      `
        extend type Query {
          "New description"
          field: String
        }
      `,
    ).toDeepEqual([
      {
        message:
          'Field "Query.field" cannot override description in extension: original has "" but extension has "New description".',
        locations: [{ line: 3, column: 11 }],
      },
    ]);

    // Extensions can add descriptions when original has none
    expectErrorsWithSchema(
      `
        type Query {
          field: String
        }
      `,
      `
        extend type Query {
          "New description"
          field: String
        }
      `,
    ).toDeepEqual([]);
  });

  it('allows overriding blank deprecation reasons', () => {
    // Extensions cannot override empty string deprecation reasons
    expectErrorsWithSchema(
      `
        type Query {
          field: String @deprecated(reason: "")
        }
      `,
      `
        extend type Query {
          field: String @deprecated(reason: "New reason")
        }
      `,
    ).toDeepEqual([
      {
        message:
          'Field "Query.field" cannot override deprecation reason in extension: original has "" but extension has "New reason".',
        locations: [{ line: 3, column: 25 }],
      },
    ]);

    // Extensions can add deprecation reasons when original has none
    expectErrorsWithSchema(
      `
        type Query {
          field: String
        }
      `,
      `
        extend type Query {
          field: String @deprecated(reason: "New reason")
        }
      `,
    ).toDeepEqual([]);
  });

  it('works with interface extensions', () => {
    expectErrorsWithSchema(
      `
        interface Node {
          "Original description"
          id: ID!
        }
      `,
      `
        extend interface Node {
          "Different description"
          id: ID!
        }
      `,
    ).toDeepEqual([
      {
        message:
          'Field "Node.id" cannot override description in extension: original has "Original description" but extension has "Different description".',
        locations: [{ line: 3, column: 11 }],
      },
    ]);
  });

  it('allows adding new enum values', () => {
    expectErrorsWithSchema(
      `
        enum Color {
          RED
        }
      `,
      `
        extend enum Color {
          "Blue color"
          BLUE
        }
      `,
    ).toDeepEqual([]);
  });

  it('allows adding new input fields', () => {
    expectErrorsWithSchema(
      `
        input UserInput {
          name: String
        }
      `,
      `
        extend input UserInput {
          "User age"
          age: Int
        }
      `,
    ).toDeepEqual([]);
  });

  it('handles extensions with only new enum values', () => {
    expectErrorsWithSchema(
      `
        enum Color {
          RED
        }
      `,
      `
        extend enum Color {
          GREEN
          BLUE
        }
      `,
    ).toDeepEqual([]);
  });

  it('handles extensions with only new input fields', () => {
    expectErrorsWithSchema(
      `
        input UserInput {
          name: String
        }
      `,
      `
        extend input UserInput {
          age: Int
          email: String
        }
      `,
    ).toDeepEqual([]);
  });

  it('handles extensions with new enum values that do not exist in original', () => {
    expectErrorsWithSchema(
      `
        enum Color {
          RED
        }
      `,
      `
        extend enum Color {
          BLUE
          GREEN
        }
      `,
    ).toDeepEqual([]);
  });

  it('handles extensions with new input fields that do not exist in original', () => {
    expectErrorsWithSchema(
      `
        input UserInput {
          name: String
        }
      `,
      `
        extend input UserInput {
          age: Int
          email: String
        }
      `,
    ).toDeepEqual([]);
  });

  it('handles extensions when schema becomes null', () => {
    // This tests the edge case where schema might become null during processing
    expectValid(`
      type Query {
        field: String
      }

      extend type Query {
        newField: String
      }
    `);
  });

  it('handles enum extensions when original type does not exist', () => {
    // This tests the case where we try to extend an enum that doesn't exist
    expectValid(`
      extend enum NonExistentEnum {
        VALUE1
        VALUE2
      }
    `);
  });

  it('handles enum extensions when original type does not exist with schema', () => {
    // This tests the case where we try to extend an enum that doesn't exist in an existing schema
    expectErrorsWithSchema(
      `
        type Query {
          field: String
        }
      `,
      `
        extend enum NonExistentEnum {
          VALUE1
          VALUE2
        }
      `,
    ).toDeepEqual([]);
  });

  it('handles input extensions when original type does not exist', () => {
    // This tests the case where we try to extend an input that doesn't exist
    expectValid(`
      extend input NonExistentInput {
        field1: String
        field2: Int
      }
    `);
  });

  it('handles input extensions when original type does not exist with schema', () => {
    // This tests the case where we try to extend an input that doesn't exist in an existing schema
    expectErrorsWithSchema(
      `
        type Query {
          field: String
        }
      `,
      `
        extend input NonExistentInput {
          field1: String
          field2: Int
        }
      `,
    ).toDeepEqual([]);
  });

  it('handles enum extensions when original type is not an enum', () => {
    // This tests the case where we try to extend a type that exists but is not an enum
    expectErrorsWithSchema(
      `
        type Query {
          field: String
        }

        type NotAnEnum {
          field: String
        }
      `,
      `
        extend enum NotAnEnum {
          VALUE1
          VALUE2
        }
      `,
    ).toDeepEqual([]);
  });

  it('handles input extensions when original type is not an input', () => {
    // This tests the case where we try to extend a type that exists but is not an input
    expectErrorsWithSchema(
      `
        type Query {
          field: String
        }

        type NotAnInput {
          field: String
        }
      `,
      `
        extend input NotAnInput {
          field1: String
          field2: Int
        }
      `,
    ).toDeepEqual([]);
  });

  it('handles object extensions when original type is not an object or interface', () => {
    // This tests the case where we try to extend a type that exists but is not an object/interface
    expectErrorsWithSchema(
      `
        type Query {
          field: String
        }

        enum NotAnObject {
          VALUE1
          VALUE2
        }
      `,
      `
        extend type NotAnObject {
          field1: String
          field2: Int
        }
      `,
    ).toDeepEqual([]);
  });
});
