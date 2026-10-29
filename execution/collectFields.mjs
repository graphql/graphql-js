import { AccumulatorMap } from "../jsutils/AccumulatorMap.mjs";
import { Kind } from "../language/kinds.mjs";
import { isAbstractType } from "../type/definition.mjs";
import { GraphQLDeferDirective, GraphQLIncludeDirective, GraphQLSkipDirective, } from "../type/directives.mjs";
import { typeFromAST } from "../utilities/typeFromAST.mjs";
import { getArgumentValues, getFragmentVariableValues } from "./values.mjs";
export function collectFields(schema, fragments, variableValues, runtimeType, selectionSet, hideSuggestions, forbidSkipAndInclude = false, visit = visitSelectionSets) {
    const groupedFieldSet = new AccumulatorMap();
    const newDeferUsages = [];
    const context = {
        schema,
        fragments,
        variableValues,
        runtimeType,
        visitedFragmentNames: new Map(),
        hideSuggestions,
        forbiddenDirectiveInstances: [],
        forbidSkipAndInclude,
    };
    visit(context, selectionSet, groupedFieldSet, newDeferUsages);
    return {
        groupedFieldSet,
        newDeferUsages,
        forbiddenDirectiveInstances: context.forbiddenDirectiveInstances,
    };
}
export function collectSubfields(schema, fragments, variableValues, returnType, fieldDetailsList, hideSuggestions) {
    const context = {
        schema,
        fragments,
        variableValues,
        runtimeType: returnType,
        visitedFragmentNames: new Map(),
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
            visitSelectionSets(context, selectionSet, subGroupedFieldSet, newDeferUsages, deferUsage, fragmentVariableValues);
        }
    }
    return {
        groupedFieldSet: subGroupedFieldSet,
        newDeferUsages,
    };
}
export function visitSelectionSets(context, selectionSet, groupedFieldSet, newDeferUsages, deferUsage, fragmentVariableValues, recurse = visitSelectionSets) {
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
                    recurse(context, selection.selectionSet, groupedFieldSet, newDeferUsages, deferUsage, fragmentVariableValues, recurse);
                }
                else {
                    newDeferUsages.push(newDeferUsage);
                    recurse(context, selection.selectionSet, groupedFieldSet, newDeferUsages, newDeferUsage, fragmentVariableValues, recurse);
                }
                break;
            }
            case Kind.FRAGMENT_SPREAD: {
                const fragName = selection.name.value;
                if (!shouldIncludeNode(context, selection, variableValues, fragmentVariableValues)) {
                    continue;
                }
                const fragment = fragments[fragName];
                if (fragment == null ||
                    !doesFragmentConditionMatch(schema, fragment.definition, runtimeType)) {
                    continue;
                }
                const newDeferUsage = getDeferUsage(variableValues, fragmentVariableValues, selection, deferUsage);
                const maybeNewDeferUsage = newDeferUsage ?? deferUsage;
                let visitedDeferSet = visitedFragmentNames.get(fragName);
                if (!visitedDeferSet) {
                    visitedDeferSet = new Set();
                    visitedFragmentNames.set(fragName, visitedDeferSet);
                }
                if (visitedDeferSet.has(null) ||
                    (maybeNewDeferUsage &&
                        visitedDeferSet.has(maybeNewDeferUsage.directiveNode))) {
                    continue;
                }
                if (newDeferUsage) {
                    newDeferUsages.push(newDeferUsage);
                }
                visitedDeferSet.add(maybeNewDeferUsage?.directiveNode ?? null);
                const fragmentVariableSignatures = fragment.variableSignatures;
                let newFragmentVariableValues;
                if (fragmentVariableSignatures) {
                    newFragmentVariableValues = getFragmentVariableValues(selection, fragmentVariableSignatures, variableValues, fragmentVariableValues, hideSuggestions);
                }
                recurse(context, fragment.definition.selectionSet, groupedFieldSet, newDeferUsages, maybeNewDeferUsage, newFragmentVariableValues, recurse);
                break;
            }
        }
    }
}
function getDeferUsage(variableValues, fragmentVariableValues, node, parentDeferUsage) {
    const directiveNode = node.directives?.find((directive) => directive.name.value === GraphQLDeferDirective.name);
    if (!directiveNode) {
        return;
    }
    const defer = getArgumentValues(GraphQLDeferDirective, directiveNode, variableValues, fragmentVariableValues);
    if (defer.if === false) {
        return;
    }
    return {
        label: typeof defer.label === 'string' ? defer.label : undefined,
        directiveNode,
        parentDeferUsage,
    };
}
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
function getFieldEntryKey(node) {
    return node.alias ? node.alias.value : node.name.value;
}
//# sourceMappingURL=collectFields.js.map