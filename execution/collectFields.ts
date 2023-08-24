import { AccumulatorMap } from '../jsutils/AccumulatorMap.ts';
import { getBySet } from '../jsutils/getBySet.ts';
import { invariant } from '../jsutils/invariant.ts';
import { isSameSet } from '../jsutils/isSameSet.ts';
import type { ObjMap } from '../jsutils/ObjMap.ts';
import type {
  FieldNode,
  FragmentDefinitionNode,
  FragmentSpreadNode,
  InlineFragmentNode,
  OperationDefinitionNode,
  SelectionSetNode,
} from '../language/ast.ts';
import { OperationTypeNode } from '../language/ast.ts';
import { Kind } from '../language/kinds.ts';
import type { GraphQLObjectType } from '../type/definition.ts';
import { isAbstractType } from '../type/definition.ts';
import {
  GraphQLDeferDirective,
  GraphQLIncludeDirective,
  GraphQLSkipDirective,
} from '../type/directives.ts';
import type { GraphQLSchema } from '../type/schema.ts';
import { typeFromAST } from '../utilities/typeFromAST.ts';
import { getDirectiveValues } from './values.ts';
export interface DeferUsage {
  label: string | undefined;
  ancestors: ReadonlyArray<Target>;
}
export const NON_DEFERRED_TARGET_SET: TargetSet = new Set<Target>([undefined]);
export type Target = DeferUsage | undefined;
export type TargetSet = ReadonlySet<Target>;
export type DeferUsageSet = ReadonlySet<DeferUsage>;
export interface FieldDetails {
  node: FieldNode;
  target: Target;
}
export interface FieldGroup {
  fields: ReadonlyArray<FieldDetails>;
  targets: TargetSet;
}
export type GroupedFieldSet = Map<string, FieldGroup>;
export interface GroupedFieldSetDetails {
  groupedFieldSet: GroupedFieldSet;
  shouldInitiateDefer: boolean;
}
export interface CollectFieldsResult {
  groupedFieldSet: GroupedFieldSet;
  newGroupedFieldSetDetails: Map<DeferUsageSet, GroupedFieldSetDetails>;
  newDeferUsages: ReadonlyArray<DeferUsage>;
}
interface CollectFieldsContext {
  schema: GraphQLSchema;
  fragments: ObjMap<FragmentDefinitionNode>;
  variableValues: {
    [variable: string]: unknown;
  };
  operation: OperationDefinitionNode;
  runtimeType: GraphQLObjectType;
  targetsByKey: Map<string, Set<Target>>;
  fieldsByTarget: Map<Target, AccumulatorMap<string, FieldNode>>;
  newDeferUsages: Array<DeferUsage>;
  visitedFragmentNames: Set<string>;
}
/**
 * Given a selectionSet, collects all of the fields and returns them.
 *
 * CollectFields requires the "runtime type" of an object. For a field that
 * returns an Interface or Union type, the "runtime type" will be the actual
 * object type returned by that field.
 *
 * @internal
 */
export function collectFields(
  schema: GraphQLSchema,
  fragments: ObjMap<FragmentDefinitionNode>,
  variableValues: {
    [variable: string]: unknown;
  },
  runtimeType: GraphQLObjectType,
  operation: OperationDefinitionNode,
): CollectFieldsResult {
  const context: CollectFieldsContext = {
    schema,
    fragments,
    variableValues,
    runtimeType,
    operation,
    fieldsByTarget: new Map(),
    targetsByKey: new Map(),
    newDeferUsages: [],
    visitedFragmentNames: new Set(),
  };
  collectFieldsImpl(context, operation.selectionSet);
  return {
    ...buildGroupedFieldSets(context.targetsByKey, context.fieldsByTarget),
    newDeferUsages: context.newDeferUsages,
  };
}
/**
 * Given an array of field nodes, collects all of the subfields of the passed
 * in fields, and returns them at the end.
 *
 * CollectSubFields requires the "return type" of an object. For a field that
 * returns an Interface or Union type, the "return type" will be the actual
 * object type returned by that field.
 *
 * @internal
 */
// eslint-disable-next-line max-params
export function collectSubfields(
  schema: GraphQLSchema,
  fragments: ObjMap<FragmentDefinitionNode>,
  variableValues: {
    [variable: string]: unknown;
  },
  operation: OperationDefinitionNode,
  returnType: GraphQLObjectType,
  fieldGroup: FieldGroup,
): CollectFieldsResult {
  const context: CollectFieldsContext = {
    schema,
    fragments,
    variableValues,
    runtimeType: returnType,
    operation,
    fieldsByTarget: new Map(),
    targetsByKey: new Map(),
    newDeferUsages: [],
    visitedFragmentNames: new Set(),
  };
  for (const fieldDetails of fieldGroup.fields) {
    const node = fieldDetails.node;
    if (node.selectionSet) {
      collectFieldsImpl(context, node.selectionSet, fieldDetails.target);
    }
  }
  return {
    ...buildGroupedFieldSets(
      context.targetsByKey,
      context.fieldsByTarget,
      fieldGroup.targets,
    ),
    newDeferUsages: context.newDeferUsages,
  };
}
function collectFieldsImpl(
  context: CollectFieldsContext,
  selectionSet: SelectionSetNode,
  parentTarget?: Target,
  newTarget?: Target,
): void {
  const {
    schema,
    fragments,
    variableValues,
    runtimeType,
    operation,
    targetsByKey,
    fieldsByTarget,
    newDeferUsages,
    visitedFragmentNames,
  } = context;
  for (const selection of selectionSet.selections) {
    switch (selection.kind) {
      case Kind.FIELD: {
        if (!shouldIncludeNode(variableValues, selection)) {
          continue;
        }
        const key = getFieldEntryKey(selection);
        const target = newTarget ?? parentTarget;
        let keyTargets = targetsByKey.get(key);
        if (keyTargets === undefined) {
          keyTargets = new Set();
          targetsByKey.set(key, keyTargets);
        }
        keyTargets.add(target);
        let targetFields = fieldsByTarget.get(target);
        if (targetFields === undefined) {
          targetFields = new AccumulatorMap();
          fieldsByTarget.set(target, targetFields);
        }
        targetFields.add(key, selection);
        break;
      }
      case Kind.INLINE_FRAGMENT: {
        if (
          !shouldIncludeNode(variableValues, selection) ||
          !doesFragmentConditionMatch(schema, selection, runtimeType)
        ) {
          continue;
        }
        const defer = getDeferValues(operation, variableValues, selection);
        let target: Target;
        if (!defer) {
          target = newTarget;
        } else {
          const ancestors =
            parentTarget === undefined
              ? [parentTarget]
              : [parentTarget, ...parentTarget.ancestors];
          target = { ...defer, ancestors };
          newDeferUsages.push(target);
        }
        collectFieldsImpl(
          context,
          selection.selectionSet,
          parentTarget,
          target,
        );
        break;
      }
      case Kind.FRAGMENT_SPREAD: {
        const fragName = selection.name.value;
        if (!shouldIncludeNode(variableValues, selection)) {
          continue;
        }
        const defer = getDeferValues(operation, variableValues, selection);
        if (visitedFragmentNames.has(fragName) && !defer) {
          continue;
        }
        const fragment = fragments[fragName];
        if (
          fragment == null ||
          !doesFragmentConditionMatch(schema, fragment, runtimeType)
        ) {
          continue;
        }
        let target: Target;
        if (!defer) {
          visitedFragmentNames.add(fragName);
          target = newTarget;
        } else {
          const ancestors =
            parentTarget === undefined
              ? [parentTarget]
              : [parentTarget, ...parentTarget.ancestors];
          target = { ...defer, ancestors };
          newDeferUsages.push(target);
        }
        collectFieldsImpl(context, fragment.selectionSet, parentTarget, target);
        break;
      }
    }
  }
}
/**
 * Returns an object containing the `@defer` arguments if a field should be
 * deferred based on the experimental flag, defer directive present and
 * not disabled by the "if" argument.
 */
function getDeferValues(
  operation: OperationDefinitionNode,
  variableValues: {
    [variable: string]: unknown;
  },
  node: FragmentSpreadNode | InlineFragmentNode,
):
  | undefined
  | {
      label: string | undefined;
    } {
  const defer = getDirectiveValues(GraphQLDeferDirective, node, variableValues);
  if (!defer) {
    return;
  }
  if (defer.if === false) {
    return;
  }
  operation.operation !== OperationTypeNode.SUBSCRIPTION ||
    invariant(
      false,
      '`@defer` directive not supported on subscription operations. Disable `@defer` by setting the `if` argument to `false`.',
    );
  return {
    label: typeof defer.label === 'string' ? defer.label : undefined,
  };
}
/**
 * Determines if a field should be included based on the `@include` and `@skip`
 * directives, where `@skip` has higher precedence than `@include`.
 */
function shouldIncludeNode(
  variableValues: {
    [variable: string]: unknown;
  },
  node: FragmentSpreadNode | FieldNode | InlineFragmentNode,
): boolean {
  const skip = getDirectiveValues(GraphQLSkipDirective, node, variableValues);
  if (skip?.if === true) {
    return false;
  }
  const include = getDirectiveValues(
    GraphQLIncludeDirective,
    node,
    variableValues,
  );
  if (include?.if === false) {
    return false;
  }
  return true;
}
/**
 * Determines if a fragment is applicable to the given type.
 */
function doesFragmentConditionMatch(
  schema: GraphQLSchema,
  fragment: FragmentDefinitionNode | InlineFragmentNode,
  type: GraphQLObjectType,
): boolean {
  const typeConditionNode = fragment.typeCondition;
  if (!typeConditionNode) {
    return true;
  }
  const conditionalType = typeFromAST(schema, typeConditionNode);
  if (conditionalType === type) {
    return true;
  }
  if (isAbstractType(conditionalType)) {
    return schema.isSubType(conditionalType, type);
  }
  return false;
}
/**
 * Implements the logic to compute the key of a given field's entry
 */
function getFieldEntryKey(node: FieldNode): string {
  return node.alias ? node.alias.value : node.name.value;
}
function buildGroupedFieldSets(
  targetsByKey: Map<string, Set<Target>>,
  fieldsByTarget: Map<Target, Map<string, ReadonlyArray<FieldNode>>>,
  parentTargets = NON_DEFERRED_TARGET_SET,
): {
  groupedFieldSet: GroupedFieldSet;
  newGroupedFieldSetDetails: Map<DeferUsageSet, GroupedFieldSetDetails>;
} {
  const { parentTargetKeys, targetSetDetailsMap } = getTargetSetDetails(
    targetsByKey,
    parentTargets,
  );
  const groupedFieldSet =
    parentTargetKeys.size > 0
      ? getOrderedGroupedFieldSet(
          parentTargetKeys,
          parentTargets,
          targetsByKey,
          fieldsByTarget,
        )
      : new Map();
  const newGroupedFieldSetDetails = new Map<
    DeferUsageSet,
    GroupedFieldSetDetails
  >();
  for (const [maskingTargets, targetSetDetails] of targetSetDetailsMap) {
    const { keys, shouldInitiateDefer } = targetSetDetails;
    const newGroupedFieldSet = getOrderedGroupedFieldSet(
      keys,
      maskingTargets,
      targetsByKey,
      fieldsByTarget,
    );
    // All TargetSets that causes new grouped field sets consist only of DeferUsages
    // and have shouldInitiateDefer defined
    newGroupedFieldSetDetails.set(maskingTargets as DeferUsageSet, {
      groupedFieldSet: newGroupedFieldSet,
      shouldInitiateDefer,
    });
  }
  return {
    groupedFieldSet,
    newGroupedFieldSetDetails,
  };
}
interface TargetSetDetails {
  keys: Set<string>;
  shouldInitiateDefer: boolean;
}
function getTargetSetDetails(
  targetsByKey: Map<string, Set<Target>>,
  parentTargets: TargetSet,
): {
  parentTargetKeys: ReadonlySet<string>;
  targetSetDetailsMap: Map<TargetSet, TargetSetDetails>;
} {
  const parentTargetKeys = new Set<string>();
  const targetSetDetailsMap = new Map<TargetSet, TargetSetDetails>();
  for (const [responseKey, targets] of targetsByKey) {
    const maskingTargetList: Array<Target> = [];
    for (const target of targets) {
      if (
        target === undefined ||
        target.ancestors.every((ancestor) => !targets.has(ancestor))
      ) {
        maskingTargetList.push(target);
      }
    }
    const maskingTargets: TargetSet = new Set<Target>(maskingTargetList);
    if (isSameSet(maskingTargets, parentTargets)) {
      parentTargetKeys.add(responseKey);
      continue;
    }
    let targetSetDetails = getBySet(targetSetDetailsMap, maskingTargets);
    if (targetSetDetails === undefined) {
      targetSetDetails = {
        keys: new Set(),
        shouldInitiateDefer: maskingTargetList.some(
          (deferUsage) => !parentTargets.has(deferUsage),
        ),
      };
      targetSetDetailsMap.set(maskingTargets, targetSetDetails);
    }
    targetSetDetails.keys.add(responseKey);
  }
  return {
    parentTargetKeys,
    targetSetDetailsMap,
  };
}
function getOrderedGroupedFieldSet(
  keys: ReadonlySet<string>,
  maskingTargets: TargetSet,
  targetsByKey: Map<string, Set<Target>>,
  fieldsByTarget: Map<Target, Map<string, ReadonlyArray<FieldNode>>>,
): GroupedFieldSet {
  const groupedFieldSet = new Map<
    string,
    {
      fields: Array<FieldDetails>;
      targets: TargetSet;
    }
  >();
  const firstTarget = maskingTargets.values().next().value as Target;
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const firstFields = fieldsByTarget.get(firstTarget)!;
  for (const [key] of firstFields) {
    if (keys.has(key)) {
      let fieldGroup = groupedFieldSet.get(key);
      if (fieldGroup === undefined) {
        fieldGroup = { fields: [], targets: maskingTargets };
        groupedFieldSet.set(key, fieldGroup);
      }
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      for (const target of targetsByKey.get(key)!) {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const fieldsForTarget = fieldsByTarget.get(target)!;
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const nodes = fieldsForTarget.get(key)!;
        // the following line is an optional minor optimization
        fieldsForTarget.delete(key);
        fieldGroup.fields.push(...nodes.map((node) => ({ node, target })));
      }
    }
  }
  return groupedFieldSet;
}
