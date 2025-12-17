import { expect } from 'chai';
import { describe, it } from 'mocha';

import { resolveOnNextTick } from '../../../__testUtils__/resolveOnNextTick.js';

import { isPromise } from '../../../jsutils/isPromise.js';
import type { PromiseOrValue } from '../../../jsutils/PromiseOrValue.js';

import { Computation } from '../Computation.js';
import { Queue } from '../Queue.js';
import type {
  Group,
  Stream,
  StreamItem,
  Task,
  TaskResult,
  Work,
  WorkQueueEvent,
} from '../WorkQueue.js';
import { createWorkQueue } from '../WorkQueue.js';

type TestTaskValue = string | number;
type TestStreamItemValue = number;
type TestGroup = Group<TestGroup>;
type TestStream = Stream<
  TestTaskValue,
  TestStreamItemValue,
  TestGroup,
  TestStream
>;
type TestStreamItem = StreamItem<
  TestTaskValue,
  TestStreamItemValue,
  TestGroup,
  TestStream
>;
type TestWork = Work<TestTaskValue, TestStreamItemValue, TestGroup, TestStream>;
type TestWorkQueueEvent = WorkQueueEvent<
  TestTaskValue,
  TestStreamItemValue,
  TestGroup,
  TestStream
>;

async function collectWorkRun(work: TestWork): Promise<{
  events: Array<TestWorkQueueEvent>;
  initialGroups: ReadonlyArray<TestGroup>;
  initialStreams: ReadonlyArray<TestStream>;
}> {
  const events: Array<TestWorkQueueEvent> = [];
  const workQueue = createWorkQueue<
    TestTaskValue,
    TestStreamItemValue,
    TestGroup,
    TestStream
  >(work);

  for await (const batch of workQueue.events) {
    events.push(...batch);
  }
  return {
    ...workQueue,
    events,
  };
}

function makeTask(
  groups: ReadonlyArray<TestGroup>,
  valueOrFactory:
    | TestTaskValue
    | (() => PromiseOrValue<
        TaskResult<TestTaskValue, TestStreamItemValue, TestGroup, TestStream>
      >),
  work?: TestWork,
): Task<TestTaskValue, TestStreamItemValue, TestGroup, TestStream> {
  if (typeof valueOrFactory === 'function') {
    return {
      groups,
      computation: new Computation(valueOrFactory),
    };
  }
  return {
    groups,
    computation: new Computation(() => ({ value: valueOrFactory, work })),
  };
}

const streamFailureError = new Error('stream failure');

function streamFrom(
  items: ReadonlyArray<TestStreamItem>,
  options?: {
    throwAfter?: boolean;
    error?: Error;
    initialCapacity?: number;
  },
): TestStream {
  const { throwAfter, error, initialCapacity } = options ?? {};
  return {
    queue: new Queue<TestStreamItem>(async ({ push, stop }) => {
      for (const item of items) {
        const pushed = push(item);
        if (isPromise(pushed)) {
          // eslint-disable-next-line no-await-in-loop
          await pushed;
        }
      }
      if (throwAfter) {
        throw error ?? streamFailureError;
      }
      stop();
    }, initialCapacity),
  };
}

describe('WorkQueue', () => {
  it('runs parent and child groups sequentially', async () => {
    const root: TestGroup = { parent: undefined };
    const child: TestGroup = { parent: root };

    let childRan = false;
    const childTask = makeTask([child], () => {
      childRan = true;
      return { value: 'child' };
    });
    const rootTask = makeTask([root], 'root', {
      groups: [child],
      tasks: [childTask],
    });

    const workQueue = await collectWorkRun({
      groups: [root],
      tasks: [rootTask],
    });

    expect(workQueue).to.deep.equal({
      initialGroups: [root],
      initialStreams: [],
      events: [
        {
          kind: 'GROUP_VALUES',
          group: root,
          values: ['root'],
        },
        {
          kind: 'GROUP_SUCCESS',
          group: root,
          newGroups: [child],
          newStreams: [],
        },
        {
          kind: 'GROUP_VALUES',
          group: child,
          values: ['child'],
        },
        {
          kind: 'GROUP_SUCCESS',
          group: child,
          newGroups: [],
          newStreams: [],
        },
        { kind: 'WORK_QUEUE_TERMINATION' },
      ],
    });

    expect(childRan).to.equal(true);
  });

  it('can handle child groups passed prior to parents', async () => {
    const root: TestGroup = { parent: undefined };
    const child: TestGroup = { parent: root };

    const childTask = makeTask([child], 'child', {});
    const rootTask = makeTask([root], 'root', {});

    const workQueue = await collectWorkRun({
      groups: [child, root],
      tasks: [rootTask, childTask],
    });

    expect(workQueue).to.deep.equal({
      initialGroups: [root],
      initialStreams: [],
      events: [
        {
          kind: 'GROUP_VALUES',
          group: root,
          values: ['root'],
        },
        {
          kind: 'GROUP_SUCCESS',
          group: root,
          newGroups: [child],
          newStreams: [],
        },
        {
          kind: 'GROUP_VALUES',
          group: child,
          values: ['child'],
        },
        {
          kind: 'GROUP_SUCCESS',
          group: child,
          newGroups: [],
          newStreams: [],
        },
        { kind: 'WORK_QUEUE_TERMINATION' },
      ],
    });
  });

  it('propagates task failures and skips descendant groups', async () => {
    const root: TestGroup = { parent: undefined };
    const child: TestGroup = { parent: root };
    const grandchild: TestGroup = { parent: child };
    let grandchildRan = false;
    let childFailed = false;

    const grandchildTask = makeTask([grandchild], () => {
      grandchildRan = true;
      return { value: 'grandchild' };
    });

    const boom = new Error('boom');
    const failingChildTask = makeTask([child], () => {
      childFailed = true;
      throw boom;
    });

    const rootTask = makeTask([root], 'root', {
      groups: [child, grandchild],
      tasks: [failingChildTask, grandchildTask],
    });

    const workQueue = await collectWorkRun({
      groups: [root],
      tasks: [rootTask],
    });

    expect(workQueue).to.deep.equal({
      initialGroups: [root],
      initialStreams: [],
      events: [
        {
          kind: 'GROUP_VALUES',
          group: root,
          values: ['root'],
        },
        {
          kind: 'GROUP_SUCCESS',
          group: root,
          newGroups: [child],
          newStreams: [],
        },
        {
          kind: 'GROUP_FAILURE',
          group: child,
          error: boom,
        },
        { kind: 'WORK_QUEUE_TERMINATION' },
      ],
    });

    expect(grandchildRan).to.equal(false);
    expect(childFailed).to.equal(true);
  });

  it('integrates work object returned by task', async () => {
    const root: TestGroup = { parent: undefined };
    const child: TestGroup = { parent: root };

    const childTask = makeTask([child], () => ({ value: 'child' }));
    const rootTask = makeTask([root], () => ({
      value: 'root',
      work: { groups: [child], tasks: [childTask] },
    }));

    const workQueue = await collectWorkRun({
      groups: [root],
      tasks: [rootTask],
    });

    expect(workQueue).to.deep.equal({
      initialGroups: [root],
      initialStreams: [],
      events: [
        {
          kind: 'GROUP_VALUES',
          group: root,
          values: ['root'],
        },
        {
          kind: 'GROUP_SUCCESS',
          group: root,
          newGroups: [child],
          newStreams: [],
        },
        {
          kind: 'GROUP_VALUES',
          group: child,
          values: ['child'],
        },
        {
          kind: 'GROUP_SUCCESS',
          group: child,
          newGroups: [],
          newStreams: [],
        },
        { kind: 'WORK_QUEUE_TERMINATION' },
      ],
    });
  });

  it('purges shared tasks so sibling groups finish without re-running work', async () => {
    const groupA: TestGroup = { parent: undefined };
    const groupB: TestGroup = { parent: undefined };

    const sharedTask = makeTask([groupA, groupB], 'shared');

    const workQueue = await collectWorkRun({
      groups: [groupA, groupB],
      tasks: [sharedTask],
    });

    expect(workQueue).to.deep.equal({
      initialGroups: [groupA, groupB],
      initialStreams: [],
      events: [
        {
          kind: 'GROUP_VALUES',
          group: groupA,
          values: ['shared'],
        },
        {
          kind: 'GROUP_SUCCESS',
          group: groupA,
          newGroups: [],
          newStreams: [],
        },
        {
          kind: 'GROUP_SUCCESS',
          group: groupB,
          newGroups: [],
          newStreams: [],
        },
        { kind: 'WORK_QUEUE_TERMINATION' },
      ],
    });
  });

  it('ignores task-emitted groups without a valid parent', async () => {
    const root: TestGroup = { parent: undefined };

    const orphanGroup: TestGroup = { parent: undefined };
    const task = makeTask([root], 'root', {
      groups: [orphanGroup],
    });

    const workQueue = await collectWorkRun({
      groups: [root],
      tasks: [task],
    });

    expect(workQueue).to.deep.equal({
      initialGroups: [root],
      initialStreams: [],
      events: [
        {
          kind: 'GROUP_VALUES',
          group: root,
          values: ['root'],
        },
        {
          kind: 'GROUP_SUCCESS',
          group: root,
          newGroups: [],
          newStreams: [],
        },
        { kind: 'WORK_QUEUE_TERMINATION' },
      ],
    });
  });

  it('skips child groups with only completed tasks when parent finishes later', async () => {
    const parent1: TestGroup = { parent: undefined };
    const parent2: TestGroup = { parent: undefined };
    const child1: TestGroup = { parent: parent1 };
    const child2: TestGroup = { parent: parent2 };

    const parent1Task = makeTask([parent1], 'parent1');
    const slowParent2Task = makeTask([parent2], async () => {
      await resolveOnNextTick();
      return { value: 'parent2-slow' };
    });
    const sharedChildTask = makeTask([child1, child2], 'child-shared');
    const slowChild1FollowUpTask = makeTask([child1], async () => {
      await resolveOnNextTick();
      await resolveOnNextTick();
      await resolveOnNextTick();
      return { value: 'child1-slow' };
    });

    const workQueue = await collectWorkRun({
      groups: [parent1, parent2, child1, child2],
      tasks: [
        parent1Task,
        slowParent2Task,
        sharedChildTask,
        slowChild1FollowUpTask,
      ],
    });

    expect(workQueue).to.deep.equal({
      initialGroups: [parent1, parent2],
      initialStreams: [],
      events: [
        {
          kind: 'GROUP_VALUES',
          group: parent1,
          values: ['parent1'],
        },
        {
          kind: 'GROUP_SUCCESS',
          group: parent1,
          newGroups: [child1],
          newStreams: [],
        },
        {
          kind: 'GROUP_VALUES',
          group: parent2,
          values: ['parent2-slow'],
        },
        {
          kind: 'GROUP_SUCCESS',
          group: parent2,
          newGroups: [],
          newStreams: [],
        },
        {
          kind: 'GROUP_VALUES',
          group: child2,
          values: ['child-shared', 'child1-slow'],
        },
        {
          kind: 'GROUP_SUCCESS',
          group: child2,
          newGroups: [],
          newStreams: [],
        },
        { kind: 'WORK_QUEUE_TERMINATION' },
      ],
    });
  });

  it('skips promoted child groups that already completed shared tasks', async () => {
    const parent: TestGroup = { parent: undefined };
    const child: TestGroup = { parent };

    const parentTask = makeTask([parent], async () => {
      await resolveOnNextTick();
      await resolveOnNextTick();
      return { value: 'parent' };
    });

    const sharedTask = makeTask([parent, child], 'shared');

    const workQueue = await collectWorkRun({
      groups: [parent, child],
      tasks: [parentTask, sharedTask],
    });

    expect(workQueue).to.deep.equal({
      initialGroups: [parent],
      initialStreams: [],
      events: [
        {
          kind: 'GROUP_VALUES',
          group: parent,
          values: ['parent', 'shared'],
        },
        {
          kind: 'GROUP_SUCCESS',
          group: parent,
          newGroups: [],
          newStreams: [],
        },
        { kind: 'WORK_QUEUE_TERMINATION' },
      ],
    });
  });

  it('skips child groups with shared tasks completed by a parent', async () => {
    const parent: TestGroup = { parent: undefined };
    const child: TestGroup = { parent };
    const otherRoot: TestGroup = { parent: undefined };

    const parentTask = makeTask([parent], async () => {
      await resolveOnNextTick();
      await resolveOnNextTick();
      return { value: 'parent' };
    });

    const sharedTask = makeTask([child, otherRoot], 'shared');
    const slowOtherRootTask = makeTask([otherRoot], async () => {
      await resolveOnNextTick();
      await resolveOnNextTick();
      await resolveOnNextTick();
      await resolveOnNextTick();
      return { value: 'other-root' };
    });

    const workQueue = await collectWorkRun({
      groups: [parent, otherRoot, child],
      tasks: [parentTask, sharedTask, slowOtherRootTask],
    });

    expect(workQueue).to.deep.equal({
      initialGroups: [parent, otherRoot],
      initialStreams: [],
      events: [
        {
          kind: 'GROUP_VALUES',
          group: parent,
          values: ['parent'],
        },
        {
          kind: 'GROUP_SUCCESS',
          group: parent,
          newGroups: [],
          newStreams: [],
        },
        {
          kind: 'GROUP_VALUES',
          group: otherRoot,
          values: ['shared', 'other-root'],
        },
        {
          kind: 'GROUP_SUCCESS',
          group: otherRoot,
          newGroups: [],
          newStreams: [],
        },
        { kind: 'WORK_QUEUE_TERMINATION' },
      ],
    });
  });

  it('does not promote child groups that only share work with the parent', async () => {
    const parent: TestGroup = { parent: undefined };
    const child: TestGroup = { parent };

    const sharedTask = makeTask([parent, child], 'shared');
    const parentOnlyTask = makeTask([parent], async () => {
      await resolveOnNextTick();
      return { value: 'parent-only' };
    });

    const workQueue = await collectWorkRun({
      groups: [parent, child],
      tasks: [sharedTask, parentOnlyTask],
    });

    expect(workQueue).to.deep.equal({
      initialGroups: [parent],
      initialStreams: [],
      events: [
        {
          kind: 'GROUP_VALUES',
          group: parent,
          values: ['shared', 'parent-only'],
        },
        {
          kind: 'GROUP_SUCCESS',
          group: parent,
          newGroups: [],
          newStreams: [],
        },
        { kind: 'WORK_QUEUE_TERMINATION' },
      ],
    });
  });

  it('ignores work returned by tasks whose groups already failed', async () => {
    const group: TestGroup = { parent: undefined };
    const lateGroup: TestGroup = { parent: undefined };

    const failing = makeTask([group], () => {
      throw new Error('fail early');
    });

    const slow = makeTask([group], async () => {
      await resolveOnNextTick();
      return { value: 'late', work: { groups: [lateGroup] } };
    });

    const workQueue = await collectWorkRun({
      groups: [group],
      tasks: [failing, slow],
    });

    expect(workQueue).to.deep.equal({
      initialGroups: [group],
      initialStreams: [],
      events: [
        {
          kind: 'GROUP_FAILURE',
          group,
          error: new Error('fail early'),
        },
        { kind: 'WORK_QUEUE_TERMINATION' },
      ],
    });
  });

  it('defers task-emitted streams until the parent group succeeds', async () => {
    const parent: TestGroup = { parent: undefined };
    const deferredStream = streamFrom([{ value: 7 }]);

    const parentTask = makeTask([parent], 'parent', {
      streams: [deferredStream],
    });

    const workQueue = await collectWorkRun({
      groups: [parent],
      tasks: [parentTask],
    });

    expect(workQueue).to.deep.equal({
      initialGroups: [parent],
      initialStreams: [],
      events: [
        {
          kind: 'GROUP_VALUES',
          group: parent,
          values: ['parent'],
        },
        {
          kind: 'GROUP_SUCCESS',
          group: parent,
          newStreams: [deferredStream],
          newGroups: [],
        },
        {
          kind: 'STREAM_VALUES',
          stream: deferredStream,
          values: [7],
          newGroups: [],
          newStreams: [],
        },
        { kind: 'STREAM_SUCCESS', stream: deferredStream },
        { kind: 'WORK_QUEUE_TERMINATION' },
      ],
    });
  });

  it('only promotes shared streams after all parent groups finish', async () => {
    const groupA: TestGroup = { parent: undefined };
    const groupB: TestGroup = { parent: undefined };
    const sharedStream = streamFrom([{ value: 1 }]);

    const sharedTask = makeTask([groupA, groupB], 'shared', {
      streams: [sharedStream],
    });

    const workQueue = await collectWorkRun({
      groups: [groupA, groupB],
      tasks: [sharedTask],
    });

    expect(workQueue).to.deep.equal({
      initialGroups: [groupA, groupB],
      initialStreams: [],
      events: [
        {
          kind: 'GROUP_VALUES',
          group: groupA,
          values: ['shared'],
        },
        {
          kind: 'GROUP_SUCCESS',
          group: groupA,
          newStreams: [sharedStream],
          newGroups: [],
        },
        {
          kind: 'GROUP_SUCCESS',
          group: groupB,
          newGroups: [],
          newStreams: [],
        },
        {
          kind: 'STREAM_VALUES',
          stream: sharedStream,
          values: [1],
          newGroups: [],
          newStreams: [],
        },
        { kind: 'STREAM_SUCCESS', stream: sharedStream },
        { kind: 'WORK_QUEUE_TERMINATION' },
      ],
    });
  });

  it('starts a shared stream once even when the second parent is slower', async () => {
    const groupA: TestGroup = { parent: undefined };
    const groupB: TestGroup = { parent: undefined };
    const sharedStream = streamFrom([{ value: 5 }]);

    const sharedTask = makeTask([groupA, groupB], 'shared', {
      streams: [sharedStream],
    });
    const fastTaskA = makeTask([groupA], 'A-only');

    const slowTaskB = makeTask([groupB], async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
      return { value: 'B-slow' };
    });

    const workQueue = await collectWorkRun({
      groups: [groupA, groupB],
      tasks: [sharedTask, fastTaskA, slowTaskB],
    });

    expect(workQueue).to.deep.equal({
      initialGroups: [groupA, groupB],
      initialStreams: [],
      events: [
        {
          kind: 'GROUP_VALUES',
          group: groupA,
          values: ['shared', 'A-only'],
        },
        {
          kind: 'GROUP_SUCCESS',
          group: groupA,
          newStreams: [sharedStream],
          newGroups: [],
        },
        {
          kind: 'STREAM_VALUES',
          stream: sharedStream,
          values: [5],
          newGroups: [],
          newStreams: [],
        },
        { kind: 'STREAM_SUCCESS', stream: sharedStream },
        {
          kind: 'GROUP_VALUES',
          group: groupB,
          values: ['B-slow'],
        },
        {
          kind: 'GROUP_SUCCESS',
          group: groupB,
          newGroups: [],
          newStreams: [],
        },
        { kind: 'WORK_QUEUE_TERMINATION' },
      ],
    });
  });

  it('does not promote a child stream if the parent fails', async () => {
    const group: TestGroup = { parent: undefined };
    const stream = streamFrom([{ value: 99 }]);

    const task = makeTask([group], 'task', {
      streams: [stream],
    });
    const boom = new Error('boom');
    const failingTask = makeTask([group], () => {
      throw boom;
    });

    const workQueue = await collectWorkRun({
      groups: [group],
      tasks: [task, failingTask],
    });

    expect(workQueue).to.deep.equal({
      initialGroups: [group],
      initialStreams: [],
      events: [
        {
          kind: 'GROUP_FAILURE',
          group,
          error: boom,
        },
        { kind: 'WORK_QUEUE_TERMINATION' },
      ],
    });
  });

  it('promotes a stream with multiple parents when only a single parent fails', async () => {
    const groupA: TestGroup = { parent: undefined };
    const groupB: TestGroup = { parent: undefined };
    const sharedStream = streamFrom([{ value: 99 }]);

    const sharedTask = makeTask([groupA, groupB], 'shared', {
      streams: [sharedStream],
    });
    const boom = new Error('boom');
    const failingTask = makeTask([groupA], () => {
      throw boom;
    });
    const slowTaskB = makeTask([groupB], async () => {
      await resolveOnNextTick();
      return { value: 'B-resolved' };
    });

    const workQueue = await collectWorkRun({
      groups: [groupA, groupB],
      tasks: [sharedTask, failingTask, slowTaskB],
    });

    expect(workQueue).to.deep.equal({
      initialGroups: [groupA, groupB],
      initialStreams: [],
      events: [
        {
          kind: 'GROUP_FAILURE',
          group: groupA,
          error: boom,
        },
        {
          kind: 'GROUP_VALUES',
          group: groupB,
          values: ['shared', 'B-resolved'],
        },
        {
          kind: 'GROUP_SUCCESS',
          group: groupB,
          newStreams: [sharedStream],
          newGroups: [],
        },
        {
          kind: 'STREAM_VALUES',
          stream: sharedStream,
          values: [99],
          newGroups: [],
          newStreams: [],
        },
        {
          kind: 'STREAM_SUCCESS',
          stream: sharedStream,
        },
        { kind: 'WORK_QUEUE_TERMINATION' },
      ],
    });
  });

  it('emits stream items followed by success', async () => {
    const stream = streamFrom([{ value: 1 }, { value: 2 }, { value: 3 }]);

    const workQueue = await collectWorkRun({ streams: [stream] });

    expect(workQueue).to.deep.equal({
      initialGroups: [],
      initialStreams: [stream],
      events: [
        {
          kind: 'STREAM_VALUES',
          stream,
          values: [1],
          newGroups: [],
          newStreams: [],
        },
        {
          kind: 'STREAM_VALUES',
          stream,
          values: [2],
          newGroups: [],
          newStreams: [],
        },
        {
          kind: 'STREAM_VALUES',
          stream,
          values: [3],
          newGroups: [],
          newStreams: [],
        },
        { kind: 'STREAM_SUCCESS', stream },
        { kind: 'WORK_QUEUE_TERMINATION' },
      ],
    });
  });

  it('handles batched stream items', async () => {
    const spawned: TestGroup = { parent: undefined };
    const spawnedTask = makeTask([spawned], 'spawned-from-stream');

    const stream = streamFrom(
      [
        { value: 1 },
        {
          value: 2,
          work: { groups: [spawned], tasks: [spawnedTask] },
        },
      ],
      { initialCapacity: 2 },
    );

    const workQueue = await collectWorkRun({ streams: [stream] });

    expect(workQueue).to.deep.equal({
      initialGroups: [],
      initialStreams: [stream],
      events: [
        {
          kind: 'STREAM_VALUES',
          stream,
          values: [1, 2],
          newGroups: [spawned],
          newStreams: [],
        },
        {
          kind: 'GROUP_VALUES',
          group: spawned,
          values: ['spawned-from-stream'],
        },
        {
          kind: 'GROUP_SUCCESS',
          group: spawned,
          newGroups: [],
          newStreams: [],
        },
        { kind: 'STREAM_SUCCESS', stream },
        { kind: 'WORK_QUEUE_TERMINATION' },
      ],
    });
  });

  it('emits stream failure when the iterator throws', async () => {
    const brokenStreamError = new Error('broken stream');
    const failingStream = streamFrom([{ value: 42 }], {
      throwAfter: true,
      error: brokenStreamError,
    });

    const workQueue = await collectWorkRun({ streams: [failingStream] });

    expect(workQueue).to.deep.equal({
      initialGroups: [],
      initialStreams: [failingStream],
      events: [
        {
          kind: 'STREAM_VALUES',
          stream: failingStream,
          values: [42],
          newGroups: [],
          newStreams: [],
        },
        {
          kind: 'STREAM_FAILURE',
          stream: failingStream,
          error: brokenStreamError,
        },
        { kind: 'WORK_QUEUE_TERMINATION' },
      ],
    });
  });

  it('emits stream success in a later payload when stream is slow to stop', async () => {
    const stream: TestStream = {
      queue: new Queue<TestStreamItem>(async ({ push, stop }) => {
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        push({ value: 1 });
        await new Promise((resolve) => setTimeout(resolve, 0));
        stop();
      }, 1),
    };

    const workQueue = await collectWorkRun({
      streams: [stream],
    });

    expect(workQueue.events).to.deep.equal([
      {
        kind: 'STREAM_VALUES',
        stream,
        values: [1],
        newGroups: [],
        newStreams: [],
      },
      { kind: 'STREAM_SUCCESS', stream },
      { kind: 'WORK_QUEUE_TERMINATION' },
    ]);
  });

  it('emits late root groups and streams immediately when triggered from stream', async () => {
    const initial: TestGroup = { parent: undefined };
    const lateGroup: TestGroup = { parent: undefined };

    const lateTask = makeTask([lateGroup], 'late');
    const secondaryStream = streamFrom([{ value: 9 }]);
    const triggerStream = streamFrom([
      {
        value: 0,
        work: {
          groups: [lateGroup],
          tasks: [lateTask],
          streams: [secondaryStream],
        },
      },
    ]);

    const initialTask = makeTask([initial], 'initial');

    const workQueue = await collectWorkRun({
      groups: [initial],
      tasks: [initialTask],
      streams: [triggerStream],
    });

    expect(workQueue).to.deep.equal({
      initialGroups: [initial],
      initialStreams: [triggerStream],
      events: [
        {
          kind: 'GROUP_VALUES',
          group: initial,
          values: ['initial'],
        },
        {
          kind: 'GROUP_SUCCESS',
          group: initial,
          newGroups: [],
          newStreams: [],
        },
        {
          kind: 'STREAM_VALUES',
          stream: triggerStream,
          values: [0],
          newGroups: [lateGroup],
          newStreams: [secondaryStream],
        },
        {
          kind: 'GROUP_VALUES',
          group: lateGroup,
          values: ['late'],
        },
        {
          kind: 'GROUP_SUCCESS',
          group: lateGroup,
          newGroups: [],
          newStreams: [],
        },
        {
          kind: 'STREAM_VALUES',
          stream: secondaryStream,
          values: [9],
          newGroups: [],
          newStreams: [],
        },
        { kind: 'STREAM_SUCCESS', stream: triggerStream },
        { kind: 'STREAM_SUCCESS', stream: secondaryStream },
        { kind: 'WORK_QUEUE_TERMINATION' },
      ],
    });
  });
  it('handles tasks that are started manually before they complete', async () => {
    const group: TestGroup = { parent: undefined };
    const computation = new Computation(async () => {
      await resolveOnNextTick();
      return { value: 'primed' };
    });
    const primedTask = {
      groups: [group],
      computation,
    };

    computation.prime();

    const workQueue = await collectWorkRun({
      groups: [group],
      tasks: [primedTask],
    });

    expect(workQueue).to.deep.equal({
      initialGroups: [group],
      initialStreams: [],
      events: [
        {
          kind: 'GROUP_VALUES',
          group,
          values: ['primed'],
        },
        {
          kind: 'GROUP_SUCCESS',
          group,
          newGroups: [],
          newStreams: [],
        },
        { kind: 'WORK_QUEUE_TERMINATION' },
      ],
    });
  });

  it('propagates failures for tasks started manually', async () => {
    const group: TestGroup = { parent: undefined };
    const primedFailure = new Error('primed failure');
    const computation = new Computation(async () => {
      await resolveOnNextTick();
      throw primedFailure;
    });
    const primedTask = {
      groups: [group],
      computation,
    };

    computation.prime();

    const workQueue = await collectWorkRun({
      groups: [group],
      tasks: [primedTask],
    });

    expect(workQueue).to.deep.equal({
      initialGroups: [group],
      initialStreams: [],
      events: [
        {
          kind: 'GROUP_FAILURE',
          group,
          error: primedFailure,
        },
        { kind: 'WORK_QUEUE_TERMINATION' },
      ],
    });
  });

  it('skips groups with no tasks and promotes descendants', async () => {
    const root: TestGroup = { parent: undefined };
    const emptyParent: TestGroup = { parent: root };
    const leaf: TestGroup = { parent: emptyParent };

    const leafTask = makeTask([leaf], 'leaf');

    const workQueue = await collectWorkRun({
      groups: [root, emptyParent, leaf],
      tasks: [leafTask],
    });

    expect(workQueue).to.deep.equal({
      initialGroups: [leaf],
      initialStreams: [],
      events: [
        {
          kind: 'GROUP_VALUES',
          group: leaf,
          values: ['leaf'],
        },
        {
          kind: 'GROUP_SUCCESS',
          group: leaf,
          newGroups: [],
          newStreams: [],
        },
        { kind: 'WORK_QUEUE_TERMINATION' },
      ],
    });
  });

  it('handles tasks that are already settled before being queued', async () => {
    const group: TestGroup = { parent: undefined };
    const computation = new Computation(() => ({
      value: 'eager',
    }));
    const eagerTask = {
      groups: [group],
      computation,
    };

    computation.prime();

    const workQueue = await collectWorkRun({
      groups: [group],
      tasks: [eagerTask],
    });

    expect(workQueue).to.deep.equal({
      initialGroups: [group],
      initialStreams: [],
      events: [
        {
          kind: 'GROUP_VALUES',
          group,
          values: ['eager'],
        },
        {
          kind: 'GROUP_SUCCESS',
          group,
          newGroups: [],
          newStreams: [],
        },
        { kind: 'WORK_QUEUE_TERMINATION' },
      ],
    });
  });

  it('cancels nested work when the events iterator is returned early', async () => {
    const root: TestGroup = { parent: undefined };
    const child: TestGroup = { parent: root };
    const rootStream = streamFrom([{ value: 1 }]);

    let childStreamCancelled = false;
    const childStreamQueue = new Queue<TestStreamItem>(({ stopped }) => {
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      stopped.then(() => {
        childStreamCancelled = true;
      });
    });
    const childStream: TestStream = { queue: childStreamQueue };

    let childTaskCancelled = false;
    const childTask: Task<
      TestTaskValue,
      TestStreamItemValue,
      TestGroup,
      TestStream
    > = {
      groups: [root],
      computation: new Computation(
        () =>
          new Promise(() => {
            // never resolves
          }),
        () => {
          childTaskCancelled = true;
        },
      ),
    };

    const rootTask = makeTask([root], () => ({
      value: 'root',
      work: { streams: [childStream] },
    }));

    const workQueue = createWorkQueue({
      groups: [root, child],
      tasks: [rootTask, childTask],
      streams: [rootStream],
    });

    const { initialGroups, initialStreams, events } = workQueue;
    const iterator = events[Symbol.asyncIterator]();
    expect(initialGroups).to.deep.equal([root]);
    expect(initialStreams).to.deep.equal([rootStream]);
    expect(await iterator.next()).to.deep.equal({
      value: [
        {
          kind: 'STREAM_VALUES',
          stream: rootStream,
          values: [1],
          newGroups: [],
          newStreams: [],
        },
      ],
      done: false,
    });
    expect(await iterator.return()).to.deep.equal({
      value: undefined,
      done: true,
    });

    expect(childTaskCancelled).to.equal(true);
    expect(childStreamCancelled).to.equal(true);
  });
});
