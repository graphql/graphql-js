import { expect } from 'chai';
import { describe, it } from 'mocha';

import { catchThrownError } from '../../__testUtils__/catchThrownError.js';
import { expectEvents } from '../../__testUtils__/expectEvents.js';
import { expectNoTracingActivity } from '../../__testUtils__/expectNoTracingActivity.js';
import { getTracingChannel } from '../../__testUtils__/getTracingChannel.js';

import { parse } from '../../language/parser.js';

import type { GraphQLSchema } from '../../type/schema.js';

import { buildSchema } from '../../utilities/buildASTSchema.js';

import { validate } from '../validate.js';

const schema = buildSchema(`
  type Query {
    field: String
  }
`);

const validateChannel = getTracingChannel('graphql:validate');

describe('validate diagnostics channel', () => {
  it('emits start and end around a successful validate', async () => {
    const document = parse('{ field }');

    await expectEvents(
      validateChannel,
      () => validate(schema, document),
      (result) => [
        { channel: 'start', context: { schema, document } },
        { channel: 'end', context: { schema, document, result } },
      ],
    );
  });

  it('emits start and end for a document with validation errors', async () => {
    const document = parse('{ missingField }');

    await expectEvents(
      validateChannel,
      () => validate(schema, document),
      (result) => [
        { channel: 'start', context: { schema, document } },
        { channel: 'end', context: { schema, document, result } },
      ],
    );
  });

  it('emits start, error, and end when validate throws on an invalid schema', async () => {
    const context = {
      document: parse('{ field }'),
      schema: {} as GraphQLSchema,
    };

    await expectEvents(
      validateChannel,
      () => catchThrownError(() => validate(context.schema, context.document)),
      (error) => [
        {
          channel: 'start',
          context,
        },
        {
          channel: 'error',
          context: {
            ...context,
            error,
          },
        },
        {
          channel: 'end',
          context: { ...context, error },
        },
      ],
    );
  });

  it('does not call tracing methods when no subscribers are attached', async () => {
    const errors = await expectNoTracingActivity(validateChannel, () =>
      validate(schema, parse('{ field }')),
    );
    expect(errors).to.deep.equal([]);
  });
});
