/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow strict
 */

import { describe, it } from 'mocha';
import { expect } from 'chai';

import { GraphQLDirective, GraphQLString, GraphQLInt } from '../';

describe('Type System: Directive', () => {
  it('defines a directive with no args', () => {
    const directive = new GraphQLDirective({
      name: 'Foo',
      locations: ['QUERY'],
    });

    expect(directive).to.deep.include({
      name: 'Foo',
      args: [],
      locations: ['QUERY'],
    });
  });

  it('defines a directive with multiple args', () => {
    const directive = new GraphQLDirective({
      name: 'Foo',
      args: {
        foo: { type: GraphQLString },
        bar: { type: GraphQLInt },
      },
      locations: ['QUERY'],
    });

    expect(directive).to.deep.include({
      name: 'Foo',
      args: [
        {
          name: 'foo',
          type: GraphQLString,
          description: null,
          defaultValue: undefined,
          astNode: undefined,
        },
        {
          name: 'bar',
          type: GraphQLInt,
          description: null,
          defaultValue: undefined,
          astNode: undefined,
        },
      ],
      locations: ['QUERY'],
    });
  });

  it('can be stringified, JSON.stringified and Object.toStringified', () => {
    const directive = new GraphQLDirective({
      name: 'Foo',
      locations: ['QUERY'],
    });

    expect(String(directive)).to.equal('@Foo');
    expect(JSON.stringify(directive)).to.equal('"@Foo"');
    expect(Object.prototype.toString.call(directive)).to.equal(
      '[object GraphQLDirective]',
    );
  });

  it('rejects an unnamed directive', () => {
    // $DisableFlowOnNegativeTest
    expect(() => new GraphQLDirective({ locations: ['Query'] })).to.throw(
      'Directive must be named.',
    );
  });

  it('rejects a directive with incorrectly typed args', () => {
    expect(
      () =>
        new GraphQLDirective({
          name: 'Foo',
          locations: ['QUERY'],
          // $DisableFlowOnNegativeTest
          args: [],
        }),
    ).to.throw('@Foo args must be an object with argument names as keys.');
  });

  it('rejects a directive with undefined locations', () => {
    // $DisableFlowOnNegativeTest
    expect(() => new GraphQLDirective({ name: 'Foo' })).to.throw(
      '@Foo locations must be an Array.',
    );
  });

  it('rejects a directive with incorrectly typed locations', () => {
    // $DisableFlowOnNegativeTest
    expect(() => new GraphQLDirective({ name: 'Foo', locations: {} })).to.throw(
      '@Foo locations must be an Array.',
    );
  });
});
