import { describe, it } from 'node:test';

import { expect } from 'chai';

import { expectEvents } from '../../__testUtils__/expectEvents.ts';
import { expectNoTracingActivity } from '../../__testUtils__/expectNoTracingActivity.ts';
import { expectToThrow } from '../../__testUtils__/expectToThrow.ts';
import { getTracingChannel } from '../../__testUtils__/getTracingChannel.ts';

import { parse } from '../../language/parser.ts';

import type { GraphQLSchema } from '../../type/schema.ts';

import { buildSchema } from '../../utilities/buildASTSchema.ts';

import { validate } from '../validate.ts';

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
      schema: {} as GraphQLSchema,
      document: parse('{ field }'),
    };

    await expectEvents(
      validateChannel,
      () => expectToThrow(() => validate(context.schema, context.document)),
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
