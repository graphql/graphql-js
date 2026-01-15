import { describe, it } from 'mocha';

import { buildSchema } from '../../utilities/buildASTSchema';

import { UniqueCapabilityIdentifiersRule } from '../rules/UniqueCapabilityIdentifiersRule';

import { expectSDLValidationErrors } from './harness';

function expectSDLErrors(sdlStr: string) {
  return expectSDLValidationErrors(
    undefined,
    UniqueCapabilityIdentifiersRule,
    sdlStr,
  );
}

function expectValidSDL(sdlStr: string) {
  expectSDLErrors(sdlStr).toDeepEqual([]);
}

describe('Validate: Unique capability identifiers', () => {
  it('no service definition', () => {
    expectValidSDL(`
      type Query {
        test: String
      }
    `);
  });

  it('unique capabilities', () => {
    expectValidSDL(`
      type Query {
        test: String
      }
      service {
        capability graphql.spec
        capability graphql.federatedQueries
        capability org.example.custom
      }
    `);
  });

  it('duplicate capabilities in service definition', () => {
    expectSDLErrors(`
      type Query {
        test: String
      }
      service {
        capability graphql.spec
        capability graphql.spec
      }
    `).toDeepEqual([
      {
        message: 'There can be only one capability named "graphql.spec".',
        locations: [
          { line: 6, column: 20 },
          { line: 7, column: 20 },
        ],
      },
    ]);
  });

  it('duplicate capabilities in service extension', () => {
    expectSDLErrors(`
      type Query {
        test: String
      }
      extend service {
        capability graphql.spec
        capability graphql.spec
      }
    `).toDeepEqual([
      {
        message: 'There can be only one capability named "graphql.spec".',
        locations: [
          { line: 6, column: 20 },
          { line: 7, column: 20 },
        ],
      },
    ]);
  });

  it('capability already exists in schema', () => {
    const schema = buildSchema(`
      type Query {
        test: String
      }
      service {
        capability graphql.spec
      }
    `);
    expectSDLValidationErrors(
      schema,
      UniqueCapabilityIdentifiersRule,
      `
      extend service {
        capability graphql.spec
      }
    `,
    ).toDeepEqual([
      {
        message:
          'Capability "graphql.spec" already exists in the schema. It cannot be redefined.',
        locations: [{ line: 3, column: 20 }],
      },
    ]);
  });

  it('unique capabilities across definition and extension', () => {
    expectValidSDL(`
      type Query {
        test: String
      }
      service {
        capability graphql.spec
      }
      extend service {
        capability graphql.federatedQueries
      }
    `);
  });
});
