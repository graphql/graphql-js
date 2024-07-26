import type { Path } from '../jsutils/Path.js';

import type { DeferUsage } from './collectFields.js';
import type {
  PendingExecutionGroup,
  StreamRecord,
  SuccessfulExecutionGroup,
} from './types.js';

export type DeliveryGroup = DeferredFragmentRecord | StreamRecord;

/** @internal */
export class DeferredFragmentRecord {
  path: Path | undefined;
  label: string | undefined;
  parentDeferUsage: DeferUsage | undefined;
  id?: string | undefined;
  pendingExecutionGroups: Set<PendingExecutionGroup>;
  successfulExecutionGroups: Set<SuccessfulExecutionGroup>;
  children: Set<DeliveryGroup>;

  constructor(
    path: Path | undefined,
    label: string | undefined,
    parentDeferUsage: DeferUsage | undefined,
  ) {
    this.path = path;
    this.label = label;
    this.parentDeferUsage = parentDeferUsage;
    this.pendingExecutionGroups = new Set();
    this.successfulExecutionGroups = new Set();
    this.children = new Set();
  }
}

export function isDeferredFragmentRecord(
  deliveryGroup: DeliveryGroup,
): deliveryGroup is DeferredFragmentRecord {
  return deliveryGroup instanceof DeferredFragmentRecord;
}

/**
 * @internal
 */
export class DeferredFragmentFactory {
  private _rootDeferredFragments = new Map<
    DeferUsage,
    DeferredFragmentRecord
  >();

  get(deferUsage: DeferUsage, path: Path | undefined): DeferredFragmentRecord {
    const deferUsagePath = this._pathAtDepth(path, deferUsage.depth);
    let deferredFragmentRecords:
      | Map<DeferUsage, DeferredFragmentRecord>
      | undefined;
    if (deferUsagePath === undefined) {
      deferredFragmentRecords = this._rootDeferredFragments;
    } else {
      // A doubly nested Map<Path, Map<DeferUsage, DeferredFragmentRecord>>
      // could be used, but could leak memory in long running operations.
      // A WeakMap could be used instead. The below implementation is
      // WeakMap-Like, saving the Map on the Path object directly.
      // Alternatively, memory could be reclaimed manually, taking care to
      // also reclaim memory for nested DeferredFragmentRecords if the parent
      // is removed secondary to an error.
      deferredFragmentRecords = (
        deferUsagePath as unknown as {
          deferredFragmentRecords: Map<DeferUsage, DeferredFragmentRecord>;
        }
      ).deferredFragmentRecords;
      if (deferredFragmentRecords === undefined) {
        deferredFragmentRecords = new Map();
        (
          deferUsagePath as unknown as {
            deferredFragmentRecords: Map<DeferUsage, DeferredFragmentRecord>;
          }
        ).deferredFragmentRecords = deferredFragmentRecords;
      }
    }
    let deferredFragmentRecord = deferredFragmentRecords.get(deferUsage);
    if (deferredFragmentRecord === undefined) {
      const { label, parentDeferUsage } = deferUsage;
      deferredFragmentRecord = new DeferredFragmentRecord(
        deferUsagePath,
        label,
        parentDeferUsage,
      );
      deferredFragmentRecords.set(deferUsage, deferredFragmentRecord);
    }
    return deferredFragmentRecord;
  }

  private _pathAtDepth(
    path: Path | undefined,
    depth: number,
  ): Path | undefined {
    if (depth === 0) {
      return;
    }
    const stack: Array<Path> = [];
    let currentPath = path;
    while (currentPath !== undefined) {
      stack.unshift(currentPath);
      currentPath = currentPath.prev;
    }
    return stack[depth - 1];
  }
}
