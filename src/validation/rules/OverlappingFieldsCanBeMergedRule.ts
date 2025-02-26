import { inspect } from '../../jsutils/inspect.js';
import type { Maybe } from '../../jsutils/Maybe.js';

import { GraphQLError } from '../../error/GraphQLError.js';

import type {
  ArgumentNode,
  DirectiveNode,
  FieldNode,
  FragmentArgumentNode,
  FragmentDefinitionNode,
  FragmentSpreadNode,
  SelectionSetNode,
  ValueNode,
} from '../../language/ast.js';
import { Kind } from '../../language/kinds.js';
import { print } from '../../language/printer.js';
import type { ASTVisitor } from '../../language/visitor.js';

import type {
  GraphQLField,
  GraphQLNamedType,
  GraphQLOutputType,
} from '../../type/definition.js';
import {
  getNamedType,
  isInterfaceType,
  isLeafType,
  isListType,
  isNonNullType,
  isObjectType,
} from '../../type/definition.js';

import { sortValueNode } from '../../utilities/sortValueNode.js';
import { typeFromAST } from '../../utilities/typeFromAST.js';

import type { ValidationContext } from '../ValidationContext.js';

/* eslint-disable @typescript-eslint/max-params */
// This file contains a lot of such errors but we plan to refactor it anyway
// so just disable it for entire file.

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
 * Overlapping fields can be merged
 *
 * A selection set is only valid if all fields (including spreading any
 * fragments) either correspond to distinct response names or can be merged
 * without ambiguity.
 *
 * See https://spec.graphql.org/draft/#sec-Field-Selection-Merging
 */
export function OverlappingFieldsCanBeMergedRule(
  context: ValidationContext,
): ASTVisitor {
  // A memoization for when fields and a fragment or two fragments are compared
  // "between" each other for conflicts. Comparisons made be made many times,
  // so memoizing this can dramatically improve the performance of this validator.
  const comparedFieldsAndFragmentPairs = new OrderedPairSet<
    NodeAndDefCollection,
    string
  >();
  const comparedFragmentPairs = new PairSet<string>();

  // A cache for the "field map" and list of fragment spreads found in any given
  // selection set. Selection sets may be asked for this information multiple
  // times, so this improves the performance of this validator.
  const cachedFieldsAndFragmentSpreads = new Map();

  return {
    SelectionSet(selectionSet) {
      const conflicts = findConflictsWithinSelectionSet(
        context,
        cachedFieldsAndFragmentSpreads,
        comparedFieldsAndFragmentPairs,
        comparedFragmentPairs,
        context.getParentType(),
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
}

type Conflict = [ConflictReason, Array<FieldNode>, Array<FieldNode>];
// Field name and reason.
type ConflictReason = [string, ConflictReasonMessage];
// Reason is a string, or a nested list of conflicts.
type ConflictReasonMessage = string | Array<ConflictReason>;
// Tuple defining a field node in a context.
type NodeAndDef = [
  Maybe<GraphQLNamedType>,
  FieldNode,
  Maybe<GraphQLField<unknown, unknown>>,
];
// Map of array of those.
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

/**
 * Algorithm:
 *
 * Conflicts occur when two fields exist in a query which will produce the same
 * response name, but represent differing values, thus creating a conflict.
 * The algorithm below finds all conflicts via making a series of comparisons
 * between fields. In order to compare as few fields as possible, this makes
 * a series of comparisons "within" sets of fields and "between" sets of fields.
 *
 * Given any selection set, a collection produces both a set of fields by
 * also including all inline fragments, as well as a list of fragments
 * referenced by fragment spreads.
 *
 * A) Each selection set represented in the document first compares "within" its
 * collected set of fields, finding any conflicts between every pair of
 * overlapping fields.
 * Note: This is the *only time* that a the fields "within" a set are compared
 * to each other. After this only fields "between" sets are compared.
 *
 * B) Also, if any fragment is referenced in a selection set, then a
 * comparison is made "between" the original set of fields and the
 * referenced fragment.
 *
 * C) Also, if multiple fragments are referenced, then comparisons
 * are made "between" each referenced fragment.
 *
 * D) When comparing "between" a set of fields and a referenced fragment, first
 * a comparison is made between each field in the original set of fields and
 * each field in the the referenced set of fields.
 *
 * E) Also, if any fragment is referenced in the referenced selection set,
 * then a comparison is made "between" the original set of fields and the
 * referenced fragment (recursively referring to step D).
 *
 * F) When comparing "between" two fragments, first a comparison is made between
 * each field in the first referenced set of fields and each field in the the
 * second referenced set of fields.
 *
 * G) Also, any fragments referenced by the first must be compared to the
 * second, and any fragments referenced by the second must be compared to the
 * first (recursively referring to step F).
 *
 * H) When comparing two fields, if both have selection sets, then a comparison
 * is made "between" both selection sets, first comparing the set of fields in
 * the first selection set with the set of fields in the second.
 *
 * I) Also, if any fragment is referenced in either selection set, then a
 * comparison is made "between" the other set of fields and the
 * referenced fragment.
 *
 * J) Also, if two fragments are referenced in both selection sets, then a
 * comparison is made "between" the two fragments.
 *
 */

// Find all conflicts found "within" a selection set, including those found
// via spreading in fragments. Called when visiting each SelectionSet in the
// GraphQL Document.
function findConflictsWithinSelectionSet(
  context: ValidationContext,
  cachedFieldsAndFragmentSpreads: Map<
    SelectionSetNode,
    FieldsAndFragmentSpreads
  >,
  comparedFieldsAndFragmentPairs: OrderedPairSet<NodeAndDefCollection, string>,
  comparedFragmentPairs: PairSet<string>,
  parentType: Maybe<GraphQLNamedType>,
  selectionSet: SelectionSetNode,
): Array<Conflict> {
  const conflicts: Array<Conflict> = [];

  const [fieldMap, fragmentSpreads] = getFieldsAndFragmentSpreads(
    context,
    cachedFieldsAndFragmentSpreads,
    parentType,
    selectionSet,
    undefined,
  );

  // (A) Find find all conflicts "within" the fields and f of this selection set.
  // Note: this is the *only place* `collectConflictsWithin` is called.
  collectConflictsWithin(
    context,
    conflicts,
    cachedFieldsAndFragmentSpreads,
    comparedFieldsAndFragmentPairs,
    comparedFragmentPairs,
    fieldMap,
  );

  if (fragmentSpreads.length !== 0) {
    // (B) Then collect conflicts between these fields and those represented by
    // each spread found.
    for (let i = 0; i < fragmentSpreads.length; i++) {
      collectConflictsBetweenFieldsAndFragment(
        context,
        conflicts,
        cachedFieldsAndFragmentSpreads,
        comparedFieldsAndFragmentPairs,
        comparedFragmentPairs,
        false,
        fieldMap,
        fragmentSpreads[i],
      );
      // (C) Then compare this fragment with all other fragments found in this
      // selection set to collect conflicts between fragments spread together.
      // This compares each item in the list of fragment spreads to every other
      // item in that same list (except for itself).
      for (let j = i + 1; j < fragmentSpreads.length; j++) {
        collectConflictsBetweenFragments(
          context,
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

// Collect all conflicts found between a set of fields and a fragment reference
// including via spreading in any nested fragments.
function collectConflictsBetweenFieldsAndFragment(
  context: ValidationContext,
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
  // Memoize so the fields and fragments are not compared for conflicts more
  // than once.
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
  if (!fragment) {
    return;
  }

  const [fieldMap2, referencedFragmentSpreads] =
    getReferencedFieldsAndFragmentSpreads(
      context,
      cachedFieldsAndFragmentSpreads,
      fragment,
      fragmentSpread.varMap,
    );

  // Do not compare a fragment's fieldMap to itself.
  if (fieldMap === fieldMap2) {
    return;
  }

  // (D) First collect any conflicts between the provided collection of fields
  // and the collection of fields represented by the given fragment.
  collectConflictsBetween(
    context,
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

  // (E) Then collect any conflicts between the provided collection of fields
  // and any fragment names found in the given fragment.
  for (const referencedFragmentSpread of referencedFragmentSpreads) {
    collectConflictsBetweenFieldsAndFragment(
      context,
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

// Collect all conflicts found between two fragments, including via spreading in
// any nested fragments.
function collectConflictsBetweenFragments(
  context: ValidationContext,
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
  // No need to compare a fragment to itself.
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

  // Memoize so two fragments are not compared for conflicts more than once.
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
  if (!fragment1 || !fragment2) {
    return;
  }

  const [fieldMap1, referencedFragmentSpreads1] =
    getReferencedFieldsAndFragmentSpreads(
      context,
      cachedFieldsAndFragmentSpreads,
      fragment1,
      fragmentSpread1.varMap,
    );
  const [fieldMap2, referencedFragmentSpreads2] =
    getReferencedFieldsAndFragmentSpreads(
      context,
      cachedFieldsAndFragmentSpreads,
      fragment2,
      fragmentSpread2.varMap,
    );

  // (F) First, collect all conflicts between these two collections of fields
  // (not including any nested fragments).
  collectConflictsBetween(
    context,
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

  // (G) Then collect conflicts between the first fragment and any nested
  // fragments spread in the second fragment.
  for (const referencedFragmentSpread2 of referencedFragmentSpreads2) {
    collectConflictsBetweenFragments(
      context,
      conflicts,
      cachedFieldsAndFragmentSpreads,
      comparedFieldsAndFragmentPairs,
      comparedFragmentPairs,
      areMutuallyExclusive,
      fragmentSpread1,
      referencedFragmentSpread2,
    );
  }

  // (G) Then collect conflicts between the second fragment and any nested
  // fragments spread in the first fragment.
  for (const referencedFragmentSpread1 of referencedFragmentSpreads1) {
    collectConflictsBetweenFragments(
      context,
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

// Find all conflicts found between two selection sets, including those found
// via spreading in fragments. Called when determining if conflicts exist
// between the sub-fields of two overlapping fields.
function findConflictsBetweenSubSelectionSets(
  context: ValidationContext,
  cachedFieldsAndFragmentSpreads: Map<
    SelectionSetNode,
    FieldsAndFragmentSpreads
  >,
  comparedFieldsAndFragmentPairs: OrderedPairSet<NodeAndDefCollection, string>,
  comparedFragmentPairs: PairSet<string>,
  areMutuallyExclusive: boolean,
  parentType1: Maybe<GraphQLNamedType>,
  selectionSet1: SelectionSetNode,
  varMap1: Map<string, ValueNode> | undefined,
  parentType2: Maybe<GraphQLNamedType>,
  selectionSet2: SelectionSetNode,
  varMap2: Map<string, ValueNode> | undefined,
): Array<Conflict> {
  const conflicts: Array<Conflict> = [];

  const [fieldMap1, fragmentSpreads1] = getFieldsAndFragmentSpreads(
    context,
    cachedFieldsAndFragmentSpreads,
    parentType1,
    selectionSet1,
    varMap1,
  );
  const [fieldMap2, fragmentSpreads2] = getFieldsAndFragmentSpreads(
    context,
    cachedFieldsAndFragmentSpreads,
    parentType2,
    selectionSet2,
    varMap2,
  );

  // (H) First, collect all conflicts between these two collections of field.
  collectConflictsBetween(
    context,
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

  // (I) Then collect conflicts between the first collection of fields and
  // those referenced by each fragment name associated with the second.
  for (const fragmentSpread2 of fragmentSpreads2) {
    collectConflictsBetweenFieldsAndFragment(
      context,
      conflicts,
      cachedFieldsAndFragmentSpreads,
      comparedFieldsAndFragmentPairs,
      comparedFragmentPairs,
      areMutuallyExclusive,
      fieldMap1,
      fragmentSpread2,
    );
  }

  // (I) Then collect conflicts between the second collection of fields and
  // those referenced by each fragment name associated with the first.
  for (const fragmentSpread1 of fragmentSpreads1) {
    collectConflictsBetweenFieldsAndFragment(
      context,
      conflicts,
      cachedFieldsAndFragmentSpreads,
      comparedFieldsAndFragmentPairs,
      comparedFragmentPairs,
      areMutuallyExclusive,
      fieldMap2,
      fragmentSpread1,
    );
  }

  // (J) Also collect conflicts between any fragment spreads by the first and
  // fragment spreads by the second. This compares each item in the first set of
  // spreads to each item in the second set of spreads.
  for (const fragmentSpread1 of fragmentSpreads1) {
    for (const fragmentSpread2 of fragmentSpreads2) {
      collectConflictsBetweenFragments(
        context,
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

// Collect all Conflicts "within" one collection of fields.
function collectConflictsWithin(
  context: ValidationContext,
  conflicts: Array<Conflict>,
  cachedFieldsAndFragmentSpreads: Map<
    SelectionSetNode,
    FieldsAndFragmentSpreads
  >,
  comparedFieldsAndFragmentPairs: OrderedPairSet<NodeAndDefCollection, string>,
  comparedFragmentPairs: PairSet<string>,
  fieldMap: NodeAndDefCollection,
): void {
  // A field map is a keyed collection, where each key represents a response
  // name and the value at that key is a list of all fields which provide that
  // response name. For every response name, if there are multiple fields, they
  // must be compared to find a potential conflict.
  for (const [responseName, fields] of fieldMap.entries()) {
    // This compares every field in the list to every other field in this list
    // (except to itself). If the list only has one item, nothing needs to
    // be compared.
    if (fields.length > 1) {
      for (let i = 0; i < fields.length; i++) {
        for (let j = i + 1; j < fields.length; j++) {
          const conflict = findConflict(
            context,
            cachedFieldsAndFragmentSpreads,
            comparedFieldsAndFragmentPairs,
            comparedFragmentPairs,
            false, // within one collection is never mutually exclusive
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
}

// Collect all Conflicts between two collections of fields. This is similar to,
// but different from the `collectConflictsWithin` function above. This check
// assumes that `collectConflictsWithin` has already been called on each
// provided collection of fields. This is true because this validator traverses
// each individual selection set.
function collectConflictsBetween(
  context: ValidationContext,
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
  // A field map is a keyed collection, where each key represents a response
  // name and the value at that key is a list of all fields which provide that
  // response name. For any response name which appears in both provided field
  // maps, each field from the first field map must be compared to every field
  // in the second field map to find potential conflicts.
  for (const [responseName, fields1] of fieldMap1.entries()) {
    const fields2 = fieldMap2.get(responseName);
    if (fields2 != null) {
      for (const field1 of fields1) {
        for (const field2 of fields2) {
          const conflict = findConflict(
            context,
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
}

// Determines if there is a conflict between two particular fields, including
// comparing their sub-fields.
function findConflict(
  context: ValidationContext,
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
  const [parentType1, node1, def1] = field1;
  const [parentType2, node2, def2] = field2;

  // If it is known that two fields could not possibly apply at the same
  // time, due to the parent types, then it is safe to permit them to diverge
  // in aliased field or arguments used as they will not present any ambiguity
  // by differing.
  // It is known that two parent types could never overlap if they are
  // different Object types. Interface or Union types might overlap - if not
  // in the current state of the schema, then perhaps in some future version,
  // thus may not safely diverge.
  const areMutuallyExclusive =
    parentFieldsAreMutuallyExclusive ||
    (parentType1 !== parentType2 &&
      isObjectType(parentType1) &&
      isObjectType(parentType2));

  if (!areMutuallyExclusive) {
    // Two aliases must refer to the same field.
    const name1 = node1.name.value;
    const name2 = node2.name.value;
    if (name1 !== name2) {
      return [
        [responseName, `"${name1}" and "${name2}" are different fields`],
        [node1],
        [node2],
      ];
    }

    // Two field calls must have the same arguments.
    if (!sameArguments(node1.arguments, varMap1, node2.arguments, varMap2)) {
      return [
        [responseName, 'they have differing arguments'],
        [node1],
        [node2],
      ];
    }
  }

  const directives1 = node1.directives ?? [];
  const directives2 = node2.directives ?? [];
  const overlappingStreamReason = hasNoOverlappingStreams(
    directives1,
    varMap1,
    directives2,
    varMap2,
  );
  if (overlappingStreamReason !== undefined) {
    return [[responseName, overlappingStreamReason], [node1], [node2]];
  }

  // The return type for each field.
  const type1 = def1?.type;
  const type2 = def2?.type;

  if (type1 && type2 && doTypesConflict(type1, type2)) {
    return [
      [
        responseName,
        `they return conflicting types "${inspect(type1)}" and "${inspect(
          type2,
        )}"`,
      ],
      [node1],
      [node2],
    ];
  }

  // Collect and compare sub-fields. Use the same "visited fragment spreads" list
  // for both collections so fields in a fragment reference are never
  // compared to themselves.
  const selectionSet1 = node1.selectionSet;
  const selectionSet2 = node2.selectionSet;
  if (selectionSet1 && selectionSet2) {
    const conflicts = findConflictsBetweenSubSelectionSets(
      context,
      cachedFieldsAndFragmentSpreads,
      comparedFieldsAndFragmentPairs,
      comparedFragmentPairs,
      areMutuallyExclusive,
      getNamedType(type1),
      selectionSet1,
      varMap1,
      getNamedType(type2),
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
    default: {
      return valueNode;
    }
  }
}

function stringifyValue(value: ValueNode): string | null {
  return print(sortValueNode(value));
}

function getStreamDirective(
  directives: ReadonlyArray<DirectiveNode>,
): DirectiveNode | undefined {
  return directives.find((directive) => directive.name.value === 'stream');
}

function hasNoOverlappingStreams(
  directives1: ReadonlyArray<DirectiveNode>,
  varMap1: Map<string, ValueNode> | undefined,
  directives2: ReadonlyArray<DirectiveNode>,
  varMap2: Map<string, ValueNode> | undefined,
): string | undefined {
  const stream1 = getStreamDirective(directives1);
  const stream2 = getStreamDirective(directives2);
  if (!stream1 && !stream2) {
    // both fields do not have streams
    return;
  } else if (stream1 && stream2) {
    // check if both fields have equivalent streams
    if (sameArguments(stream1.arguments, varMap1, stream2.arguments, varMap2)) {
      // This was allowed in previous alpha versions of `graphql-js`.
      return 'they have overlapping stream directives. See https://github.com/graphql/defer-stream-wg/discussions/100';
    }
    return 'they have overlapping stream directives';
  }
  // fields have a mix of stream and no stream
  return 'they have overlapping stream directives';
}

// Two types conflict if both types could not apply to a value simultaneously.
// Composite types are ignored as their individual field types will be compared
// later recursively. However List and Non-Null types must match.
function doTypesConflict(
  type1: GraphQLOutputType,
  type2: GraphQLOutputType,
): boolean {
  if (isListType(type1)) {
    return isListType(type2)
      ? doTypesConflict(type1.ofType, type2.ofType)
      : true;
  }
  if (isListType(type2)) {
    return true;
  }
  if (isNonNullType(type1)) {
    return isNonNullType(type2)
      ? doTypesConflict(type1.ofType, type2.ofType)
      : true;
  }
  if (isNonNullType(type2)) {
    return true;
  }
  if (isLeafType(type1) || isLeafType(type2)) {
    return type1 !== type2;
  }
  return false;
}

// Given a selection set, return the collection of fields (a mapping of response
// name to field nodes and definitions) as well as a list of fragment spreads
// referenced via fragment spreads.
function getFieldsAndFragmentSpreads(
  context: ValidationContext,
  cachedFieldsAndFragmentSpreads: Map<
    SelectionSetNode,
    FieldsAndFragmentSpreads
  >,
  parentType: Maybe<GraphQLNamedType>,
  selectionSet: SelectionSetNode,
  varMap: Map<string, ValueNode> | undefined,
): FieldsAndFragmentSpreads {
  const cached = cachedFieldsAndFragmentSpreads.get(selectionSet);
  if (cached) {
    return cached;
  }
  const nodeAndDefs: NodeAndDefCollection = new Map();
  const fragmentSpreads = new Map<string, FragmentSpread>();
  _collectFieldsAndFragmentSpreads(
    context,
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

// Given a reference to a fragment, return the represented collection of fields
// as well as a list of nested fragment spreads referenced via fragment spreads.
function getReferencedFieldsAndFragmentSpreads(
  context: ValidationContext,
  cachedFieldsAndFragmentSpreads: Map<
    SelectionSetNode,
    FieldsAndFragmentSpreads
  >,
  fragment: FragmentDefinitionNode,
  varMap: Map<string, ValueNode> | undefined,
) {
  // Short-circuit building a type from the node if possible.
  const cached = cachedFieldsAndFragmentSpreads.get(fragment.selectionSet);
  if (cached) {
    return cached;
  }

  const fragmentType = typeFromAST(context.getSchema(), fragment.typeCondition);
  return getFieldsAndFragmentSpreads(
    context,
    cachedFieldsAndFragmentSpreads,
    fragmentType,
    fragment.selectionSet,
    varMap,
  );
}

function _collectFieldsAndFragmentSpreads(
  context: ValidationContext,
  parentType: Maybe<GraphQLNamedType>,
  selectionSet: SelectionSetNode,
  nodeAndDefs: NodeAndDefCollection,
  fragmentSpreads: Map<string, FragmentSpread>,
  varMap: Map<string, ValueNode> | undefined,
): void {
  for (const selection of selectionSet.selections) {
    switch (selection.kind) {
      case Kind.FIELD: {
        const fieldName = selection.name.value;
        let fieldDef;
        if (isObjectType(parentType) || isInterfaceType(parentType)) {
          fieldDef = parentType.getFields()[fieldName];
        }
        const responseName = selection.alias
          ? selection.alias.value
          : fieldName;

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
        const inlineFragmentType = typeCondition
          ? typeFromAST(context.getSchema(), typeCondition)
          : parentType;
        _collectFieldsAndFragmentSpreads(
          context,
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
  context: ValidationContext,
  fragmentSpreadNode: FragmentSpreadNode,
  varMap: Map<string, ValueNode> | undefined,
): FragmentSpread {
  let key = '';
  const newVarMap = new Map<string, ValueNode>();
  const fragmentSignature = context.getFragmentSignatureByName()(
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

// Given a series of Conflicts which occurred between two sub-fields, generate
// a single Conflict.
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

/**
 * A way to keep track of pairs of things where the ordering of the pair
 * matters.
 *
 * Provides a third argument for has/set to allow flagging the pair as
 * weakly or strongly present within the collection.
 */
class OrderedPairSet<T, U> {
  _data: Map<T, Map<U, boolean>>;

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

/**
 * A way to keep track of pairs of similar things when the ordering of the pair
 * does not matter.
 */
class PairSet<T> {
  _orderedPairSet: OrderedPairSet<T, T>;

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
