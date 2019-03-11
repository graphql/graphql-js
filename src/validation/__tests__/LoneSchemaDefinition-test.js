/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow strict
 */

import { describe, it } from 'mocha';
import { expectSDLValidationErrors } from './harness';
import {
  LoneSchemaDefinition,
  schemaDefinitionNotAloneMessage,
  canNotDefineSchemaWithinExtensionMessage,
} from '../rules/LoneSchemaDefinition';
import { buildSchema } from '../../utilities';

function expectSDLErrors(sdlStr, schema) {
  return expectSDLValidationErrors(schema, LoneSchemaDefinition, sdlStr);
}

function expectValidSDL(sdlStr, schema) {
  expectSDLErrors(sdlStr, schema).to.deep.equal([]);
}

function schemaDefinitionNotAlone(line, column) {
  return {
    message: schemaDefinitionNotAloneMessage(),
    locations: [{ line, column }],
  };
}

function canNotDefineSchemaWithinExtension(line, column) {
  return {
    message: canNotDefineSchemaWithinExtensionMessage(),
    locations: [{ line, column }],
  };
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
      schemaDefinitionNotAlone(10, 7),
      schemaDefinitionNotAlone(14, 7),
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
    ).to.deep.equal([canNotDefineSchemaWithinExtension(2, 9)]);
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
    ).to.deep.equal([canNotDefineSchemaWithinExtension(2, 9)]);
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
