import { invariant } from '../../jsutils/invariant.ts';
import { isPromise } from '../../jsutils/isPromise.ts';
import type { PromiseOrValue } from '../../jsutils/PromiseOrValue.ts';

import type { Computation } from './Computation.ts';
import { Queue } from './Queue.ts';

/** @internal */
export interface Group<TSelf extends Group<TSelf>> {
  parent?: TSelf | undefined;
}

interface WorkResult<
  TValue,
  T,
  I,
  G extends Group<G>,
  S extends Stream<T, I, G, S>,
> {
  value: TValue;
  work?: Work<T, I, G, S> | undefined;
}

/** @internal */
export interface Stream<
  T,
  I,
  G extends Group<G>,
  S extends Stream<T, I, G, S>,
> {
  queue: Queue<StreamItem<T, I, G, S>>;
}

/** @internal */
export interface Work<T, I, G extends Group<G>, S extends Stream<T, I, G, S>> {
  groups?: ReadonlyArray<G>;
  tasks?: ReadonlyArray<Task<T, I, G, S>>;
  streams?: ReadonlyArray<S>;
}

interface NewWork<T, I, G extends Group<G>, S extends Stream<T, I, G, S>> {
  newGroups: ReadonlyArray<G>;
  newStreams: ReadonlyArray<S>;
}

/** @internal */
export interface WorkQueue<
  T,
  I,
  G extends Group<G>,
  S extends Stream<T, I, G, S>,
> {
  initialGroups: ReadonlyArray<G>;
  initialStreams: ReadonlyArray<S>;
  events: AsyncGenerator<ReadonlyArray<WorkQueueEvent<T, I, G, S>>, void, void>;
}

/** @internal */
export type StreamItem<
  T,
  I,
  G extends Group<G>,
  S extends Stream<T, I, G, S>,
> = WorkResult<I, T, I, G, S>;

/** @internal */
export type TaskResult<
  T,
  I,
  G extends Group<G>,
  S extends Stream<T, I, G, S>,
> = WorkResult<T, T, I, G, S>;

/** @internal */
export interface Task<T, I, G extends Group<G>, S extends Stream<T, I, G, S>> {
  groups: ReadonlyArray<G>;
  computation: Computation<TaskResult<T, I, G, S>>;
}

interface TaskSuccessGraphEvent<
  T,
  I,
  G extends Group<G>,
  S extends Stream<T, I, G, S>,
> {
  kind: 'TASK_SUCCESS';
  task: Task<T, I, G, S>;
  result: TaskResult<T, I, G, S>;
}

interface TaskFailureGraphEvent<
  T,
  I,
  G extends Group<G>,
  S extends Stream<T, I, G, S>,
> {
  kind: 'TASK_FAILURE';
  task: Task<T, I, G, S>;
  error: unknown;
}

interface StreamItemsEvent<
  T,
  I,
  G extends Group<G>,
  S extends Stream<T, I, G, S>,
> {
  kind: 'STREAM_ITEMS';
  stream: S;
  items: Generator<StreamItem<T, I, G, S>>;
}

interface StreamSuccessEvent<
  T,
  I,
  G extends Group<G>,
  S extends Stream<T, I, G, S>,
> {
  kind: 'STREAM_SUCCESS';
  stream: S;
}

interface StreamFailureEvent<
  T,
  I,
  G extends Group<G>,
  S extends Stream<T, I, G, S>,
> {
  kind: 'STREAM_FAILURE';
  stream: S;
  error: unknown;
}

type GraphEvent<T, I, G extends Group<G>, S extends Stream<T, I, G, S>> =
  | TaskSuccessGraphEvent<T, I, G, S>
  | TaskFailureGraphEvent<T, I, G, S>
  | StreamItemsEvent<T, I, G, S>
  | StreamSuccessEvent<T, I, G, S>
  | StreamFailureEvent<T, I, G, S>;

interface GroupValuesEvent<
  T,
  I,
  G extends Group<G>,
  S extends Stream<T, I, G, S>,
> {
  kind: 'GROUP_VALUES';
  group: G;
  values: ReadonlyArray<T>;
}

interface GroupSuccessEvent<
  T,
  I,
  G extends Group<G>,
  S extends Stream<T, I, G, S>,
> extends NewWork<T, I, G, S> {
  kind: 'GROUP_SUCCESS';
  group: G;
}

interface GroupFailureEvent<G extends Group<G>> {
  kind: 'GROUP_FAILURE';
  group: G;
  errors: ReadonlyArray<unknown>;
}

interface StreamValuesEvent<
  T,
  I,
  G extends Group<G>,
  S extends Stream<T, I, G, S>,
> extends NewWork<T, I, G, S> {
  kind: 'STREAM_VALUES';
  stream: S;
  values: ReadonlyArray<I>;
}

interface WorkQueueTerminationEvent {
  kind: 'WORK_QUEUE_TERMINATION';
}

/** @internal */
export type WorkQueueEvent<
  T,
  I,
  G extends Group<G>,
  S extends Stream<T, I, G, S>,
> =
  | GroupValuesEvent<T, I, G, S>
  | GroupSuccessEvent<T, I, G, S>
  | GroupFailureEvent<G>
  | StreamValuesEvent<T, I, G, S>
  | StreamSuccessEvent<T, I, G, S>
  | StreamFailureEvent<T, I, G, S>
  | WorkQueueTerminationEvent;

interface GroupNode<T, I, G extends Group<G>, S extends Stream<T, I, G, S>> {
  childGroups: Array<G>;
  tasks: Set<Task<T, I, G, S>>;
  pending: number;
  errors: Array<unknown>;
}

interface TaskNode<T, I, G extends Group<G>, S extends Stream<T, I, G, S>> {
  value: T | undefined;
  childStreams: Array<S>;
}

/** @internal */
export function createWorkQueue<
  T,
  I,
  G extends Group<G>,
  S extends Stream<T, I, G, S>,
>(initialWork: Work<T, I, G, S> | undefined): WorkQueue<T, I, G, S> {
  const rootGroups = new Set<G>();
  // Released groups whose outcomes settled before announcement need draining.
  // Ordinary task completions already finish their directly affected roots.
  const readyGroups = new Set<G>();
  const rootStreams = new Set<S>();
  const cancelledGroups = new WeakSet<G>();
  const groupNodes = new Map<G, GroupNode<T, I, G, S>>();
  const taskNodes = new Map<Task<T, I, G, S>, TaskNode<T, I, G, S>>();
  let pushGraphEvent!: (e: GraphEvent<T, I, G, S>) => PromiseOrValue<void>;
  let stopGraphEvents!: (err?: unknown) => PromiseOrValue<void>;

  const { newGroups: initialRootGroups, newStreams: initialRootStreams } =
    maybeIntegrateWork(initialWork);
  const nonEmptyInitialRootGroups = pruneEmptyGroups(initialRootGroups);
  // Initialize root groups and streams at startup to prepare for cancellation
  // prior to starting the work queue
  for (const group of nonEmptyInitialRootGroups) {
    addRootGroup(group);
  }
  for (const stream of initialRootStreams) {
    rootStreams.add(stream);
  }

  const events = new Queue<GraphEvent<T, I, G, S>>(
    ({ push: _push, stop: _stop, onStop, started }) => {
      pushGraphEvent = _push;
      stopGraphEvents = _stop;
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      started.then(() => {
        for (const group of rootGroups) {
          startGroup(group);
        }
        for (const stream of rootStreams) {
          // eslint-disable-next-line @typescript-eslint/no-floating-promises
          startStream(stream);
        }
      });
      onStop((reason) => cancel(reason));
    },
    1,
  ).subscribe((graphEvents) => handleGraphEvents(graphEvents));

  return {
    initialGroups: nonEmptyInitialRootGroups,
    initialStreams: initialRootStreams,
    events,
  };

  function cancel(reason?: unknown): PromiseOrValue<void> {
    const cancelPromises: Array<Promise<unknown>> = [];
    for (const group of rootGroups) {
      cancelGroup(group, reason, cancelPromises);
    }
    for (const stream of rootStreams) {
      cancelStream(stream, reason, cancelPromises);
    }
    if (cancelPromises.length > 0) {
      return Promise.allSettled(cancelPromises).then(() => undefined);
    }
  }

  function cancelGroup(
    group: G,
    reason: unknown,
    cancelPromises: Array<Promise<unknown>>,
  ): void {
    const groupNode = groupNodes.get(group);
    if (groupNode) {
      for (const task of groupNode.tasks) {
        cancelTask(task, reason, cancelPromises);
      }
      for (const childGroup of groupNode.childGroups) {
        cancelGroup(childGroup, reason, cancelPromises);
      }
    }
  }

  function cancelTask(
    task: Task<T, I, G, S>,
    reason: unknown,
    cancelPromises: Array<Promise<unknown>>,
  ): void {
    const abortResult = task.computation.abort(reason);
    if (isPromise(abortResult)) {
      cancelPromises.push(abortResult);
    }
    const taskNode = taskNodes.get(task);
    if (taskNode) {
      for (const childStream of taskNode.childStreams) {
        cancelStream(childStream, reason, cancelPromises);
      }
    }
  }

  function cancelStream(
    stream: S,
    reason: unknown,
    cancelPromises: Array<Promise<unknown>>,
  ): void {
    const abortResult = stream.queue.abort(reason);
    if (isPromise(abortResult)) {
      cancelPromises.push(abortResult);
    }
  }

  function maybeIntegrateWork(
    work: Work<T, I, G, S> | undefined,
    parentTask?: Task<T, I, G, S>,
  ): NewWork<T, I, G, S> {
    if (!work) {
      return { newGroups: [], newStreams: [] };
    }
    const { groups, tasks, streams } = work;
    const newGroups = groups ? addGroups(groups, parentTask) : [];
    if (tasks) {
      for (const task of tasks) {
        addTask(task);
      }
    }
    const newStreams = streams ? addStreams(streams, parentTask) : [];
    return { newGroups, newStreams };
  }

  function addGroups(
    originalGroups: ReadonlyArray<G>,
    parentTask?: Task<T, I, G, S>,
  ): Array<G> {
    const groupSet = new Set(originalGroups);
    const visited = new Set<G>();
    const newRootGroups: Array<G> = [];
    for (const group of originalGroups) {
      addGroup(group, groupSet, newRootGroups, visited, parentTask);
    }
    return newRootGroups;
  }

  function addGroup(
    group: G,
    groupSet: ReadonlySet<G>,
    newRootGroups: Array<G>,
    visited: Set<G>,
    parentTask?: Task<T, I, G, S>,
  ): void {
    if (visited.has(group)) {
      return;
    }
    visited.add(group);
    const parent = group.parent;
    if (parent !== undefined && groupSet.has(parent)) {
      addGroup(parent, groupSet, newRootGroups, visited, parentTask);
    }

    // A shared producer can reveal a child after its parent has failed.
    if (parent !== undefined && cancelledGroups.has(parent)) {
      cancelledGroups.add(group);
      return;
    }

    const groupNode: GroupNode<T, I, G, S> = {
      childGroups: [],
      tasks: new Set(),
      pending: 0,
      errors: [],
    };
    groupNodes.set(group, groupNode);

    if (parentTask === undefined && !parent) {
      newRootGroups.push(group);
    } else if (parent) {
      groupNodes.get(parent)?.childGroups.push(group);
    }
  }

  function addTask(task: Task<T, I, G, S>): void {
    for (const group of task.groups) {
      const groupNode = groupNodes.get(group);
      if (groupNode) {
        groupNode.tasks.add(task);
        groupNode.pending++;
        if (groupNode.errors.length === 0) {
          readyGroups.delete(group);
        }
        if (rootGroups.has(group)) {
          startTask(task);
        }
      }
    }
  }

  function addStreams(
    streams: ReadonlyArray<S>,
    parentTask?: Task<T, I, G, S>,
  ): ReadonlyArray<S> {
    if (!parentTask) {
      return streams;
    }
    const taskNode = taskNodes.get(parentTask);
    if (taskNode) {
      taskNode.childStreams.push(...streams);
    }
    return [];
  }

  function pruneEmptyGroups(
    newGroups: ReadonlyArray<G>,
    nonEmptyNewGroups: Array<G> = [],
  ): ReadonlyArray<G> {
    for (const newGroup of newGroups) {
      const newGroupState = groupNodes.get(newGroup);
      if (newGroupState) {
        // Settled tasks can still hold values that have not been published.
        if (
          newGroupState.tasks.size === 0 &&
          newGroupState.errors.length === 0
        ) {
          groupNodes.delete(newGroup);
          readyGroups.delete(newGroup);
          pruneEmptyGroups(newGroupState.childGroups, nonEmptyNewGroups);
        } else {
          nonEmptyNewGroups.push(newGroup);
        }
      }
    }
    return nonEmptyNewGroups;
  }

  function startNewWork(
    newGroups: ReadonlyArray<G>,
    newStreams: ReadonlyArray<S>,
  ): void {
    for (const group of newGroups) {
      addRootGroup(group);
      startGroup(group);
    }
    for (const stream of newStreams) {
      rootStreams.add(stream);
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      startStream(stream);
    }
  }

  function addRootGroup(group: G): void {
    rootGroups.add(group);
    const groupNode = groupNodes.get(group);
    invariant(groupNode !== undefined);
    if (groupNode.pending === 0 || groupNode.errors.length > 0) {
      readyGroups.add(group);
    }
  }

  function startGroup(group: G): void {
    const groupNode = groupNodes.get(group);
    if (groupNode?.errors.length === 0) {
      for (const task of groupNode.tasks) {
        startTask(task);
      }
    }
  }

  function startTask(task: Task<T, I, G, S>): void {
    if (taskNodes.has(task)) {
      return;
    }
    taskNodes.set(task, {
      value: undefined,
      childStreams: [],
    });
    try {
      const result = task.computation.result();
      if (isPromise(result)) {
        result.then(
          (resolved) => {
            // eslint-disable-next-line @typescript-eslint/no-floating-promises
            pushGraphEvent({ kind: 'TASK_SUCCESS', task, result: resolved });
          },
          (error: unknown) => {
            // eslint-disable-next-line @typescript-eslint/no-floating-promises
            pushGraphEvent({ kind: 'TASK_FAILURE', task, error });
          },
        );
      } else {
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        pushGraphEvent({ kind: 'TASK_SUCCESS', task, result });
      }
    } catch (error) {
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      pushGraphEvent({ kind: 'TASK_FAILURE', task, error });
    }
  }

  async function startStream(stream: S): Promise<void> {
    try {
      await stream.queue.forEachBatch(async (items) => {
        const pushed = pushGraphEvent({
          kind: 'STREAM_ITEMS',
          stream,
          items,
        });
        if (isPromise(pushed)) {
          await pushed;
        }
      });
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      pushGraphEvent({ kind: 'STREAM_SUCCESS', stream });
    } catch (error) {
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      pushGraphEvent({ kind: 'STREAM_FAILURE', stream, error });
    }
  }

  function handleGraphEvents(
    graphEvents: Generator<GraphEvent<T, I, G, S>>,
  ): ReadonlyArray<WorkQueueEvent<T, I, G, S>> | undefined {
    const workQueueEvents: Array<WorkQueueEvent<T, I, G, S>> = [];
    for (const graphEvent of graphEvents) {
      switch (graphEvent.kind) {
        case 'TASK_SUCCESS':
          workQueueEvents.push(...taskSuccess(graphEvent));
          break;
        case 'TASK_FAILURE':
          workQueueEvents.push(...taskFailure(graphEvent));
          break;
        case 'STREAM_ITEMS':
          workQueueEvents.push(...streamItems(graphEvent));
          break;
        case 'STREAM_SUCCESS':
          // check whether already deleted within streamItems()
          if (rootStreams.has(graphEvent.stream)) {
            rootStreams.delete(graphEvent.stream);
            workQueueEvents.push(graphEvent);
          }
          break;
        case 'STREAM_FAILURE':
          rootStreams.delete(graphEvent.stream);
          workQueueEvents.push(graphEvent);
          break;
      }
    }

    if (rootGroups.size === 0 && rootStreams.size === 0) {
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      stopGraphEvents();
      workQueueEvents.push({ kind: 'WORK_QUEUE_TERMINATION' });
    }

    return workQueueEvents.length > 0 ? workQueueEvents : undefined;
  }

  function taskSuccess(
    graphEvent: TaskSuccessGraphEvent<T, I, G, S>,
  ): ReadonlyArray<WorkQueueEvent<T, I, G, S>> {
    const { task, result } = graphEvent;
    const { value, work } = result;
    const taskNode = taskNodes.get(task);
    if (!taskNode) {
      return [];
    }
    if (!task.groups.some(isHealthyGroup)) {
      removeTask(task);
      return [];
    }
    taskNode.value = value;
    maybeIntegrateWork(work, task);

    const groupEvents: Array<
      GroupValuesEvent<T, I, G, S> | GroupSuccessEvent<T, I, G, S>
    > = [];
    const newGroups: Array<G> = [];
    const newStreams: Array<S> = [];
    for (const group of task.groups) {
      const groupNode = groupNodes.get(group);
      if (groupNode) {
        groupNode.pending--;
        if (
          rootGroups.has(group) &&
          groupNode.pending === 0 &&
          groupNode.errors.length === 0
        ) {
          const {
            groupValuesEvent,
            groupSuccessEvent,
            newGroups: childNewGroups,
            newStreams: childNewStreams,
          } = finishGroupSuccess(group, groupNode);
          if (groupValuesEvent) {
            groupEvents.push(groupValuesEvent);
          }
          groupEvents.push(groupSuccessEvent);
          newGroups.push(...childNewGroups);
          newStreams.push(...childNewStreams);
        }
      }
    }

    startNewWork(newGroups, newStreams);
    return [...groupEvents, ...drainReadyGroups()];
  }

  function taskFailure(
    graphEvent: TaskFailureGraphEvent<T, I, G, S>,
  ): ReadonlyArray<GroupFailureEvent<G>> {
    const { task, error } = graphEvent;
    if (!taskNodes.has(task)) {
      return [];
    }
    // Retained failure records do not keep an otherwise cancelled task active.
    const hasHealthyOwner = task.groups.some(isHealthyGroup);
    removeTask(task);
    if (!hasHealthyOwner) {
      return [];
    }
    const groupFailureEvents: Array<GroupFailureEvent<G>> = [];
    for (const group of task.groups) {
      const groupNode = groupNodes.get(group);
      if (groupNode) {
        if (rootGroups.has(group)) {
          groupFailureEvents.push(
            finishGroupFailure(group, groupNode, [error]),
          );
        } else {
          groupNode.pending--;
          groupNode.errors.push(error);
        }
      }
    }
    return groupFailureEvents;
  }

  function isHealthyGroup(group: G): boolean {
    const node = groupNodes.get(group);
    if (!node || node.errors.length > 0) {
      return false;
    }
    let parent = group.parent;
    while (parent !== undefined) {
      const parentNode = groupNodes.get(parent);
      if (!parentNode) {
        break;
      }
      if (parentNode.errors.length > 0) {
        return false;
      }
      parent = parent.parent;
    }
    return true;
  }

  function drainReadyGroups(): Array<WorkQueueEvent<T, I, G, S>> {
    const readyEvents: Array<WorkQueueEvent<T, I, G, S>> = [];
    // Insertion order matches release order. Set iteration also visits ready
    // descendants released by an earlier completion in this drain.
    for (const group of readyGroups) {
      readyGroups.delete(group);
      const groupNode = groupNodes.get(group);
      invariant(groupNode !== undefined);
      if (groupNode.errors.length > 0) {
        readyEvents.push(
          finishGroupFailure(group, groupNode, groupNode.errors),
        );
      } else {
        invariant(groupNode.pending === 0);
        const { groupValuesEvent, groupSuccessEvent, newGroups, newStreams } =
          finishGroupSuccess(group, groupNode);
        if (groupValuesEvent) {
          readyEvents.push(groupValuesEvent);
        }
        readyEvents.push(groupSuccessEvent);
        startNewWork(newGroups, newStreams);
      }
    }
    return readyEvents;
  }

  function streamItems(
    graphEvent: StreamItemsEvent<T, I, G, S>,
  ): ReadonlyArray<WorkQueueEvent<T, I, G, S>> {
    const { stream, items } = graphEvent;
    const values: Array<I> = [];
    const newGroups: Array<G> = [];
    const newStreams: Array<S> = [];
    for (const { value, work } of items) {
      const { newGroups: itemNewGroups, newStreams: itemNewStreams } =
        maybeIntegrateWork(work);
      const nonEmptyNewGroups = pruneEmptyGroups(itemNewGroups);
      startNewWork(nonEmptyNewGroups, itemNewStreams);
      values.push(value);
      newGroups.push(...nonEmptyNewGroups);
      newStreams.push(...itemNewStreams);
    }
    const streamValuesEvent: StreamValuesEvent<T, I, G, S> = {
      kind: 'STREAM_VALUES',
      stream,
      values,
      newGroups,
      newStreams,
    };

    const readyEvents: Array<WorkQueueEvent<T, I, G, S>> = [
      streamValuesEvent,
      ...drainReadyGroups(),
    ];
    // queues allow peeking ahead see if stream has stopped
    if (stream.queue.isStopped()) {
      rootStreams.delete(stream);
      readyEvents.push({ kind: 'STREAM_SUCCESS', stream });
    }
    return readyEvents;
  }

  function finishGroupSuccess(
    group: G,
    groupNode: GroupNode<T, I, G, S>,
  ): {
    groupValuesEvent: GroupValuesEvent<T, I, G, S> | undefined;
    groupSuccessEvent: GroupSuccessEvent<T, I, G, S>;
    newGroups: ReadonlyArray<G>;
    newStreams: ReadonlyArray<S>;
  } {
    groupNodes.delete(group);
    readyGroups.delete(group);
    const values: Array<T> = [];
    const newStreams: Array<S> = [];
    for (const task of groupNode.tasks) {
      const taskNode = taskNodes.get(task);
      if (taskNode) {
        const { value, childStreams } = taskNode;
        if (value !== undefined) {
          values.push(value);
        }
        for (const childStream of childStreams) {
          newStreams.push(childStream);
        }
        removeTask(task);
      }
    }
    const newGroups = pruneEmptyGroups(groupNode.childGroups);
    rootGroups.delete(group);
    return {
      groupValuesEvent: values.length
        ? { kind: 'GROUP_VALUES', group, values }
        : undefined,
      groupSuccessEvent: {
        kind: 'GROUP_SUCCESS',
        group,
        newGroups,
        newStreams,
      },
      newGroups,
      newStreams,
    };
  }

  function finishGroupFailure(
    group: G,
    groupNode: GroupNode<T, I, G, S>,
    errors: ReadonlyArray<unknown>,
  ): GroupFailureEvent<G> {
    removeGroup(group, groupNode);
    return { kind: 'GROUP_FAILURE', group, errors };
  }

  function removeGroup(group: G, groupNode: GroupNode<T, I, G, S>): void {
    cancelledGroups.add(group);
    readyGroups.delete(group);
    rootGroups.delete(group);
    groupNodes.delete(group);
    for (const task of groupNode.tasks) {
      if (task.groups.every((taskGroup) => !groupNodes.has(taskGroup))) {
        removeTask(task);
      }
    }
    for (const childGroup of groupNode.childGroups) {
      const childGroupState = groupNodes.get(childGroup);
      if (childGroupState) {
        removeGroup(childGroup, childGroupState);
      }
    }
  }

  function removeTask(task: Task<T, I, G, S>): void {
    for (const group of task.groups) {
      const groupNode = groupNodes.get(group);
      groupNode?.tasks.delete(task);
    }
    taskNodes.delete(task);
  }
}
