import { expect } from 'chai';
import { describe, it } from 'mocha';

import dedent from '../../__testUtils__/dedent';

import invariant from '../../jsutils/invariant';

import { Kind } from '../../language/kinds';
import { parse } from '../../language/parser';
import { Source } from '../../language/source';

import { GraphQLError, printError } from '../GraphQLError';

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

  it('has a name, message, and stack trace', () => {
    const e = new GraphQLError('msg');

    expect(e).to.include({ name: 'GraphQLError', message: 'msg' });
    expect(e.stack).to.be.a('string');
  });

  it('uses the stack of an original error', () => {
    const original = new Error('original');
    const e = new GraphQLError(
      'msg',
      undefined,
      undefined,
      undefined,
      undefined,
      original,
    );

    expect(e).to.include({
      name: 'GraphQLError',
      message: 'msg',
      stack: original.stack,
      originalError: original,
    });
  });

  it('creates new stack if original error has no stack', () => {
    const original = new Error('original');
    const e = new GraphQLError('msg', null, null, null, null, original);

    expect(e).to.include({
      name: 'GraphQLError',
      message: 'msg',
      originalError: original,
    });
    expect(e.stack).to.be.a('string');
  });

  it('converts nodes to positions and locations', () => {
    const e = new GraphQLError('msg', [fieldNode]);
    expect(e).to.have.property('source', source);
    expect(e).to.deep.include({
      nodes: [fieldNode],
      positions: [4],
      locations: [{ line: 2, column: 3 }],
    });
  });

  it('converts single node to positions and locations', () => {
    const e = new GraphQLError('msg', fieldNode); // Non-array value.
    expect(e).to.have.property('source', source);
    expect(e).to.deep.include({
      nodes: [fieldNode],
      positions: [4],
      locations: [{ line: 2, column: 3 }],
    });
  });

  it('converts node with loc.start === 0 to positions and locations', () => {
    const e = new GraphQLError('msg', operationNode);
    expect(e).to.have.property('source', source);
    expect(e).to.deep.include({
      nodes: [operationNode],
      positions: [0],
      locations: [{ line: 1, column: 1 }],
    });
  });

  it('converts source and positions to locations', () => {
    const e = new GraphQLError('msg', null, source, [6]);
    expect(e).to.have.property('source', source);
    expect(e).to.deep.include({
      nodes: undefined,
      positions: [6],
      locations: [{ line: 2, column: 5 }],
    });
  });

  it('serializes to include message', () => {
    const e = new GraphQLError('msg');
    expect(JSON.stringify(e)).to.equal('{"message":"msg"}');
  });

  it('serializes to include message and locations', () => {
    const e = new GraphQLError('msg', fieldNode);
    expect(JSON.stringify(e)).to.equal(
      '{"message":"msg","locations":[{"line":2,"column":3}]}',
    );
  });

  it('serializes to include path', () => {
    const e = new GraphQLError('msg', null, null, null, [
      'path',
      3,
      'to',
      'field',
    ]);
    expect(e).to.have.deep.property('path', ['path', 3, 'to', 'field']);
    expect(JSON.stringify(e)).to.equal(
      '{"message":"msg","path":["path",3,"to","field"]}',
    );
  });
});

describe('printError', () => {
  it('prints an error without location', () => {
    const error = new GraphQLError('Error without location');
    expect(printError(error)).to.equal('Error without location');
  });

  it('prints an error using node without location', () => {
    const error = new GraphQLError(
      'Error attached to node without location',
      parse('{ foo }', { noLocation: true }),
    );
    expect(printError(error)).to.equal(
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

    expect(printError(error) + '\n').to.equal(dedent`
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
