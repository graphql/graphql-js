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
  UniqueTypeNames,
  existedTypeNameMessage,
  duplicateTypeNameMessage,
} from '../rules/UniqueTypeNames';

function expectSDLErrors(sdlStr, schema) {
  return expectSDLValidationErrors(schema, UniqueTypeNames, sdlStr);
}

function expectValidSDL(sdlStr, schema) {
  expectSDLErrors(sdlStr, schema).to.deep.equal([]);
}

describe('Validate: Unique type names', () => {
  it('no types', () => {
    expectValidSDL(`
      directive @test on SCHEMA
    `);
  });

  it('one type', () => {
    expectValidSDL(`
      type Foo
    `);
  });

  it('many types', () => {
    expectValidSDL(`
      type Foo
      type Bar
      type Baz
    `);
  });

  it('type and non-type definitions named the same', () => {
    expectValidSDL(`
      query Foo { __typename }
      fragment Foo on Query { __typename }
      directive @Foo on SCHEMA

      type Foo
    `);
  });

  it('types named the same', () => {
    expectSDLErrors(`
      type Foo

      scalar Foo
      type Foo
      interface Foo
      union Foo
      enum Foo
      input Foo
    `).to.deep.equal([
      {
        message: duplicateTypeNameMessage('Foo'),
        locations: [{ line: 2, column: 12 }, { line: 4, column: 14 }],
      },
      {
        message: duplicateTypeNameMessage('Foo'),
        locations: [{ line: 2, column: 12 }, { line: 5, column: 12 }],
      },
      {
        message: duplicateTypeNameMessage('Foo'),
        locations: [{ line: 2, column: 12 }, { line: 6, column: 17 }],
      },
      {
        message: duplicateTypeNameMessage('Foo'),
        locations: [{ line: 2, column: 12 }, { line: 7, column: 13 }],
      },
      {
        message: duplicateTypeNameMessage('Foo'),
        locations: [{ line: 2, column: 12 }, { line: 8, column: 12 }],
      },
      {
        message: duplicateTypeNameMessage('Foo'),
        locations: [{ line: 2, column: 12 }, { line: 9, column: 13 }],
      },
    ]);
  });

  it('adding new type to existing schema', () => {
    const schema = buildSchema('type Foo');

    expectValidSDL('type Bar', schema);
  });

  it('adding new type to existing schema with same-named directive', () => {
    const schema = buildSchema('directive @Foo on SCHEMA');

    expectValidSDL('type Foo', schema);
  });

  it('adding conflicting types to existing schema', () => {
    const schema = buildSchema('type Foo');
    const sdl = `
      scalar Foo
      type Foo
      interface Foo
      union Foo
      enum Foo
      input Foo
    `;

    expectSDLErrors(sdl, schema).to.deep.equal([
      {
        message: existedTypeNameMessage('Foo'),
        locations: [{ line: 2, column: 14 }],
      },
      {
        message: existedTypeNameMessage('Foo'),
        locations: [{ line: 3, column: 12 }],
      },
      {
        message: existedTypeNameMessage('Foo'),
        locations: [{ line: 4, column: 17 }],
      },
      {
        message: existedTypeNameMessage('Foo'),
        locations: [{ line: 5, column: 13 }],
      },
      {
        message: existedTypeNameMessage('Foo'),
        locations: [{ line: 6, column: 12 }],
      },
      {
        message: existedTypeNameMessage('Foo'),
        locations: [{ line: 7, column: 13 }],
      },
    ]);
  });
});
