import { expect } from 'chai';
import { afterEach, beforeEach, describe, it } from 'mocha';

import {
  collectEvents,
  sharedFakeDc,
} from '../../__testUtils__/fakeDiagnosticsChannel.js';

import { parse } from '../../language/parser.js';

import { buildSchema } from '../../utilities/buildASTSchema.js';

import { enableDiagnosticsChannel } from '../../diagnostics.js';

import { validate } from '../validate.js';

const schema = buildSchema(`
  type Query {
    field: String
  }
`);

const validateChannel = sharedFakeDc.tracingChannel('graphql:validate');

describe('validate diagnostics channel', () => {
  let active: ReturnType<typeof collectEvents> | undefined;

  beforeEach(() => {
    enableDiagnosticsChannel(sharedFakeDc);
  });

  afterEach(() => {
    active?.unsubscribe();
    active = undefined;
  });

  it('emits start and end around a successful validate', () => {
    active = collectEvents(validateChannel);

    const doc = parse('{ field }');
    const errors = validate(schema, doc);

    expect(errors).to.deep.equal([]);
    expect(active.events.map((e) => e.kind)).to.deep.equal(['start', 'end']);
    expect(active.events[0].ctx.schema).to.equal(schema);
    expect(active.events[0].ctx.document).to.equal(doc);
  });

  it('emits start and end for a document with validation errors', () => {
    active = collectEvents(validateChannel);

    const doc = parse('{ missingField }');
    const errors = validate(schema, doc);

    expect(errors).to.have.length.greaterThan(0);
    // Validation errors are collected, not thrown, so we still see start/end.
    expect(active.events.map((e) => e.kind)).to.deep.equal(['start', 'end']);
  });

  it('emits start, error, and end when validate throws on an invalid schema', () => {
    active = collectEvents(validateChannel);

    expect(() => validate({} as typeof schema, parse('{ field }'))).to.throw();

    expect(active.events.map((e) => e.kind)).to.deep.equal([
      'start',
      'error',
      'end',
    ]);
    expect(active.events[1].ctx.error).to.be.instanceOf(Error);
  });

  it('does nothing when no subscribers are attached', () => {
    const errors = validate(schema, parse('{ field }'));
    expect(errors).to.deep.equal([]);
  });
});
