import { AccumulatorMap } from "../jsutils/AccumulatorMap.mjs";
import { invariant } from "../jsutils/invariant.mjs";
import { OperationTypeNode } from "../language/ast.mjs";
import { Kind } from "../language/kinds.mjs";
import { isAbstractType } from "../type/definition.mjs";
import { GraphQLDeferDirective, GraphQLIncludeDirective, GraphQLSkipDirective, } from "../type/directives.mjs";
import { typeFromAST } from "../utilities/typeFromAST.mjs";
import { getDirectiveValues, getFragmentVariableValues } from "./values.mjs";
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
export function collectFields(schema, fragments, variableValues, runtimeType, operation, hideSuggestions) {
    const groupedFieldSet = new AccumulatorMap();
    const newDeferUsages = [];
    const context = {
        schema,
        fragments,
        variableValues,
        runtimeType,
        operation,
        visitedFragmentNames: new Set(),
        hideSuggestions,
    };
    collectFieldsImpl(context, operation.selectionSet, groupedFieldSet, newDeferUsages);
    return { groupedFieldSet, newDeferUsages };
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
export function collectSubfields(schema, fragments, variableValues, operation, returnType, fieldDetailsList, hideSuggestions) {
    const context = {
        schema,
        fragments,
        variableValues,
        runtimeType: returnType,
        operation,
        visitedFragmentNames: new Set(),
        hideSuggestions,
    };
    const subGroupedFieldSet = new AccumulatorMap();
    const newDeferUsages = [];
    for (const fieldDetail of fieldDetailsList) {
        const selectionSet = fieldDetail.node.selectionSet;
        if (selectionSet) {
            const { deferUsage, fragmentVariableValues } = fieldDetail;
            collectFieldsImpl(context, selectionSet, subGroupedFieldSet, newDeferUsages, deferUsage, fragmentVariableValues);
        }
    }
    return {
        groupedFieldSet: subGroupedFieldSet,
        newDeferUsages,
    };
}
// eslint-disable-next-line @typescript-eslint/max-params
function collectFieldsImpl(context, selectionSet, groupedFieldSet, newDeferUsages, deferUsage, fragmentVariableValues) {
    const { schema, fragments, variableValues, runtimeType, operation, visitedFragmentNames, hideSuggestions, } = context;
    for (const selection of selectionSet.selections) {
        switch (selection.kind) {
            case Kind.FIELD: {
                if (!shouldIncludeNode(selection, variableValues, fragmentVariableValues)) {
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
                if (!shouldIncludeNode(selection, variableValues, fragmentVariableValues) ||
                    !doesFragmentConditionMatch(schema, selection, runtimeType)) {
                    continue;
                }
                const newDeferUsage = getDeferUsage(operation, variableValues, fragmentVariableValues, selection, deferUsage);
                if (!newDeferUsage) {
                    collectFieldsImpl(context, selection.selectionSet, groupedFieldSet, newDeferUsages, deferUsage, fragmentVariableValues);
                }
                else {
                    newDeferUsages.push(newDeferUsage);
                    collectFieldsImpl(context, selection.selectionSet, groupedFieldSet, newDeferUsages, newDeferUsage, fragmentVariableValues);
                }
                break;
            }
            case Kind.FRAGMENT_SPREAD: {
                const fragName = selection.name.value;
                const newDeferUsage = getDeferUsage(operation, variableValues, fragmentVariableValues, selection, deferUsage);
                if (!newDeferUsage &&
                    (visitedFragmentNames.has(fragName) ||
                        !shouldIncludeNode(selection, variableValues, fragmentVariableValues))) {
                    continue;
                }
                const fragment = fragments[fragName];
                if (fragment == null ||
                    !doesFragmentConditionMatch(schema, fragment.definition, runtimeType)) {
                    continue;
                }
                const fragmentVariableSignatures = fragment.variableSignatures;
                let newFragmentVariableValues;
                if (fragmentVariableSignatures) {
                    newFragmentVariableValues = getFragmentVariableValues(selection, fragmentVariableSignatures, variableValues, fragmentVariableValues, hideSuggestions);
                }
                if (!newDeferUsage) {
                    visitedFragmentNames.add(fragName);
                    collectFieldsImpl(context, fragment.definition.selectionSet, groupedFieldSet, newDeferUsages, deferUsage, newFragmentVariableValues);
                }
                else {
                    newDeferUsages.push(newDeferUsage);
                    collectFieldsImpl(context, fragment.definition.selectionSet, groupedFieldSet, newDeferUsages, newDeferUsage, newFragmentVariableValues);
                }
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
function getDeferUsage(operation, variableValues, fragmentVariableValues, node, parentDeferUsage) {
    const defer = getDirectiveValues(GraphQLDeferDirective, node, variableValues, fragmentVariableValues);
    if (!defer) {
        return;
    }
    if (defer.if === false) {
        return;
    }
    (operation.operation !== OperationTypeNode.SUBSCRIPTION) || invariant(false, '`@defer` directive not supported on subscription operations. Disable `@defer` by setting the `if` argument to `false`.');
    return {
        label: typeof defer.label === 'string' ? defer.label : undefined,
        parentDeferUsage,
    };
}
/**
 * Determines if a field should be included based on the `@include` and `@skip`
 * directives, where `@skip` has higher precedence than `@include`.
 */
function shouldIncludeNode(node, variableValues, fragmentVariableValues) {
    const skip = getDirectiveValues(GraphQLSkipDirective, node, variableValues, fragmentVariableValues);
    if (skip?.if === true) {
        return false;
    }
    const include = getDirectiveValues(GraphQLIncludeDirective, node, variableValues, fragmentVariableValues);
    if (include?.if === false) {
        return false;
    }
    return true;
}
/**
 * Determines if a fragment is applicable to the given type.
 */
function doesFragmentConditionMatch(schema, fragment, type) {
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
function getFieldEntryKey(node) {
    return node.alias ? node.alias.value : node.name.value;
}
