import { AccumulatorMap } from '../jsutils/AccumulatorMap.js';
import { invariant } from '../jsutils/invariant.js';
import type { ObjMap } from '../jsutils/ObjMap.js';

import type {
  FieldNode,
  FragmentDefinitionNode,
  FragmentSpreadNode,
  InlineFragmentNode,
  SelectionSetNode,
} from '../language/ast.js';
import { Kind } from '../language/kinds.js';

import type { GraphQLObjectType } from '../type/definition.js';
import { isAbstractType } from '../type/definition.js';
import {
  GraphQLDeferDirective,
  GraphQLIncludeDirective,
  GraphQLSkipDirective,
} from '../type/directives.js';
import type { GraphQLSchema } from '../type/schema.js';

import type {
  FragmentDetails,
  GroupedFieldSet,
} from '../execution/collectFields.js';
import type { ValidatedExecutionArgs } from '../execution/execute.js';
import type { VariableValues } from '../execution/values.js';
import {
  getDirectiveValues,
  getFragmentVariableValues,
} from '../execution/values.js';

import { typeFromAST } from '../utilities/typeFromAST.js';

export interface FieldDetails {
  node: FieldNode;
  fragmentVariableValues?: VariableValues | undefined;
}

interface CollectFieldsContext {
  schema: GraphQLSchema;
  fragments: ObjMap<FragmentDetails>;
  variableValues: VariableValues;
  runtimeType: GraphQLObjectType;
  visitedFragmentNames: Set<string>;
  hideSuggestions: boolean;
}

export interface GroupedFieldSetTree {
  groupedFieldSet: GroupedFieldSet;
  deferredGroupedFieldSets: Map<string, GroupedFieldSetTree>;
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
  validateExecutionArgs: ValidatedExecutionArgs,
  runtimeType: GraphQLObjectType,
  selectionSet: SelectionSetNode,
): GroupedFieldSetTree {
  const context: CollectFieldsContext = {
    ...validateExecutionArgs,
    runtimeType,
    visitedFragmentNames: new Set(),
  };

  const groupedFieldSet = new AccumulatorMap<string, FieldDetails>();
  const deferredGroupedFieldSets = new Map<string, GroupedFieldSetTree>();
  collectFieldsImpl(
    context,
    selectionSet,
    groupedFieldSet,
    deferredGroupedFieldSets,
  );
  return { groupedFieldSet, deferredGroupedFieldSets };
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
export function collectSubfields(
  validatedExecutionArgs: ValidatedExecutionArgs,
  returnType: GraphQLObjectType,
  fieldDetailsList: ReadonlyArray<FieldDetails>,
): GroupedFieldSetTree {
  const context: CollectFieldsContext = {
    ...validatedExecutionArgs,
    runtimeType: returnType,
    visitedFragmentNames: new Set(),
  };
  const groupedFieldSet = new AccumulatorMap<string, FieldDetails>();
  const deferredGroupedFieldSets = new Map<string, GroupedFieldSetTree>();

  for (const fieldDetail of fieldDetailsList) {
    const selectionSet = fieldDetail.node.selectionSet;
    if (selectionSet) {
      const { fragmentVariableValues } = fieldDetail;
      collectFieldsImpl(
        context,
        selectionSet,
        groupedFieldSet,
        deferredGroupedFieldSets,
        fragmentVariableValues,
      );
    }
  }

  return { groupedFieldSet, deferredGroupedFieldSets };
}

function collectFieldsImpl(
  context: CollectFieldsContext,
  selectionSet: SelectionSetNode,
  groupedFieldSet: AccumulatorMap<string, FieldDetails>,
  deferredGroupedFieldSets: Map<string, GroupedFieldSetTree>,
  fragmentVariableValues?: VariableValues,
): void {
  const {
    schema,
    fragments,
    variableValues,
    runtimeType,
    visitedFragmentNames,
    hideSuggestions,
  } = context;

  for (const selection of selectionSet.selections) {
    switch (selection.kind) {
      case Kind.FIELD: {
        if (
          !shouldIncludeNode(selection, variableValues, fragmentVariableValues)
        ) {
          continue;
        }
        groupedFieldSet.add(getFieldEntryKey(selection), {
          node: selection,
          fragmentVariableValues,
        });
        break;
      }
      case Kind.INLINE_FRAGMENT: {
        const deferLabel = isDeferred(selection);
        if (deferLabel !== undefined) {
          const deferredGroupedFieldSet = new AccumulatorMap<
            string,
            FieldDetails
          >();
          const nestedDeferredGroupedFieldSets = new Map<
            string,
            GroupedFieldSetTree
          >();
          collectFieldsImpl(
            context,
            selection.selectionSet,
            deferredGroupedFieldSet,
            nestedDeferredGroupedFieldSets,
          );
          deferredGroupedFieldSets.set(deferLabel, {
            groupedFieldSet: deferredGroupedFieldSet,
            deferredGroupedFieldSets: nestedDeferredGroupedFieldSets,
          });
          continue;
        }

        if (
          !shouldIncludeNode(
            selection,
            variableValues,
            fragmentVariableValues,
          ) ||
          !doesFragmentConditionMatch(schema, selection, runtimeType)
        ) {
          continue;
        }

        collectFieldsImpl(
          context,
          selection.selectionSet,
          groupedFieldSet,
          deferredGroupedFieldSets,
          fragmentVariableValues,
        );

        break;
      }
      case Kind.FRAGMENT_SPREAD: {
        const fragName = selection.name.value;

        if (
          visitedFragmentNames.has(fragName) ||
          !shouldIncludeNode(selection, variableValues, fragmentVariableValues)
        ) {
          continue;
        }

        const fragment = fragments[fragName];
        if (
          fragment == null ||
          !doesFragmentConditionMatch(schema, fragment.definition, runtimeType)
        ) {
          continue;
        }

        const deferLabel = isDeferred(selection);
        if (deferLabel !== undefined) {
          const deferredGroupedFieldSet = new AccumulatorMap<
            string,
            FieldDetails
          >();
          const nestedDeferredGroupedFieldSets = new Map<
            string,
            GroupedFieldSetTree
          >();
          collectFieldsImpl(
            context,
            fragment.definition.selectionSet,
            deferredGroupedFieldSet,
            nestedDeferredGroupedFieldSets,
          );
          deferredGroupedFieldSets.set(deferLabel, {
            groupedFieldSet: deferredGroupedFieldSet,
            deferredGroupedFieldSets: nestedDeferredGroupedFieldSets,
          });
          continue;
        }

        const fragmentVariableSignatures = fragment.variableSignatures;
        let newFragmentVariableValues: VariableValues | undefined;
        if (fragmentVariableSignatures) {
          newFragmentVariableValues = getFragmentVariableValues(
            selection,
            fragmentVariableSignatures,
            variableValues,
            fragmentVariableValues,
            hideSuggestions,
          );
        }

        visitedFragmentNames.add(fragName);
        collectFieldsImpl(
          context,
          fragment.definition.selectionSet,
          groupedFieldSet,
          deferredGroupedFieldSets,
          newFragmentVariableValues,
        );
        break;
      }
    }
  }
}

/**
 * Determines if a field should be included based on the `@include` and `@skip`
 * directives, where `@skip` has higher precedence than `@include`.
 */
function shouldIncludeNode(
  node: FragmentSpreadNode | FieldNode | InlineFragmentNode,
  variableValues: VariableValues,
  fragmentVariableValues: VariableValues | undefined,
): boolean {
  const skip = getDirectiveValues(
    GraphQLSkipDirective,
    node,
    variableValues,
    fragmentVariableValues,
  );
  if (skip?.if === true) {
    return false;
  }

  const include = getDirectiveValues(
    GraphQLIncludeDirective,
    node,
    variableValues,
    fragmentVariableValues,
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

/**
 * Implements the logic to check if a fragment annotated with the `@defer`
 * directive has been actually deferred or inlined.
 */
function isDeferred(
  selection: FragmentSpreadNode | InlineFragmentNode,
): string | undefined {
  const deferDirective = selection.directives?.find(
    (directive) => directive.name.value === GraphQLDeferDirective.name,
  );
  if (!deferDirective) {
    return;
  }
  const labelArg = deferDirective.arguments?.find(
    (arg) => arg.name.value === 'label',
  );
  invariant(labelArg != null);
  const labelValue = labelArg.value;
  invariant(labelValue.kind === Kind.STRING);
  return labelValue.value;
}
