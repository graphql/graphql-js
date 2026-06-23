import { describe, it } from 'mocha';

import { buildSchema } from '../../utilities/buildASTSchema';

import { LoneServiceDefinitionRule } from '../rules/LoneServiceDefinitionRule';

import { expectSDLValidationErrors } from './harness';

function expectSDLErrors(sdlStr: string) {
  return expectSDLValidationErrors(
    undefined,
    LoneServiceDefinitionRule,
    sdlStr,
  );
}

function expectValidSDL(sdlStr: string) {
  expectSDLErrors(sdlStr).toDeepEqual([]);
}

describe('Validate: Lone service definition', () => {
  it('no service definition', () => {
    expectValidSDL(`
      type Query {
        test: String
      }
    `);
  });

  it('one service definition', () => {
    expectValidSDL(`
      type Query {
        test: String
      }
      service {
        capability graphql.spec
      }
    `);
  });

  it('multiple service definitions', () => {
    expectSDLErrors(`
      type Query {
        test: String
      }
      service {
        capability graphql.spec
      }
      service {
        capability graphql.federatedQueries
      }
    `).toDeepEqual([
      {
        message: 'Must provide only one service definition.',
        locations: [{ line: 8, column: 7 }],
      },
    ]);
  });

  it('service definition in extension', () => {
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
      LoneServiceDefinitionRule,
      `
      service {
        capability graphql.federatedQueries
      }
    `,
    ).toDeepEqual([
      {
        message: 'Cannot define a new service within a schema extension.',
        locations: [{ line: 2, column: 7 }],
      },
    ]);
  });
});
