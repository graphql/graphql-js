"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.collectFields = collectFields;
exports.collectSubfields = collectSubfields;
const AccumulatorMap_ts_1 = require("../jsutils/AccumulatorMap.js");
const kinds_ts_1 = require("../language/kinds.js");
const definition_ts_1 = require("../type/definition.js");
const directives_ts_1 = require("../type/directives.js");
const typeFromAST_ts_1 = require("../utilities/typeFromAST.js");
const values_ts_1 = require("./values.js");
function collectFields(schema, fragments, variableValues, runtimeType, selectionSet, hideSuggestions, forbidSkipAndInclude = false) {
    const groupedFieldSet = new AccumulatorMap_ts_1.AccumulatorMap();
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
    collectFieldsImpl(context, selectionSet, groupedFieldSet, newDeferUsages);
    return {
        groupedFieldSet,
        newDeferUsages,
        forbiddenDirectiveInstances: context.forbiddenDirectiveInstances,
    };
}
function collectSubfields(schema, fragments, variableValues, returnType, fieldDetailsList, hideSuggestions) {
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
    const subGroupedFieldSet = new AccumulatorMap_ts_1.AccumulatorMap();
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
function collectFieldsImpl(context, selectionSet, groupedFieldSet, newDeferUsages, deferUsage, fragmentVariableValues) {
    const { schema, fragments, variableValues, runtimeType, visitedFragmentNames, hideSuggestions, } = context;
    for (const selection of selectionSet.selections) {
        switch (selection.kind) {
            case kinds_ts_1.Kind.FIELD: {
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
            case kinds_ts_1.Kind.INLINE_FRAGMENT: {
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
            case kinds_ts_1.Kind.FRAGMENT_SPREAD: {
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
                    newFragmentVariableValues = (0, values_ts_1.getFragmentVariableValues)(selection, fragmentVariableSignatures, variableValues, fragmentVariableValues, hideSuggestions);
                }
                collectFieldsImpl(context, fragment.definition.selectionSet, groupedFieldSet, newDeferUsages, maybeNewDeferUsage, newFragmentVariableValues);
                break;
            }
        }
    }
}
function getDeferUsage(variableValues, fragmentVariableValues, node, parentDeferUsage) {
    const directiveNode = node.directives?.find((directive) => directive.name.value === directives_ts_1.GraphQLDeferDirective.name);
    if (!directiveNode) {
        return;
    }
    const defer = (0, values_ts_1.getArgumentValues)(directives_ts_1.GraphQLDeferDirective, directiveNode, variableValues, fragmentVariableValues);
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
    const skipDirectiveNode = node.directives?.find((directive) => directive.name.value === directives_ts_1.GraphQLSkipDirective.name);
    if (skipDirectiveNode && context.forbidSkipAndInclude) {
        context.forbiddenDirectiveInstances.push(skipDirectiveNode);
        return false;
    }
    const skip = skipDirectiveNode
        ? (0, values_ts_1.getArgumentValues)(directives_ts_1.GraphQLSkipDirective, skipDirectiveNode, variableValues, fragmentVariableValues, context.hideSuggestions)
        : undefined;
    if (skip?.if === true) {
        return false;
    }
    const includeDirectiveNode = node.directives?.find((directive) => directive.name.value === directives_ts_1.GraphQLIncludeDirective.name);
    if (includeDirectiveNode && context.forbidSkipAndInclude) {
        context.forbiddenDirectiveInstances.push(includeDirectiveNode);
        return false;
    }
    const include = includeDirectiveNode
        ? (0, values_ts_1.getArgumentValues)(directives_ts_1.GraphQLIncludeDirective, includeDirectiveNode, variableValues, fragmentVariableValues, context.hideSuggestions)
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
    const conditionalType = (0, typeFromAST_ts_1.typeFromAST)(schema, typeConditionNode);
    if (conditionalType === type) {
        return true;
    }
    if ((0, definition_ts_1.isAbstractType)(conditionalType)) {
        return schema.isSubType(conditionalType, type);
    }
    return false;
}
function getFieldEntryKey(node) {
    return node.alias ? node.alias.value : node.name.value;
}
//# sourceMappingURL=collectFields.js.map