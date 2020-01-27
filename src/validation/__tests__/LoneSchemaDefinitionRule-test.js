// @flow strict

import { describe, it } from 'mocha';

import { buildSchema } from '../../utilities/buildASTSchema';

import { LoneSchemaDefinitionRuleRule } from '../rules/LoneSchemaDefinitionRule';

import { expectSDLValidationErrors } from './harness';

function expectSDLErrors(sdlStr, schema) {
  return expectSDLValidationErrors(
    schema,
    LoneSchemaDefinitionRuleRule,
    sdlStr,
  );
}

function expectValidSDL(sdlStr, schema) {
  expectSDLErrors(sdlStr, schema).to.deep.equal([]);
}

describe('Validate: Schema definition should be alone', () => {
  it('no schema', () => {
    expectValidSDL(`
      type Query {
        foo: String
      }
    `);
  });

  it('one schema definition', () => {
    expectValidSDL(`
      schema {
        query: Foo
      }

      type Foo {
        foo: String
      }
    `);
  });

  it('multiple schema definitions', () => {
    expectSDLErrors(`
      schema {
        query: Foo
      }

      type Foo {
        foo: String
      }

      schema {
        mutation: Foo
      }

      schema {
        subscription: Foo
      }
    `).to.deep.equal([
      {
        message: 'Must provide only one schema definition.',
        locations: [{ line: 10, column: 7 }],
      },
      {
        message: 'Must provide only one schema definition.',
        locations: [{ line: 14, column: 7 }],
      },
    ]);
  });

  it('define schema in schema extension', () => {
    const schema = buildSchema(`
      type Foo {
        foo: String
      }
    `);

    expectSDLErrors(
      `
        schema {
          query: Foo
        }
      `,
      schema,
    ).to.deep.equal([]);
  });

  it('redefine schema in schema extension', () => {
    const schema = buildSchema(`
      schema {
        query: Foo
      }

      type Foo {
        foo: String
      }
    `);

    expectSDLErrors(
      `
        schema {
          mutation: Foo
        }
      `,
      schema,
    ).to.deep.equal([
      {
        message: 'Cannot define a new schema within a schema extension.',
        locations: [{ line: 2, column: 9 }],
      },
    ]);
  });

  it('redefine implicit schema in schema extension', () => {
    const schema = buildSchema(`
      type Query {
        fooField: Foo
      }

      type Foo {
        foo: String
      }
    `);

    expectSDLErrors(
      `
        schema {
          mutation: Foo
        }
      `,
      schema,
    ).to.deep.equal([
      {
        message: 'Cannot define a new schema within a schema extension.',
        locations: [{ line: 2, column: 9 }],
      },
    ]);
  });

  it('extend schema in schema extension', () => {
    const schema = buildSchema(`
      type Query {
        fooField: Foo
      }

      type Foo {
        foo: String
      }
    `);

    expectValidSDL(
      `
        extend schema {
          mutation: Foo
        }
      `,
      schema,
    );
  });
});
