import { expect } from 'chai';
import { describe, it } from 'mocha';

import { catchThrownError } from '../../__testUtils__/catchThrownError.js';
import { expectEvents } from '../../__testUtils__/expectEvents.js';
import { expectNoTracingActivity } from '../../__testUtils__/expectNoTracingActivity.js';
import { getTracingChannel } from '../../__testUtils__/getTracingChannel.js';

import { parse } from '../parser.js';

const parseChannel = getTracingChannel('graphql:parse');

describe('parse diagnostics channel', () => {
  it('emits start and end around a successful parse', async () => {
    const source = '{ field }';

    await expectEvents(
      parseChannel,
      () => parse(source),
      (result) => [
        { channel: 'start', context: { source } },
        { channel: 'end', context: { source, result } },
      ],
    );
  });

  it('emits start, error, and end when the parser throws', async () => {
    const source = '{ ';

    await expectEvents(
      parseChannel,
      () => catchThrownError(() => parse(source)),
      (error) => [
        { channel: 'start', context: { source } },
        {
          channel: 'error',
          context: {
            source,
            error,
          },
        },
        { channel: 'end', context: { source, error } },
      ],
    );
  });

  it('does not call tracing methods when no subscribers are attached', async () => {
    const document = await expectNoTracingActivity(parseChannel, () =>
      parse('{ field }'),
    );
    expect(document.kind).to.equal('Document');
  });
});
