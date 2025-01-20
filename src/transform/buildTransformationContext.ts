import { invariant } from '../jsutils/invariant.js';
import { mapValue } from '../jsutils/mapValue.js';
import type { ObjMap } from '../jsutils/ObjMap.js';
import type { Path } from '../jsutils/Path.js';

import type {
  ArgumentNode,
  DirectiveNode,
  SelectionNode,
  SelectionSetNode,
} from '../language/ast.js';
import { Kind } from '../language/kinds.js';

import {
  GraphQLDeferDirective,
  GraphQLStreamDirective,
} from '../type/directives.js';
import type { GraphQLOutputType } from '../type/index.js';
import { TypeNameMetaFieldDef } from '../type/introspection.js';

import type { GroupedFieldSet } from '../execution/collectFields.js';
import type { ValidatedExecutionArgs } from '../execution/execute.js';
import type { PendingResult } from '../execution/types.js';

import type { FieldDetails } from './collectFields.js';

export interface Stream {
  path: Path;
  itemType: GraphQLOutputType;
  fieldDetailsList: ReadonlyArray<FieldDetails>;
  nextIndex: number;
}

export interface TransformationContext {
  transformedArgs: ValidatedExecutionArgs;
  originalDeferLabels: Map<string, string | undefined>;
  originalStreamLabels: Map<string, string | undefined>;
  deferredGroupedFieldSets: Map<string, GroupedFieldSet>;
  streams: Map<string, Stream>;
  prefix: string;
  pendingResultsById: Map<string, PendingResult>;
  pendingLabelsByPath: Map<string, Set<string>>;
  mergedResult: ObjMap<unknown>;
}

interface RequestTransformationContext {
  prefix: string;
  incrementalCounter: number;
  originalDeferLabels: Map<string, string | undefined>;
  originalStreamLabels: Map<string, string | undefined>;
}

export function buildTransformationContext(
  originalArgs: ValidatedExecutionArgs,
  prefix: string,
): TransformationContext {
  const { operation, fragments } = originalArgs;

  const context: RequestTransformationContext = {
    prefix,
    incrementalCounter: 0,
    originalDeferLabels: new Map(),
    originalStreamLabels: new Map(),
  };

  const transformedFragments = mapValue(fragments, (details) => ({
    ...details,
    definition: {
      ...details.definition,
      selectionSet: transformRootSelectionSet(
        context,
        details.definition.selectionSet,
      ),
    },
  }));

  const transformedArgs: ValidatedExecutionArgs = {
    ...originalArgs,
    operation: {
      ...operation,
      selectionSet: transformRootSelectionSet(context, operation.selectionSet),
    },
    fragmentDefinitions: mapValue(
      transformedFragments,
      ({ definition }) => definition,
    ),
    fragments: transformedFragments,
  };

  return {
    transformedArgs,
    originalDeferLabels: context.originalDeferLabels,
    originalStreamLabels: context.originalStreamLabels,
    deferredGroupedFieldSets: new Map(),
    streams: new Map(),
    prefix,
    pendingResultsById: new Map(),
    pendingLabelsByPath: new Map(),
    mergedResult: {},
  };
}

function transformRootSelectionSet(
  context: RequestTransformationContext,
  selectionSet: SelectionSetNode,
): SelectionSetNode {
  return {
    ...selectionSet,
    selections: [
      ...selectionSet.selections.map((node) =>
        transformSelection(context, node),
      ),
    ],
  };
}

function transformNestedSelectionSet(
  context: RequestTransformationContext,
  selectionSet: SelectionSetNode,
): SelectionSetNode {
  return {
    ...selectionSet,
    selections: [
      ...selectionSet.selections.map((node) =>
        transformSelection(context, node),
      ),
      {
        kind: Kind.FIELD,
        name: {
          kind: Kind.NAME,
          value: TypeNameMetaFieldDef.name,
        },
        alias: {
          kind: Kind.NAME,
          value: context.prefix,
        },
      },
    ],
  };
}

function transformSelection(
  context: RequestTransformationContext,
  selection: SelectionNode,
): SelectionNode {
  if (selection.kind === Kind.FIELD) {
    const selectionSet = selection.selectionSet;
    if (selectionSet) {
      return {
        ...selection,
        selectionSet: transformNestedSelectionSet(context, selectionSet),
        directives: selection.directives?.map((directive) =>
          transformMaybeStreamDirective(context, directive),
        ),
      };
    }
    return {
      ...selection,
      directives: selection.directives?.map((directive) =>
        transformMaybeStreamDirective(context, directive),
      ),
    };
  } else if (selection.kind === Kind.INLINE_FRAGMENT) {
    return {
      ...selection,
      selectionSet: transformRootSelectionSet(context, selection.selectionSet),
      directives: selection.directives?.map((directive) =>
        transformMaybeDeferDirective(context, directive),
      ),
    };
  }

  return {
    ...selection,
    directives: selection.directives?.map((directive) =>
      transformMaybeDeferDirective(context, directive),
    ),
  };
}

function transformMaybeDeferDirective(
  context: RequestTransformationContext,
  directive: DirectiveNode,
): DirectiveNode {
  const name = directive.name.value;

  if (name !== GraphQLDeferDirective.name) {
    return directive;
  }

  let foundLabel = false;
  const newArgs: Array<ArgumentNode> = [];
  const args = directive.arguments;
  if (args) {
    for (const arg of args) {
      if (arg.name.value === 'label') {
        foundLabel = true;
        const value = arg.value;

        invariant(value.kind === Kind.STRING);

        const originalLabel = value.value;
        const prefixedLabel = `${context.prefix}defer${context.incrementalCounter++}__${originalLabel}`;
        context.originalDeferLabels.set(prefixedLabel, originalLabel);
        newArgs.push({
          ...arg,
          value: {
            ...value,
            value: prefixedLabel,
          },
        });
      } else {
        newArgs.push(arg);
      }
    }
  }

  if (!foundLabel) {
    const newLabel = `${context.prefix}defer${context.incrementalCounter++}`;
    context.originalDeferLabels.set(newLabel, undefined);
    newArgs.push({
      kind: Kind.ARGUMENT,
      name: {
        kind: Kind.NAME,
        value: 'label',
      },
      value: {
        kind: Kind.STRING,
        value: newLabel,
      },
    });
  }

  return {
    ...directive,
    arguments: newArgs,
  };
}

function transformMaybeStreamDirective(
  context: RequestTransformationContext,
  directive: DirectiveNode,
): DirectiveNode {
  const name = directive.name.value;

  if (name !== GraphQLStreamDirective.name) {
    return directive;
  }

  let foundLabel = false;
  const newArgs: Array<ArgumentNode> = [];
  const args = directive.arguments;
  if (args) {
    for (const arg of args) {
      if (arg.name.value === 'label') {
        foundLabel = true;
        const value = arg.value;

        invariant(value.kind === Kind.STRING);

        const originalLabel = value.value;
        const prefixedLabel = `${context.prefix}stream${context.incrementalCounter++}__${originalLabel}`;
        context.originalStreamLabels.set(prefixedLabel, originalLabel);
        newArgs.push({
          ...arg,
          value: {
            ...value,
            value: prefixedLabel,
          },
        });
      } else {
        newArgs.push(arg);
      }
    }
  }

  if (!foundLabel) {
    const newLabel = `${context.prefix}stream${context.incrementalCounter++}`;
    context.originalStreamLabels.set(newLabel, undefined);
    newArgs.push({
      kind: Kind.ARGUMENT,
      name: {
        kind: Kind.NAME,
        value: 'label',
      },
      value: {
        kind: Kind.STRING,
        value: newLabel,
      },
    });
  }

  return {
    ...directive,
    arguments: newArgs,
  };
}
