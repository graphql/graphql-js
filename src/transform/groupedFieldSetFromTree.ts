import { AccumulatorMap } from '../jsutils/AccumulatorMap.js';
import { invariant } from '../jsutils/invariant.js';
import type { Path } from '../jsutils/Path.js';
import { pathToArray } from '../jsutils/Path.js';

import type {
  FieldDetails,
  GroupedFieldSet,
} from '../execution/collectFields.js';

import type { TransformationContext } from './buildTransformationContext.js';
import type { DeferredFragmentTree } from './collectFields.js';

export function groupedFieldSetFromTree(
  context: TransformationContext,
  groupedFieldSet: GroupedFieldSet,
  deferredFragmentTree: DeferredFragmentTree,
  path: Path | undefined,
): GroupedFieldSet {
  const groupedFieldSetWithInlinedDefers = new AccumulatorMap<
    string,
    FieldDetails
  >();

  for (const [responseName, fieldDetailsList] of groupedFieldSet) {
    for (const fieldDetails of fieldDetailsList) {
      groupedFieldSetWithInlinedDefers.add(responseName, fieldDetails);
    }
  }

  maybeAddDefers(
    context,
    groupedFieldSetWithInlinedDefers,
    deferredFragmentTree,
    path,
  );

  return groupedFieldSetWithInlinedDefers;
}

function maybeAddDefers(
  context: TransformationContext,
  groupedFieldSetWithInlinedDefers: AccumulatorMap<string, FieldDetails>,
  deferredFragmentTree: DeferredFragmentTree,
  path: Path | undefined,
): void {
  for (const [label, nestedDeferredFragmentTree] of deferredFragmentTree) {
    const pathStr = pathToArray(path).join('.');
    const labels = context.pendingLabelsByPath.get(pathStr);
    if (labels?.has(label)) {
      continue;
    }

    const groupedFieldSet = context.deferredGroupedFieldSets.get(label);
    invariant(groupedFieldSet != null);

    for (const [responseName, fieldDetailsList] of groupedFieldSet) {
      for (const fieldDetails of fieldDetailsList) {
        groupedFieldSetWithInlinedDefers.add(responseName, fieldDetails);
      }
    }

    maybeAddDefers(
      context,
      groupedFieldSetWithInlinedDefers,
      nestedDeferredFragmentTree,
      path,
    );
  }
}
