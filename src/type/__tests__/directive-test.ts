import { expect } from 'chai';
import { describe, it } from 'mocha';

import { DirectiveLocation } from '../../language/directiveLocation';

import { GraphQLDirective } from '../directives';
import { GraphQLInt, GraphQLString } from '../scalars';

describe('Type System: Directive', () => {
  it('defines a directive with no args', () => {
    const directive = new GraphQLDirective({
      name: 'Foo',
      locations: [DirectiveLocation.QUERY],
    });

    expect(directive).to.deep.include({
      name: 'Foo',
      args: [],
      isRepeatable: false,
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
      locations: [DirectiveLocation.QUERY],
    });

    expect(directive).to.deep.include({
      name: 'Foo',
      args: [
        {
          name: 'foo',
          description: undefined,
          type: GraphQLString,
          defaultValue: undefined,
          deprecationReason: undefined,
          extensions: {},
          astNode: undefined,
        },
        {
          name: 'bar',
          description: undefined,
          type: GraphQLInt,
          defaultValue: undefined,
          deprecationReason: undefined,
          extensions: {},
          astNode: undefined,
        },
      ],
      isRepeatable: false,
      locations: ['QUERY'],
    });
  });

  it('defines a repeatable directive', () => {
    const directive = new GraphQLDirective({
      name: 'Foo',
      isRepeatable: true,
      locations: [DirectiveLocation.QUERY],
    });

    expect(directive).to.deep.include({
      name: 'Foo',
      args: [],
      isRepeatable: true,
      locations: ['QUERY'],
    });
  });

  it('can be stringified, JSON.stringified and Object.toStringified', () => {
    const directive = new GraphQLDirective({
      name: 'Foo',
      locations: [DirectiveLocation.QUERY],
    });

    expect(String(directive)).to.equal('@Foo');
    expect(JSON.stringify(directive)).to.equal('"@Foo"');
    expect(Object.prototype.toString.call(directive)).to.equal(
      '[object GraphQLDirective]',
    );
  });

  it('rejects a directive with invalid name', () => {
    expect(
      () =>
        new GraphQLDirective({
          name: 'bad-name',
          locations: [DirectiveLocation.QUERY],
        }),
    ).to.throw('Names must only contain [_a-zA-Z0-9] but "bad-name" does not.');
  });

  it('rejects a directive with incorrectly typed args', () => {
    expect(
      () =>
        new GraphQLDirective({
          name: 'Foo',
          locations: [DirectiveLocation.QUERY],
          // @ts-expect-error
          args: [],
        }),
    ).to.throw('@Foo args must be an object with argument names as keys.');
  });

  it('rejects a directive with incorrectly named arg', () => {
    expect(
      () =>
        new GraphQLDirective({
          name: 'Foo',
          locations: [DirectiveLocation.QUERY],
          args: {
            'bad-name': { type: GraphQLString },
          },
        }),
    ).to.throw('Names must only contain [_a-zA-Z0-9] but "bad-name" does not.');
  });

  it('rejects a directive with undefined locations', () => {
    // @ts-expect-error
    expect(() => new GraphQLDirective({ name: 'Foo' })).to.throw(
      '@Foo locations must be an Array.',
    );
  });

  it('rejects a directive with incorrectly typed locations', () => {
    // @ts-expect-error
    expect(() => new GraphQLDirective({ name: 'Foo', locations: {} })).to.throw(
      '@Foo locations must be an Array.',
    );
  });
});
