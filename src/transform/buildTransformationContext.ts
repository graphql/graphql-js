import { invariant } from '../jsutils/invariant.js';
import { mapValue } from '../jsutils/mapValue.js';
import type { ObjMap } from '../jsutils/ObjMap.js';

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
import { TypeNameMetaFieldDef } from '../type/introspection.js';

import { collectSubfields as _collectSubfields } from '../execution/collectFields.js';
import type { ValidatedExecutionArgs } from '../execution/execute.js';
import type { PendingResult } from '../execution/types.js';

type SelectionSetNodeOrFragmentName =
  | { node: SelectionSetNode; fragmentName?: never }
  | { node?: never; fragmentName: string };

interface DeferUsageContext {
  originalLabel: string | undefined;
  selectionSet: SelectionSetNodeOrFragmentName;
}

interface StreamUsageContext {
  originalLabel: string | undefined;
  selectionSet: SelectionSetNode | undefined;
}

export interface TransformationContext {
  transformedArgs: ValidatedExecutionArgs;
  deferUsageMap: Map<string, DeferUsageContext>;
  streamUsageMap: Map<string, StreamUsageContext>;
  prefix: string;
  pendingResultsById: Map<string, PendingResult>;
  pendingLabelsByPath: Map<string, Set<string>>;
  mergedResult: ObjMap<unknown>;
}

interface RequestTransformationContext {
  prefix: string;
  incrementalCounter: number;
  deferUsageMap: Map<string, DeferUsageContext>;
  streamUsageMap: Map<string, StreamUsageContext>;
}

export function buildTransformationContext(
  originalArgs: ValidatedExecutionArgs,
  prefix: string,
): TransformationContext {
  const { operation, fragments } = originalArgs;

  const context: RequestTransformationContext = {
    prefix,
    incrementalCounter: 0,
    deferUsageMap: new Map(),
    streamUsageMap: new Map(),
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
    deferUsageMap: context.deferUsageMap,
    streamUsageMap: context.streamUsageMap,
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
      const transformedSelectionSet = transformNestedSelectionSet(
        context,
        selectionSet,
      );
      return {
        ...selection,
        selectionSet: transformedSelectionSet,
        directives: selection.directives?.map((directive) =>
          transformMaybeStreamDirective(
            context,
            directive,
            transformedSelectionSet,
          ),
        ),
      };
    }
    return {
      ...selection,
      directives: selection.directives?.map((directive) =>
        transformMaybeStreamDirective(context, directive, undefined),
      ),
    };
  } else if (selection.kind === Kind.INLINE_FRAGMENT) {
    const transformedSelectionSet = transformRootSelectionSet(
      context,
      selection.selectionSet,
    );

    return {
      ...selection,
      selectionSet: transformedSelectionSet,
      directives: selection.directives?.map((directive) =>
        transformMaybeDeferDirective(context, directive, {
          node: transformedSelectionSet,
        }),
      ),
    };
  }

  return {
    ...selection,
    directives: selection.directives?.map((directive) =>
      transformMaybeDeferDirective(context, directive, {
        fragmentName: selection.name.value,
      }),
    ),
  };
}

function transformMaybeDeferDirective(
  context: RequestTransformationContext,
  directive: DirectiveNode,
  selectionSet: SelectionSetNodeOrFragmentName,
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
        context.deferUsageMap.set(prefixedLabel, {
          originalLabel,
          selectionSet,
        });
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
    context.deferUsageMap.set(newLabel, {
      originalLabel: undefined,
      selectionSet,
    });
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
  selectionSet: SelectionSetNode | undefined,
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
        context.streamUsageMap.set(prefixedLabel, {
          originalLabel,
          selectionSet,
        });
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
    context.streamUsageMap.set(newLabel, {
      originalLabel: undefined,
      selectionSet,
    });
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
