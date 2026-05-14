import { describe, it } from 'node:test';

import { expect } from 'chai';

import { expectEvents } from '../../__testUtils__/expectEvents.ts';
import { expectNoTracingActivity } from '../../__testUtils__/expectNoTracingActivity.ts';
import { expectToThrow } from '../../__testUtils__/expectToThrow.ts';
import { getTracingChannel } from '../../__testUtils__/getTracingChannel.ts';

import { parse } from '../parser.ts';

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
      () => expectToThrow(() => parse(source)),
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
