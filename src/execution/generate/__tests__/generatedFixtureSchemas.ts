import type { DocumentNode } from '../../../language/ast.ts';
import { parse } from '../../../language/parser.ts';

import type { GraphQLSchema } from '../../../type/index.ts';
import {
  assertInterfaceType,
  assertObjectType,
  assertScalarType,
} from '../../../type/index.ts';

import { buildSchema } from '../../../utilities/buildASTSchema.ts';

export const queryFixtureDocument: DocumentNode = parse(`
  query GeneratedFixture(
    $id: ID!
    $includeOptional: Boolean!
    $skipMaybe: Boolean!
    $value: Int = 3
    $input: FixtureInput
  ) {
    typename: __typename
    node(id: $id) {
      __typename
      id
      label
      ... on Item {
        count
        ratio
        active
        tags
        computed
        maybeError @skip(if: $skipMaybe)
        optional: computed @include(if: $includeOptional)
        child {
          name
        }
      }
    }
    item(id: $id, input: $input, values: [$value, 2]) {
      id
      label
      count
      tags
    }
    defaultItem {
      id
      label
      tags
      child {
        name
      }
    }
    scalarBox {
      bool
      float
      id
      int
      odd
      string
    }
    list {
      id
      label
    }
  }
`);

export const incrementalFixtureDocument: DocumentNode = parse(`
  query GeneratedIncrementalFixture {
    immediate
    ... @defer(label: "deferred") {
      deferred
    }
    streamItems @stream(initialCount: 1, label: "streamed") {
      id
      label
    }
  }
`);

export const subscriptionFixtureDocument: DocumentNode = parse(`
  subscription GeneratedSubscriptionFixture($enabled: Boolean!) {
    event(enabled: $enabled) {
      id
      label
    }
  }
`);

export interface QueryFixtureContext {
  active?: unknown;
  asyncLeaf?: boolean;
  asyncRoot?: boolean;
  asyncType?: boolean;
  bool?: unknown;
  child?: unknown;
  count?: unknown;
  float?: unknown;
  id?: unknown;
  int?: unknown;
  label?: unknown;
  list?: unknown;
  odd?: unknown;
  ratio?: unknown;
  scalarId?: unknown;
  string?: unknown;
  tags?: unknown;
  throwMaybe?: boolean;
}

export interface SubscriptionFixtureContext {
  eventId?: unknown;
  eventLabel?: unknown;
  resolveEventAsync?: boolean;
  subscribeMode?: 'error' | 'nonIterable' | 'promise' | 'reject' | 'throw';
}

export function createKitchenSinkFixtureSchema(): GraphQLSchema {
  const schema = buildSchema(`
    scalar Odd

    interface Node {
      id: ID!
      label: String
    }

    input FixtureInput {
      marker: String
    }

    type Child {
      name: String
    }

    type Item implements Node {
      id: ID!
      label: String
      count: Int
      ratio: Float
      active: Boolean
      tags: [String]
      computed: String
      maybeError: String
      child: Child
    }

    type ScalarBox {
      bool: Boolean
      float: Float
      id: ID
      int: Int
      odd: Odd
      string: String
    }

    type Event {
      id: ID
      label: String
    }

    type Query {
      node(id: ID!): Node
      item(id: ID!, input: FixtureInput, values: [Int]): Item
      defaultItem: Item
      scalarBox: ScalarBox
      list: [Item]
      immediate: String
      deferred: String
      streamItems: [Item]
    }

    type Subscription {
      event(enabled: Boolean): Event
    }
  `);

  const oddType = assertScalarType(schema.getType('Odd'));
  oddType.coerceOutputValue = (value) => {
    if (typeof value === 'number' && value % 2 === 1) {
      return value;
    }
    throw new Error('Expected odd integer.');
  };

  const nodeType = assertInterfaceType(schema.getType('Node'));
  nodeType.resolveType = (_value, contextValue) =>
    toQueryFixtureContext(contextValue).asyncType === true
      ? Promise.resolve('Item')
      : 'Item';

  const queryType = assertObjectType(schema.getType('Query'));
  const queryFields = queryType.getFields();
  queryFields.node.resolve = (_source, args, contextValue) => {
    const context = toQueryFixtureContext(contextValue);
    const item = createItem(args.id, context);
    return context.asyncRoot === true ? Promise.resolve(item) : item;
  };
  queryFields.item.resolve = (_source, args, contextValue) => {
    const context = toQueryFixtureContext(contextValue);
    const item = createItem(args.id, context);
    item.label = `${item.label}:${args.input?.marker ?? 'none'}:${String(
      args.values?.[0],
    )}`;
    return context.asyncRoot === true ? Promise.resolve(item) : item;
  };
  queryFields.scalarBox.resolve = (_source, _args, contextValue) =>
    createScalarBox(toQueryFixtureContext(contextValue));
  queryFields.list.resolve = (_source, _args, contextValue) => {
    const context = toQueryFixtureContext(contextValue);
    return context.list ?? [createItem('a', context), createItem('b', context)];
  };
  queryFields.immediate.resolve = () => 'first';
  queryFields.deferred.resolve = (_source, _args, contextValue) =>
    (contextValue as IncrementalFixtureContext).asyncDeferred === true
      ? Promise.resolve('later')
      : 'later';
  queryFields.streamItems.resolve = () => [
    { id: '1', label: 'one' },
    { id: '2', label: 'two' },
  ];

  const subscriptionType = assertObjectType(schema.getSubscriptionType());
  const subscriptionFields = subscriptionType.getFields();
  subscriptionFields.event.subscribe = (_source, args, contextValue) => {
    if (args.enabled !== true) {
      return createEmptyEventStream();
    }
    const context = toSubscriptionFixtureContext(contextValue);
    if (context.subscribeMode === 'throw') {
      throw new Error('subscription source failed');
    }
    if (context.subscribeMode === 'reject') {
      return Promise.reject(new Error('subscription source rejected'));
    }
    if (context.subscribeMode === 'error') {
      return new Error('subscription source error');
    }
    if (context.subscribeMode === 'nonIterable') {
      return { event: createEvent(context, 'not-iterable') };
    }

    const stream = createEventStream(context);
    return context.subscribeMode === 'promise'
      ? Promise.resolve(stream)
      : stream;
  };
  subscriptionFields.event.resolve = (source, _args, contextValue) => {
    const event = (source as { event: unknown }).event;
    return toSubscriptionFixtureContext(contextValue).resolveEventAsync === true
      ? Promise.resolve(event)
      : event;
  };

  return schema;
}

function toQueryFixtureContext(contextValue: unknown): QueryFixtureContext {
  return (contextValue as QueryFixtureContext | undefined) ?? {};
}

function toSubscriptionFixtureContext(
  contextValue: unknown,
): SubscriptionFixtureContext {
  return (contextValue as SubscriptionFixtureContext | undefined) ?? {};
}

async function* createEmptyEventStream(): AsyncGenerator<never> {
  await Promise.resolve();
  for (const event of [] as Array<never>) {
    yield event;
  }
}

async function* createEventStream(
  context: SubscriptionFixtureContext,
): AsyncGenerator<{ event: ReturnType<typeof createEvent> }> {
  await Promise.resolve();
  yield { event: createEvent(context, '1', 'first') };
  yield { event: createEvent(context, '2', 'second') };
}

function createEvent(
  context: SubscriptionFixtureContext,
  id: unknown,
  label: unknown = id,
): {
  id: unknown;
  label: unknown;
} {
  return {
    id: context.eventId ?? id,
    label: context.eventLabel ?? label,
  };
}

export function createQueryFixtureRootValue(): unknown {
  return {
    defaultItem: createItem('root', {}),
  };
}

export interface IncrementalFixtureContext {
  asyncDeferred?: boolean;
}

function createScalarBox(context: QueryFixtureContext): {
  active?: never;
  bool: unknown;
  float: unknown;
  id: unknown;
  int: unknown;
  odd: unknown;
  string: unknown;
} {
  return {
    bool: context.bool ?? true,
    float: context.float ?? 3.5,
    id: context.scalarId ?? 123,
    int: context.int ?? 6,
    odd: context.odd ?? 9,
    string: context.string ?? 42,
  };
}

function createItem(
  id: unknown,
  context: QueryFixtureContext,
): {
  __typename: string;
  active: unknown;
  child: unknown;
  computed: (
    args: unknown,
    contextValue: QueryFixtureContext,
    info: { fieldName: string },
  ) => Promise<string> | string;
  count: unknown;
  id: unknown;
  label: unknown;
  maybeError: () => string;
  ratio: unknown;
  tags: unknown;
} {
  return {
    __typename: 'Item',
    active: context.active ?? true,
    child: context.child ?? { name: `child:${String(id)}` },
    computed: (_args, contextValue, info) => {
      const value = `${info.fieldName}:${String(id)}`;
      return contextValue.asyncLeaf === true ? Promise.resolve(value) : value;
    },
    count: context.count ?? 7,
    id: context.id ?? id,
    label: context.label ?? `item:${String(id)}`,
    maybeError: () => {
      if (context.throwMaybe === true) {
        throw new Error('fixture field error');
      }
      return 'ok';
    },
    ratio: context.ratio ?? 1.25,
    tags: context.tags ?? ['generated', String(id)],
  };
}
