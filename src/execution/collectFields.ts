import { AccumulatorMap } from '../jsutils/AccumulatorMap.js';
import type { ObjMap } from '../jsutils/ObjMap.js';

import type {
  DirectiveNode,
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

import { typeFromAST } from '../utilities/typeFromAST.js';

import type { GraphQLVariableSignature } from './getVariableSignature.js';
import type { VariableValues } from './values.js';
import {
  experimentalGetArgumentValues,
  getDirectiveValues,
  getFragmentVariableValues,
} from './values.js';

export interface DeferUsage {
  label: string | undefined;
  parentDeferUsage: DeferUsage | undefined;
}

export interface FieldDetails {
  node: FieldNode;
  deferUsage?: DeferUsage | undefined;
  fragmentVariableValues?: VariableValues | undefined;
}

export type FieldDetailsList = ReadonlyArray<FieldDetails>;

export type GroupedFieldSet = ReadonlyMap<string, FieldDetailsList>;

export interface FragmentDetails {
  definition: FragmentDefinitionNode;
  variableSignatures?: ObjMap<GraphQLVariableSignature> | undefined;
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
// eslint-disable-next-line @typescript-eslint/max-params
export function collectFields(
  schema: GraphQLSchema,
  fragments: ObjMap<FragmentDetails>,
  variableValues: VariableValues,
  runtimeType: GraphQLObjectType,
  selectionSet: SelectionSetNode,
  hideSuggestions: boolean,
  forbidSkipAndInclude = false,
): {
  groupedFieldSet: GroupedFieldSet;
  newDeferUsages: ReadonlyArray<DeferUsage>;
  forbiddenDirectiveInstances: ReadonlyArray<DirectiveNode>;
} {
  const groupedFieldSet = new AccumulatorMap<string, FieldDetails>();
  const newDeferUsages: Array<DeferUsage> = [];
  const forbiddenDirectiveInstances: Array<DirectiveNode> = [];

  const selectionSetVisitor = buildSelectionSetVisitor(
    schema,
    fragments,
    variableValues,
    runtimeType,
    hideSuggestions,
    forbidSkipAndInclude,
    groupedFieldSet,
    newDeferUsages,
    forbiddenDirectiveInstances,
  );

  selectionSetVisitor(selectionSet);

  return {
    groupedFieldSet,
    newDeferUsages,
    forbiddenDirectiveInstances,
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
// eslint-disable-next-line @typescript-eslint/max-params
export function collectSubfields(
  schema: GraphQLSchema,
  fragments: ObjMap<FragmentDetails>,
  variableValues: VariableValues,
  returnType: GraphQLObjectType,
  fieldDetailsList: FieldDetailsList,
  hideSuggestions: boolean,
): {
  groupedFieldSet: GroupedFieldSet;
  newDeferUsages: ReadonlyArray<DeferUsage>;
} {
  const subGroupedFieldSet = new AccumulatorMap<string, FieldDetails>();
  const newDeferUsages: Array<DeferUsage> = [];

  const selectionSetVisitor = buildSelectionSetVisitor(
    schema,
    fragments,
    variableValues,
    returnType,
    hideSuggestions,
    false,
    subGroupedFieldSet,
    newDeferUsages,
    [],
  );

  for (const fieldDetail of fieldDetailsList) {
    const selectionSet = fieldDetail.node.selectionSet;
    if (selectionSet) {
      const { deferUsage, fragmentVariableValues } = fieldDetail;
      selectionSetVisitor(selectionSet, deferUsage, fragmentVariableValues);
    }
  }

  return {
    groupedFieldSet: subGroupedFieldSet,
    newDeferUsages,
  };
}

// eslint-disable-next-line @typescript-eslint/max-params
function buildSelectionSetVisitor(
  schema: GraphQLSchema,
  fragments: ObjMap<FragmentDetails>,
  variableValues: VariableValues,
  runtimeType: GraphQLObjectType,
  hideSuggestions: boolean,
  forbidSkipAndInclude: boolean,
  groupedFieldSet: AccumulatorMap<string, FieldDetails>,
  newDeferUsages: Array<DeferUsage>,
  forbiddenDirectiveInstances: Array<DirectiveNode>,
): (
  node: SelectionSetNode,
  deferUsage?: DeferUsage,
  fragmentVariableValues?: VariableValues,
) => void {
  const visitedFragmentNames = new Set<string>();

  function selectionSetVisitor(
    selectionSet: SelectionSetNode,
    deferUsage?: DeferUsage,
    fragmentVariableValues?: VariableValues,
  ): void {
    for (const selection of selectionSet.selections) {
      switch (selection.kind) {
        case Kind.FIELD: {
          if (!shouldIncludeNode(selection)) {
            continue;
          }
          groupedFieldSet.add(getFieldEntryKey(selection), {
            node: selection,
            deferUsage,
            fragmentVariableValues,
          });
          break;
        }
        case Kind.INLINE_FRAGMENT: {
          if (
            !shouldIncludeNode(selection) ||
            !doesFragmentConditionMatch(selection)
          ) {
            continue;
          }

          const newDeferUsage = getDeferUsage(selection);

          if (!newDeferUsage) {
            selectionSetVisitor(
              selection.selectionSet,
              deferUsage,
              fragmentVariableValues,
            );
          } else {
            newDeferUsages.push(newDeferUsage);
            selectionSetVisitor(
              selection.selectionSet,
              newDeferUsage,
              fragmentVariableValues,
            );
          }
          break;
        }
        case Kind.FRAGMENT_SPREAD: {
          const fragName = selection.name.value;

          if (
            visitedFragmentNames.has(fragName) ||
            !shouldIncludeNode(selection)
          ) {
            continue;
          }

          const fragment = fragments[fragName];
          if (
            fragment == null ||
            !doesFragmentConditionMatch(fragment.definition)
          ) {
            continue;
          }

          const newDeferUsage = getDeferUsage(selection);

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

          if (!newDeferUsage) {
            visitedFragmentNames.add(fragName);
            selectionSetVisitor(
              fragment.definition.selectionSet,
              deferUsage,
              newFragmentVariableValues,
            );
          } else {
            newDeferUsages.push(newDeferUsage);
            selectionSetVisitor(
              fragment.definition.selectionSet,
              newDeferUsage,
              newFragmentVariableValues,
            );
          }
          break;
        }
      }
    }

    /**
     * Returns an object containing the `@defer` arguments if a field should be
     * deferred based on the experimental flag, defer directive present and
     * not disabled by the "if" argument.
     */
    function getDeferUsage(
      node: FragmentSpreadNode | InlineFragmentNode,
    ): DeferUsage | undefined {
      const defer = getDirectiveValues(
        GraphQLDeferDirective,
        node,
        variableValues,
        fragmentVariableValues,
      );

      if (!defer) {
        return;
      }

      if (defer.if === false) {
        return;
      }

      return {
        label: typeof defer.label === 'string' ? defer.label : undefined,
        parentDeferUsage: deferUsage,
      };
    }

    /**
     * Determines if a field should be included based on the `@include` and `@skip`
     * directives, where `@skip` has higher precedence than `@include`.
     */
    function shouldIncludeNode(
      node: FragmentSpreadNode | FieldNode | InlineFragmentNode,
    ): boolean {
      const skipDirectiveNode = node.directives?.find(
        (directive) => directive.name.value === GraphQLSkipDirective.name,
      );
      if (skipDirectiveNode && forbidSkipAndInclude) {
        forbiddenDirectiveInstances.push(skipDirectiveNode);
        return false;
      }
      const skip = skipDirectiveNode
        ? experimentalGetArgumentValues(
            skipDirectiveNode,
            GraphQLSkipDirective.args,
            variableValues,
            fragmentVariableValues,
            hideSuggestions,
          )
        : undefined;
      if (skip?.if === true) {
        return false;
      }

      const includeDirectiveNode = node.directives?.find(
        (directive) => directive.name.value === GraphQLIncludeDirective.name,
      );
      if (includeDirectiveNode && forbidSkipAndInclude) {
        forbiddenDirectiveInstances.push(includeDirectiveNode);
        return false;
      }
      const include = includeDirectiveNode
        ? experimentalGetArgumentValues(
            includeDirectiveNode,
            GraphQLIncludeDirective.args,
            variableValues,
            fragmentVariableValues,
            hideSuggestions,
          )
        : undefined;
      if (include?.if === false) {
        return false;
      }
      return true;
    }
  }

  /**
   * Determines if a fragment is applicable to the given type.
   */
  function doesFragmentConditionMatch(
    fragment: FragmentDefinitionNode | InlineFragmentNode,
  ): boolean {
    const typeConditionNode = fragment.typeCondition;
    if (!typeConditionNode) {
      return true;
    }
    const conditionalType = typeFromAST(schema, typeConditionNode);
    if (conditionalType === runtimeType) {
      return true;
    }
    if (isAbstractType(conditionalType)) {
      return schema.isSubType(conditionalType, runtimeType);
    }
    return false;
  }

  return selectionSetVisitor;
}

/**
 * Implements the logic to compute the key of a given field's entry
 */
function getFieldEntryKey(node: FieldNode): string {
  return node.alias ? node.alias.value : node.name.value;
}
