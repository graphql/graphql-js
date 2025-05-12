import { AccumulatorMap } from "../jsutils/AccumulatorMap.mjs";
import { Kind } from "../language/kinds.mjs";
import { isAbstractType } from "../type/definition.mjs";
import { GraphQLDeferDirective, GraphQLIncludeDirective, GraphQLSkipDirective, } from "../type/directives.mjs";
import { typeFromAST } from "../utilities/typeFromAST.mjs";
import { getArgumentValues, getDirectiveValues, getFragmentVariableValues, } from "./values.mjs";
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
export function collectFields(schema, fragments, variableValues, runtimeType, selectionSet, hideSuggestions, forbidSkipAndInclude = false) {
    const groupedFieldSet = new AccumulatorMap();
    const newDeferUsages = [];
    const context = {
        schema,
        fragments,
        variableValues,
        runtimeType,
        visitedFragmentNames: new Set(),
        hideSuggestions,
        forbiddenDirectiveInstances: [],
        forbidSkipAndInclude,
    };
    collectFieldsImpl(context, selectionSet, groupedFieldSet, newDeferUsages);
    return {
        groupedFieldSet,
        newDeferUsages,
        forbiddenDirectiveInstances: context.forbiddenDirectiveInstances,
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
export function collectSubfields(schema, fragments, variableValues, returnType, fieldDetailsList, hideSuggestions) {
    const context = {
        schema,
        fragments,
        variableValues,
        runtimeType: returnType,
        visitedFragmentNames: new Set(),
        hideSuggestions,
        forbiddenDirectiveInstances: [],
        forbidSkipAndInclude: false,
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
    const { schema, fragments, variableValues, runtimeType, visitedFragmentNames, hideSuggestions, } = context;
    for (const selection of selectionSet.selections) {
        switch (selection.kind) {
            case Kind.FIELD: {
                if (!shouldIncludeNode(context, selection, variableValues, fragmentVariableValues)) {
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
                if (!shouldIncludeNode(context, selection, variableValues, fragmentVariableValues) ||
                    !doesFragmentConditionMatch(schema, selection, runtimeType)) {
                    continue;
                }
                const newDeferUsage = getDeferUsage(variableValues, fragmentVariableValues, selection, deferUsage);
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
                if (visitedFragmentNames.has(fragName) ||
                    !shouldIncludeNode(context, selection, variableValues, fragmentVariableValues)) {
                    continue;
                }
                const fragment = fragments[fragName];
                if (fragment == null ||
                    !doesFragmentConditionMatch(schema, fragment.definition, runtimeType)) {
                    continue;
                }
                const newDeferUsage = getDeferUsage(variableValues, fragmentVariableValues, selection, deferUsage);
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
function getDeferUsage(variableValues, fragmentVariableValues, node, parentDeferUsage) {
    const defer = getDirectiveValues(GraphQLDeferDirective, node, variableValues, fragmentVariableValues);
    if (!defer) {
        return;
    }
    if (defer.if === false) {
        return;
    }
    return {
        label: typeof defer.label === 'string' ? defer.label : undefined,
        parentDeferUsage,
    };
}
/**
 * Determines if a field should be included based on the `@include` and `@skip`
 * directives, where `@skip` has higher precedence than `@include`.
 */
function shouldIncludeNode(context, node, variableValues, fragmentVariableValues) {
    const skipDirectiveNode = node.directives?.find((directive) => directive.name.value === GraphQLSkipDirective.name);
    if (skipDirectiveNode && context.forbidSkipAndInclude) {
        context.forbiddenDirectiveInstances.push(skipDirectiveNode);
        return false;
    }
    const skip = skipDirectiveNode
        ? getArgumentValues(GraphQLSkipDirective, skipDirectiveNode, variableValues, fragmentVariableValues, context.hideSuggestions)
        : undefined;
    if (skip?.if === true) {
        return false;
    }
    const includeDirectiveNode = node.directives?.find((directive) => directive.name.value === GraphQLIncludeDirective.name);
    if (includeDirectiveNode && context.forbidSkipAndInclude) {
        context.forbiddenDirectiveInstances.push(includeDirectiveNode);
        return false;
    }
    const include = includeDirectiveNode
        ? getArgumentValues(GraphQLIncludeDirective, includeDirectiveNode, variableValues, fragmentVariableValues, context.hideSuggestions)
        : undefined;
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
//# sourceMappingURL=collectFields.js.map