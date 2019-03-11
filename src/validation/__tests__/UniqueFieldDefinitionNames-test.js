/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow strict
 */

import { describe, it } from 'mocha';
import { buildSchema } from '../../utilities';
import { expectSDLValidationErrors } from './harness';
import {
  UniqueFieldDefinitionNames,
  duplicateFieldDefinitionNameMessage,
  existedFieldDefinitionNameMessage,
} from '../rules/UniqueFieldDefinitionNames';

function expectSDLErrors(sdlStr, schema) {
  return expectSDLValidationErrors(schema, UniqueFieldDefinitionNames, sdlStr);
}

function expectValidSDL(sdlStr, schema) {
  expectSDLErrors(sdlStr, schema).to.deep.equal([]);
}

function duplicateFieldName(typeName, fieldName, l1, c1, l2, c2) {
  return {
    message: duplicateFieldDefinitionNameMessage(typeName, fieldName),
    locations: [{ line: l1, column: c1 }, { line: l2, column: c2 }],
  };
}

function existedFieldName(typeName, fieldName, l1, c1) {
  return {
    message: existedFieldDefinitionNameMessage(typeName, fieldName),
    locations: [{ line: l1, column: c1 }],
  };
}

describe('Validate: Unique field definition names', () => {
  it('no fields', () => {
    expectValidSDL(`
      type SomeObject
      interface SomeInterface
      input SomeInputObject
    `);
  });

  it('one field', () => {
    expectValidSDL(`
      type SomeObject {
        foo: String
      }

      interface SomeInterface {
        foo: String
      }

      input SomeInputObject {
        foo: String
      }
    `);
  });

  it('multiple fields', () => {
    expectValidSDL(`
      type SomeObject {
        foo: String
        bar: String
      }

      interface SomeInterface {
        foo: String
        bar: String
      }

      input SomeInputObject {
        foo: String
        bar: String
      }
    `);
  });

  it('duplicate fields inside the same type definition', () => {
    expectSDLErrors(`
      type SomeObject {
        foo: String
        bar: String
        foo: String
      }

      interface SomeInterface {
        foo: String
        bar: String
        foo: String
      }

      input SomeInputObject {
        foo: String
        bar: String
        foo: String
      }
    `).to.deep.equal([
      duplicateFieldName('SomeObject', 'foo', 3, 9, 5, 9),
      duplicateFieldName('SomeInterface', 'foo', 9, 9, 11, 9),
      duplicateFieldName('SomeInputObject', 'foo', 15, 9, 17, 9),
    ]);
  });

  it('extend type with new field', () => {
    expectValidSDL(`
      type SomeObject {
        foo: String
      }
      extend type SomeObject {
        bar: String
      }
      extend type SomeObject {
        baz: String
      }

      interface SomeInterface {
        foo: String
      }
      extend interface SomeInterface {
        bar: String
      }
      extend interface SomeInterface {
        baz: String
      }

      input SomeInputObject {
        foo: String
      }
      extend input SomeInputObject {
        bar: String
      }
      extend input SomeInputObject {
        baz: String
      }
    `);
  });

  it('extend type with duplicate field', () => {
    expectSDLErrors(`
      extend type SomeObject {
        foo: String
      }
      type SomeObject {
        foo: String
      }

      extend interface SomeInterface {
        foo: String
      }
      interface SomeInterface {
        foo: String
      }

      extend input SomeInputObject {
        foo: String
      }
      input SomeInputObject {
        foo: String
      }
    `).to.deep.equal([
      duplicateFieldName('SomeObject', 'foo', 3, 9, 6, 9),
      duplicateFieldName('SomeInterface', 'foo', 10, 9, 13, 9),
      duplicateFieldName('SomeInputObject', 'foo', 17, 9, 20, 9),
    ]);
  });

  it('duplicate field inside extension', () => {
    expectSDLErrors(`
      type SomeObject
      extend type SomeObject {
        foo: String
        bar: String
        foo: String
      }

      interface SomeInterface
      extend interface SomeInterface {
        foo: String
        bar: String
        foo: String
      }

      input SomeInputObject
      extend input SomeInputObject {
        foo: String
        bar: String
        foo: String
      }
    `).to.deep.equal([
      duplicateFieldName('SomeObject', 'foo', 4, 9, 6, 9),
      duplicateFieldName('SomeInterface', 'foo', 11, 9, 13, 9),
      duplicateFieldName('SomeInputObject', 'foo', 18, 9, 20, 9),
    ]);
  });

  it('duplicate field inside different extensions', () => {
    expectSDLErrors(`
      type SomeObject
      extend type SomeObject {
        foo: String
      }
      extend type SomeObject {
        foo: String
      }

      interface SomeInterface
      extend interface SomeInterface {
        foo: String
      }
      extend interface SomeInterface {
        foo: String
      }

      input SomeInputObject
      extend input SomeInputObject {
        foo: String
      }
      extend input SomeInputObject {
        foo: String
      }
    `).to.deep.equal([
      duplicateFieldName('SomeObject', 'foo', 4, 9, 7, 9),
      duplicateFieldName('SomeInterface', 'foo', 12, 9, 15, 9),
      duplicateFieldName('SomeInputObject', 'foo', 20, 9, 23, 9),
    ]);
  });

  it('adding new field to the type inside existing schema', () => {
    const schema = buildSchema(`
      type SomeObject
      interface SomeInterface
      input SomeInputObject
    `);
    const sdl = `
      extend type SomeObject {
        foo: String
      }

      extend interface SomeInterface {
        foo: String
      }

      extend input SomeInputObject {
        foo: String
      }
    `;

    expectValidSDL(sdl, schema);
  });

  it('adding conflicting fields to existing schema twice', () => {
    const schema = buildSchema(`
      type SomeObject {
        foo: String
      }

      interface SomeInterface {
        foo: String
      }

      input SomeInputObject {
        foo: String
      }
    `);
    const sdl = `
      extend type SomeObject {
        foo: String
      }
      extend interface SomeInterface {
        foo: String
      }
      extend input SomeInputObject {
        foo: String
      }

      extend type SomeObject {
        foo: String
      }
      extend interface SomeInterface {
        foo: String
      }
      extend input SomeInputObject {
        foo: String
      }
    `;

    expectSDLErrors(sdl, schema).to.deep.equal([
      existedFieldName('SomeObject', 'foo', 3, 9),
      existedFieldName('SomeInterface', 'foo', 6, 9),
      existedFieldName('SomeInputObject', 'foo', 9, 9),

      existedFieldName('SomeObject', 'foo', 13, 9),
      existedFieldName('SomeInterface', 'foo', 16, 9),
      existedFieldName('SomeInputObject', 'foo', 19, 9),
    ]);
  });

  it('adding fields to existing schema twice', () => {
    const schema = buildSchema(`
      type SomeObject
      interface SomeInterface
      input SomeInputObject
    `);
    const sdl = `
      extend type SomeObject {
        foo: String
      }
      extend type SomeObject {
        foo: String
      }

      extend interface SomeInterface {
        foo: String
      }
      extend interface SomeInterface {
        foo: String
      }

      extend input SomeInputObject {
        foo: String
      }
      extend input SomeInputObject {
        foo: String
      }
    `;

    expectSDLErrors(sdl, schema).to.deep.equal([
      duplicateFieldName('SomeObject', 'foo', 3, 9, 6, 9),
      duplicateFieldName('SomeInterface', 'foo', 10, 9, 13, 9),
      duplicateFieldName('SomeInputObject', 'foo', 17, 9, 20, 9),
    ]);
  });
});
