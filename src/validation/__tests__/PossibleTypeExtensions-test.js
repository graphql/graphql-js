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
  PossibleTypeExtensions,
  extendingUnknownTypeMessage,
  extendingDifferentTypeKindMessage,
} from '../rules/PossibleTypeExtensions';

function expectSDLErrors(sdlStr, schema) {
  return expectSDLValidationErrors(schema, PossibleTypeExtensions, sdlStr);
}

function expectValidSDL(sdlStr, schema) {
  expectSDLErrors(sdlStr, schema).to.deep.equal([]);
}

function extendingUnknownType(typeName, suggestedTypes, line, column) {
  return {
    message: extendingUnknownTypeMessage(typeName, suggestedTypes),
    locations: [{ line, column }],
  };
}

function extendingDifferentTypeKind(typeName, kind, l1, c1, l2, c2) {
  const message = extendingDifferentTypeKindMessage(typeName, kind);
  const locations = [{ line: l1, column: c1 }];

  if (l2 !== undefined && c2 !== undefined) {
    locations.push({ line: l2, column: c2 });
  }
  return { message, locations };
}

describe('Validate: Possible type extensions', () => {
  it('no extensions', () => {
    expectValidSDL(`
      scalar FooScalar
      type FooObject
      interface FooInterface
      union FooUnion
      enum FooEnum
      input FooInputObject
    `);
  });

  it('one extension per type', () => {
    expectValidSDL(`
      scalar FooScalar
      type FooObject
      interface FooInterface
      union FooUnion
      enum FooEnum
      input FooInputObject

      extend scalar FooScalar @dummy
      extend type FooObject @dummy
      extend interface FooInterface @dummy
      extend union FooUnion @dummy
      extend enum FooEnum @dummy
      extend input FooInputObject @dummy
    `);
  });

  it('many extensions per type', () => {
    expectValidSDL(`
      scalar FooScalar
      type FooObject
      interface FooInterface
      union FooUnion
      enum FooEnum
      input FooInputObject

      extend scalar FooScalar @dummy
      extend type FooObject @dummy
      extend interface FooInterface @dummy
      extend union FooUnion @dummy
      extend enum FooEnum @dummy
      extend input FooInputObject @dummy

      extend scalar FooScalar @dummy
      extend type FooObject @dummy
      extend interface FooInterface @dummy
      extend union FooUnion @dummy
      extend enum FooEnum @dummy
      extend input FooInputObject @dummy
    `);
  });

  it('extending unknown type', () => {
    expectSDLErrors(`
      type Known

      extend scalar Unknown @dummy
      extend type Unknown @dummy
      extend interface Unknown @dummy
      extend union Unknown @dummy
      extend enum Unknown @dummy
      extend input Unknown @dummy
    `).to.deep.equal([
      extendingUnknownType('Unknown', ['Known'], 4, 21),
      extendingUnknownType('Unknown', ['Known'], 5, 19),
      extendingUnknownType('Unknown', ['Known'], 6, 24),
      extendingUnknownType('Unknown', ['Known'], 7, 20),
      extendingUnknownType('Unknown', ['Known'], 8, 19),
      extendingUnknownType('Unknown', ['Known'], 9, 20),
    ]);
  });

  it('does not consider non-type definitions', () => {
    expectSDLErrors(`
      query Foo { __typename }
      fragment Foo on Query { __typename }
      directive @Foo on SCHEMA

      extend scalar Foo @dummy
      extend type Foo @dummy
      extend interface Foo @dummy
      extend union Foo @dummy
      extend enum Foo @dummy
      extend input Foo @dummy
    `).to.deep.equal([
      extendingUnknownType('Foo', [], 6, 21),
      extendingUnknownType('Foo', [], 7, 19),
      extendingUnknownType('Foo', [], 8, 24),
      extendingUnknownType('Foo', [], 9, 20),
      extendingUnknownType('Foo', [], 10, 19),
      extendingUnknownType('Foo', [], 11, 20),
    ]);
  });

  it('extending with different kinds', () => {
    expectSDLErrors(`
      scalar FooScalar
      type FooObject
      interface FooInterface
      union FooUnion
      enum FooEnum
      input FooInputObject

      extend type FooScalar @dummy
      extend interface FooObject @dummy
      extend union FooInterface @dummy
      extend enum FooUnion @dummy
      extend input FooEnum @dummy
      extend scalar FooInputObject @dummy
    `).to.deep.equal([
      extendingDifferentTypeKind('FooScalar', 'scalar', 2, 7, 9, 7),
      extendingDifferentTypeKind('FooObject', 'object', 3, 7, 10, 7),
      extendingDifferentTypeKind('FooInterface', 'interface', 4, 7, 11, 7),
      extendingDifferentTypeKind('FooUnion', 'union', 5, 7, 12, 7),
      extendingDifferentTypeKind('FooEnum', 'enum', 6, 7, 13, 7),
      extendingDifferentTypeKind('FooInputObject', 'input object', 7, 7, 14, 7),
    ]);
  });

  it('extending types within existing schema', () => {
    const schema = buildSchema(`
      scalar FooScalar
      type FooObject
      interface FooInterface
      union FooUnion
      enum FooEnum
      input FooInputObject
    `);
    const sdl = `
      extend scalar FooScalar @dummy
      extend type FooObject @dummy
      extend interface FooInterface @dummy
      extend union FooUnion @dummy
      extend enum FooEnum @dummy
      extend input FooInputObject @dummy
    `;

    expectValidSDL(sdl, schema);
  });

  it('extending unknown types within existing schema', () => {
    const schema = buildSchema('type Known');
    const sdl = `
      extend scalar Unknown @dummy
      extend type Unknown @dummy
      extend interface Unknown @dummy
      extend union Unknown @dummy
      extend enum Unknown @dummy
      extend input Unknown @dummy
    `;

    expectSDLErrors(sdl, schema).to.deep.equal([
      extendingUnknownType('Unknown', ['Known'], 2, 21),
      extendingUnknownType('Unknown', ['Known'], 3, 19),
      extendingUnknownType('Unknown', ['Known'], 4, 24),
      extendingUnknownType('Unknown', ['Known'], 5, 20),
      extendingUnknownType('Unknown', ['Known'], 6, 19),
      extendingUnknownType('Unknown', ['Known'], 7, 20),
    ]);
  });

  it('extending types with different kinds within existing schema', () => {
    const schema = buildSchema(`
      scalar FooScalar
      type FooObject
      interface FooInterface
      union FooUnion
      enum FooEnum
      input FooInputObject
    `);
    const sdl = `
      extend type FooScalar @dummy
      extend interface FooObject @dummy
      extend union FooInterface @dummy
      extend enum FooUnion @dummy
      extend input FooEnum @dummy
      extend scalar FooInputObject @dummy
    `;

    expectSDLErrors(sdl, schema).to.deep.equal([
      extendingDifferentTypeKind('FooScalar', 'scalar', 2, 7),
      extendingDifferentTypeKind('FooObject', 'object', 3, 7),
      extendingDifferentTypeKind('FooInterface', 'interface', 4, 7),
      extendingDifferentTypeKind('FooUnion', 'union', 5, 7),
      extendingDifferentTypeKind('FooEnum', 'enum', 6, 7),
      extendingDifferentTypeKind('FooInputObject', 'input object', 7, 7),
    ]);
  });
});
