import type { Path } from '../jsutils/Path.js';

import type { DeferUsage } from './collectFields.js';
import { DeferredFragmentRecord } from './types.js';

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
