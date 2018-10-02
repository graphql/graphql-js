/**
 * Copyright (c) 2018-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow strict
 */

import { describe, it } from 'mocha';
import { expectSDLErrorsFromRule } from './harness';
import {
  LoneSchemaDefinition,
  schemaDefinitionNotAloneMessage,
  canNotDefineSchemaWithinExtensionMessage,
} from '../rules/LoneSchemaDefinition';
import { buildSchema } from '../../utilities';

const expectSDLErrors = expectSDLErrorsFromRule.bind(
  undefined,
  LoneSchemaDefinition,
);

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
    expectSDLErrors(`
      type Query {
        foo: String
      }
    `).to.deep.equal([]);
  });

  it('one schema definition', () => {
    expectSDLErrors(`
      schema {
        query: Foo
      }

      type Foo {
        foo: String
      }
    `).to.deep.equal([]);
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

    expectSDLErrors(
      `
        extend schema {
          mutation: Foo
        }
      `,
      schema,
    ).to.deep.equal([]);
  });
});
