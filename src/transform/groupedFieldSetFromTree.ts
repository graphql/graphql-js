import { AccumulatorMap } from '../jsutils/AccumulatorMap.js';
import type { Path } from '../jsutils/Path.js';
import { pathToArray } from '../jsutils/Path.js';

import type {
  FieldDetails,
  GroupedFieldSet,
} from '../execution/collectFields.js';

import type { TransformationContext } from './buildTransformationContext.js';
import type { GroupedFieldSetTree } from './collectFields.js';

export function groupedFieldSetFromTree(
  context: TransformationContext,
  groupedFieldSetTree: GroupedFieldSetTree,
  path: Path | undefined,
): GroupedFieldSet {
  const groupedFieldSetWithInlinedDefers = new AccumulatorMap<
    string,
    FieldDetails
  >();
  groupedFieldSetFromTreeImpl(
    context,
    groupedFieldSetWithInlinedDefers,
    groupedFieldSetTree,
    path,
  );
  return groupedFieldSetWithInlinedDefers;
}

function groupedFieldSetFromTreeImpl(
  context: TransformationContext,
  groupedFieldSetWithInlinedDefers: AccumulatorMap<string, FieldDetails>,
  groupedFieldSetTree: GroupedFieldSetTree,
  path: Path | undefined,
): void {
  const { groupedFieldSet, deferredGroupedFieldSets } = groupedFieldSetTree;

  for (const [responseName, fieldDetailsList] of groupedFieldSet) {
    for (const fieldDetails of fieldDetailsList) {
      groupedFieldSetWithInlinedDefers.add(responseName, fieldDetails);
    }
  }

  for (const [label, childGroupedFieldSetTree] of deferredGroupedFieldSets) {
    const pathStr = pathToArray(path).join('.');
    const labels = context.pendingLabelsByPath.get(pathStr);
    if (labels?.has(label)) {
      continue;
    }

    groupedFieldSetFromTreeImpl(
      context,
      groupedFieldSetWithInlinedDefers,
      childGroupedFieldSetTree,
      path,
    );
  }
}
