import { expect } from 'chai';
import { describe, it } from 'mocha';

import { GraphQLDirective } from '../directives';
import { GraphQLString, GraphQLInt } from '../scalars';

describe('Type System: Directive', () => {
  it('defines a directive with no args', () => {
    const directive = new GraphQLDirective({
      name: 'Foo',
      locations: ['QUERY'],
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
      locations: ['QUERY'],
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
          extensions: undefined,
          astNode: undefined,
        },
        {
          name: 'bar',
          description: undefined,
          type: GraphQLInt,
          defaultValue: undefined,
          deprecationReason: undefined,
          extensions: undefined,
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
      locations: ['QUERY'],
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
      locations: ['QUERY'],
    });

    expect(String(directive)).to.equal('@Foo');
    expect(JSON.stringify(directive)).to.equal('"@Foo"');
    expect(Object.prototype.toString.call(directive)).to.equal(
      '[object GraphQLDirective]',
    );
  });

  it('rejects an unnamed directive', () => {
    // $FlowExpectedError[prop-missing]
    expect(() => new GraphQLDirective({ locations: ['QUERY'] })).to.throw(
      'Directive must be named.',
    );
  });

  it('rejects a directive with incorrectly typed args', () => {
    expect(
      () =>
        new GraphQLDirective({
          name: 'Foo',
          locations: ['QUERY'],
          // $FlowExpectedError[incompatible-call]
          args: [],
        }),
    ).to.throw('@Foo args must be an object with argument names as keys.');
  });

  it('rejects a directive with undefined locations', () => {
    // $FlowExpectedError[prop-missing]
    expect(() => new GraphQLDirective({ name: 'Foo' })).to.throw(
      '@Foo locations must be an Array.',
    );
  });

  it('rejects a directive with incorrectly typed locations', () => {
    // $FlowExpectedError[incompatible-call]
    expect(() => new GraphQLDirective({ name: 'Foo', locations: {} })).to.throw(
      '@Foo locations must be an Array.',
    );
  });
});
