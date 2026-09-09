/** @category Validation Rules */

import type { Maybe } from '../../jsutils/Maybe.ts';

import { GraphQLError } from '../../error/GraphQLError.ts';

import type {
  ArgumentNode,
  DirectiveNode,
  FieldNode,
  FragmentArgumentNode,
  FragmentDefinitionNode,
  FragmentSpreadNode,
  SelectionSetNode,
  ValueNode,
} from '../../language/ast.ts';
import { Kind } from '../../language/kinds.ts';
import { print } from '../../language/printer.ts';

import { sortValueNode } from '../../utilities/sortValueNode.ts';

import type { IndexCursor } from '../IndexCursor.ts';
import type {
  CompositeTypeReference,
  FieldReference,
  OutputTypeReference,
  TypeSystemValidationIndex,
} from '../TypeSystemValidationIndex.ts';

import type {
  ASTValidationContext,
  ASTVisitorFn,
} from './ASTValidationContext.ts';

/* eslint-disable max-params */
// This mirrors the legacy overlap algorithm, which threads comparison caches
// through several recursive helpers.

function reasonMessage(reason: ConflictReasonMessage): string {
  if (Array.isArray(reason)) {
    return reason
      .map(
        ([responseName, subReason]) =>
          `subfields "${responseName}" conflict because ` +
          reasonMessage(subReason),
      )
      .join(' and ');
  }
  return reason;
}

/**
 * Overlapping fields can be merged.
 *
 * See https://spec.graphql.org/draft/#sec-Field-Selection-Merging
 * @category Validation Rules
 
 * @internal
 */
export const OverlappingFieldsCanBeMergedASTVisitor: ASTVisitorFn = (
  context,
) => {
  const indexCursor = context.indexCursor;
  const comparedFieldsAndFragmentPairs = new OrderedPairSet<
    NodeAndDefCollection,
    string
  >();
  const comparedFragmentPairs = new PairSet<string>();
  const cachedFieldsAndFragmentSpreads = new Map<
    SelectionSetNode,
    FieldsAndFragmentSpreads
  >();

  return {
    SelectionSet(selectionSet) {
      if (!selectionSetHasPotentialOverlap(selectionSet)) {
        return;
      }

      const conflicts = findConflictsWithinSelectionSet(
        context,
        indexCursor,
        cachedFieldsAndFragmentSpreads,
        comparedFieldsAndFragmentPairs,
        comparedFragmentPairs,
        indexCursor.getCurrentParentType(),
        selectionSet,
      );
      for (const [[responseName, reason], fields1, fields2] of conflicts) {
        const reasonMsg = reasonMessage(reason);
        context.reportError(
          new GraphQLError(
            `Fields "${responseName}" conflict because ${reasonMsg}. Use different aliases on the fields to fetch both if this was intentional.`,
            { nodes: fields1.concat(fields2) },
          ),
        );
      }
    },
  };
};

function selectionSetHasPotentialOverlap(
  selectionSet: SelectionSetNode,
): boolean {
  const seenResponseNames = new Set<string>();
  for (const selection of selectionSet.selections) {
    if (selection.kind !== Kind.FIELD) {
      return true;
    }

    const responseName = selection.alias?.value ?? selection.name.value;
    if (seenResponseNames.has(responseName)) {
      return true;
    }
    seenResponseNames.add(responseName);
  }
  return false;
}

type Conflict = [ConflictReason, Array<FieldNode>, Array<FieldNode>];
type ConflictReason = [string, ConflictReasonMessage];
type ConflictReasonMessage = string | Array<ConflictReason>;
type NodeAndDef = [
  Maybe<CompositeTypeReference>,
  FieldNode,
  Maybe<FieldReference>,
];
type NodeAndDefCollection = Map<string, Array<NodeAndDef>>;
interface FragmentSpread {
  key: string;
  node: FragmentSpreadNode;
  varMap: Map<string, ValueNode> | undefined;
}
type FragmentSpreads = ReadonlyArray<FragmentSpread>;
type FieldsAndFragmentSpreads = readonly [
  NodeAndDefCollection,
  FragmentSpreads,
];

function findConflictsWithinSelectionSet(
  context: ASTValidationContext,
  indexCursor: IndexCursor,
  cachedFieldsAndFragmentSpreads: Map<
    SelectionSetNode,
    FieldsAndFragmentSpreads
  >,
  comparedFieldsAndFragmentPairs: OrderedPairSet<NodeAndDefCollection, string>,
  comparedFragmentPairs: PairSet<string>,
  parentType: Maybe<CompositeTypeReference>,
  selectionSet: SelectionSetNode,
): Array<Conflict> {
  const conflicts: Array<Conflict> = [];

  const [fieldMap, fragmentSpreads] = getFieldsAndFragmentSpreads(
    context,
    indexCursor,
    cachedFieldsAndFragmentSpreads,
    parentType,
    selectionSet,
    undefined,
  );

  collectConflictsWithin(
    context,
    indexCursor,
    conflicts,
    cachedFieldsAndFragmentSpreads,
    comparedFieldsAndFragmentPairs,
    comparedFragmentPairs,
    fieldMap,
  );

  if (fragmentSpreads.length !== 0) {
    for (let i = 0; i < fragmentSpreads.length; i++) {
      collectConflictsBetweenFieldsAndFragment(
        context,
        indexCursor,
        conflicts,
        cachedFieldsAndFragmentSpreads,
        comparedFieldsAndFragmentPairs,
        comparedFragmentPairs,
        false,
        fieldMap,
        fragmentSpreads[i],
      );
      for (let j = i + 1; j < fragmentSpreads.length; j++) {
        collectConflictsBetweenFragments(
          context,
          indexCursor,
          conflicts,
          cachedFieldsAndFragmentSpreads,
          comparedFieldsAndFragmentPairs,
          comparedFragmentPairs,
          false,
          fragmentSpreads[i],
          fragmentSpreads[j],
        );
      }
    }
  }
  return conflicts;
}

function collectConflictsBetweenFieldsAndFragment(
  context: ASTValidationContext,
  indexCursor: IndexCursor,
  conflicts: Array<Conflict>,
  cachedFieldsAndFragmentSpreads: Map<
    SelectionSetNode,
    FieldsAndFragmentSpreads
  >,
  comparedFieldsAndFragmentPairs: OrderedPairSet<NodeAndDefCollection, string>,
  comparedFragmentPairs: PairSet<string>,
  areMutuallyExclusive: boolean,
  fieldMap: NodeAndDefCollection,
  fragmentSpread: FragmentSpread,
): void {
  if (
    comparedFieldsAndFragmentPairs.has(
      fieldMap,
      fragmentSpread.key,
      areMutuallyExclusive,
    )
  ) {
    return;
  }
  comparedFieldsAndFragmentPairs.add(
    fieldMap,
    fragmentSpread.key,
    areMutuallyExclusive,
  );

  const fragment = context.getFragment(fragmentSpread.node.name.value);
  if (fragment == null) {
    return;
  }

  const [fieldMap2, referencedFragmentSpreads] =
    getReferencedFieldsAndFragmentSpreads(
      context,
      indexCursor,
      cachedFieldsAndFragmentSpreads,
      fragment,
      fragmentSpread.varMap,
    );

  if (fieldMap === fieldMap2) {
    return;
  }

  collectConflictsBetween(
    context,
    indexCursor,
    conflicts,
    cachedFieldsAndFragmentSpreads,
    comparedFieldsAndFragmentPairs,
    comparedFragmentPairs,
    areMutuallyExclusive,
    fieldMap,
    undefined,
    fieldMap2,
    fragmentSpread.varMap,
  );

  for (const referencedFragmentSpread of referencedFragmentSpreads) {
    collectConflictsBetweenFieldsAndFragment(
      context,
      indexCursor,
      conflicts,
      cachedFieldsAndFragmentSpreads,
      comparedFieldsAndFragmentPairs,
      comparedFragmentPairs,
      areMutuallyExclusive,
      fieldMap,
      referencedFragmentSpread,
    );
  }
}

function collectConflictsBetweenFragments(
  context: ASTValidationContext,
  indexCursor: IndexCursor,
  conflicts: Array<Conflict>,
  cachedFieldsAndFragmentSpreads: Map<
    SelectionSetNode,
    FieldsAndFragmentSpreads
  >,
  comparedFieldsAndFragmentPairs: OrderedPairSet<NodeAndDefCollection, string>,
  comparedFragmentPairs: PairSet<string>,
  areMutuallyExclusive: boolean,
  fragmentSpread1: FragmentSpread,
  fragmentSpread2: FragmentSpread,
): void {
  if (fragmentSpread1.key === fragmentSpread2.key) {
    return;
  }

  if (fragmentSpread1.node.name.value === fragmentSpread2.node.name.value) {
    if (
      !sameArguments(
        fragmentSpread1.node.arguments,
        fragmentSpread1.varMap,
        fragmentSpread2.node.arguments,
        fragmentSpread2.varMap,
      )
    ) {
      context.reportError(
        new GraphQLError(
          `Spreads "${fragmentSpread1.node.name.value}" conflict because ${fragmentSpread1.key} and ${fragmentSpread2.key} have different fragment arguments.`,
          { nodes: [fragmentSpread1.node, fragmentSpread2.node] },
        ),
      );
      return;
    }
  }

  if (
    comparedFragmentPairs.has(
      fragmentSpread1.key,
      fragmentSpread2.key,
      areMutuallyExclusive,
    )
  ) {
    return;
  }
  comparedFragmentPairs.add(
    fragmentSpread1.key,
    fragmentSpread2.key,
    areMutuallyExclusive,
  );

  const fragment1 = context.getFragment(fragmentSpread1.node.name.value);
  const fragment2 = context.getFragment(fragmentSpread2.node.name.value);
  if (fragment1 == null || fragment2 == null) {
    return;
  }

  const [fieldMap1, referencedFragmentSpreads1] =
    getReferencedFieldsAndFragmentSpreads(
      context,
      indexCursor,
      cachedFieldsAndFragmentSpreads,
      fragment1,
      fragmentSpread1.varMap,
    );
  const [fieldMap2, referencedFragmentSpreads2] =
    getReferencedFieldsAndFragmentSpreads(
      context,
      indexCursor,
      cachedFieldsAndFragmentSpreads,
      fragment2,
      fragmentSpread2.varMap,
    );

  collectConflictsBetween(
    context,
    indexCursor,
    conflicts,
    cachedFieldsAndFragmentSpreads,
    comparedFieldsAndFragmentPairs,
    comparedFragmentPairs,
    areMutuallyExclusive,
    fieldMap1,
    fragmentSpread1.varMap,
    fieldMap2,
    fragmentSpread2.varMap,
  );

  for (const referencedFragmentSpread2 of referencedFragmentSpreads2) {
    collectConflictsBetweenFragments(
      context,
      indexCursor,
      conflicts,
      cachedFieldsAndFragmentSpreads,
      comparedFieldsAndFragmentPairs,
      comparedFragmentPairs,
      areMutuallyExclusive,
      fragmentSpread1,
      referencedFragmentSpread2,
    );
  }

  for (const referencedFragmentSpread1 of referencedFragmentSpreads1) {
    collectConflictsBetweenFragments(
      context,
      indexCursor,
      conflicts,
      cachedFieldsAndFragmentSpreads,
      comparedFieldsAndFragmentPairs,
      comparedFragmentPairs,
      areMutuallyExclusive,
      referencedFragmentSpread1,
      fragmentSpread2,
    );
  }
}

function findConflictsBetweenSubSelectionSets(
  context: ASTValidationContext,
  indexCursor: IndexCursor,
  cachedFieldsAndFragmentSpreads: Map<
    SelectionSetNode,
    FieldsAndFragmentSpreads
  >,
  comparedFieldsAndFragmentPairs: OrderedPairSet<NodeAndDefCollection, string>,
  comparedFragmentPairs: PairSet<string>,
  areMutuallyExclusive: boolean,
  parentType1: Maybe<CompositeTypeReference>,
  selectionSet1: SelectionSetNode,
  varMap1: Map<string, ValueNode> | undefined,
  parentType2: Maybe<CompositeTypeReference>,
  selectionSet2: SelectionSetNode,
  varMap2: Map<string, ValueNode> | undefined,
): Array<Conflict> {
  const conflicts: Array<Conflict> = [];

  const [fieldMap1, fragmentSpreads1] = getFieldsAndFragmentSpreads(
    context,
    indexCursor,
    cachedFieldsAndFragmentSpreads,
    parentType1,
    selectionSet1,
    varMap1,
  );
  const [fieldMap2, fragmentSpreads2] = getFieldsAndFragmentSpreads(
    context,
    indexCursor,
    cachedFieldsAndFragmentSpreads,
    parentType2,
    selectionSet2,
    varMap2,
  );

  collectConflictsBetween(
    context,
    indexCursor,
    conflicts,
    cachedFieldsAndFragmentSpreads,
    comparedFieldsAndFragmentPairs,
    comparedFragmentPairs,
    areMutuallyExclusive,
    fieldMap1,
    varMap1,
    fieldMap2,
    varMap2,
  );

  for (const fragmentSpread2 of fragmentSpreads2) {
    collectConflictsBetweenFieldsAndFragment(
      context,
      indexCursor,
      conflicts,
      cachedFieldsAndFragmentSpreads,
      comparedFieldsAndFragmentPairs,
      comparedFragmentPairs,
      areMutuallyExclusive,
      fieldMap1,
      fragmentSpread2,
    );
  }

  for (const fragmentSpread1 of fragmentSpreads1) {
    collectConflictsBetweenFieldsAndFragment(
      context,
      indexCursor,
      conflicts,
      cachedFieldsAndFragmentSpreads,
      comparedFieldsAndFragmentPairs,
      comparedFragmentPairs,
      areMutuallyExclusive,
      fieldMap2,
      fragmentSpread1,
    );
  }

  for (const fragmentSpread1 of fragmentSpreads1) {
    for (const fragmentSpread2 of fragmentSpreads2) {
      collectConflictsBetweenFragments(
        context,
        indexCursor,
        conflicts,
        cachedFieldsAndFragmentSpreads,
        comparedFieldsAndFragmentPairs,
        comparedFragmentPairs,
        areMutuallyExclusive,
        fragmentSpread1,
        fragmentSpread2,
      );
    }
  }
  return conflicts;
}

function collectConflictsWithin(
  context: ASTValidationContext,
  indexCursor: IndexCursor,
  conflicts: Array<Conflict>,
  cachedFieldsAndFragmentSpreads: Map<
    SelectionSetNode,
    FieldsAndFragmentSpreads
  >,
  comparedFieldsAndFragmentPairs: OrderedPairSet<NodeAndDefCollection, string>,
  comparedFragmentPairs: PairSet<string>,
  fieldMap: NodeAndDefCollection,
): void {
  for (const [responseName, fields] of fieldMap.entries()) {
    if (fields.length <= 1) {
      continue;
    }

    for (let i = 0; i < fields.length; i++) {
      for (let j = i + 1; j < fields.length; j++) {
        const conflict = findConflict(
          context,
          indexCursor,
          cachedFieldsAndFragmentSpreads,
          comparedFieldsAndFragmentPairs,
          comparedFragmentPairs,
          false,
          responseName,
          fields[i],
          undefined,
          fields[j],
          undefined,
        );
        if (conflict) {
          conflicts.push(conflict);
        }
      }
    }
  }
}

function collectConflictsBetween(
  context: ASTValidationContext,
  indexCursor: IndexCursor,
  conflicts: Array<Conflict>,
  cachedFieldsAndFragmentSpreads: Map<
    SelectionSetNode,
    FieldsAndFragmentSpreads
  >,
  comparedFieldsAndFragmentPairs: OrderedPairSet<NodeAndDefCollection, string>,
  comparedFragmentPairs: PairSet<string>,
  parentFieldsAreMutuallyExclusive: boolean,
  fieldMap1: NodeAndDefCollection,
  varMap1: Map<string, ValueNode> | undefined,
  fieldMap2: NodeAndDefCollection,
  varMap2: Map<string, ValueNode> | undefined,
): void {
  for (const [responseName, fields1] of fieldMap1.entries()) {
    const fields2 = fieldMap2.get(responseName);
    if (fields2 == null) {
      continue;
    }

    for (const field1 of fields1) {
      for (const field2 of fields2) {
        const conflict = findConflict(
          context,
          indexCursor,
          cachedFieldsAndFragmentSpreads,
          comparedFieldsAndFragmentPairs,
          comparedFragmentPairs,
          parentFieldsAreMutuallyExclusive,
          responseName,
          field1,
          varMap1,
          field2,
          varMap2,
        );
        if (conflict) {
          conflicts.push(conflict);
        }
      }
    }
  }
}

function findConflict(
  context: ASTValidationContext,
  indexCursor: IndexCursor,
  cachedFieldsAndFragmentSpreads: Map<
    SelectionSetNode,
    FieldsAndFragmentSpreads
  >,
  comparedFieldsAndFragmentPairs: OrderedPairSet<NodeAndDefCollection, string>,
  comparedFragmentPairs: PairSet<string>,
  parentFieldsAreMutuallyExclusive: boolean,
  responseName: string,
  field1: NodeAndDef,
  varMap1: Map<string, ValueNode> | undefined,
  field2: NodeAndDef,
  varMap2: Map<string, ValueNode> | undefined,
): Maybe<Conflict> {
  const index = context.index;
  const [parentType1, node1, def1] = field1;
  const [parentType2, node2, def2] = field2;
  const areMutuallyExclusive =
    parentFieldsAreMutuallyExclusive ||
    (parentType1 != null &&
      parentType2 != null &&
      index.getTypeName(parentType1) !== index.getTypeName(parentType2) &&
      index.isObjectType(parentType1) &&
      index.isObjectType(parentType2));

  if (!areMutuallyExclusive) {
    const name1 = node1.name.value;
    const name2 = node2.name.value;
    if (name1 !== name2) {
      return [
        [responseName, `"${name1}" and "${name2}" are different fields`],
        [node1],
        [node2],
      ];
    }

    if (!sameArguments(node1.arguments, varMap1, node2.arguments, varMap2)) {
      return [
        [responseName, 'they have differing arguments'],
        [node1],
        [node2],
      ];
    }
  }

  const overlappingStreamReason = hasNoOverlappingStreams(
    node1.directives,
    varMap1,
    node2.directives,
    varMap2,
  );
  if (overlappingStreamReason !== undefined) {
    return [[responseName, overlappingStreamReason], [node1], [node2]];
  }

  const type1 = def1 == null ? undefined : index.getFieldType(def1);
  const type2 = def2 == null ? undefined : index.getFieldType(def2);
  if (type1 != null && type2 != null && doTypesConflict(index, type1, type2)) {
    return [
      [
        responseName,
        `they return conflicting types "${index.typeToString(
          type1,
        )}" and "${index.typeToString(type2)}"`,
      ],
      [node1],
      [node2],
    ];
  }

  const selectionSet1 = node1.selectionSet;
  const selectionSet2 = node2.selectionSet;
  if (selectionSet1 != null && selectionSet2 != null) {
    const conflicts = findConflictsBetweenSubSelectionSets(
      context,
      indexCursor,
      cachedFieldsAndFragmentSpreads,
      comparedFieldsAndFragmentPairs,
      comparedFragmentPairs,
      areMutuallyExclusive,
      getCompositeNamedType(index, type1),
      selectionSet1,
      varMap1,
      getCompositeNamedType(index, type2),
      selectionSet2,
      varMap2,
    );
    return subfieldConflicts(conflicts, responseName, node1, node2);
  }
}

function sameArguments<T extends ArgumentNode | FragmentArgumentNode>(
  args1: ReadonlyArray<T> | undefined,
  varMap1: Map<string, ValueNode> | undefined,
  args2: ReadonlyArray<T> | undefined,
  varMap2: Map<string, ValueNode> | undefined,
): boolean {
  if (args1 === undefined || args1.length === 0) {
    return args2 === undefined || args2.length === 0;
  }
  if (args2 === undefined || args2.length === 0) {
    return false;
  }

  if (args1.length !== args2.length) {
    return false;
  }

  const values2 = new Map(
    args2.map(({ name, value }) => [
      name.value,
      varMap2 === undefined ? value : replaceFragmentVariables(value, varMap2),
    ]),
  );
  return args1.every((arg1) => {
    let value1 = arg1.value;
    if (varMap1) {
      value1 = replaceFragmentVariables(value1, varMap1);
    }
    const value2 = values2.get(arg1.name.value);
    if (value2 === undefined) {
      return false;
    }

    return stringifyValue(value1) === stringifyValue(value2);
  });
}

function replaceFragmentVariables(
  valueNode: ValueNode,
  varMap: ReadonlyMap<string, ValueNode>,
): ValueNode {
  switch (valueNode.kind) {
    case Kind.VARIABLE:
      return varMap.get(valueNode.name.value) ?? valueNode;
    case Kind.LIST:
      return {
        ...valueNode,
        values: valueNode.values.map((node) =>
          replaceFragmentVariables(node, varMap),
        ),
      };
    case Kind.OBJECT:
      return {
        ...valueNode,
        fields: valueNode.fields.map((field) => ({
          ...field,
          value: replaceFragmentVariables(field.value, varMap),
        })),
      };
    default:
      return valueNode;
  }
}

function stringifyValue(value: ValueNode): string | null {
  return print(sortValueNode(value));
}

function getStreamDirective(
  directives: ReadonlyArray<DirectiveNode> | undefined,
): DirectiveNode | undefined {
  return directives?.find((directive) => directive.name.value === 'stream');
}

function hasNoOverlappingStreams(
  directives1: ReadonlyArray<DirectiveNode> | undefined,
  varMap1: Map<string, ValueNode> | undefined,
  directives2: ReadonlyArray<DirectiveNode> | undefined,
  varMap2: Map<string, ValueNode> | undefined,
): string | undefined {
  const stream1 = getStreamDirective(directives1);
  const stream2 = getStreamDirective(directives2);
  if (stream1 == null && stream2 == null) {
    return;
  }
  if (stream1 != null && stream2 != null) {
    if (sameArguments(stream1.arguments, varMap1, stream2.arguments, varMap2)) {
      return 'they have overlapping stream directives. See https://github.com/graphql/defer-stream-wg/discussions/100';
    }
    return 'they have overlapping stream directives';
  }
  return 'they have overlapping stream directives';
}

function doTypesConflict(
  index: TypeSystemValidationIndex,
  type1: OutputTypeReference,
  type2: OutputTypeReference,
): boolean {
  if (index.isListType(type1)) {
    return index.isListType(type2)
      ? doTypesConflict(
          index,
          index.getListItemType(type1),
          index.getListItemType(type2),
        )
      : true;
  }
  if (index.isListType(type2)) {
    return true;
  }
  if (index.isNonNullType(type1)) {
    return index.isNonNullType(type2)
      ? doTypesConflict(
          index,
          index.getNullableType(type1),
          index.getNullableType(type2),
        )
      : true;
  }
  if (index.isNonNullType(type2)) {
    return true;
  }
  if (index.isLeafType(type1) || index.isLeafType(type2)) {
    return index.getTypeName(type1) !== index.getTypeName(type2);
  }
  return false;
}

function getFieldsAndFragmentSpreads(
  context: ASTValidationContext,
  indexCursor: IndexCursor,
  cachedFieldsAndFragmentSpreads: Map<
    SelectionSetNode,
    FieldsAndFragmentSpreads
  >,
  parentType: Maybe<CompositeTypeReference>,
  selectionSet: SelectionSetNode,
  varMap: Map<string, ValueNode> | undefined,
): FieldsAndFragmentSpreads {
  const cached = cachedFieldsAndFragmentSpreads.get(selectionSet);
  if (cached) {
    return cached;
  }
  const nodeAndDefs: NodeAndDefCollection = new Map();
  const fragmentSpreads = new Map<string, FragmentSpread>();
  collectFieldsAndFragmentSpreads(
    context,
    indexCursor,
    parentType,
    selectionSet,
    nodeAndDefs,
    fragmentSpreads,
    varMap,
  );
  const result: FieldsAndFragmentSpreads = [
    nodeAndDefs,
    Array.from(fragmentSpreads.values()),
  ];
  cachedFieldsAndFragmentSpreads.set(selectionSet, result);
  return result;
}

function getReferencedFieldsAndFragmentSpreads(
  context: ASTValidationContext,
  indexCursor: IndexCursor,
  cachedFieldsAndFragmentSpreads: Map<
    SelectionSetNode,
    FieldsAndFragmentSpreads
  >,
  fragment: FragmentDefinitionNode,
  varMap: Map<string, ValueNode> | undefined,
): FieldsAndFragmentSpreads {
  const cached = cachedFieldsAndFragmentSpreads.get(fragment.selectionSet);
  if (cached) {
    return cached;
  }

  return getFieldsAndFragmentSpreads(
    context,
    indexCursor,
    cachedFieldsAndFragmentSpreads,
    getCompositeNamedType(
      context.index,
      context.index.getOutputTypeReference(fragment.typeCondition),
    ),
    fragment.selectionSet,
    varMap,
  );
}

function collectFieldsAndFragmentSpreads(
  context: ASTValidationContext,
  indexCursor: IndexCursor,
  parentType: Maybe<CompositeTypeReference>,
  selectionSet: SelectionSetNode,
  nodeAndDefs: NodeAndDefCollection,
  fragmentSpreads: Map<string, FragmentSpread>,
  varMap: Map<string, ValueNode> | undefined,
): void {
  for (const selection of selectionSet.selections) {
    switch (selection.kind) {
      case Kind.FIELD: {
        const fieldName = selection.name.value;
        const fieldDef =
          parentType == null
            ? undefined
            : context.index.getFieldDef(parentType, fieldName);
        const responseName = selection.alias?.value ?? fieldName;

        let nodeAndDefsList = nodeAndDefs.get(responseName);
        if (nodeAndDefsList == null) {
          nodeAndDefsList = [];
          nodeAndDefs.set(responseName, nodeAndDefsList);
        }
        nodeAndDefsList.push([parentType, selection, fieldDef]);
        break;
      }
      case Kind.FRAGMENT_SPREAD: {
        const fragmentSpread = getFragmentSpread(context, selection, varMap);
        fragmentSpreads.set(fragmentSpread.key, fragmentSpread);
        break;
      }
      case Kind.INLINE_FRAGMENT: {
        const typeCondition = selection.typeCondition;
        const inlineFragmentType =
          typeCondition == null
            ? parentType
            : getCompositeNamedType(
                context.index,
                context.index.getOutputTypeReference(typeCondition),
              );
        collectFieldsAndFragmentSpreads(
          context,
          indexCursor,
          inlineFragmentType,
          selection.selectionSet,
          nodeAndDefs,
          fragmentSpreads,
          varMap,
        );
        break;
      }
    }
  }
}

function getFragmentSpread(
  context: ASTValidationContext,
  fragmentSpreadNode: FragmentSpreadNode,
  varMap: Map<string, ValueNode> | undefined,
): FragmentSpread {
  let key = '';
  const newVarMap = new Map<string, ValueNode>();
  const fragmentSignature = context.documentIndex.getFragmentSignatureByName()(
    fragmentSpreadNode.name.value,
  );
  const argMap = new Map<string, ValueNode>();
  if (fragmentSpreadNode.arguments) {
    for (const arg of fragmentSpreadNode.arguments) {
      argMap.set(arg.name.value, arg.value);
    }
  }
  if (fragmentSignature?.variableDefinitions) {
    key += fragmentSpreadNode.name.value + '(';
    for (const [varName, variable] of fragmentSignature.variableDefinitions) {
      const value = argMap.get(varName);
      if (value) {
        key += varName + ': ' + print(sortValueNode(value));
      }
      const arg = argMap.get(varName);
      if (arg !== undefined) {
        newVarMap.set(
          varName,
          varMap !== undefined ? replaceFragmentVariables(arg, varMap) : arg,
        );
      } else if (variable.defaultValue) {
        newVarMap.set(varName, variable.defaultValue);
      }
    }
    key += ')';
  }
  return {
    key,
    node: fragmentSpreadNode,
    varMap: newVarMap.size > 0 ? newVarMap : undefined,
  };
}

function getCompositeNamedType(
  index: TypeSystemValidationIndex,
  type: Maybe<OutputTypeReference>,
): Maybe<CompositeTypeReference> {
  const namedType = index.getNamedOutputType(type ?? undefined);
  return namedType != null && index.isCompositeType(namedType)
    ? namedType
    : undefined;
}

function subfieldConflicts(
  conflicts: ReadonlyArray<Conflict>,
  responseName: string,
  node1: FieldNode,
  node2: FieldNode,
): Maybe<Conflict> {
  if (conflicts.length > 0) {
    return [
      [responseName, conflicts.map(([reason]) => reason)],
      [node1, ...conflicts.map(([, fields1]) => fields1).flat()],
      [node2, ...conflicts.map(([, , fields2]) => fields2).flat()],
    ];
  }
}

class OrderedPairSet<T, U> {
  private _data: Map<T, Map<U, boolean>>;

  constructor() {
    this._data = new Map();
  }

  has(a: T, b: U, weaklyPresent: boolean): boolean {
    const result = this._data.get(a)?.get(b);
    if (result === undefined) {
      return false;
    }

    return weaklyPresent ? true : weaklyPresent === result;
  }

  add(a: T, b: U, weaklyPresent: boolean): void {
    const map = this._data.get(a);
    if (map === undefined) {
      this._data.set(a, new Map([[b, weaklyPresent]]));
    } else {
      map.set(b, weaklyPresent);
    }
  }
}

class PairSet<T> {
  private _orderedPairSet: OrderedPairSet<T, T>;

  constructor() {
    this._orderedPairSet = new OrderedPairSet();
  }

  has(a: T, b: T, weaklyPresent: boolean): boolean {
    return a < b
      ? this._orderedPairSet.has(a, b, weaklyPresent)
      : this._orderedPairSet.has(b, a, weaklyPresent);
  }

  add(a: T, b: T, weaklyPresent: boolean): void {
    if (a < b) {
      this._orderedPairSet.add(a, b, weaklyPresent);
    } else {
      this._orderedPairSet.add(b, a, weaklyPresent);
    }
  }
}
