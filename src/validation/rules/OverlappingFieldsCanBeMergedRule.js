import inspect from '../../jsutils/inspect';
import type { ObjMap } from '../../jsutils/ObjMap';

import { GraphQLError } from '../../error/GraphQLError';

import type {
  ArgumentNode,
  FieldNode,
  FragmentDefinitionNode,
  SelectionSetNode,
  ValueNode,
} from '../../language/ast';
import { isNode } from '../../language/ast';
import { Kind } from '../../language/kinds';
import type { ASTVisitor } from '../../language/visitor';

import type {
  GraphQLField,
  GraphQLNamedType,
  GraphQLOutputType,
} from '../../type/definition';
import {
  getNamedType,
  isInterfaceType,
  isLeafType,
  isListType,
  isNonNullType,
  isObjectType,
} from '../../type/definition';

import { typeFromAST } from '../../utilities/typeFromAST';

import { validationAbortedError } from '../validationAbortedError';
import type { ValidationContext } from '../ValidationContext';

// Keep diagnostic detail bounded independently of document size.
const MAX_CONFLICT_DETAIL_LENGTH = 1000;
const MAX_CONFLICT_NODES = 20;
// v15 has no default validation error limit. Bound this rule's reporting locally.
const MAX_REPORTED_CONFLICTS = 100;

// Meter work that can grow through repeated comparisons.
// Collecting a selection set's fields is cached and is not charged.
const MAX_COMPLEXITY_BUDGET = 500_000;

/**
 * Overlapping fields can be merged
 *
 * A selection set is only valid if all fields (including spreading any
 * fragments) either correspond to distinct response names or can be merged
 * without ambiguity.
 */
export function OverlappingFieldsCanBeMergedRule(
  validationContext: ValidationContext,
): ASTVisitor {
  const ruleContext: RuleContext = {
    // A memoization for when two fragments are compared for conflicts.
    // Comparisons may be made many times, so memoizing this can dramatically
    // improve the performance of this validator.
    comparedFragmentPairs: new PairSet(),

    // A cache for the "field map" and list of fragment names found in any given
    // selection set.
    cachedCollectFieldsResults: new Map(),
    stringifiedValues: new Map(),
    remainingComplexityBudget: MAX_COMPLEXITY_BUDGET,
  };

  let reportedConflicts = 0;

  return {
    SelectionSet(selectionSet, _key, parent) {
      // Inline fragments are flattened into their enclosing response level.
      // Their fields' own selection sets are still visited independently.
      if (parent && 'kind' in parent && parent.kind === Kind.INLINE_FRAGMENT) {
        return;
      }
      const conflicts = findConflictsWithinSelectionSet(
        validationContext,
        ruleContext,
        validationContext.getParentType(),
        selectionSet,
      );
      for (const { responseName, reason, fields1, fields2 } of conflicts) {
        if (reportedConflicts >= MAX_REPORTED_CONFLICTS) {
          throw validationAbortedError;
        }
        reportedConflicts++;
        validationContext.reportError(
          new GraphQLError(
            `Fields "${maybeAbbreviate(
              responseName,
            )}" conflict because ${reason}. Use different aliases on the fields to fetch both if this was intentional.`,
            fields1.concat(fields2),
          ),
        );
      }
    },
  };
}

interface Conflict {
  responseName: string;
  reason: string;
  fields1: Array<FieldNode>;
  fields2: Array<FieldNode>;
}
// A field node and its definition in the parent-type context.
interface FieldDetails {
  parentType: ?GraphQLNamedType;
  node: FieldNode;
  definition: ?GraphQLField<mixed, mixed>;
  info?: FieldInfo;
}
interface FieldInfo {
  // A null reason means the field names and arguments match.
  comparisons: Map<FieldInfo, string | null>;
  arguments: ArgumentInfo | void;
}
interface ArgumentInfo {
  nodes: $ReadOnlyArray<ArgumentNode>;
  values: Map<string, ValueNode>;
}
// Map of array of those.
type FieldDetailsList = Array<FieldDetails>;
type GroupedFieldSet = ObjMap<FieldDetailsList>;
type FragmentNames = Array<string>;
interface CollectFieldsResult {
  groupedFieldSet: GroupedFieldSet;
  responseNames: Array<string>;
  fragmentNames: FragmentNames;
  comparedFragments?: Map<string, boolean>;
  overlappingFields?: Map<CollectFieldsResult, Array<OverlappingFields>>;
}
interface OverlappingFields {
  responseName: string;
  fields1: FieldDetailsList;
  fields2: FieldDetailsList;
}
interface RuleContext {
  remainingComplexityBudget: number;
  stringifiedValues: Map<ValueNode, string>;
  comparedFragmentPairs: PairSet;
  cachedCollectFieldsResults: Map<
    ?GraphQLNamedType,
    Map<SelectionSetNode, CollectFieldsResult>,
  >;
}

/**
 * Find all conflicts found "within" a selection set, including those found
 * via spreading in fragments. Called when visiting each SelectionSet in the
 * GraphQL Document.
 *
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
 * Note: This is the *only time* that the fields "within" a set are compared
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
 * each field in the referenced set of fields.
 *
 * E) Also, if any fragment is referenced in the referenced selection set,
 * then a comparison is made "between" the original set of fields and the
 * referenced fragment (recursively referring to step D).
 *
 * F) When comparing "between" two fragments, first a comparison is made between
 * each field in the first referenced set of fields and each field in the
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
 */
function findConflictsWithinSelectionSet(
  validationContext: ValidationContext,
  ruleContext: RuleContext,
  parentType: ?GraphQLNamedType,
  selectionSet: SelectionSetNode,
): Array<Conflict> {
  const conflicts: Array<Conflict> = [];

  const collectFieldsResult = collectFields(
    validationContext,
    ruleContext,
    parentType,
    selectionSet,
  );

  // (A) Find find all conflicts "within" the fields of this selection set.
  // Note: this is the *only place* `collectConflictsWithin` is called.
  collectConflictsWithin(
    validationContext,
    conflicts,
    ruleContext,
    collectFieldsResult,
  );

  // Compare fragment uses only with fields or another spread.
  if (
    collectFieldsResult.fragmentNames.length !== 0 &&
    (collectFieldsResult.responseNames.length !== 0 ||
      collectFieldsResult.fragmentNames.length > 1)
  ) {
    // (B) Then collect conflicts between these fields and those represented by
    // each spread fragment name found.
    for (let i = 0; i < collectFieldsResult.fragmentNames.length; i++) {
      collectConflictsBetweenFieldsAndFragment(
        validationContext,
        conflicts,
        ruleContext,
        false,
        collectFieldsResult,
        collectFieldsResult.fragmentNames[i],
      );
      // (C) Then compare this fragment with all other fragments found in this
      // selection set to collect conflicts between fragments spread together.
      // This compares each item in the list of fragment names to every other
      // item in that same list (except for itself).
      for (let j = i + 1; j < collectFieldsResult.fragmentNames.length; j++) {
        collectConflictsBetweenFragments(
          validationContext,
          conflicts,
          ruleContext,
          false,
          collectFieldsResult.fragmentNames[i],
          collectFieldsResult.fragmentNames[j],
        );
      }
    }
  }
  return conflicts;
}

// Collect all conflicts found between a set of fields and a fragment reference
// including via spreading in any nested fragments.
function collectConflictsBetweenFieldsAndFragment(
  validationContext: ValidationContext,
  conflicts: Array<Conflict>,
  ruleContext: RuleContext,
  areMutuallyExclusive: boolean,
  collectFieldsResult: CollectFieldsResult,
  fragmentName: string,
): void {
  // Callers can enumerate more field-map/fragment pairs than document nodes.
  // Count attempts even when an empty collection or the pair cache skips them.
  spendComplexityBudget(ruleContext, 1);

  if (collectFieldsResult.responseNames.length === 0) {
    return;
  }

  const comparedFragments =
    collectFieldsResult.comparedFragments ??
    (collectFieldsResult.comparedFragments = new Map());
  // Memoize so the fields and fragments are not compared for conflicts more
  // than once.
  const compared = comparedFragments.get(fragmentName);
  // Only a non-exclusive comparison can be reused for overlapping parents.
  if (compared === false || (areMutuallyExclusive && compared === true)) {
    return;
  }
  comparedFragments.set(fragmentName, areMutuallyExclusive);

  const fragment = validationContext.getFragment(fragmentName);
  if (!fragment) {
    return;
  }

  const collectFieldsResult2 = collectFragmentFields(
    validationContext,
    ruleContext,
    fragment,
  );

  // Do not compare a fragment's collectFieldsResult to itself.
  if (collectFieldsResult === collectFieldsResult2) {
    return;
  }

  // (D) First collect any conflicts between the provided collection of fields
  // and the collection of fields represented by the given fragment.
  collectConflictsBetween(
    validationContext,
    conflicts,
    ruleContext,
    areMutuallyExclusive,
    collectFieldsResult,
    collectFieldsResult2,
  );

  // (E) Then collect any conflicts between the provided collection of fields
  // and any fragment names found in the given fragment.
  for (let i = 0; i < collectFieldsResult2.fragmentNames.length; i++) {
    const referencedFragmentName = collectFieldsResult2.fragmentNames[i];

    collectConflictsBetweenFieldsAndFragment(
      validationContext,
      conflicts,
      ruleContext,
      areMutuallyExclusive,
      collectFieldsResult,
      referencedFragmentName,
    );
  }
}

// Collect all conflicts found between two fragments, including via spreading in
// any nested fragments.
function collectConflictsBetweenFragments(
  validationContext: ValidationContext,
  conflicts: Array<Conflict>,
  ruleContext: RuleContext,
  areMutuallyExclusive: boolean,
  fragmentName1: string,
  fragmentName2: string,
): void {
  // Count attempted fragment pairs, including identity and cache hits.
  spendComplexityBudget(ruleContext, 2);

  const { comparedFragmentPairs } = ruleContext;
  // No need to compare a fragment to itself.
  if (fragmentName1 === fragmentName2) {
    return;
  }

  // Memoize so two fragments are not compared for conflicts more than once.
  if (
    comparedFragmentPairs.has(
      fragmentName1,
      fragmentName2,
      areMutuallyExclusive,
    )
  ) {
    return;
  }
  comparedFragmentPairs.add(fragmentName1, fragmentName2, areMutuallyExclusive);

  const fragment1 = validationContext.getFragment(fragmentName1);
  const fragment2 = validationContext.getFragment(fragmentName2);
  if (!fragment1 || !fragment2) {
    return;
  }

  const collectFieldsResult1 = collectFragmentFields(
    validationContext,
    ruleContext,
    fragment1,
  );
  const collectFieldsResult2 = collectFragmentFields(
    validationContext,
    ruleContext,
    fragment2,
  );

  // (F) First, collect all conflicts between these two collections of fields
  // (not including any nested fragments).
  collectConflictsBetween(
    validationContext,
    conflicts,
    ruleContext,
    areMutuallyExclusive,
    collectFieldsResult1,
    collectFieldsResult2,
  );

  // (G) Then collect conflicts between the first fragment and any nested
  // fragments spread in the second fragment.
  for (let j = 0; j < collectFieldsResult2.fragmentNames.length; j++) {
    collectConflictsBetweenFragments(
      validationContext,
      conflicts,
      ruleContext,
      areMutuallyExclusive,
      fragmentName1,
      collectFieldsResult2.fragmentNames[j],
    );
  }

  // (G) Then collect conflicts between the second fragment and any nested
  // fragments spread in the first fragment.
  for (let i = 0; i < collectFieldsResult1.fragmentNames.length; i++) {
    collectConflictsBetweenFragments(
      validationContext,
      conflicts,
      ruleContext,
      areMutuallyExclusive,
      collectFieldsResult1.fragmentNames[i],
      fragmentName2,
    );
  }
}

// Find all conflicts found between two selection sets, including those found
// via spreading in fragments. Called when determining if conflicts exist
// between the sub-fields of two overlapping fields.
function findConflictsBetweenSubSelectionSets(
  validationContext: ValidationContext,
  ruleContext: RuleContext,
  areMutuallyExclusive: boolean,
  parentType1: ?GraphQLNamedType,
  selectionSet1: SelectionSetNode,
  parentType2: ?GraphQLNamedType,
  selectionSet2: SelectionSetNode,
): Array<Conflict> {
  const conflicts: Array<Conflict> = [];

  const collectFieldsResult1 = collectFields(
    validationContext,
    ruleContext,
    parentType1,
    selectionSet1,
  );
  const collectFieldsResult2 = collectFields(
    validationContext,
    ruleContext,
    parentType2,
    selectionSet2,
  );

  // (H) First, collect all conflicts between these two collections of field.
  collectConflictsBetween(
    validationContext,
    conflicts,
    ruleContext,
    areMutuallyExclusive,
    collectFieldsResult1,
    collectFieldsResult2,
  );

  // (I) Then collect conflicts between the first collection of fields and
  // those referenced by each fragment name associated with the second.
  if (collectFieldsResult2.fragmentNames.length !== 0) {
    for (let j = 0; j < collectFieldsResult2.fragmentNames.length; j++) {
      collectConflictsBetweenFieldsAndFragment(
        validationContext,
        conflicts,
        ruleContext,
        areMutuallyExclusive,
        collectFieldsResult1,
        collectFieldsResult2.fragmentNames[j],
      );
    }
  }

  // (I) Then collect conflicts between the second collection of fields and
  // those referenced by each fragment name associated with the first.
  if (collectFieldsResult1.fragmentNames.length !== 0) {
    for (let i = 0; i < collectFieldsResult1.fragmentNames.length; i++) {
      collectConflictsBetweenFieldsAndFragment(
        validationContext,
        conflicts,
        ruleContext,
        areMutuallyExclusive,
        collectFieldsResult2,
        collectFieldsResult1.fragmentNames[i],
      );
    }
  }

  // (J) Also collect conflicts between any fragment names by the first and
  // fragment names by the second. This compares each item in the first set of
  // names to each item in the second set of names.
  for (let i = 0; i < collectFieldsResult1.fragmentNames.length; i++) {
    for (let j = 0; j < collectFieldsResult2.fragmentNames.length; j++) {
      collectConflictsBetweenFragments(
        validationContext,
        conflicts,
        ruleContext,
        areMutuallyExclusive,
        collectFieldsResult1.fragmentNames[i],
        collectFieldsResult2.fragmentNames[j],
      );
    }
  }
  return conflicts;
}

// Collect all Conflicts "within" one collection of fields.
function collectConflictsWithin(
  validationContext: ValidationContext,
  conflicts: Array<Conflict>,
  ruleContext: RuleContext,
  collectFieldsResult: CollectFieldsResult,
): void {
  // A field map is a keyed collection, where each key represents a response
  // name and the value at that key is a list of all fields which provide that
  // response name. For every response name, if there are multiple fields, they
  // must be compared to find a potential conflict.
  for (const responseName of collectFieldsResult.responseNames) {
    const fields = collectFieldsResult.groupedFieldSet[responseName];
    // This compares every field in the list to every other field in this list
    // (except to itself). If the list only has one item, nothing needs to
    // be compared.
    if (fields.length > 1) {
      for (let i = 0; i < fields.length; i++) {
        for (let j = i + 1; j < fields.length; j++) {
          const conflict = findConflict(
            validationContext,
            ruleContext,
            false,
            responseName,
            fields[i],
            fields[j],
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
  validationContext: ValidationContext,
  conflicts: Array<Conflict>,
  ruleContext: RuleContext,
  parentFieldsAreMutuallyExclusive: boolean,
  collectFieldsResult1: CollectFieldsResult,
  collectFieldsResult2: CollectFieldsResult,
): void {
  if (
    collectFieldsResult1.responseNames.length === 0 ||
    collectFieldsResult2.responseNames.length === 0
  ) {
    return;
  }

  // A field map is a keyed collection, where each key represents a response
  // name and the value at that key is a list of all fields which provide that
  // response name. For any response name which appears in both provided field
  // maps, each field from the first field map must be compared to every field
  // in the second field map to find potential conflicts.
  for (const { responseName, fields1, fields2 } of getOverlappingFields(
    ruleContext,
    collectFieldsResult1,
    collectFieldsResult2,
  )) {
    for (let i = 0; i < fields1.length; i++) {
      for (let j = 0; j < fields2.length; j++) {
        const conflict = findConflict(
          validationContext,
          ruleContext,
          parentFieldsAreMutuallyExclusive,
          responseName,
          fields1[i],
          fields2[j],
        );
        if (conflict) {
          conflicts.push(conflict);
        }
      }
    }
  }
}

function getOverlappingFields(
  ruleContext: RuleContext,
  collectFieldsResult1: CollectFieldsResult,
  collectFieldsResult2: CollectFieldsResult,
): Array<OverlappingFields> {
  // Reuse matching response groups when these collections are compared again.
  const byCollectFieldsResult =
    collectFieldsResult1.overlappingFields ??
    (collectFieldsResult1.overlappingFields = new Map());
  const cached = byCollectFieldsResult.get(collectFieldsResult2);
  if (cached !== undefined) {
    return cached;
  }
  const overlappingFields: Array<OverlappingFields> = [];
  for (const responseName of collectFieldsResult1.responseNames) {
    // A field map can participate in many distinct comparisons.
    spendComplexityBudget(ruleContext, 1);
    const fields2 = collectFieldsResult2.groupedFieldSet[responseName];
    if (fields2 !== undefined) {
      const fields1 = collectFieldsResult1.groupedFieldSet[responseName];
      overlappingFields.push({ responseName, fields1, fields2 });
    }
  }
  byCollectFieldsResult.set(collectFieldsResult2, overlappingFields);
  return overlappingFields;
}

// Determines if there is a conflict between two particular fields, including
// comparing their sub-fields.
function findConflict(
  validationContext: ValidationContext,
  ruleContext: RuleContext,
  parentFieldsAreMutuallyExclusive: boolean,
  responseName: string,
  fieldDetails1: FieldDetails,
  fieldDetails2: FieldDetails,
): ?Conflict {
  const {
    parentType: parentType1,
    node: node1,
    definition: def1,
  } = fieldDetails1;
  const {
    parentType: parentType2,
    node: node2,
    definition: def2,
  } = fieldDetails2;

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

  // Count attempted field pairs, including pairs skipped by type exclusivity.
  spendComplexityBudget(ruleContext, 2);

  if (!areMutuallyExclusive) {
    const fieldInfo1 = getFieldInfo(fieldDetails1);
    const fieldInfo2 = getFieldInfo(fieldDetails2);
    let reason = fieldInfo1.comparisons.get(fieldInfo2);
    if (reason === undefined) {
      // Two aliases must refer to the same field with the same arguments.
      const name1 = node1.name.value;
      const name2 = node2.name.value;
      reason =
        name1 !== name2
          ? `"${maybeAbbreviate(name1)}" and "${maybeAbbreviate(
              name2,
            )}" are different fields`
          : sameArguments(
              ruleContext,
              fieldInfo1.arguments,
              fieldInfo2.arguments,
            )
          ? null
          : 'they have differing arguments';
      fieldInfo1.comparisons.set(fieldInfo2, reason);
    }
    if (reason !== null) {
      return {
        responseName,
        reason,
        fields1: [node1],
        fields2: [node2],
      };
    }
  }

  // The return type for each field.
  const type1 = def1?.type;
  const type2 = def2?.type;

  if (type1 && type2 && doTypesConflict(type1, type2)) {
    return {
      responseName,
      reason: `they return conflicting types "${inspect(type1)}" and "${inspect(
        type2,
      )}"`,
      fields1: [node1],
      fields2: [node2],
    };
  }

  // Collect and compare sub-fields. Use the same "visited fragment names" list
  // for both collections so fields in a fragment reference are never
  // compared to themselves.
  const selectionSet1 = node1.selectionSet;
  const selectionSet2 = node2.selectionSet;
  if (selectionSet1 && selectionSet2) {
    const conflicts = findConflictsBetweenSubSelectionSets(
      validationContext,
      ruleContext,
      areMutuallyExclusive,
      getNamedType(type1),
      selectionSet1,
      getNamedType(type2),
      selectionSet2,
    );
    return subfieldConflicts(conflicts, responseName, node1, node2);
  }
}

// Prepare argument lookups only when a field overlaps.
function getFieldInfo(fieldDetails: FieldDetails): FieldInfo {
  if (fieldDetails.info === undefined) {
    fieldDetails.info = {
      comparisons: new Map(),
      arguments: getArgumentInfo(fieldDetails.node.arguments),
    };
  }
  return fieldDetails.info;
}

function getArgumentInfo(
  args: $ReadOnlyArray<ArgumentNode> | void,
): ArgumentInfo | void {
  if (args === undefined || args.length === 0) {
    return;
  }
  const values: Map<string, ValueNode> = new Map();
  for (const { name, value } of args) {
    values.set(name.value, value);
  }
  return { nodes: args, values };
}

function sameArguments(
  ruleContext: RuleContext,
  argumentInfo1: ArgumentInfo | void,
  argumentInfo2: ArgumentInfo | void,
): boolean {
  if (argumentInfo1 === undefined) {
    return argumentInfo2 === undefined;
  }
  if (
    argumentInfo2 === undefined ||
    argumentInfo1.nodes.length !== argumentInfo2.nodes.length
  ) {
    return false;
  }
  const values2 = argumentInfo2.values;
  return argumentInfo1.nodes.every((arg1) => {
    // A prepared argument list can participate in many field-pair comparisons.
    spendComplexityBudget(ruleContext, 1);
    const value2 = values2.get(arg1.name.value);
    if (value2 === undefined) {
      return false;
    }
    return (
      stringifyValue(ruleContext, arg1.value) ===
      stringifyValue(ruleContext, value2)
    );
  });
}

function stringifyValue(ruleContext: RuleContext, value: ValueNode): string {
  const cached = ruleContext.stringifiedValues.get(value);
  if (cached !== undefined) {
    return cached;
  }
  const result = JSON.stringify(value, (_key, node) => {
    if (!isNode(node)) {
      return node;
    }
    switch (node.kind) {
      case Kind.VARIABLE:
        return [node.kind, node.name.value];
      case Kind.OBJECT:
        return [
          node.kind,
          node.fields
            .slice()
            .sort((first, second) =>
              first.name.value < second.name.value
                ? -1
                : first.name.value > second.name.value
                ? 1
                : 0,
            ),
        ];
      case Kind.OBJECT_FIELD:
        return [node.name.value, node.value];
      case Kind.LIST:
        return [node.kind, node.values];
      case Kind.STRING:
        return [node.kind, node.value, node.block === true];
      default:
        return [node.kind, 'value' in node ? node.value : null];
    }
  });
  ruleContext.stringifiedValues.set(value, result);
  return result;
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
// name to field nodes and definitions) as well as a list of fragment names
// referenced via fragment spreads.
function collectFields(
  validationContext: ValidationContext,
  ruleContext: RuleContext,
  parentType: ?GraphQLNamedType,
  selectionSet: SelectionSetNode,
): CollectFieldsResult {
  const { cachedCollectFieldsResults } = ruleContext;
  // A programmatically built document can share a selection-set object between
  // different parent types; their field definitions must not share a cache entry.
  let bySelectionSet = cachedCollectFieldsResults.get(parentType);
  if (bySelectionSet === undefined) {
    bySelectionSet = new Map();
    cachedCollectFieldsResults.set(parentType, bySelectionSet);
  }
  const cached = bySelectionSet.get(selectionSet);
  if (cached) {
    return cached;
  }
  const fieldDetails: GroupedFieldSet = Object.create(null);
  const fragmentNames: ObjMap<boolean> = Object.create(null);
  collectFieldsImpl(
    validationContext,
    parentType,
    selectionSet,
    fieldDetails,
    fragmentNames,
  );
  const result: CollectFieldsResult = {
    groupedFieldSet: fieldDetails,
    responseNames: Object.keys(fieldDetails),
    fragmentNames: Object.keys(fragmentNames),
  };
  bySelectionSet.set(selectionSet, result);
  return result;
}

// Given a reference to a fragment, return the represented collection of fields
// as well as a list of nested fragment names referenced via fragment spreads.
function collectFragmentFields(
  validationContext: ValidationContext,
  ruleContext: RuleContext,
  fragment: FragmentDefinitionNode,
) {
  const fragmentType = typeFromAST(
    validationContext.getSchema(),
    fragment.typeCondition,
  );
  return collectFields(
    validationContext,
    ruleContext,
    fragmentType,
    fragment.selectionSet,
  );
}

function collectFieldsImpl(
  validationContext: ValidationContext,
  parentType: ?GraphQLNamedType,
  selectionSet: SelectionSetNode,
  fieldDetails: GroupedFieldSet,
  fragmentNames: ObjMap<boolean>,
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
        if (!fieldDetails[responseName]) {
          fieldDetails[responseName] = [];
        }
        fieldDetails[responseName].push({
          parentType,
          node: selection,
          definition: fieldDef,
        });
        break;
      }
      case Kind.FRAGMENT_SPREAD:
        fragmentNames[selection.name.value] = true;
        break;
      case Kind.INLINE_FRAGMENT: {
        const typeCondition = selection.typeCondition;
        const inlineFragmentType = typeCondition
          ? typeFromAST(validationContext.getSchema(), typeCondition)
          : parentType;
        collectFieldsImpl(
          validationContext,
          inlineFragmentType,
          selection.selectionSet,
          fieldDetails,
          fragmentNames,
        );
        break;
      }
    }
  }
}

// Given a series of Conflicts which occurred between two sub-fields, generate
// a single Conflict.
function subfieldConflicts(
  conflicts: $ReadOnlyArray<Conflict>,
  responseName: string,
  node1: FieldNode,
  node2: FieldNode,
): ?Conflict {
  if (conflicts.length > 0) {
    let message = '';
    for (const { responseName: name, reason } of conflicts) {
      message +=
        (message === '' ? '' : ' and ') +
        `subfields "${maybeAbbreviate(name)}" conflict because ${reason}`;
      if (message.length > MAX_CONFLICT_DETAIL_LENGTH) {
        break;
      }
    }
    return {
      responseName,
      reason: maybeAbbreviate(message),
      fields1: collectConflictNodes(node1, conflicts, 'fields1'),
      fields2: collectConflictNodes(node2, conflicts, 'fields2'),
    };
  }
}

function collectConflictNodes(
  node: FieldNode,
  conflicts: $ReadOnlyArray<Conflict>,
  side: 'fields1' | 'fields2',
): Array<FieldNode> {
  const nodes = [node];
  for (const conflict of conflicts) {
    const remaining = MAX_CONFLICT_NODES - nodes.length;
    // Locations start with the enclosing field. Take from the end so that
    // truncation favors the deeper fields involved in the conflict.
    const retainedNodes = (side === 'fields1'
      ? conflict.fields1
      : conflict.fields2
    ).slice(-remaining);
    nodes.push(...retainedNodes);
    if (nodes.length === MAX_CONFLICT_NODES) {
      break;
    }
  }
  return nodes;
}

function maybeAbbreviate(text: string): string {
  return text.length > MAX_CONFLICT_DETAIL_LENGTH
    ? text.slice(0, MAX_CONFLICT_DETAIL_LENGTH) + '...'
    : text;
}

function spendComplexityBudget(ruleContext: RuleContext, cost: number): void {
  ruleContext.remainingComplexityBudget -= cost;
  /* istanbul ignore if -- exercised by private complexity calibration */
  if (ruleContext.remainingComplexityBudget < 0) {
    throw validationAbortedError;
  }
}

/**
 * A way to keep track of pairs of things when the ordering of the pair does
 * not matter. We do this by maintaining a sort of double adjacency sets.
 */
class PairSet {
  _data: ObjMap<ObjMap<boolean>>;

  constructor() {
    this._data = Object.create(null);
  }

  has(a: string, b: string, areMutuallyExclusive: boolean): boolean {
    const first = this._data[a];
    const result = first && first[b];
    if (result === undefined) {
      return false;
    }

    // areMutuallyExclusive being false is a superset of being true,
    // hence if we want to know if this PairSet "has" these two with no
    // exclusivity, we have to ensure it was added as such.
    if (areMutuallyExclusive === false) {
      return result === false;
    }
    return true;
  }

  add(a: string, b: string, areMutuallyExclusive: boolean): void {
    this._pairSetAdd(a, b, areMutuallyExclusive);
    this._pairSetAdd(b, a, areMutuallyExclusive);
  }

  _pairSetAdd(a: string, b: string, areMutuallyExclusive: boolean): void {
    let map = this._data[a];
    if (!map) {
      map = Object.create(null);
      this._data[a] = map;
    }
    map[b] = areMutuallyExclusive;
  }
}
