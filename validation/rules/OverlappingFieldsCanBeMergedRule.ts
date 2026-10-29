/** @category Validation Rules */
import { inspect } from '../../jsutils/inspect.ts';
import type { Maybe } from '../../jsutils/Maybe.ts';
import { GraphQLError } from '../../error/GraphQLError.ts';
import type {
  ArgumentNode,
  FieldNode,
  FragmentArgumentNode,
  FragmentDefinitionNode,
  FragmentSpreadNode,
  SelectionSetNode,
  ValueNode,
} from '../../language/ast.ts';
import { isNode } from '../../language/ast.ts';
import { Kind } from '../../language/kinds.ts';
import { print } from '../../language/printer.ts';
import type { ASTVisitor } from '../../language/visitor.ts';
import type {
  GraphQLField,
  GraphQLNamedType,
  GraphQLOutputType,
} from '../../type/definition.ts';
import {
  getNamedType,
  isInterfaceType,
  isLeafType,
  isListType,
  isNonNullType,
  isObjectType,
} from '../../type/definition.ts';
import { typeFromAST } from '../../utilities/typeFromAST.ts';
import type { FragmentSignature } from '../../utilities/TypeInfo.ts';
import { validationAbortedError } from '../validationAbortedError.ts';
import type { ValidationContext } from '../ValidationContext.ts';
/* eslint-disable max-params */
// This file contains a lot of such errors but we plan to refactor it anyway
// so just disable it for entire file.
// Keep diagnostic detail bounded independently of document size.
const MAX_CONFLICT_DETAIL_LENGTH = 1000;
const MAX_CONFLICT_NODES = 20;
const MAX_FRAGMENT_ARGUMENT_SIZE = 256;
// Meter work that can grow through repeated comparisons and fragment scopes.
// Collecting a selection set's fields is shared across scopes and is not charged.
const MAX_COMPLEXITY_BUDGET = 500000;
/**
 * Overlapping fields can be merged
 *
 * A selection set is only valid if all fields (including spreading any
 * fragments) either correspond to distinct response names or can be merged
 * without ambiguity.
 *
 * See https://spec.graphql.org/draft/#sec-Field-Selection-Merging
 * @param validationContext - The validation context used while checking the document.
 * @returns A visitor that reports validation errors for this rule.
 * @example
 * ```ts
 * import { buildSchema, parse, validate } from 'graphql';
 * import { OverlappingFieldsCanBeMergedRule } from 'graphql/validation';
 *
 * const schema = buildSchema(`
 *   type Query {
 *     dog: Dog
 *   }
 *
 *   type Dog {
 *     name: String
 *     barkVolume: Int
 *   }
 * `);
 *
 * const invalidDocument = parse(`
 *   { dog { value: barkVolume value: name } }
 * `);
 * const invalidErrors = validate(schema, invalidDocument, [
 *   OverlappingFieldsCanBeMergedRule,
 * ]);
 *
 * invalidErrors.length; // => 1
 *
 * const validDocument = parse(`
 *   { dog { barkVolume name } }
 * `);
 * const validErrors = validate(schema, validDocument, [
 *   OverlappingFieldsCanBeMergedRule,
 * ]); // => []
 * ```
 */
export function OverlappingFieldsCanBeMergedRule(
  validationContext: ValidationContext,
): ASTVisitor {
  const ruleContext: RuleContext = {
    // A memoization for when fields and a fragment or two fragments are compared
    // "between" each other for conflicts. Comparisons may be made many times,
    // so memoizing this can dramatically improve the performance of this validator.
    comparedFieldsAndFragmentPairs: new Map(),
    comparedFragmentPairs: new Map(),
    // A cache for the "field map" and list of fragment spreads found in any given
    // selection set.
    cachedCollectFieldsResults: new Map(),
    valueInfoByNode: new Map(),
    fragmentSpreadInfoByNode: new Map(),
    fragmentSpreadInfoByKey: new Map(),
    remainingComplexityBudget: MAX_COMPLEXITY_BUDGET,
  };
  let fragmentScope: VariableScope | undefined;
  return {
    FragmentDefinition: {
      enter(node) {
        const fragmentName = node.name.value;
        const fragmentSignature =
          validationContext.getFragmentSignatureByName()(fragmentName);
        fragmentScope = getVariableScope(fragmentSignature);
      },
      leave() {
        fragmentScope = undefined;
      },
    },
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
        fragmentScope,
      );
      for (const { responseName, reason, fields1, fields2 } of conflicts) {
        validationContext.reportError(
          new GraphQLError(
            `Fields "${maybeAbbreviate(responseName)}" conflict because ${reason}. Use different aliases on the fields to fetch both if this was intentional.`,
            { nodes: fields1.concat(fields2) },
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
  parentType: Maybe<GraphQLNamedType>;
  node: FieldNode;
  definition: Maybe<GraphQLField<unknown, unknown>>;
  info?: FieldInfo;
}
interface FieldInfo {
  comparisons: Map<FieldInfo, FieldComparison>;
  namedType: Maybe<GraphQLNamedType>;
  arguments: ArgumentInfo | undefined;
  hasStream: boolean;
  streamArguments: ArgumentInfo | undefined;
}
interface FieldComparison {
  sameName?: boolean;
  arguments?: ArgumentComparison;
  streamArguments?: ArgumentComparison;
}
interface ArgumentComparison {
  sameStructure: boolean;
  valuesWithVariables: ReadonlyArray<ValueInfo>;
}
type FieldDetailsList = Array<FieldDetails>;
type GroupedFieldSet = Map<string, FieldDetailsList>;
interface OverlappingFields {
  responseName: string;
  fieldDetailsList1: FieldDetailsList;
  fieldDetailsList2: FieldDetailsList;
}
// Equivalent spreads share a scope. The signature identifies declarations;
// object identity distinguishes scopes with different fragment arguments.
interface VariableScope {
  signature: FragmentSignature;
}
interface FragmentSpread {
  node: FragmentSpreadNode;
  scope: VariableScope | undefined;
  definition: FragmentDefinitionNode | undefined;
}
type FragmentSpreads = ReadonlyArray<FragmentSpread>;
interface CollectFieldsResult {
  groupedFieldSet: GroupedFieldSet;
  spreads: ReadonlyArray<FragmentSpreadNode>;
  byScope?: Map<VariableScope | undefined, FragmentSpreads>;
  overlappingFields?: Map<CollectFieldsResult, Array<OverlappingFields>>;
}
type ArgumentNodes =
  | ReadonlyArray<ArgumentNode>
  | ReadonlyArray<FragmentArgumentNode>;
interface ArgumentInfo {
  nodes: ArgumentNodes;
  values: Map<string, ValueNode>;
}
interface FragmentSpreadInfo {
  signature: Maybe<FragmentSignature>;
  values: ReadonlyArray<ValueInfo>;
  // Cache the resulting fragment scope by the arguments' enclosing scope.
  // An undefined key means no local references; an undefined value means
  // the target fragment declares no variables.
  byScope: Map<VariableScope | undefined, VariableScope | undefined>;
}
interface RuleContext {
  comparedFieldsAndFragmentPairs: Map<
    VariableScope | undefined,
    Map<
      VariableScope | undefined,
      OrderedPairSet<CollectFieldsResult, FragmentDefinitionNode | undefined>
    >
  >;
  comparedFragmentPairs: Map<
    VariableScope | undefined,
    Map<VariableScope | undefined, PairSet<FragmentDefinitionNode | undefined>>
  >;
  cachedCollectFieldsResults: Map<
    Maybe<GraphQLNamedType>,
    Map<SelectionSetNode, CollectFieldsResult>
  >;
  valueInfoByNode: Map<ValueNode, ValueInfo>;
  fragmentSpreadInfoByNode: Map<FragmentSpreadNode, FragmentSpreadInfo>;
  fragmentSpreadInfoByKey: Map<string, FragmentSpreadInfo>;
  remainingComplexityBudget: number;
}
/**
 * Find all conflicts found "within" a selection set, including those found
 * via spreading in fragments. Inline-fragment selection sets are included in
 * their enclosing collection.
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
 *
 * @internal
 */
function findConflictsWithinSelectionSet(
  validationContext: ValidationContext,
  ruleContext: RuleContext,
  parentType: Maybe<GraphQLNamedType>,
  selectionSet: SelectionSetNode,
  scope: VariableScope | undefined,
): Array<Conflict> {
  const conflicts: Array<Conflict> = [];
  const collectFieldsResult = collectFields(
    validationContext,
    ruleContext,
    parentType,
    selectionSet,
  );
  // (A) Find find all conflicts "within" the fields and f of this selection set.
  // Note: this is the *only place* `collectConflictsWithin` is called.
  collectConflictsWithin(
    validationContext,
    ruleContext,
    conflicts,
    collectFieldsResult,
    scope,
  );
  // Prepare fragment uses only for comparisons with fields or another spread.
  if (
    collectFieldsResult.spreads.length !== 0 &&
    (collectFieldsResult.groupedFieldSet.size !== 0 ||
      collectFieldsResult.spreads.length > 1)
  ) {
    const fragmentSpreads = getFragmentSpreads(
      validationContext,
      ruleContext,
      collectFieldsResult,
      scope,
    );
    // (B) Then collect conflicts between these fields and those represented by
    // each spread found.
    for (let i = 0; i < fragmentSpreads.length; i++) {
      collectConflictsBetweenFieldsAndFragment(
        validationContext,
        ruleContext,
        conflicts,
        false,
        collectFieldsResult,
        scope,
        fragmentSpreads[i],
      );
      // (C) Then compare this fragment with all other fragments found in this
      // selection set to collect conflicts between fragments spread together.
      // This compares each item in the list of fragment spreads to every other
      // item in that same list (except for itself).
      for (let j = i + 1; j < fragmentSpreads.length; j++) {
        collectConflictsBetweenFragments(
          validationContext,
          ruleContext,
          conflicts,
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
  validationContext: ValidationContext,
  ruleContext: RuleContext,
  conflicts: Array<Conflict>,
  areMutuallyExclusive: boolean,
  collectFieldsResult: CollectFieldsResult,
  scope: VariableScope | undefined,
  fragmentSpread: FragmentSpread,
): void {
  // Callers can enumerate more field-map/fragment pairs than document nodes.
  // Count attempts even when an empty collection or the pair cache skips them.
  spendComplexityBudget(ruleContext, 1);
  if (collectFieldsResult.groupedFieldSet.size === 0) {
    return;
  }
  // Fields and fragments can each be compared in different variable scopes.
  // Keep a separate pair history for each pair of scopes.
  const fragment = fragmentSpread.definition;
  let byFragmentScope = ruleContext.comparedFieldsAndFragmentPairs.get(scope);
  if (byFragmentScope === undefined) {
    byFragmentScope = new Map();
    ruleContext.comparedFieldsAndFragmentPairs.set(scope, byFragmentScope);
  }
  let comparedFieldsAndFragmentPairs = byFragmentScope.get(
    fragmentSpread.scope,
  );
  if (comparedFieldsAndFragmentPairs === undefined) {
    comparedFieldsAndFragmentPairs = new OrderedPairSet();
    byFragmentScope.set(fragmentSpread.scope, comparedFieldsAndFragmentPairs);
  }
  // Memoize so the fields and fragments are not compared for conflicts more
  // than once.
  if (
    comparedFieldsAndFragmentPairs.has(
      collectFieldsResult,
      fragment,
      areMutuallyExclusive,
    )
  ) {
    return;
  }
  comparedFieldsAndFragmentPairs.add(
    collectFieldsResult,
    fragment,
    areMutuallyExclusive,
  );
  if (!fragment) {
    return;
  }
  const collectFieldsResult2 = collectFragmentFields(
    validationContext,
    ruleContext,
    fragment,
  );
  const referencedFragmentSpreads = getFragmentSpreads(
    validationContext,
    ruleContext,
    collectFieldsResult2,
    fragmentSpread.scope,
  );
  // Do not compare a selection set to itself in the same variable scope.
  if (
    collectFieldsResult === collectFieldsResult2 &&
    scope === fragmentSpread.scope
  ) {
    return;
  }
  // (D) First collect any conflicts between the provided collection of fields
  // and the collection of fields represented by the given fragment.
  collectConflictsBetween(
    validationContext,
    ruleContext,
    conflicts,
    areMutuallyExclusive,
    collectFieldsResult,
    scope,
    collectFieldsResult2,
    fragmentSpread.scope,
  );
  // (E) Then collect any conflicts between the provided collection of fields
  // and any fragment names found in the given fragment.
  for (const referencedFragmentSpread of referencedFragmentSpreads) {
    collectConflictsBetweenFieldsAndFragment(
      validationContext,
      ruleContext,
      conflicts,
      areMutuallyExclusive,
      collectFieldsResult,
      scope,
      referencedFragmentSpread,
    );
  }
}
// Collect all conflicts found between two fragments, including via spreading in
// any nested fragments.
function collectConflictsBetweenFragments(
  validationContext: ValidationContext,
  ruleContext: RuleContext,
  conflicts: Array<Conflict>,
  areMutuallyExclusive: boolean,
  fragmentSpread1: FragmentSpread,
  fragmentSpread2: FragmentSpread,
): void {
  const fragment1 = fragmentSpread1.definition;
  const fragment2 = fragmentSpread2.definition;
  const scope1 = fragmentSpread1.scope;
  const scope2 = fragmentSpread2.scope;
  // Count attempted fragment pairs, including identity and cache hits.
  spendComplexityBudget(ruleContext, 2);
  // No need to compare a fragment to itself.
  if (fragment1 === fragment2 && scope1 === scope2) {
    return;
  }
  // Scope pairs share a comparison history indexed by fragment definitions.
  let byScope = ruleContext.comparedFragmentPairs.get(scope1);
  let comparedFragmentPairs =
    byScope?.get(scope2) ??
    ruleContext.comparedFragmentPairs.get(scope2)?.get(scope1);
  if (comparedFragmentPairs === undefined) {
    if (byScope === undefined) {
      byScope = new Map();
      ruleContext.comparedFragmentPairs.set(scope1, byScope);
    }
    comparedFragmentPairs = new PairSet();
    byScope.set(scope2, comparedFragmentPairs);
  }
  if (fragment1 === fragment2) {
    if (comparedFragmentPairs.has(fragment1, fragment2, false)) {
      return;
    }
    comparedFragmentPairs.add(fragment1, fragment2, false);
    validationContext.reportError(
      new GraphQLError(
        `Spreads "${maybeAbbreviate(fragmentSpread1.node.name.value)}" conflict because ${getFragmentSpreadDescription(ruleContext, fragmentSpread1.node)} and ${getFragmentSpreadDescription(ruleContext, fragmentSpread2.node)} have different fragment arguments.`,
        { nodes: [fragmentSpread1.node, fragmentSpread2.node] },
      ),
    );
    return;
  }
  // Memoize so two fragments are not compared for conflicts more than once.
  if (comparedFragmentPairs.has(fragment1, fragment2, areMutuallyExclusive)) {
    return;
  }
  comparedFragmentPairs.add(fragment1, fragment2, areMutuallyExclusive);
  if (!fragment1 || !fragment2) {
    return;
  }
  const collectFieldsResult1 = collectFragmentFields(
    validationContext,
    ruleContext,
    fragment1,
  );
  const referencedFragmentSpreads1 = getFragmentSpreads(
    validationContext,
    ruleContext,
    collectFieldsResult1,
    fragmentSpread1.scope,
  );
  const collectFieldsResult2 = collectFragmentFields(
    validationContext,
    ruleContext,
    fragment2,
  );
  const referencedFragmentSpreads2 = getFragmentSpreads(
    validationContext,
    ruleContext,
    collectFieldsResult2,
    fragmentSpread2.scope,
  );
  // (F) First, collect all conflicts between these two collections of fields
  // (not including any nested fragments).
  collectConflictsBetween(
    validationContext,
    ruleContext,
    conflicts,
    areMutuallyExclusive,
    collectFieldsResult1,
    fragmentSpread1.scope,
    collectFieldsResult2,
    fragmentSpread2.scope,
  );
  // (G) Then collect conflicts between the first fragment and any nested
  // fragments spread in the second fragment.
  for (const referencedFragmentSpread2 of referencedFragmentSpreads2) {
    collectConflictsBetweenFragments(
      validationContext,
      ruleContext,
      conflicts,
      areMutuallyExclusive,
      fragmentSpread1,
      referencedFragmentSpread2,
    );
  }
  // (G) Then collect conflicts between the second fragment and any nested
  // fragments spread in the first fragment.
  for (const referencedFragmentSpread1 of referencedFragmentSpreads1) {
    collectConflictsBetweenFragments(
      validationContext,
      ruleContext,
      conflicts,
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
  validationContext: ValidationContext,
  ruleContext: RuleContext,
  areMutuallyExclusive: boolean,
  parentType1: Maybe<GraphQLNamedType>,
  selectionSet1: SelectionSetNode,
  scope1: VariableScope | undefined,
  parentType2: Maybe<GraphQLNamedType>,
  selectionSet2: SelectionSetNode,
  scope2: VariableScope | undefined,
): Array<Conflict> {
  const conflicts: Array<Conflict> = [];
  const collectFieldsResult1 = collectFields(
    validationContext,
    ruleContext,
    parentType1,
    selectionSet1,
  );
  const fragmentSpreads1 = getFragmentSpreads(
    validationContext,
    ruleContext,
    collectFieldsResult1,
    scope1,
  );
  const collectFieldsResult2 = collectFields(
    validationContext,
    ruleContext,
    parentType2,
    selectionSet2,
  );
  const fragmentSpreads2 = getFragmentSpreads(
    validationContext,
    ruleContext,
    collectFieldsResult2,
    scope2,
  );
  // (H) First, collect all conflicts between these two collections of field.
  collectConflictsBetween(
    validationContext,
    ruleContext,
    conflicts,
    areMutuallyExclusive,
    collectFieldsResult1,
    scope1,
    collectFieldsResult2,
    scope2,
  );
  // (I) Then collect conflicts between the first collection of fields and
  // those referenced by each fragment name associated with the second.
  for (const fragmentSpread2 of fragmentSpreads2) {
    collectConflictsBetweenFieldsAndFragment(
      validationContext,
      ruleContext,
      conflicts,
      areMutuallyExclusive,
      collectFieldsResult1,
      scope1,
      fragmentSpread2,
    );
  }
  // (I) Then collect conflicts between the second collection of fields and
  // those referenced by each fragment name associated with the first.
  for (const fragmentSpread1 of fragmentSpreads1) {
    collectConflictsBetweenFieldsAndFragment(
      validationContext,
      ruleContext,
      conflicts,
      areMutuallyExclusive,
      collectFieldsResult2,
      scope2,
      fragmentSpread1,
    );
  }
  // (J) Also collect conflicts between any fragment spreads by the first and
  // fragment spreads by the second. This compares each item in the first set of
  // spreads to each item in the second set of spreads.
  for (const fragmentSpread1 of fragmentSpreads1) {
    for (const fragmentSpread2 of fragmentSpreads2) {
      collectConflictsBetweenFragments(
        validationContext,
        ruleContext,
        conflicts,
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
  validationContext: ValidationContext,
  ruleContext: RuleContext,
  conflicts: Array<Conflict>,
  collectFieldsResult: CollectFieldsResult,
  scope: VariableScope | undefined,
): void {
  // A field map is a keyed collection, where each key represents a response
  // name and the value at that key is a list of all fields which provide that
  // response name. For every response name, if there are multiple fields, they
  // must be compared to find a potential conflict.
  for (const [
    responseName,
    fieldDetailsList,
  ] of collectFieldsResult.groupedFieldSet.entries()) {
    // This compares every field in the list to every other field in this list
    // (except to itself). If the list only has one item, nothing needs to
    // be compared.
    if (fieldDetailsList.length > 1) {
      for (let i = 0; i < fieldDetailsList.length; i++) {
        for (let j = i + 1; j < fieldDetailsList.length; j++) {
          const conflict = findConflict(
            validationContext,
            ruleContext,
            false, // within one collection is never mutually exclusive
            responseName,
            fieldDetailsList[i],
            scope,
            fieldDetailsList[j],
            scope,
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
  ruleContext: RuleContext,
  conflicts: Array<Conflict>,
  parentFieldsAreMutuallyExclusive: boolean,
  collectFieldsResult1: CollectFieldsResult,
  scope1: VariableScope | undefined,
  collectFieldsResult2: CollectFieldsResult,
  scope2: VariableScope | undefined,
): void {
  if (
    collectFieldsResult1.groupedFieldSet.size === 0 ||
    collectFieldsResult2.groupedFieldSet.size === 0
  ) {
    return;
  }
  // A field map is a keyed collection, where each key represents a response
  // name and the value at that key is a list of all fields which provide that
  // response name. For any response name which appears in both provided field
  // maps, each field from the first field map must be compared to every field
  // in the second field map to find potential conflicts.
  for (const {
    responseName,
    fieldDetailsList1,
    fieldDetailsList2,
  } of getOverlappingFields(
    ruleContext,
    collectFieldsResult1,
    collectFieldsResult2,
  )) {
    for (const fieldDetails1 of fieldDetailsList1) {
      for (const fieldDetails2 of fieldDetailsList2) {
        const conflict = findConflict(
          validationContext,
          ruleContext,
          parentFieldsAreMutuallyExclusive,
          responseName,
          fieldDetails1,
          scope1,
          fieldDetails2,
          scope2,
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
  // Matching response names is independent of variable scopes. Reuse that
  // matching across scopes, while still comparing fields in their own scope.
  const byCollectFieldsResult = (collectFieldsResult1.overlappingFields ??=
    new Map());
  const cached = byCollectFieldsResult.get(collectFieldsResult2);
  if (cached !== undefined) {
    return cached;
  }
  const overlappingFields: Array<OverlappingFields> = [];
  for (const [
    responseName,
    fieldDetailsList1,
  ] of collectFieldsResult1.groupedFieldSet.entries()) {
    // A field map can participate in many distinct comparisons.
    spendComplexityBudget(ruleContext, 1);
    const fieldDetailsList2 =
      collectFieldsResult2.groupedFieldSet.get(responseName);
    if (fieldDetailsList2 != null) {
      overlappingFields.push({
        responseName,
        fieldDetailsList1,
        fieldDetailsList2,
      });
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
  scope1: VariableScope | undefined,
  fieldDetails2: FieldDetails,
  scope2: VariableScope | undefined,
): Maybe<Conflict> {
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
  const fieldInfo1 = getFieldInfo(fieldDetails1);
  const fieldInfo2 = getFieldInfo(fieldDetails2);
  let comparison = fieldInfo1.comparisons.get(fieldInfo2);
  if (comparison === undefined) {
    comparison = {};
    fieldInfo1.comparisons.set(fieldInfo2, comparison);
  }
  if (!areMutuallyExclusive) {
    // Two aliases must refer to the same field.
    const name1 = node1.name.value;
    const name2 = node2.name.value;
    // Field names do not depend on the fragment scope.
    const sameName = (comparison.sameName ??= name1 === name2);
    if (!sameName) {
      return {
        responseName,
        reason: `"${maybeAbbreviate(name1)}" and "${maybeAbbreviate(name2)}" are different fields`,
        fields1: [node1],
        fields2: [node2],
      };
    }
    // Two field calls must have the same arguments.
    const comparedArguments = (comparison.arguments ??= compareArguments(
      ruleContext,
      fieldInfo1.arguments,
      fieldInfo2.arguments,
    ));
    if (!sameArguments(ruleContext, comparedArguments, scope1, scope2)) {
      return {
        responseName,
        reason: 'they have differing arguments',
        fields1: [node1],
        fields2: [node2],
      };
    }
  }
  if (fieldInfo1.hasStream || fieldInfo2.hasStream) {
    let reason = 'they have overlapping stream directives';
    if (fieldInfo1.hasStream && fieldInfo2.hasStream) {
      const comparedArguments = (comparison.streamArguments ??=
        compareArguments(
          ruleContext,
          fieldInfo1.streamArguments,
          fieldInfo2.streamArguments,
        ));
      if (sameArguments(ruleContext, comparedArguments, scope1, scope2)) {
        // This was allowed in previous alpha versions of `graphql-js`.
        reason +=
          '. See https://github.com/graphql/defer-stream-wg/discussions/100';
      }
    }
    return { responseName, reason, fields1: [node1], fields2: [node2] };
  }
  // The return type for each field.
  const type1 = def1?.type;
  const type2 = def2?.type;
  if (type1 && type2 && doTypesConflict(type1, type2)) {
    return {
      responseName,
      reason: `they return conflicting types "${inspect(type1)}" and "${inspect(type2)}"`,
      fields1: [node1],
      fields2: [node2],
    };
  }
  // Collect and compare sub-fields. Use the same "visited fragment spreads" list
  // for both collections so fields in a fragment reference are never
  // compared to themselves.
  const selectionSet1 = node1.selectionSet;
  const selectionSet2 = node2.selectionSet;
  if (selectionSet1 && selectionSet2) {
    const conflicts = findConflictsBetweenSubSelectionSets(
      validationContext,
      ruleContext,
      areMutuallyExclusive,
      fieldInfo1.namedType,
      selectionSet1,
      scope1,
      fieldInfo2.namedType,
      selectionSet2,
      scope2,
    );
    return subfieldConflicts(conflicts, responseName, node1, node2);
  }
}
// Prepare argument and directive lookups only when a field overlaps.
function getFieldInfo(fieldDetails: FieldDetails): FieldInfo {
  if (fieldDetails.info === undefined) {
    const node = fieldDetails.node;
    const stream = node.directives?.find(
      (directive) => directive.name.value === 'stream',
    );
    fieldDetails.info = {
      comparisons: new Map(),
      namedType: getNamedType(fieldDetails.definition?.type),
      arguments: getArgumentInfo(node.arguments),
      hasStream: stream !== undefined,
      streamArguments: getArgumentInfo(stream?.arguments),
    };
  }
  return fieldDetails.info;
}
function getArgumentInfo(
  args: ArgumentNodes | undefined,
): ArgumentInfo | undefined {
  if (args === undefined || args.length === 0) {
    return;
  }
  const values = new Map<string, ValueNode>();
  for (const { name, value } of args) {
    values.set(name.value, value);
  }
  return {
    nodes: args,
    values,
  };
}
// Compare names and source values once per field pair. Retain only values
// containing variables, whose meaning can differ between fragment scopes.
function compareArguments(
  ruleContext: RuleContext,
  argumentInfo1: ArgumentInfo | undefined,
  argumentInfo2: ArgumentInfo | undefined,
): ArgumentComparison {
  const valuesWithVariables: Array<ValueInfo> = [];
  if (argumentInfo1 === undefined) {
    return {
      sameStructure: argumentInfo2 === undefined,
      valuesWithVariables,
    };
  }
  if (argumentInfo1.nodes.length !== argumentInfo2?.nodes.length) {
    return { sameStructure: false, valuesWithVariables };
  }
  for (const arg1 of argumentInfo1.nodes) {
    // A prepared argument list can participate in many field-pair comparisons.
    spendComplexityBudget(ruleContext, 1);
    const value2 = argumentInfo2.values.get(arg1.name.value);
    if (value2 === undefined) {
      return { sameStructure: false, valuesWithVariables };
    }
    const valueInfo1 = getValueInfo(ruleContext, arg1.value);
    if (
      valueInfo1.comparisonKey !==
      getValueInfo(ruleContext, value2).comparisonKey
    ) {
      return { sameStructure: false, valuesWithVariables };
    }
    if (valueInfo1.variables.length !== 0) {
      valuesWithVariables.push(valueInfo1);
    }
  }
  return { sameStructure: true, valuesWithVariables };
}
function sameArguments(
  ruleContext: RuleContext,
  comparison: ArgumentComparison,
  scope1: VariableScope | undefined,
  scope2: VariableScope | undefined,
): boolean {
  if (!comparison.sameStructure) {
    return false;
  }
  // Equal expressions refer to the same variables within a scope. Across scopes,
  // they agree only when every reference is an operation variable.
  return (
    scope1 === scope2 ||
    comparison.valuesWithVariables.every((value) => {
      // Different scope pairs can revisit the same prepared values.
      spendComplexityBudget(ruleContext, 1);
      return (
        !usesLocalVariables(ruleContext, value, scope1) &&
        !usesLocalVariables(ruleContext, value, scope2)
      );
    })
  );
}
interface ValueInfo {
  comparisonKey: string;
  variables: ReadonlyArray<string>;
  scopeDependencies?: Map<FragmentSignature, boolean>;
}
function usesLocalVariables(
  ruleContext: RuleContext,
  value: ValueInfo,
  scope: VariableScope | undefined,
): boolean {
  if (scope === undefined) {
    return false;
  }
  // Declaration membership does not depend on the fragment arguments.
  const dependencies = (value.scopeDependencies ??= new Map());
  const cached = dependencies.get(scope.signature);
  if (cached !== undefined) {
    return cached;
  }
  const dependsOnScope = value.variables.some((variable) => {
    // A source value can be checked in several declaration contexts.
    spendComplexityBudget(ruleContext, 1);
    return scope.signature.variableDefinitions.has(variable);
  });
  dependencies.set(scope.signature, dependsOnScope);
  return dependsOnScope;
}
// Keep variable names in the representation and compare their scopes separately.
function getValueInfo(ruleContext: RuleContext, value: ValueNode): ValueInfo {
  const cached = ruleContext.valueInfoByNode.get(value);
  if (cached !== undefined) {
    return cached;
  }
  const variables: Array<string> = [];
  const comparisonKey = JSON.stringify(value, (_key, node: unknown) => {
    if (!isNode(node)) {
      return node;
    }
    switch (node.kind) {
      case Kind.VARIABLE:
        variables.push(node.name.value);
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
  const valueInfo = { comparisonKey, variables };
  ruleContext.valueInfoByNode.set(value, valueInfo);
  return valueInfo;
}
// Two types conflict if both types could not apply to a value simultaneously.
// Composite types are ignored as their individual field types will be compared
// later recursively. However List and Non-Null types must match.
function doTypesConflict(
  type1: GraphQLOutputType,
  type2: GraphQLOutputType,
): boolean {
  if (type1 === type2) {
    return false;
  }
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
// Share source fields across scopes; only resolving spreads depends on the scope.
function collectFields(
  validationContext: ValidationContext,
  ruleContext: RuleContext,
  parentType: Maybe<GraphQLNamedType>,
  selectionSet: SelectionSetNode,
): CollectFieldsResult {
  const { cachedCollectFieldsResults } = ruleContext;
  // A programmatically built document can share a selection-set object between
  // different parent types; their field definitions must not share a cache entry.
  let bySelectionSet = cachedCollectFieldsResults.get(parentType);
  if (!bySelectionSet) {
    bySelectionSet = new Map();
    cachedCollectFieldsResults.set(parentType, bySelectionSet);
  }
  let collectFieldsResult = bySelectionSet.get(selectionSet);
  if (!collectFieldsResult) {
    const groupedFieldSet: GroupedFieldSet = new Map();
    const spreads: Array<FragmentSpreadNode> = [];
    collectFieldsImpl(
      validationContext,
      parentType,
      selectionSet,
      groupedFieldSet,
      spreads,
    );
    collectFieldsResult = { groupedFieldSet, spreads };
    bySelectionSet.set(selectionSet, collectFieldsResult);
  }
  return collectFieldsResult;
}
// Given a reference to a fragment, return the represented collection of fields
// as well as a list of nested fragment spreads referenced via fragment spreads.
function collectFragmentFields(
  validationContext: ValidationContext,
  ruleContext: RuleContext,
  fragment: FragmentDefinitionNode,
): CollectFieldsResult {
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
  parentType: Maybe<GraphQLNamedType>,
  selectionSet: SelectionSetNode,
  groupedFieldSet: GroupedFieldSet,
  fragmentSpreads: Array<FragmentSpreadNode>,
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
        let fieldDetailsList = groupedFieldSet.get(responseName);
        if (fieldDetailsList == null) {
          fieldDetailsList = [];
          groupedFieldSet.set(responseName, fieldDetailsList);
        }
        fieldDetailsList.push({
          parentType,
          node: selection,
          definition: fieldDef,
        });
        break;
      }
      case Kind.FRAGMENT_SPREAD: {
        fragmentSpreads.push(selection);
        break;
      }
      case Kind.INLINE_FRAGMENT: {
        const typeCondition = selection.typeCondition;
        const inlineFragmentType = typeCondition
          ? typeFromAST(validationContext.getSchema(), typeCondition)
          : parentType;
        collectFieldsImpl(
          validationContext,
          inlineFragmentType,
          selection.selectionSet,
          groupedFieldSet,
          fragmentSpreads,
        );
        break;
      }
    }
  }
}
// Resolve a source collection's spreads in the enclosing variable scope.
function getFragmentSpreads(
  validationContext: ValidationContext,
  ruleContext: RuleContext,
  collectFieldsResult: CollectFieldsResult,
  scope: VariableScope | undefined,
): FragmentSpreads {
  const byScope = (collectFieldsResult.byScope ??= new Map());
  const cached = byScope.get(scope);
  if (cached) {
    return cached;
  }
  const spreadsByScope = new Map<
    VariableScope | undefined,
    Map<FragmentDefinitionNode | undefined, FragmentSpread>
  >();
  const result: Array<FragmentSpread> = [];
  for (const spreadNode of collectFieldsResult.spreads) {
    const spread = getFragmentSpread(
      validationContext,
      ruleContext,
      spreadNode,
      scope,
    );
    let byDefinition = spreadsByScope.get(spread.scope);
    if (byDefinition === undefined) {
      byDefinition = new Map();
      spreadsByScope.set(spread.scope, byDefinition);
    }
    const previous = byDefinition.get(spread.definition);
    if (previous === undefined) {
      byDefinition.set(spread.definition, spread);
      result.push(spread);
    } else {
      // Keep first-occurrence order and the last occurrence's error location.
      previous.node = spread.node;
    }
  }
  byScope.set(scope, result);
  return result;
}
function getFragmentSpread(
  validationContext: ValidationContext,
  ruleContext: RuleContext,
  fragmentSpreadNode: FragmentSpreadNode,
  scope: VariableScope | undefined,
): FragmentSpread {
  // New enclosing scopes can repeat spread resolution, including cache hits.
  spendComplexityBudget(ruleContext, 1);
  let fragmentSpreadInfo =
    ruleContext.fragmentSpreadInfoByNode.get(fragmentSpreadNode);
  if (fragmentSpreadInfo === undefined) {
    const signature = validationContext.getFragmentSignatureByName()(
      fragmentSpreadNode.name.value,
    );
    const argumentInfo = getArgumentInfo(fragmentSpreadNode.arguments);
    const parts: Array<string> = [];
    const values: Array<ValueInfo> = [];
    if (signature && argumentInfo !== undefined) {
      const argMap = argumentInfo.values;
      // Order only supplied, declared arguments, once per source spread.
      const names: Array<string> = [];
      for (const name of argMap.keys()) {
        if (signature.variableDefinitions.has(name)) {
          names.push(name);
        }
      }
      for (const name of names.sort()) {
        const argument = getValueInfo(
          ruleContext,
          argMap.get(name) as ValueNode,
        );
        parts.push(name, argument.comparisonKey);
        if (argument.variables.length !== 0) {
          values.push(argument);
        }
      }
    }
    const fragmentSpreadInfoKey = JSON.stringify([
      signature?.definition.name.value,
      parts,
    ]);
    fragmentSpreadInfo = ruleContext.fragmentSpreadInfoByKey.get(
      fragmentSpreadInfoKey,
    );
    if (fragmentSpreadInfo === undefined) {
      fragmentSpreadInfo = {
        signature,
        values,
        byScope: new Map(),
      };
      ruleContext.fragmentSpreadInfoByKey.set(
        fragmentSpreadInfoKey,
        fragmentSpreadInfo,
      );
    }
    ruleContext.fragmentSpreadInfoByNode.set(
      fragmentSpreadNode,
      fragmentSpreadInfo,
    );
  }
  // The source key fixes the variable names. Any local reference identifies
  // the enclosing scope; otherwise all references are operation variables.
  const variableScope = fragmentSpreadInfo.values.some((value) => {
    // Enclosing scopes can revisit these prepared argument values.
    spendComplexityBudget(ruleContext, 1);
    return usesLocalVariables(ruleContext, value, scope);
  })
    ? scope
    : undefined;
  let fragmentScope = fragmentSpreadInfo.byScope.get(variableScope);
  if (!fragmentSpreadInfo.byScope.has(variableScope)) {
    fragmentScope = getVariableScope(fragmentSpreadInfo.signature);
    fragmentSpreadInfo.byScope.set(variableScope, fragmentScope);
  }
  return {
    node: fragmentSpreadNode,
    scope: fragmentScope,
    definition: fragmentSpreadInfo.signature?.definition,
  };
}
function getVariableScope(
  fragmentSignature: Maybe<FragmentSignature>,
): VariableScope | undefined {
  if (!fragmentSignature || fragmentSignature.variableDefinitions.size === 0) {
    return;
  }
  return { signature: fragmentSignature };
}
function getFragmentSpreadDescription(
  ruleContext: RuleContext,
  node: FragmentSpreadNode,
): string {
  const description = {
    ...node,
    name: { ...node.name, value: maybeAbbreviate(node.name.value) },
    directives: [],
  };
  // Use the cached representation's length to print only small arguments.
  let size = 1;
  for (const argument of node.arguments ?? []) {
    size +=
      2 +
      argument.name.value.length +
      getValueInfo(ruleContext, argument.value).comparisonKey.length;
    if (size > MAX_FRAGMENT_ARGUMENT_SIZE) {
      return description.name.value + '(...)';
    }
  }
  return print(description).slice(3);
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
    // Abbreviate while combining child reasons, not after expanding a whole
    // tree of conflicts.
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
  conflicts: ReadonlyArray<Conflict>,
  side: 'fields1' | 'fields2',
): Array<FieldNode> {
  const nodes = [node];
  for (const conflict of conflicts) {
    const remaining = MAX_CONFLICT_NODES - nodes.length;
    // Locations start with the enclosing field. Take from the end so that
    // truncation favors the deeper fields involved in the conflict.
    const retainedNodes = conflict[side].slice(-remaining);
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
  /* node:coverage ignore next 3 */
  if (ruleContext.remainingComplexityBudget < 0) {
    throw validationAbortedError;
  }
}
/**
 * A way to keep track of pairs of things where the ordering of the pair
 * matters.
 *
 * Provides a third argument for has/set to allow flagging the pair as
 * weakly or strongly present within the collection.
 *
 * @internal
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
 *
 * @internal
 */
class PairSet<T> {
  _orderedPairSet: OrderedPairSet<T, T>;
  constructor() {
    this._orderedPairSet = new OrderedPairSet();
  }
  has(a: T, b: T, weaklyPresent: boolean): boolean {
    return (
      this._orderedPairSet.has(a, b, weaklyPresent) ||
      this._orderedPairSet.has(b, a, weaklyPresent)
    );
  }
  add(a: T, b: T, weaklyPresent: boolean): void {
    this._orderedPairSet.add(a, b, weaklyPresent);
  }
}
