import { expect } from 'chai';
import { describe, it } from 'mocha';

import { DirectiveLocation } from '../../language/directiveLocation.js';

import { GraphQLDirective } from '../directives.js';
import { GraphQLInt, GraphQLString } from '../scalars.js';

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
      isRepeatable: false,
      locations: ['QUERY'],
    });

    expect(directive.args).to.have.lengthOf(2);

    expect(directive.args[0]).to.deep.include({
      parent: directive,
      name: 'foo',
      description: undefined,
      type: GraphQLString,
      defaultValue: undefined,
      default: undefined,
      deprecationReason: undefined,
      extensions: {},
      astNode: undefined,
    });

    expect(directive.args[1]).to.deep.include({
      parent: directive,
      name: 'bar',
      description: undefined,
      type: GraphQLInt,
      defaultValue: undefined,
      default: undefined,
      deprecationReason: undefined,
      extensions: {},
      astNode: undefined,
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
});
