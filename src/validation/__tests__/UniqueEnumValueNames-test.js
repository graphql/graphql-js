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
  UniqueEnumValueNames,
  duplicateEnumValueNameMessage,
  existedEnumValueNameMessage,
} from '../rules/UniqueEnumValueNames';

function expectSDLErrors(sdlStr, schema) {
  return expectSDLValidationErrors(schema, UniqueEnumValueNames, sdlStr);
}

function expectValidSDL(sdlStr, schema) {
  expectSDLErrors(sdlStr, schema).to.deep.equal([]);
}

function duplicateEnumValuesName(typeName, valueName, l1, c1, l2, c2) {
  return {
    message: duplicateEnumValueNameMessage(typeName, valueName),
    locations: [{ line: l1, column: c1 }, { line: l2, column: c2 }],
  };
}

function existedEnumValueName(typeName, valueName, l1, c1) {
  return {
    message: existedEnumValueNameMessage(typeName, valueName),
    locations: [{ line: l1, column: c1 }],
  };
}

describe('Validate: Unique enum value names', () => {
  it('no values', () => {
    expectValidSDL(`
      enum SomeEnum
    `);
  });

  it('one value', () => {
    expectValidSDL(`
      enum SomeEnum {
        FOO
      }
    `);
  });

  it('multiple values', () => {
    expectValidSDL(`
      enum SomeEnum {
        FOO
        BAR
      }
    `);
  });

  it('duplicate values inside the same enum definition', () => {
    expectSDLErrors(`
      enum SomeEnum {
        FOO
        BAR
        FOO
      }
    `).to.deep.equal([duplicateEnumValuesName('SomeEnum', 'FOO', 3, 9, 5, 9)]);
  });

  it('extend enum with new value', () => {
    expectValidSDL(`
      enum SomeEnum {
        FOO
      }
      extend enum SomeEnum {
        BAR
      }
      extend enum SomeEnum {
        BAZ
      }
    `);
  });

  it('extend enum with duplicate value', () => {
    expectSDLErrors(`
      extend enum SomeEnum {
        FOO
      }
      enum SomeEnum {
        FOO
      }
    `).to.deep.equal([duplicateEnumValuesName('SomeEnum', 'FOO', 3, 9, 6, 9)]);
  });

  it('duplicate value inside extension', () => {
    expectSDLErrors(`
      enum SomeEnum
      extend enum SomeEnum {
        FOO
        BAR
        FOO
      }
    `).to.deep.equal([duplicateEnumValuesName('SomeEnum', 'FOO', 4, 9, 6, 9)]);
  });

  it('duplicate value inside different extensions', () => {
    expectSDLErrors(`
      enum SomeEnum
      extend enum SomeEnum {
        FOO
      }
      extend enum SomeEnum {
        FOO
      }
    `).to.deep.equal([duplicateEnumValuesName('SomeEnum', 'FOO', 4, 9, 7, 9)]);
  });

  it('adding new value to the type inside existing schema', () => {
    const schema = buildSchema('enum SomeEnum');
    const sdl = `
      extend enum SomeEnum {
        FOO
      }
    `;

    expectValidSDL(sdl, schema);
  });

  it('adding conflicting value to existing schema twice', () => {
    const schema = buildSchema(`
      enum SomeEnum {
        FOO
      }
    `);
    const sdl = `
      extend enum SomeEnum {
        FOO
      }
      extend enum SomeEnum {
        FOO
      }
    `;

    expectSDLErrors(sdl, schema).to.deep.equal([
      existedEnumValueName('SomeEnum', 'FOO', 3, 9),
      existedEnumValueName('SomeEnum', 'FOO', 6, 9),
    ]);
  });

  it('adding enum values to existing schema twice', () => {
    const schema = buildSchema('enum SomeEnum');
    const sdl = `
      extend enum SomeEnum {
        FOO
      }
      extend enum SomeEnum {
        FOO
      }
    `;

    expectSDLErrors(sdl, schema).to.deep.equal([
      duplicateEnumValuesName('SomeEnum', 'FOO', 3, 9, 6, 9),
    ]);
  });
});
