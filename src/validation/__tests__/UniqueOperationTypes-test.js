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
  UniqueOperationTypes,
  existedOperationTypeMessage,
  duplicateOperationTypeMessage,
} from '../rules/UniqueOperationTypes';

function expectSDLErrors(sdlStr, schema) {
  return expectSDLValidationErrors(schema, UniqueOperationTypes, sdlStr);
}

function expectValidSDL(sdlStr, schema) {
  expectSDLErrors(sdlStr, schema).to.deep.equal([]);
}

function existedOperationType(operation, l1, c1) {
  return {
    message: existedOperationTypeMessage(operation),
    locations: [{ line: l1, column: c1 }],
  };
}

function duplicateOperationType(operation, l1, c1, l2, c2) {
  return {
    message: duplicateOperationTypeMessage(operation),
    locations: [{ line: l1, column: c1 }, { line: l2, column: c2 }],
  };
}

describe('Validate: Unique operation types', () => {
  it('no schema definition', () => {
    expectValidSDL(`
      type Foo
    `);
  });

  it('schema definition with all types', () => {
    expectValidSDL(`
      type Foo

      schema {
        query: Foo
        mutation: Foo
        subscription: Foo
      }
    `);
  });

  it('schema definition with single extension', () => {
    expectValidSDL(`
      type Foo

      schema { query: Foo }

      extend schema {
        mutation: Foo
        subscription: Foo
      }
    `);
  });

  it('schema definition with separate extensions', () => {
    expectValidSDL(`
      type Foo

      schema { query: Foo }
      extend schema { mutation: Foo }
      extend schema { subscription: Foo }
    `);
  });

  it('extend schema before definition', () => {
    expectValidSDL(`
      type Foo

      extend schema { mutation: Foo }
      extend schema { subscription: Foo }

      schema { query: Foo }
    `);
  });

  it('duplicate operation types inside single schema definition', () => {
    expectSDLErrors(`
      type Foo

      schema {
        query: Foo
        mutation: Foo
        subscription: Foo

        query: Foo
        mutation: Foo
        subscription: Foo
      }
    `).to.deep.equal([
      duplicateOperationType('query', 5, 9, 9, 9),
      duplicateOperationType('mutation', 6, 9, 10, 9),
      duplicateOperationType('subscription', 7, 9, 11, 9),
    ]);
  });

  it('duplicate operation types inside schema extension', () => {
    expectSDLErrors(`
      type Foo

      schema {
        query: Foo
        mutation: Foo
        subscription: Foo
      }

      extend schema {
        query: Foo
        mutation: Foo
        subscription: Foo
      }
    `).to.deep.equal([
      duplicateOperationType('query', 5, 9, 11, 9),
      duplicateOperationType('mutation', 6, 9, 12, 9),
      duplicateOperationType('subscription', 7, 9, 13, 9),
    ]);
  });

  it('duplicate operation types inside schema extension twice', () => {
    expectSDLErrors(`
      type Foo

      schema {
        query: Foo
        mutation: Foo
        subscription: Foo
      }

      extend schema {
        query: Foo
        mutation: Foo
        subscription: Foo
      }

      extend schema {
        query: Foo
        mutation: Foo
        subscription: Foo
      }
    `).to.deep.equal([
      duplicateOperationType('query', 5, 9, 11, 9),
      duplicateOperationType('mutation', 6, 9, 12, 9),
      duplicateOperationType('subscription', 7, 9, 13, 9),
      duplicateOperationType('query', 5, 9, 17, 9),
      duplicateOperationType('mutation', 6, 9, 18, 9),
      duplicateOperationType('subscription', 7, 9, 19, 9),
    ]);
  });

  it('duplicate operation types inside second schema extension', () => {
    expectSDLErrors(`
      type Foo

      schema {
        query: Foo
      }

      extend schema {
        mutation: Foo
        subscription: Foo
      }

      extend schema {
        query: Foo
        mutation: Foo
        subscription: Foo
      }
    `).to.deep.equal([
      duplicateOperationType('query', 5, 9, 14, 9),
      duplicateOperationType('mutation', 9, 9, 15, 9),
      duplicateOperationType('subscription', 10, 9, 16, 9),
    ]);
  });

  it('define schema inside extension SDL', () => {
    const schema = buildSchema('type Foo');
    const sdl = `
      schema {
        query: Foo
        mutation: Foo
        subscription: Foo
      }
    `;

    expectValidSDL(sdl, schema);
  });

  it('define and extend schema inside extension SDL', () => {
    const schema = buildSchema('type Foo');
    const sdl = `
      schema { query: Foo }
      extend schema { mutation: Foo }
      extend schema { subscription: Foo }
    `;

    expectValidSDL(sdl, schema);
  });

  it('adding new operation types to existing schema', () => {
    const schema = buildSchema('type Query');
    const sdl = `
      extend schema { mutation: Foo }
      extend schema { subscription: Foo }
    `;

    expectValidSDL(sdl, schema);
  });

  it('adding conflicting operation types to existing schema', () => {
    const schema = buildSchema(`
      type Query
      type Mutation
      type Subscription

      type Foo
    `);

    const sdl = `
      extend schema {
        query: Foo
        mutation: Foo
        subscription: Foo
      }
    `;

    expectSDLErrors(sdl, schema).to.deep.equal([
      existedOperationType('query', 3, 9),
      existedOperationType('mutation', 4, 9),
      existedOperationType('subscription', 5, 9),
    ]);
  });

  it('adding conflicting operation types to existing schema twice', () => {
    const schema = buildSchema(`
      type Query
      type Mutation
      type Subscription
    `);

    const sdl = `
      extend schema {
        query: Foo
        mutation: Foo
        subscription: Foo
      }

      extend schema {
        query: Foo
        mutation: Foo
        subscription: Foo
      }
    `;

    expectSDLErrors(sdl, schema).to.deep.equal([
      existedOperationType('query', 3, 9),
      existedOperationType('mutation', 4, 9),
      existedOperationType('subscription', 5, 9),
      existedOperationType('query', 9, 9),
      existedOperationType('mutation', 10, 9),
      existedOperationType('subscription', 11, 9),
    ]);
  });
});
