import { invariant } from '../jsutils/invariant.js';
import type { ObjMap } from '../jsutils/ObjMap.js';
import { pathToArray } from '../jsutils/Path.js';

import type { GraphQLError } from '../error/GraphQLError.js';

import type {
  CompletedExecutionGroup,
  CompletedResult,
  DeferredFragmentRecord,
  DeliveryGroup,
  FailedExecutionGroup,
  IncrementalDeferResult,
  IncrementalResult,
  IncrementalStreamResult,
  InitialIncrementalExecutionResult,
  PendingResult,
  StreamItemsRecordResult,
  StreamRecord,
  SubsequentIncrementalExecutionResult,
  SuccessfulExecutionGroup,
} from './types.js';

export interface PayloadPublisher<TInitialPayload, TSubsequentPayload> {
  getInitialPayload: (
    data: ObjMap<unknown>,
    errors: ReadonlyArray<GraphQLError> | undefined,
    newRootNodes: ReadonlyArray<DeliveryGroup>,
  ) => TInitialPayload;
  getSubsequentPayloadPublisher: () => SubsequentPayloadPublisher<TSubsequentPayload>;
}

export interface SubsequentPayloadPublisher<TSubsequentPayload> {
  addFailedDeferredFragmentRecord: (
    deferredFragmentRecord: DeferredFragmentRecord,
    failedExecutionGroup: FailedExecutionGroup,
  ) => void;
  addSuccessfulDeferredFragmentRecord: (
    deferredFragmentRecord: DeferredFragmentRecord,
    newRootNodes: ReadonlyArray<DeliveryGroup>,
    successfulExecutionGroups: ReadonlyArray<SuccessfulExecutionGroup>,
  ) => void;
  addFailedStreamRecord: (
    streamRecord: StreamRecord,
    errors: ReadonlyArray<GraphQLError>,
  ) => void;
  addSuccessfulStreamRecord: (streamRecord: StreamRecord) => void;
  addStreamItems: (
    streamRecord: StreamRecord,
    newRootNodes: ReadonlyArray<DeliveryGroup> | undefined,
    result: StreamItemsRecordResult,
  ) => void;
  getSubsequentPayload: (hasNext: boolean) => TSubsequentPayload | undefined;
}

export function getPayloadPublisher(): PayloadPublisher<
  InitialIncrementalExecutionResult,
  SubsequentIncrementalExecutionResult
> {
  const ids = new Map<DeliveryGroup, string>();
  let nextId = 0;

  return {
    getInitialPayload,
    getSubsequentPayloadPublisher,
  };

  function getInitialPayload(
    data: ObjMap<unknown>,
    errors: ReadonlyArray<GraphQLError> | undefined,
    newRootNodes: ReadonlyArray<DeliveryGroup>,
  ): InitialIncrementalExecutionResult {
    const pending: Array<PendingResult> = [];
    addPendingResults(newRootNodes, pending);

    return errors === undefined
      ? { data, pending, hasNext: true }
      : { errors, data, pending, hasNext: true };
  }

  function addPendingResults(
    newRootNodes: ReadonlyArray<DeliveryGroup>,
    pending: Array<PendingResult>,
  ): void {
    for (const node of newRootNodes) {
      const id = String(nextId++);
      ids.set(node, id);
      const pendingResult: PendingResult = {
        id,
        path: pathToArray(node.path),
      };
      if (node.label !== undefined) {
        pendingResult.label = node.label;
      }
      pending.push(pendingResult);
    }
  }

  function getSubsequentPayloadPublisher(): SubsequentPayloadPublisher<SubsequentIncrementalExecutionResult> {
    const pending: Array<PendingResult> = [];
    const incremental: Array<IncrementalResult> = [];
    const completed: Array<CompletedResult> = [];

    return {
      addFailedDeferredFragmentRecord,
      addSuccessfulDeferredFragmentRecord,
      addFailedStreamRecord,
      addSuccessfulStreamRecord,
      addStreamItems,
      getSubsequentPayload,
    };

    function addFailedDeferredFragmentRecord(
      deferredFragmentRecord: DeferredFragmentRecord,
      failedExecutionGroup: FailedExecutionGroup,
    ): void {
      const id = ids.get(deferredFragmentRecord);
      invariant(id !== undefined);
      completed.push({
        id,
        errors: failedExecutionGroup.errors,
      });
    }

    function addSuccessfulDeferredFragmentRecord(
      deferredFragmentRecord: DeferredFragmentRecord,
      newRootNodes: ReadonlyArray<DeliveryGroup>,
      successfulExecutionGroups: ReadonlyArray<SuccessfulExecutionGroup>,
    ): void {
      const id = ids.get(deferredFragmentRecord);
      invariant(id !== undefined);
      addPendingResults(newRootNodes, pending);
      for (const successfulExecutionGroup of successfulExecutionGroups) {
        const { bestId, subPath } = getBestIdAndSubPath(
          id,
          deferredFragmentRecord,
          successfulExecutionGroup,
        );
        const incrementalEntry: IncrementalDeferResult = {
          ...successfulExecutionGroup.result,
          id: bestId,
        };
        if (subPath !== undefined) {
          incrementalEntry.subPath = subPath;
        }
        incremental.push(incrementalEntry);
      }
      completed.push({ id });
    }

    function addFailedStreamRecord(
      streamRecord: StreamRecord,
      errors: ReadonlyArray<GraphQLError>,
    ): void {
      const id = ids.get(streamRecord);
      invariant(id !== undefined);
      completed.push({
        id,
        errors,
      });
    }

    function addSuccessfulStreamRecord(streamRecord: StreamRecord): void {
      const id = ids.get(streamRecord);
      invariant(id !== undefined);
      completed.push({ id });
    }

    function addStreamItems(
      streamRecord: StreamRecord,
      newRootNodes: ReadonlyArray<DeliveryGroup> | undefined,
      result: StreamItemsRecordResult,
    ): void {
      const id = ids.get(streamRecord);
      invariant(id !== undefined);
      const incrementalEntry: IncrementalStreamResult = {
        id,
        ...result,
      };

      incremental.push(incrementalEntry);

      if (newRootNodes) {
        addPendingResults(newRootNodes, pending);
      }
    }

    function getSubsequentPayload(
      hasNext: boolean,
    ): SubsequentIncrementalExecutionResult | undefined {
      if (incremental.length > 0 || completed.length > 0) {
        const subsequentIncrementalExecutionResult: SubsequentIncrementalExecutionResult =
          { hasNext };

        if (pending.length > 0) {
          subsequentIncrementalExecutionResult.pending = pending;
        }
        if (incremental.length > 0) {
          subsequentIncrementalExecutionResult.incremental = incremental;
        }
        if (completed.length > 0) {
          subsequentIncrementalExecutionResult.completed = completed;
        }

        return subsequentIncrementalExecutionResult;
      }
    }
  }

  function getBestIdAndSubPath(
    initialId: string,
    initialDeferredFragmentRecord: DeferredFragmentRecord,
    completedExecutionGroup: CompletedExecutionGroup,
  ): { bestId: string; subPath: ReadonlyArray<string | number> | undefined } {
    let maxLength = pathToArray(initialDeferredFragmentRecord.path).length;
    let bestId = initialId;

    for (const deferredFragmentRecord of completedExecutionGroup
      .pendingExecutionGroup.deferredFragmentRecords) {
      if (deferredFragmentRecord === initialDeferredFragmentRecord) {
        continue;
      }
      const id = ids.get(deferredFragmentRecord);
      // TODO: add test case for when an fragment has not been released, but might be processed for the shortest path.
      /* c8 ignore next 3 */
      if (id === undefined) {
        continue;
      }
      const fragmentPath = pathToArray(deferredFragmentRecord.path);
      const length = fragmentPath.length;
      if (length > maxLength) {
        maxLength = length;
        bestId = id;
      }
    }
    const subPath = completedExecutionGroup.path.slice(maxLength);
    return {
      bestId,
      subPath: subPath.length > 0 ? subPath : undefined,
    };
  }
}
