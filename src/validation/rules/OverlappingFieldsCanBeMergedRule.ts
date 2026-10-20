/** @category Validation Rules */

import { inspect } from '../../jsutils/inspect.ts';
import type { Maybe } from '../../jsutils/Maybe.ts';
import { SetMap } from '../../jsutils/SetMap.ts';

import { GraphQLError } from '../../error/GraphQLError.ts';

import type {
  ArgumentNode,
  ASTNode,
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
import { BREAK } from '../../language/visitor.ts';

import type {
  GraphQLField,
  GraphQLNamedType,
  GraphQLObjectType,
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

// Keep diagnostic detail bounded independently of document size.
const MAX_CONFLICT_DETAIL_LENGTH = 1000;
const MAX_FRAGMENT_ARGUMENT_SIZE = 256;

// Meter work that can grow through repeated comparisons and fragment scopes.
// Collecting a selection set's fields is shared across scopes and is not charged.
const MAX_COMPLEXITY_BUDGET = 500_000;
const conflictReported = new Error('Conflict reported.');

/**
 * Overlapping fields can be merged
 *
 * A selection set is only valid if all fields (including spreading any
 * fragments) either correspond to distinct response names or can be merged
 * without ambiguity.
 * Reports the first conflicting pair, at the conflicting nodes themselves.
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
 * ]);
 *
 * validErrors; // => []
 * ```
 */
export function OverlappingFieldsCanBeMergedRule(
  validationContext: ValidationContext,
): ASTVisitor {
  const ruleContext: RuleContext = {
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
      const collection = collectFields(
        validationContext,
        ruleContext,
        validationContext.getParentType(),
        selectionSet,
      );
      // Children and fragment definitions are visited independently. With no
      // peers here, there is nothing to merge at this response level.
      if (!collection.needsComparison) {
        return;
      }
      const scoped = getScopedFields(collection, fragmentScope);
      try {
        checkFieldsCanMerge(validationContext, ruleContext, scoped);
      } catch (error) {
        if (error !== conflictReported) {
          throw error;
        }
        // Stop only this rule after its first conflict; other rules continue.
        return BREAK;
      }
    },
  };
}

// A field node and its definition in the parent-type context.
interface FieldDetails {
  parentType: Maybe<GraphQLNamedType>;
  node: FieldNode;
  definition: Maybe<GraphQLField<unknown, unknown>>;
  scope?: VariableScope;
  info?: FieldInfo;
}
interface FieldInfo {
  comparisons?: Map<FieldInfo, FieldComparison>;
  arguments: ArgumentInfo | undefined;
  hasStream: boolean;
  streamArguments: ArgumentInfo | undefined;
}
interface FieldComparison {
  sameName?: boolean;
  arguments?: ArgumentComparison;
}
// A boolean is a scope-independent result; otherwise check these values' bindings.
type ArgumentComparison = ReadonlyArray<ValueInfo> | boolean;
type FieldDetailsList = Array<FieldDetails>;
type GroupedFieldSet = Map<string, FieldDetailsList>;
// Equivalent fragment uses share a scope. The signature identifies declarations;
// object identity distinguishes argument bindings.
interface VariableScope {
  signature: FragmentSignature;
}
interface FragmentSpread {
  node: FragmentSpreadNode;
  scope: VariableScope | undefined;
  definition: FragmentDefinitionNode | undefined;
}
type FragmentSpreadKey = VariableScope | FragmentDefinitionNode | undefined;
type FragmentSpreads = ReadonlyArray<FragmentSpread>;

interface CollectFieldsResult extends FieldSetState {
  groupedFieldSet: GroupedFieldSet;
  spreads: ReadonlyArray<FragmentSpreadNode>;
  needsComparison: boolean;
  scope?: VariableScope;
  byScope?: Map<VariableScope, CollectFieldsResult>;
  resolvedSpreads?: FragmentSpreads;
}
type FieldSet = CollectFieldsResult | MergedFieldSet;
interface MergedFieldSet extends FieldSetState {
  sets: ReadonlySet<CollectFieldsResult>;
}
interface FieldSetState {
  fields?: GroupedFieldSet;
  responseShape?: boolean;
  checked?: boolean;
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
  fieldInfoByNode?: Map<FieldNode, FieldInfo>;
  cachedCollectFieldsResults: Map<
    Maybe<GraphQLNamedType>,
    Map<SelectionSetNode, CollectFieldsResult>
  >;
  valueInfoByNode: Map<ValueNode, ValueInfo>;
  fragmentSpreadInfoByNode: Map<FragmentSpreadNode, FragmentSpreadInfo>;
  fragmentSpreadInfoByKey: Map<string, FragmentSpreadInfo>;
  mergeChecks?: SetMap<CollectFieldsResult, MergedFieldSet>;
  remainingComplexityBudget: number;
}

// Sangria's set-based algorithm checks groups instead of every field pair:
// https://github.com/graphql/graphql-js/issues/2185
//
// Collect direct fields and inline fragments once per selection set and parent
// type. When a comparison needs named fragments, expand their scoped collections
// at this response level and group the resulting fields by response name.
//
// Check names and arguments among parents that can overlap, and response shapes
// across every parent. Merge each common-parent group's children before checking
// them. If there are several concrete parent groups, also check their combined
// children for response shape alone: names and arguments may differ across those
// mutually exclusive parents. Otherwise the common-parent recursion already
// checks the entire child set, including its response shape.
// Equality checks need only one representative; child selections need every member.
//
// Cache the walks by their sets of scoped source collections. The complexity
// budget still bounds distinct merged states and repeated expansion: caching
// sets alone does not make that work linear. Report the first conflicting pair
// directly, without a second walk to reconstruct ancestry paths.
function getScopedFields(
  collection: CollectFieldsResult,
  scope: VariableScope | undefined,
): CollectFieldsResult {
  // The source collection is already the unbound instance. Only fragment
  // arguments require a separate record; its source fields remain shared.
  if (scope === undefined) {
    return collection;
  }
  const byScope = (collection.byScope ??= new Map());
  let scoped = byScope.get(scope);
  if (scoped === undefined) {
    scoped = {
      groupedFieldSet: collection.groupedFieldSet,
      spreads: collection.spreads,
      needsComparison: collection.needsComparison,
      scope,
    };
    byScope.set(scope, scoped);
  }
  return scoped;
}

function checkResponseShape(
  validationContext: ValidationContext,
  ruleContext: RuleContext,
  check: FieldSet,
): void {
  if (check.responseShape) {
    return;
  }
  // Mark before descending so invalid fragment cycles do not recurse forever.
  check.responseShape = true;
  for (const fields of getMergedFields(
    validationContext,
    ruleContext,
    check,
  ).values()) {
    // A lone field's own selection set is visited independently.
    if (fields.length === 1) {
      continue;
    }
    checkFieldResponseShapes(validationContext, ruleContext, fields);
    const children = getMergedChildren(validationContext, ruleContext, fields);
    if (children) {
      checkResponseShape(validationContext, ruleContext, children);
    }
  }
}

function checkFieldResponseShapes(
  validationContext: ValidationContext,
  ruleContext: RuleContext,
  fields: ReadonlyArray<FieldDetails>,
): void {
  let knownField: FieldDetails | undefined;
  for (const field of fields) {
    // Fields can participate in several distinct merged groups.
    spendComplexityBudget(ruleContext, 1);
    const info = getFieldInfo(ruleContext, field);
    if (info.hasStream) {
      const other = field === fields[0] ? fields[1] : fields[0];
      const otherInfo = getFieldInfo(ruleContext, other);
      let reason = 'they have overlapping stream directives';
      if (
        otherInfo.hasStream &&
        sameArguments(
          ruleContext,
          compareArguments(
            ruleContext,
            info.streamArguments,
            otherInfo.streamArguments,
          ),
          field.scope,
          other.scope,
        )
      ) {
        reason +=
          '. See https://github.com/graphql/defer-stream-wg/discussions/100';
      }
      reportFieldConflict(
        validationContext,
        fields[0],
        field === fields[0] ? other : field,
        reason,
      );
    }
    const type = field.definition?.type;
    if (type !== undefined) {
      const knownType = knownField?.definition?.type;
      if (knownType !== undefined && doTypesConflict(knownType, type)) {
        reportFieldConflict(
          validationContext,
          knownField as FieldDetails,
          field,
          `they return conflicting types "${inspect(knownType)}" and "${inspect(type)}"`,
        );
      }
      knownField = field;
    }
  }
}

function getMergedFields(
  validationContext: ValidationContext,
  ruleContext: RuleContext,
  check: FieldSet,
): GroupedFieldSet {
  if (check.fields !== undefined) {
    return check.fields;
  }
  // With no binding or expansion, the collected map is already complete.
  if (
    'groupedFieldSet' in check &&
    check.scope === undefined &&
    check.spreads.length === 0
  ) {
    check.fields = check.groupedFieldSet;
    return check.fields;
  }
  const groups: GroupedFieldSet = new Map();
  // Expand each scoped source once at this response level. Parameterized
  // fragments also need a binding check, even when all their fields agree.
  const pending = new Set('sets' in check ? check.sets : [check]);
  let boundFragments: Map<FragmentDefinitionNode, FragmentSpread> | undefined;
  for (const collection of pending) {
    const { scope } = collection;
    for (const [name, fields] of collection.groupedFieldSet) {
      let group = groups.get(name);
      if (group === undefined) {
        group = [];
        groups.set(name, group);
      }
      for (const details of fields) {
        if (pending.size > 1 || scope !== undefined) {
          // Merges and bound fragment uses can revisit a source field.
          spendComplexityBudget(ruleContext, 1);
        }
        group.push(scope === undefined ? details : { ...details, scope });
      }
    }
    if (collection.spreads.length === 0) {
      continue;
    }
    for (const spread of getFragmentSpreads(
      validationContext,
      ruleContext,
      collection,
    )) {
      // Each merge can revisit the same fragment references, including hits.
      spendComplexityBudget(ruleContext, 1);
      const definition = spread.definition;
      if (definition === undefined) {
        continue;
      }
      // Without parameters, the pending set already identifies each fragment.
      if (spread.scope !== undefined) {
        const previous = (boundFragments ??= new Map()).get(definition);
        if (previous !== undefined && previous.scope !== spread.scope) {
          reportConflict(
            validationContext,
            previous.node,
            spread.node,
            `Spreads "${maybeAbbreviate(spread.node.name.value)}" conflict because ${getFragmentSpreadDescription(ruleContext, previous.node)} and ${getFragmentSpreadDescription(ruleContext, spread.node)} have different fragment arguments.`,
          );
        }
        boundFragments.set(definition, spread);
      }
      pending.add(
        getScopedFields(
          collectFragmentFields(validationContext, ruleContext, definition),
          spread.scope,
        ),
      );
    }
  }
  check.fields = groups;
  return groups;
}

function getMergedChildren(
  validationContext: ValidationContext,
  ruleContext: RuleContext,
  fields: ReadonlyArray<FieldDetails>,
): FieldSet | undefined {
  let sets: Set<CollectFieldsResult> | undefined;
  for (const field of fields) {
    // The completed group comparison already charged for these members.
    if (field.node.selectionSet !== undefined) {
      (sets ??= new Set()).add(
        getScopedFields(
          collectFields(
            validationContext,
            ruleContext,
            getNamedType(field.definition?.type),
            field.node.selectionSet,
          ),
          field.scope,
        ),
      );
    }
  }
  if (sets === undefined) {
    return;
  }
  if (sets.size === 1) {
    return sets.values().next().value;
  }
  // Charge one unit per collection, including repeated merge-cache lookups.
  spendComplexityBudget(ruleContext, sets.size);
  const checks = (ruleContext.mergeChecks ??= new SetMap());
  return checks.getOrInsert(sets, { sets });
}

function checkFieldsCanMerge(
  validationContext: ValidationContext,
  ruleContext: RuleContext,
  check: FieldSet,
): void {
  if (check.checked) {
    return;
  }
  check.checked = true;
  const shapeAlreadyChecked = check.responseShape;
  check.responseShape = true;
  for (const fields of getMergedFields(
    validationContext,
    ruleContext,
    check,
  ).values()) {
    if (fields.length === 1) {
      continue;
    }
    // Distinct object parents cannot overlap. Abstract or unknown parents may
    // overlap every object group, so include their fields in each one. Walking
    // these groups separately preserves exclusivity inherited from ancestors.
    const abstract = new Array<FieldDetails>();
    const concrete = new Map<GraphQLObjectType, Array<FieldDetails>>();
    for (const field of fields) {
      const parentType = field.parentType;
      if (isObjectType(parentType)) {
        let group = concrete.get(parentType);
        if (group === undefined) {
          group = [];
          concrete.set(parentType, group);
        }
        group.push(field);
      } else {
        // Unknown parents retain the conservative overlap behavior.
        abstract.push(field);
      }
    }
    const commonGroups = concrete.size === 0 ? [abstract] : concrete.values();
    for (const concreteGroup of commonGroups) {
      checkCommonParentFields(
        validationContext,
        ruleContext,
        concreteGroup,
        concrete.size === 0 ? [] : abstract,
      );
    }
    if (!shapeAlreadyChecked) {
      checkFieldResponseShapes(validationContext, ruleContext, fields);
      if (concrete.size > 1) {
        const children = getMergedChildren(
          validationContext,
          ruleContext,
          fields,
        );
        if (children) {
          checkResponseShape(validationContext, ruleContext, children);
        }
      }
    }
  }
}

function checkCommonParentFields(
  validationContext: ValidationContext,
  ruleContext: RuleContext,
  group: ReadonlyArray<FieldDetails>,
  shared: ReadonlyArray<FieldDetails>,
): void {
  if (group.length + shared.length === 1) {
    return;
  }
  const first = group[0];
  const fieldInfo1 = getFieldInfo(ruleContext, first);
  for (const fields of [group, shared]) {
    for (const field of fields) {
      if (field === first) {
        continue;
      }
      // Equality within each common-parent group needs only a representative.
      spendComplexityBudget(ruleContext, 2);
      const fieldInfo2 = getFieldInfo(ruleContext, field);
      // Source comparisons are shared across merged sets and bindings.
      const comparisons = (fieldInfo1.comparisons ??= new Map());
      let comparison = comparisons.get(fieldInfo2);
      if (comparison === undefined) {
        comparison = {};
        comparisons.set(fieldInfo2, comparison);
      }
      const name1 = first.node.name.value;
      const name2 = field.node.name.value;
      if (!(comparison.sameName ??= name1 === name2)) {
        reportFieldConflict(
          validationContext,
          first,
          field,
          `"${maybeAbbreviate(name1)}" and "${maybeAbbreviate(name2)}" are different fields`,
        );
      }
      if (
        !sameArguments(
          ruleContext,
          (comparison.arguments ??= compareArguments(
            ruleContext,
            fieldInfo1.arguments,
            fieldInfo2.arguments,
          )),
          first.scope,
          field.scope,
        )
      ) {
        reportFieldConflict(
          validationContext,
          first,
          field,
          'they have differing arguments',
        );
      }
    }
  }
  // Copy only after every member was checked and charged. A failed comparison
  // must not copy a large shared group before it can stop.
  const children = getMergedChildren(
    validationContext,
    ruleContext,
    shared.length === 0 ? group : group.concat(shared),
  );
  if (children) {
    checkFieldsCanMerge(validationContext, ruleContext, children);
  }
}

// Report one witness with its two locations, without rebuilding ancestry paths.
function reportFieldConflict(
  validationContext: ValidationContext,
  first: FieldDetails,
  second: FieldDetails,
  reason: string,
): never {
  const node = first.node;
  const responseName = node.alias?.value ?? node.name.value;
  reportConflict(
    validationContext,
    node,
    second.node,
    `Fields "${maybeAbbreviate(responseName)}" conflict because ${reason}. Use different aliases on the fields or their ancestors to fetch both if this was intentional.`,
  );
}

function reportConflict(
  validationContext: ValidationContext,
  first: ASTNode,
  second: ASTNode,
  message: string,
): never {
  validationContext.reportError(
    new GraphQLError(message, { nodes: [first, second] }),
  );
  throw conflictReported;
}

// Prepare argument and directive lookups only when a field overlaps.
function getFieldInfo(
  ruleContext: RuleContext,
  fieldDetails: FieldDetails,
): FieldInfo {
  if (fieldDetails.info !== undefined) {
    return fieldDetails.info;
  }
  const node = fieldDetails.node;
  const byNode = (ruleContext.fieldInfoByNode ??= new Map());
  let info = byNode.get(node);
  if (info === undefined) {
    const stream = node.directives?.find(
      (directive) => directive.name.value === 'stream',
    );
    info = {
      arguments: getArgumentInfo(node.arguments),
      hasStream: stream !== undefined,
      streamArguments: getArgumentInfo(stream?.arguments),
    };
    byNode.set(node, info);
  }
  return (fieldDetails.info = info);
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
// containing variables, whose bindings can differ between fragment uses.
function compareArguments(
  ruleContext: RuleContext,
  argumentInfo1: ArgumentInfo | undefined,
  argumentInfo2: ArgumentInfo | undefined,
): ArgumentComparison {
  if (argumentInfo1 === undefined) {
    return argumentInfo2 === undefined;
  }
  if (argumentInfo1.nodes.length !== argumentInfo2?.nodes.length) {
    return false;
  }
  const comparedValues: Array<ValueInfo> = [];
  for (const arg1 of argumentInfo1.nodes) {
    // A prepared argument list can participate in many field-pair comparisons.
    spendComplexityBudget(ruleContext, 1);
    const value2 = argumentInfo2.values.get(arg1.name.value);
    if (value2 === undefined) {
      return false;
    }
    const valueInfo1 = getValueInfo(ruleContext, arg1.value);
    if (
      valueInfo1.comparisonKey !==
      getValueInfo(ruleContext, value2).comparisonKey
    ) {
      return false;
    }
    if (valueInfo1.variables.length !== 0) {
      comparedValues.push(valueInfo1);
    }
  }
  return comparedValues;
}

function sameArguments(
  ruleContext: RuleContext,
  comparison: ArgumentComparison,
  scope1: VariableScope | undefined,
  scope2: VariableScope | undefined,
): boolean {
  if (typeof comparison === 'boolean') {
    return comparison;
  }
  // Equal expressions have equal bindings in the same scope. Across scopes,
  // they agree only when every reference is an operation variable.
  return (
    scope1 === scope2 ||
    comparison.every((value) => {
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
  // Only declaration membership matters; different bindings share this answer.
  const dependencies = (value.scopeDependencies ??= new Map());
  let dependsOnScope = dependencies.get(scope.signature);
  if (dependsOnScope === undefined) {
    dependsOnScope = value.variables.some((variable) => {
      // A source value can be checked in several declaration contexts.
      spendComplexityBudget(ruleContext, 1);
      return scope.signature.variableDefinitions.has(variable);
    });
    dependencies.set(scope.signature, dependsOnScope);
  }
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
    let needsComparison =
      spreads.length > 1 ||
      (spreads.length === 1 && groupedFieldSet.size !== 0);
    for (const fields of groupedFieldSet.values()) {
      if (fields.length > 1) {
        needsComparison = true;
        break;
      }
    }
    collectFieldsResult = { groupedFieldSet, spreads, needsComparison };
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
): FragmentSpreads {
  const cached = collectFieldsResult.resolvedSpreads;
  if (cached) {
    return cached;
  }

  const fragmentSpreads = new Map<FragmentSpreadKey, FragmentSpread>();
  for (const spreadNode of collectFieldsResult.spreads) {
    const spread = getFragmentSpread(
      validationContext,
      ruleContext,
      spreadNode,
      collectFieldsResult.scope,
    );
    fragmentSpreads.set(getFragmentSpreadKey(spread), spread);
  }
  const result = Array.from(fragmentSpreads.values());
  collectFieldsResult.resolvedSpreads = result;
  return result;
}

// Bound scopes identify distinct argument bindings. Without local variables,
// the definition itself identifies the fragment, independently of spread nodes.
function getFragmentSpreadKey(spread: FragmentSpread): FragmentSpreadKey {
  return spread.scope ?? spread.definition;
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
