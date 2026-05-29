import { describe, it } from 'node:test';

import { expect } from 'chai';

import type {
  TracingSubChannel,
  TracingSubscriptionHandler,
} from '../../__testUtils__/diagnosticsTracing.ts';
import { tracingSubChannels } from '../../__testUtils__/diagnosticsTracing.ts';
import { expectNoTracingActivity } from '../../__testUtils__/expectNoTracingActivity.ts';
import { getTracingChannel } from '../../__testUtils__/getTracingChannel.ts';

import { invariant } from '../../jsutils/invariant.ts';

import type { OperationDefinitionNode } from '../../language/ast.ts';
import { OperationTypeNode } from '../../language/ast.ts';
import { parse } from '../../language/parser.ts';

import { buildSchema } from '../../utilities/buildASTSchema.ts';

import type { GraphQLExecuteVariableCoercionContext } from '../../diagnostics.ts';

import { execute } from '../execute.ts';

const schema = buildSchema(`
  type Query {
    echo(value: Int!): Int
  }
`);

const variableCoercionChannel = getTracingChannel(
  'graphql:execute:variableCoercion',
);

interface CollectedEvent {
  channel: TracingSubChannel;
  context: GraphQLExecuteVariableCoercionContext;
}

function collectInto(
  events: Array<CollectedEvent>,
): TracingSubscriptionHandler<GraphQLExecuteVariableCoercionContext> {
  const handler =
    {} as TracingSubscriptionHandler<GraphQLExecuteVariableCoercionContext>;
  for (const sub of tracingSubChannels) {
    handler[sub] = (context) => {
      events.push({ channel: sub, context: { ...context } });
    };
  }
  return handler;
}

describe('variable coercion diagnostics channel', () => {
  it('emits start and end with the coerced variables on the result', () => {
    const document = parse('query Q($value: Int!) { echo(value: $value) }');
    const operation = document.definitions[0] as OperationDefinitionNode;
    const events: Array<CollectedEvent> = [];
    const handler = collectInto(events);

    variableCoercionChannel.subscribe(handler);
    try {
      execute({
        schema,
        document,
        rootValue: { echo: (args: { value: number }) => args.value },
        variableValues: { value: 42 },
      });
    } finally {
      variableCoercionChannel.unsubscribe(handler);
    }

    expect(events.map((event) => event.channel)).to.deep.equal([
      'start',
      'end',
    ]);

    const [start, end] = events;
    expect(start.context).to.deep.equal({
      schema,
      document,
      operation,
      rawVariableValues: { value: 42 },
      operationName: 'Q',
      operationType: OperationTypeNode.QUERY,
    });

    const result = end.context.result;
    invariant(result != null && 'variableValues' in result);
    expect(result.variableValues.coerced).to.deep.equal({ value: 42 });
  });

  it('reports coercion failures on the result, not the error channel', () => {
    const document = parse('query Q($value: Int!) { echo(value: $value) }');
    const events: Array<CollectedEvent> = [];
    const handler = collectInto(events);

    variableCoercionChannel.subscribe(handler);
    try {
      execute({
        schema,
        document,
        variableValues: { value: 'not-an-int' },
      });
    } finally {
      variableCoercionChannel.unsubscribe(handler);
    }

    // Coercion reports errors by returning them, so the lifecycle still
    // completes with start/end and the error channel never fires.
    expect(events.map((event) => event.channel)).to.deep.equal([
      'start',
      'end',
    ]);

    const result = events[1].context.result;
    invariant(result != null && 'errors' in result);
    expect(result.errors).to.have.lengthOf(1);
    expect(result.errors[0].message).to.match(/Int cannot represent/);
  });

  it('omits operationName and rawVariableValues for an anonymous, variable-less operation', () => {
    const document = parse('{ echo(value: 1) }');
    const operation = document.definitions[0] as OperationDefinitionNode;
    const events: Array<CollectedEvent> = [];
    const handler = collectInto(events);

    variableCoercionChannel.subscribe(handler);
    try {
      execute({
        schema,
        document,
        rootValue: { echo: (args: { value: number }) => args.value },
      });
    } finally {
      variableCoercionChannel.unsubscribe(handler);
    }

    expect(events[0].context).to.deep.equal({
      schema,
      document,
      operation,
      rawVariableValues: undefined,
      operationName: undefined,
      operationType: OperationTypeNode.QUERY,
    });
  });

  it('stays on the fast path when nothing is subscribed', async () => {
    const document = parse('query Q($value: Int!) { echo(value: $value) }');

    const result = await expectNoTracingActivity(variableCoercionChannel, () =>
      execute({
        schema,
        document,
        rootValue: { echo: (args: { value: number }) => args.value },
        variableValues: { value: 7 },
      }),
    );

    expect(result).to.deep.equal({ data: { echo: 7 } });
  });
});
