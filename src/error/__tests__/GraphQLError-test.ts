import { expect } from 'chai';
import { describe, it } from 'mocha';

import { dedent } from '../../__testUtils__/dedent';

import { invariant } from '../../jsutils/invariant';

import { Kind } from '../../language/kinds';
import { parse } from '../../language/parser';
import { Source } from '../../language/source';

import { formatError, GraphQLError, printError } from '../GraphQLError';

const source = new Source(dedent`
  {
    field
  }
`);
const ast = parse(source);
const operationNode = ast.definitions[0];
invariant(operationNode.kind === Kind.OPERATION_DEFINITION);
const fieldNode = operationNode.selectionSet.selections[0];
invariant(fieldNode);

describe('GraphQLError', () => {
  it('is a class and is a subclass of Error', () => {
    expect(new GraphQLError('str')).to.be.instanceof(Error);
    expect(new GraphQLError('str')).to.be.instanceof(GraphQLError);
  });

  it('has a name, message, extensions, and stack trace', () => {
    const e = new GraphQLError('msg');

    expect(e).to.deep.include({
      name: 'GraphQLError',
      message: 'msg',
      extensions: {},
    });
    expect(e.stack).to.be.a('string');
  });

  it('enumerate only properties prescribed by the spec', () => {
    const e = new GraphQLError('msg' /* message */, {
      nodes: [fieldNode],
      source,
      positions: [1, 2, 3],
      path: ['a', 'b', 'c'],
      originalError: new Error('test'),
      extensions: { foo: 'bar' },
    });

    expect(Object.keys(e)).to.deep.equal([
      'message',
      'path',
      'locations',
      'extensions',
    ]);
  });

  it('uses the stack of an original error', () => {
    const original = new Error('original');
    const e = new GraphQLError('msg', {
      originalError: original,
    });

    expect(e).to.include({
      name: 'GraphQLError',
      message: 'msg',
      stack: original.stack,
      originalError: original,
    });
  });

  it('creates new stack if original error has no stack', () => {
    const original = new Error('original');
    const e = new GraphQLError('msg', { originalError: original });

    expect(e).to.include({
      name: 'GraphQLError',
      message: 'msg',
      originalError: original,
    });
    expect(e.stack).to.be.a('string');
  });

  it('converts nodes to positions and locations', () => {
    const e = new GraphQLError('msg', { nodes: [fieldNode] });
    expect(e).to.deep.include({
      source,
      nodes: [fieldNode],
      positions: [4],
      locations: [{ line: 2, column: 3 }],
    });
  });

  it('converts single node to positions and locations', () => {
    const e = new GraphQLError('msg', { nodes: fieldNode }); // Non-array value.
    expect(e).to.deep.include({
      source,
      nodes: [fieldNode],
      positions: [4],
      locations: [{ line: 2, column: 3 }],
    });
  });

  it('converts node with loc.start === 0 to positions and locations', () => {
    const e = new GraphQLError('msg', { nodes: operationNode });
    expect(e).to.deep.include({
      source,
      nodes: [operationNode],
      positions: [0],
      locations: [{ line: 1, column: 1 }],
    });
  });

  it('converts node without location to undefined source, positions and locations', () => {
    const fieldNodeNoLocation = {
      ...fieldNode,
      loc: undefined,
    };

    const e = new GraphQLError('msg', { nodes: fieldNodeNoLocation });
    expect(e).to.deep.include({
      nodes: [fieldNodeNoLocation],
      source: undefined,
      positions: undefined,
      locations: undefined,
    });
  });

  it('converts source and positions to locations', () => {
    const e = new GraphQLError('msg', { source, positions: [6] });
    expect(e).to.deep.include({
      source,
      nodes: undefined,
      positions: [6],
      locations: [{ line: 2, column: 5 }],
    });
  });

  it('defaults to original error extension only if extensions argument is not passed', () => {
    class ErrorWithExtensions extends Error {
      extensions: unknown;

      constructor(message: string) {
        super(message);
        this.extensions = { original: 'extensions' };
      }
    }

    const original = new ErrorWithExtensions('original');
    const inheritedExtensions = new GraphQLError('InheritedExtensions', {
      originalError: original,
    });

    expect(inheritedExtensions).to.deep.include({
      message: 'InheritedExtensions',
      originalError: original,
      extensions: { original: 'extensions' },
    });

    const ownExtensions = new GraphQLError('OwnExtensions', {
      originalError: original,
      extensions: { own: 'extensions' },
    });

    expect(ownExtensions).to.deep.include({
      message: 'OwnExtensions',
      originalError: original,
      extensions: { own: 'extensions' },
    });

    const ownEmptyExtensions = new GraphQLError('OwnEmptyExtensions', {
      originalError: original,
      extensions: {},
    });

    expect(ownEmptyExtensions).to.deep.include({
      message: 'OwnEmptyExtensions',
      originalError: original,
      extensions: {},
    });
  });

  it('serializes to include all standard fields', () => {
    const eShort = new GraphQLError('msg');
    expect(JSON.stringify(eShort, null, 2)).to.equal(dedent`
      {
        "message": "msg"
      }
    `);

    const path = ['path', 2, 'field'];
    const extensions = { foo: 'bar' };
    const eFull = new GraphQLError('msg', {
      nodes: fieldNode,
      path,
      extensions,
    });

    // We should try to keep order of fields stable
    // Changing it wouldn't be breaking change but will fail some tests in other libraries.
    expect(JSON.stringify(eFull, null, 2)).to.equal(dedent`
      {
        "message": "msg",
        "locations": [
          {
            "line": 2,
            "column": 3
          }
        ],
        "path": [
          "path",
          2,
          "field"
        ],
        "extensions": {
          "foo": "bar"
        }
      }
    `);
  });
});

describe('toString', () => {
  it('Deprecated: prints an error using printError', () => {
    const error = new GraphQLError('Error');
    expect(printError(error)).to.equal('Error');
  });

  it('prints an error without location', () => {
    const error = new GraphQLError('Error without location');
    expect(error.toString()).to.equal('Error without location');
  });

  it('prints an error using node without location', () => {
    const error = new GraphQLError('Error attached to node without location', {
      nodes: parse('{ foo }', { noLocation: true }),
    });
    expect(error.toString()).to.equal(
      'Error attached to node without location',
    );
  });

  it('prints an error with nodes from different sources', () => {
    const docA = parse(
      new Source(
        dedent`
          type Foo {
            field: String
          }
        `,
        'SourceA',
      ),
    );
    const opA = docA.definitions[0];
    invariant(opA.kind === Kind.OBJECT_TYPE_DEFINITION && opA.fields);
    const fieldA = opA.fields[0];

    const docB = parse(
      new Source(
        dedent`
          type Foo {
            field: Int
          }
        `,
        'SourceB',
      ),
    );
    const opB = docB.definitions[0];
    invariant(opB.kind === Kind.OBJECT_TYPE_DEFINITION && opB.fields);
    const fieldB = opB.fields[0];

    const error = new GraphQLError('Example error with two nodes', [
      fieldA.type,
      fieldB.type,
    ]);

    expect(error.toString()).to.equal(dedent`
      Example error with two nodes

      SourceA:2:10
      1 | type Foo {
      2 |   field: String
        |          ^
      3 | }

      SourceB:2:10
      1 | type Foo {
      2 |   field: Int
        |          ^
      3 | }
    `);
  });
});

describe('toJSON', () => {
  it('Deprecated: format an error using formatError', () => {
    const error = new GraphQLError('Example Error');
    expect(formatError(error)).to.deep.equal({
      message: 'Example Error',
    });
  });

  it('includes path', () => {
    const error = new GraphQLError('msg', { path: ['path', 3, 'to', 'field'] });

    expect(error.toJSON()).to.deep.equal({
      message: 'msg',
      path: ['path', 3, 'to', 'field'],
    });
  });

  it('includes extension fields', () => {
    const error = new GraphQLError('msg', {
      extensions: { foo: 'bar' },
    });

    expect(error.toJSON()).to.deep.equal({
      message: 'msg',
      extensions: { foo: 'bar' },
    });
  });

  it('can be created with the legacy argument list', () => {
    const error = new GraphQLError(
      'msg',
      [operationNode],
      source,
      [6],
      ['path', 2, 'a'],
      new Error('I like turtles'),
      { hee: 'I like turtles' },
    );

    expect(error.toJSON()).to.deep.equal({
      message: 'msg',
      locations: [{ column: 5, line: 2 }],
      path: ['path', 2, 'a'],
      extensions: { hee: 'I like turtles' },
    });
  });
});
