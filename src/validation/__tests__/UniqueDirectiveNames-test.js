/**
 * Copyright (c) 2018-present, Facebook, Inc.
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
  UniqueDirectiveNames,
  existedDirectiveNameMessage,
  duplicateDirectiveNameMessage,
} from '../rules/UniqueDirectiveNames';

function expectSDLErrors(sdlStr, schema) {
  return expectSDLValidationErrors(schema, UniqueDirectiveNames, sdlStr);
}

function expectValidSDL(sdlStr, schema) {
  expectSDLErrors(sdlStr, schema).to.deep.equal([]);
}

describe('Validate: Unique directive names', () => {
  it('no directive', () => {
    expectValidSDL(`
      type Foo
    `);
  });

  it('one directive', () => {
    expectValidSDL(`
      directive @foo on SCHEMA
    `);
  });

  it('many directives', () => {
    expectValidSDL(`
      directive @foo on SCHEMA
      directive @bar on SCHEMA
      directive @baz on SCHEMA
    `);
  });

  it('directive and non-directive definitions named the same', () => {
    expectValidSDL(`
      query foo { __typename }
      fragment foo on foo { __typename }
      type foo

      directive @foo on SCHEMA
    `);
  });

  it('directives named the same', () => {
    expectSDLErrors(`
      directive @foo on SCHEMA

      directive @foo on SCHEMA
    `).to.deep.equal([
      {
        message: duplicateDirectiveNameMessage('foo'),
        locations: [{ line: 2, column: 18 }, { line: 4, column: 18 }],
      },
    ]);
  });

  it('adding new directive to existing schema', () => {
    const schema = buildSchema('directive @foo on SCHEMA');

    expectValidSDL('directive @bar on SCHEMA', schema);
  });

  it('adding new directive with standard name to existing schema', () => {
    const schema = buildSchema('type foo');

    expectSDLErrors('directive @skip on SCHEMA', schema).to.deep.equal([
      {
        message: existedDirectiveNameMessage('skip'),
        locations: [{ line: 1, column: 12 }],
      },
    ]);
  });

  it('adding new directive to existing schema with same-named type', () => {
    const schema = buildSchema('type foo');

    expectValidSDL('directive @foo on SCHEMA', schema);
  });

  it('adding conflicting directives to existing schema', () => {
    const schema = buildSchema('directive @foo on SCHEMA');

    expectSDLErrors('directive @foo on SCHEMA', schema).to.deep.equal([
      {
        message: existedDirectiveNameMessage('foo'),
        locations: [{ line: 1, column: 12 }],
      },
    ]);
  });
});
