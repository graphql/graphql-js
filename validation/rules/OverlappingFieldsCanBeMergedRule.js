"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OverlappingFieldsCanBeMergedRule = OverlappingFieldsCanBeMergedRule;
const inspect_ts_1 = require("../../jsutils/inspect.js");
const GraphQLError_ts_1 = require("../../error/GraphQLError.js");
const ast_ts_1 = require("../../language/ast.js");
const kinds_ts_1 = require("../../language/kinds.js");
const printer_ts_1 = require("../../language/printer.js");
const definition_ts_1 = require("../../type/definition.js");
const typeFromAST_ts_1 = require("../../utilities/typeFromAST.js");
function reasonMessage(reason) {
    if (Array.isArray(reason)) {
        return reason
            .map(({ responseName, reason: subReason }) => `subfields "${responseName}" conflict because ` +
            reasonMessage(subReason))
            .join(' and ');
    }
    return reason;
}
function OverlappingFieldsCanBeMergedRule(validationContext) {
    const ruleContext = {
        comparedFieldsAndFragmentPairs: new Map(),
        comparedFragmentPairs: new Map(),
        cachedCollectFieldsResults: new Map(),
        valueInfoByNode: new Map(),
        fragmentScopes: new Map(),
    };
    let fragmentScope;
    return {
        FragmentDefinition: {
            enter(node) {
                const fragmentName = node.name.value;
                const fragmentSignature = validationContext.getFragmentSignatureByName()(fragmentName);
                fragmentScope = getVariableScope(fragmentSignature);
            },
            leave() {
                fragmentScope = undefined;
            },
        },
        SelectionSet(selectionSet) {
            const conflicts = findConflictsWithinSelectionSet(validationContext, ruleContext, validationContext.getParentType(), selectionSet, fragmentScope);
            for (const { responseName, reason, fields1, fields2 } of conflicts) {
                const reasonMsg = reasonMessage(reason);
                validationContext.reportError(new GraphQLError_ts_1.GraphQLError(`Fields "${responseName}" conflict because ${reasonMsg}. Use different aliases on the fields to fetch both if this was intentional.`, { nodes: fields1.concat(fields2) }));
            }
        },
    };
}
function findConflictsWithinSelectionSet(validationContext, ruleContext, parentType, selectionSet, scope) {
    const conflicts = [];
    const collectFieldsResult = collectFields(validationContext, ruleContext, parentType, selectionSet);
    collectConflictsWithin(validationContext, ruleContext, conflicts, collectFieldsResult, scope);
    if (collectFieldsResult.spreads.length !== 0) {
        const fragmentSpreads = getFragmentSpreads(validationContext, ruleContext, collectFieldsResult, scope);
        for (let i = 0; i < fragmentSpreads.length; i++) {
            collectConflictsBetweenFieldsAndFragment(validationContext, ruleContext, conflicts, false, collectFieldsResult, scope, fragmentSpreads[i]);
            for (let j = i + 1; j < fragmentSpreads.length; j++) {
                collectConflictsBetweenFragments(validationContext, ruleContext, conflicts, false, fragmentSpreads[i], fragmentSpreads[j]);
            }
        }
    }
    return conflicts;
}
function collectConflictsBetweenFieldsAndFragment(validationContext, ruleContext, conflicts, areMutuallyExclusive, collectFieldsResult, scope, fragmentSpread) {
    if (collectFieldsResult.groupedFieldSet.size === 0) {
        return;
    }
    const fragment = fragmentSpread.definition;
    let byFragmentScope = ruleContext.comparedFieldsAndFragmentPairs.get(scope);
    if (byFragmentScope === undefined) {
        byFragmentScope = new Map();
        ruleContext.comparedFieldsAndFragmentPairs.set(scope, byFragmentScope);
    }
    let comparedFieldsAndFragmentPairs = byFragmentScope.get(fragmentSpread.scope);
    if (comparedFieldsAndFragmentPairs === undefined) {
        comparedFieldsAndFragmentPairs = new OrderedPairSet();
        byFragmentScope.set(fragmentSpread.scope, comparedFieldsAndFragmentPairs);
    }
    if (comparedFieldsAndFragmentPairs.has(collectFieldsResult, fragment, areMutuallyExclusive)) {
        return;
    }
    comparedFieldsAndFragmentPairs.add(collectFieldsResult, fragment, areMutuallyExclusive);
    if (!fragment) {
        return;
    }
    const collectFieldsResult2 = collectFragmentFields(validationContext, ruleContext, fragment);
    const referencedFragmentSpreads = getFragmentSpreads(validationContext, ruleContext, collectFieldsResult2, fragmentSpread.scope);
    if (collectFieldsResult === collectFieldsResult2 &&
        scope === fragmentSpread.scope) {
        return;
    }
    collectConflictsBetween(validationContext, ruleContext, conflicts, areMutuallyExclusive, collectFieldsResult, scope, collectFieldsResult2, fragmentSpread.scope);
    for (const referencedFragmentSpread of referencedFragmentSpreads) {
        collectConflictsBetweenFieldsAndFragment(validationContext, ruleContext, conflicts, areMutuallyExclusive, collectFieldsResult, scope, referencedFragmentSpread);
    }
}
function collectConflictsBetweenFragments(validationContext, ruleContext, conflicts, areMutuallyExclusive, fragmentSpread1, fragmentSpread2) {
    const fragment1 = fragmentSpread1.definition;
    const fragment2 = fragmentSpread2.definition;
    const scope1 = fragmentSpread1.scope;
    const scope2 = fragmentSpread2.scope;
    if (fragment1 === fragment2 && scope1 === scope2) {
        return;
    }
    let byScope = ruleContext.comparedFragmentPairs.get(scope1);
    let comparedFragmentPairs = byScope?.get(scope2) ??
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
        validationContext.reportError(new GraphQLError_ts_1.GraphQLError(`Spreads "${fragmentSpread1.node.name.value}" conflict because ${getFragmentSpreadDescription(fragmentSpread1.node)} and ${getFragmentSpreadDescription(fragmentSpread2.node)} have different fragment arguments.`, { nodes: [fragmentSpread1.node, fragmentSpread2.node] }));
        return;
    }
    if (comparedFragmentPairs.has(fragment1, fragment2, areMutuallyExclusive)) {
        return;
    }
    comparedFragmentPairs.add(fragment1, fragment2, areMutuallyExclusive);
    if (!fragment1 || !fragment2) {
        return;
    }
    const collectFieldsResult1 = collectFragmentFields(validationContext, ruleContext, fragment1);
    const referencedFragmentSpreads1 = getFragmentSpreads(validationContext, ruleContext, collectFieldsResult1, fragmentSpread1.scope);
    const collectFieldsResult2 = collectFragmentFields(validationContext, ruleContext, fragment2);
    const referencedFragmentSpreads2 = getFragmentSpreads(validationContext, ruleContext, collectFieldsResult2, fragmentSpread2.scope);
    collectConflictsBetween(validationContext, ruleContext, conflicts, areMutuallyExclusive, collectFieldsResult1, fragmentSpread1.scope, collectFieldsResult2, fragmentSpread2.scope);
    for (const referencedFragmentSpread2 of referencedFragmentSpreads2) {
        collectConflictsBetweenFragments(validationContext, ruleContext, conflicts, areMutuallyExclusive, fragmentSpread1, referencedFragmentSpread2);
    }
    for (const referencedFragmentSpread1 of referencedFragmentSpreads1) {
        collectConflictsBetweenFragments(validationContext, ruleContext, conflicts, areMutuallyExclusive, referencedFragmentSpread1, fragmentSpread2);
    }
}
function findConflictsBetweenSubSelectionSets(validationContext, ruleContext, areMutuallyExclusive, parentType1, selectionSet1, scope1, parentType2, selectionSet2, scope2) {
    const conflicts = [];
    const collectFieldsResult1 = collectFields(validationContext, ruleContext, parentType1, selectionSet1);
    const fragmentSpreads1 = getFragmentSpreads(validationContext, ruleContext, collectFieldsResult1, scope1);
    const collectFieldsResult2 = collectFields(validationContext, ruleContext, parentType2, selectionSet2);
    const fragmentSpreads2 = getFragmentSpreads(validationContext, ruleContext, collectFieldsResult2, scope2);
    collectConflictsBetween(validationContext, ruleContext, conflicts, areMutuallyExclusive, collectFieldsResult1, scope1, collectFieldsResult2, scope2);
    for (const fragmentSpread2 of fragmentSpreads2) {
        collectConflictsBetweenFieldsAndFragment(validationContext, ruleContext, conflicts, areMutuallyExclusive, collectFieldsResult1, scope1, fragmentSpread2);
    }
    for (const fragmentSpread1 of fragmentSpreads1) {
        collectConflictsBetweenFieldsAndFragment(validationContext, ruleContext, conflicts, areMutuallyExclusive, collectFieldsResult2, scope2, fragmentSpread1);
    }
    for (const fragmentSpread1 of fragmentSpreads1) {
        for (const fragmentSpread2 of fragmentSpreads2) {
            collectConflictsBetweenFragments(validationContext, ruleContext, conflicts, areMutuallyExclusive, fragmentSpread1, fragmentSpread2);
        }
    }
    return conflicts;
}
function collectConflictsWithin(validationContext, ruleContext, conflicts, collectFieldsResult, scope) {
    for (const [responseName, fieldDetailsList,] of collectFieldsResult.groupedFieldSet.entries()) {
        if (fieldDetailsList.length > 1) {
            for (let i = 0; i < fieldDetailsList.length; i++) {
                for (let j = i + 1; j < fieldDetailsList.length; j++) {
                    const conflict = findConflict(validationContext, ruleContext, false, responseName, fieldDetailsList[i], scope, fieldDetailsList[j], scope);
                    if (conflict) {
                        conflicts.push(conflict);
                    }
                }
            }
        }
    }
}
function collectConflictsBetween(validationContext, ruleContext, conflicts, parentFieldsAreMutuallyExclusive, collectFieldsResult1, scope1, collectFieldsResult2, scope2) {
    if (collectFieldsResult1.groupedFieldSet.size === 0 ||
        collectFieldsResult2.groupedFieldSet.size === 0) {
        return;
    }
    for (const [responseName, fieldDetailsList1,] of collectFieldsResult1.groupedFieldSet.entries()) {
        const fieldDetailsList2 = collectFieldsResult2.groupedFieldSet.get(responseName);
        if (fieldDetailsList2 != null) {
            for (const fieldDetails1 of fieldDetailsList1) {
                for (const fieldDetails2 of fieldDetailsList2) {
                    const conflict = findConflict(validationContext, ruleContext, parentFieldsAreMutuallyExclusive, responseName, fieldDetails1, scope1, fieldDetails2, scope2);
                    if (conflict) {
                        conflicts.push(conflict);
                    }
                }
            }
        }
    }
}
function findConflict(validationContext, ruleContext, parentFieldsAreMutuallyExclusive, responseName, fieldDetails1, scope1, fieldDetails2, scope2) {
    const { parentType: parentType1, node: node1, definition: def1, } = fieldDetails1;
    const { parentType: parentType2, node: node2, definition: def2, } = fieldDetails2;
    const areMutuallyExclusive = parentFieldsAreMutuallyExclusive ||
        (parentType1 !== parentType2 &&
            (0, definition_ts_1.isObjectType)(parentType1) &&
            (0, definition_ts_1.isObjectType)(parentType2));
    const fieldInfo1 = getFieldInfo(fieldDetails1);
    const fieldInfo2 = getFieldInfo(fieldDetails2);
    let comparison = fieldInfo1.comparisons.get(fieldInfo2);
    if (comparison === undefined) {
        comparison = {};
        fieldInfo1.comparisons.set(fieldInfo2, comparison);
    }
    if (!areMutuallyExclusive) {
        const name1 = node1.name.value;
        const name2 = node2.name.value;
        const sameName = (comparison.sameName ??= name1 === name2);
        if (!sameName) {
            return {
                responseName,
                reason: `"${name1}" and "${name2}" are different fields`,
                fields1: [node1],
                fields2: [node2],
            };
        }
        const comparedArguments = (comparison.arguments ??= compareArguments(ruleContext, fieldInfo1.arguments, fieldInfo2.arguments));
        if (!sameArguments(comparedArguments, scope1, scope2)) {
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
                compareArguments(ruleContext, fieldInfo1.streamArguments, fieldInfo2.streamArguments));
            if (sameArguments(comparedArguments, scope1, scope2)) {
                reason +=
                    '. See https://github.com/graphql/defer-stream-wg/discussions/100';
            }
        }
        return { responseName, reason, fields1: [node1], fields2: [node2] };
    }
    const type1 = def1?.type;
    const type2 = def2?.type;
    if (type1 && type2 && doTypesConflict(type1, type2)) {
        return {
            responseName,
            reason: `they return conflicting types "${(0, inspect_ts_1.inspect)(type1)}" and "${(0, inspect_ts_1.inspect)(type2)}"`,
            fields1: [node1],
            fields2: [node2],
        };
    }
    const selectionSet1 = node1.selectionSet;
    const selectionSet2 = node2.selectionSet;
    if (selectionSet1 && selectionSet2) {
        const conflicts = findConflictsBetweenSubSelectionSets(validationContext, ruleContext, areMutuallyExclusive, (0, definition_ts_1.getNamedType)(type1), selectionSet1, scope1, (0, definition_ts_1.getNamedType)(type2), selectionSet2, scope2);
        return subfieldConflicts(conflicts, responseName, node1, node2);
    }
}
function getFieldInfo(fieldDetails) {
    if (fieldDetails.info === undefined) {
        const node = fieldDetails.node;
        const stream = node.directives?.find((directive) => directive.name.value === 'stream');
        fieldDetails.info = {
            comparisons: new Map(),
            arguments: getArgumentInfo(node.arguments),
            hasStream: stream !== undefined,
            streamArguments: getArgumentInfo(stream?.arguments),
        };
    }
    return fieldDetails.info;
}
function getArgumentInfo(args) {
    if (args === undefined || args.length === 0) {
        return;
    }
    const values = new Map();
    for (const { name, value } of args) {
        values.set(name.value, value);
    }
    return {
        nodes: args,
        values,
    };
}
function compareArguments(ruleContext, argumentInfo1, argumentInfo2) {
    const valuesWithVariables = [];
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
        const value2 = argumentInfo2.values.get(arg1.name.value);
        if (value2 === undefined) {
            return { sameStructure: false, valuesWithVariables };
        }
        const valueInfo1 = getValueInfo(ruleContext, arg1.value);
        if (valueInfo1.comparisonKey !==
            getValueInfo(ruleContext, value2).comparisonKey) {
            return { sameStructure: false, valuesWithVariables };
        }
        if (valueInfo1.variables.length !== 0) {
            valuesWithVariables.push(valueInfo1);
        }
    }
    return { sameStructure: true, valuesWithVariables };
}
function sameArguments(comparison, scope1, scope2) {
    if (!comparison.sameStructure) {
        return false;
    }
    return (scope1 === scope2 ||
        comparison.valuesWithVariables.every((value) => !usesLocalVariables(value, scope1) &&
            !usesLocalVariables(value, scope2)));
}
function usesLocalVariables(value, scope) {
    if (scope === undefined) {
        return false;
    }
    const dependencies = (value.scopeDependencies ??= new Map());
    const cached = dependencies.get(scope.signature);
    if (cached !== undefined) {
        return cached;
    }
    const dependsOnScope = value.variables.some((variable) => scope.signature.variableDefinitions.has(variable));
    dependencies.set(scope.signature, dependsOnScope);
    return dependsOnScope;
}
function getValueInfo(ruleContext, value) {
    const cached = ruleContext.valueInfoByNode.get(value);
    if (cached !== undefined) {
        return cached;
    }
    const variables = [];
    const comparisonKey = JSON.stringify(value, (_key, node) => {
        if (!(0, ast_ts_1.isNode)(node)) {
            return node;
        }
        switch (node.kind) {
            case kinds_ts_1.Kind.VARIABLE:
                variables.push(node.name.value);
                return [node.kind, node.name.value];
            case kinds_ts_1.Kind.OBJECT:
                return [
                    node.kind,
                    node.fields
                        .slice()
                        .sort((first, second) => first.name.value < second.name.value
                        ? -1
                        : first.name.value > second.name.value
                            ? 1
                            : 0),
                ];
            case kinds_ts_1.Kind.OBJECT_FIELD:
                return [node.name.value, node.value];
            case kinds_ts_1.Kind.LIST:
                return [node.kind, node.values];
            case kinds_ts_1.Kind.STRING:
                return [node.kind, node.value, node.block === true];
            default:
                return [node.kind, 'value' in node ? node.value : null];
        }
    });
    const valueInfo = { comparisonKey, variables };
    ruleContext.valueInfoByNode.set(value, valueInfo);
    return valueInfo;
}
function doTypesConflict(type1, type2) {
    if ((0, definition_ts_1.isListType)(type1)) {
        return (0, definition_ts_1.isListType)(type2)
            ? doTypesConflict(type1.ofType, type2.ofType)
            : true;
    }
    if ((0, definition_ts_1.isListType)(type2)) {
        return true;
    }
    if ((0, definition_ts_1.isNonNullType)(type1)) {
        return (0, definition_ts_1.isNonNullType)(type2)
            ? doTypesConflict(type1.ofType, type2.ofType)
            : true;
    }
    if ((0, definition_ts_1.isNonNullType)(type2)) {
        return true;
    }
    if ((0, definition_ts_1.isLeafType)(type1) || (0, definition_ts_1.isLeafType)(type2)) {
        return type1 !== type2;
    }
    return false;
}
function collectFields(validationContext, ruleContext, parentType, selectionSet) {
    const { cachedCollectFieldsResults } = ruleContext;
    let bySelectionSet = cachedCollectFieldsResults.get(parentType);
    if (!bySelectionSet) {
        bySelectionSet = new Map();
        cachedCollectFieldsResults.set(parentType, bySelectionSet);
    }
    let collectFieldsResult = bySelectionSet.get(selectionSet);
    if (!collectFieldsResult) {
        const groupedFieldSet = new Map();
        const spreads = [];
        collectFieldsImpl(validationContext, parentType, selectionSet, groupedFieldSet, spreads);
        collectFieldsResult = { groupedFieldSet, spreads };
        bySelectionSet.set(selectionSet, collectFieldsResult);
    }
    return collectFieldsResult;
}
function collectFragmentFields(validationContext, ruleContext, fragment) {
    const fragmentType = (0, typeFromAST_ts_1.typeFromAST)(validationContext.getSchema(), fragment.typeCondition);
    return collectFields(validationContext, ruleContext, fragmentType, fragment.selectionSet);
}
function collectFieldsImpl(validationContext, parentType, selectionSet, groupedFieldSet, fragmentSpreads) {
    for (const selection of selectionSet.selections) {
        switch (selection.kind) {
            case kinds_ts_1.Kind.FIELD: {
                const fieldName = selection.name.value;
                let fieldDef;
                if ((0, definition_ts_1.isObjectType)(parentType) || (0, definition_ts_1.isInterfaceType)(parentType)) {
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
            case kinds_ts_1.Kind.FRAGMENT_SPREAD: {
                fragmentSpreads.push(selection);
                break;
            }
            case kinds_ts_1.Kind.INLINE_FRAGMENT: {
                const typeCondition = selection.typeCondition;
                const inlineFragmentType = typeCondition
                    ? (0, typeFromAST_ts_1.typeFromAST)(validationContext.getSchema(), typeCondition)
                    : parentType;
                collectFieldsImpl(validationContext, inlineFragmentType, selection.selectionSet, groupedFieldSet, fragmentSpreads);
                break;
            }
        }
    }
}
function getFragmentSpreads(validationContext, ruleContext, collectFieldsResult, scope) {
    const byScope = (collectFieldsResult.byScope ??= new Map());
    const cached = byScope.get(scope);
    if (cached) {
        return cached;
    }
    const spreadsByScope = new Map();
    const result = [];
    for (const spreadNode of collectFieldsResult.spreads) {
        const spread = getFragmentSpread(validationContext, ruleContext, spreadNode, scope);
        let byDefinition = spreadsByScope.get(spread.scope);
        if (byDefinition === undefined) {
            byDefinition = new Map();
            spreadsByScope.set(spread.scope, byDefinition);
        }
        const previous = byDefinition.get(spread.definition);
        if (previous === undefined) {
            byDefinition.set(spread.definition, spread);
            result.push(spread);
        }
        else {
            previous.node = spread.node;
        }
    }
    byScope.set(scope, result);
    return result;
}
function getFragmentSpread(validationContext, ruleContext, fragmentSpreadNode, scope) {
    const signature = validationContext.getFragmentSignatureByName()(fragmentSpreadNode.name.value);
    const argumentInfo = getArgumentInfo(fragmentSpreadNode.arguments);
    const parts = [];
    const values = [];
    if (signature && argumentInfo !== undefined) {
        const argMap = argumentInfo.values;
        for (const name of signature.variableDefinitions.keys()) {
            const value = argMap.get(name);
            if (value !== undefined) {
                const argument = getValueInfo(ruleContext, value);
                parts.push(name, argument.comparisonKey);
                if (argument.variables.length !== 0) {
                    values.push(argument);
                }
            }
        }
    }
    const sourceKey = JSON.stringify([signature?.definition.name.value, parts]);
    let byScope = ruleContext.fragmentScopes.get(sourceKey);
    if (byScope === undefined) {
        byScope = new Map();
        ruleContext.fragmentScopes.set(sourceKey, byScope);
    }
    const variableScope = values.some((value) => usesLocalVariables(value, scope))
        ? scope
        : undefined;
    let fragmentScope = byScope.get(variableScope);
    if (!byScope.has(variableScope)) {
        fragmentScope = getVariableScope(signature);
        byScope.set(variableScope, fragmentScope);
    }
    return {
        node: fragmentSpreadNode,
        scope: fragmentScope,
        definition: signature?.definition,
    };
}
function getVariableScope(fragmentSignature) {
    if (!fragmentSignature || fragmentSignature.variableDefinitions.size === 0) {
        return;
    }
    return { signature: fragmentSignature };
}
function getFragmentSpreadDescription(node) {
    return (0, printer_ts_1.print)({ ...node, directives: [] }).slice(3);
}
function subfieldConflicts(conflicts, responseName, node1, node2) {
    if (conflicts.length > 0) {
        return {
            responseName,
            reason: conflicts.map(({ responseName: name, reason }) => ({
                responseName: name,
                reason,
            })),
            fields1: [node1, ...conflicts.map(({ fields1 }) => fields1).flat()],
            fields2: [node2, ...conflicts.map(({ fields2 }) => fields2).flat()],
        };
    }
}
class OrderedPairSet {
    constructor() {
        this._data = new Map();
    }
    has(a, b, weaklyPresent) {
        const result = this._data.get(a)?.get(b);
        if (result === undefined) {
            return false;
        }
        return weaklyPresent ? true : weaklyPresent === result;
    }
    add(a, b, weaklyPresent) {
        const map = this._data.get(a);
        if (map === undefined) {
            this._data.set(a, new Map([[b, weaklyPresent]]));
        }
        else {
            map.set(b, weaklyPresent);
        }
    }
}
class PairSet {
    constructor() {
        this._orderedPairSet = new OrderedPairSet();
    }
    has(a, b, weaklyPresent) {
        return (this._orderedPairSet.has(a, b, weaklyPresent) ||
            this._orderedPairSet.has(b, a, weaklyPresent));
    }
    add(a, b, weaklyPresent) {
        this._orderedPairSet.add(a, b, weaklyPresent);
    }
}
//# sourceMappingURL=OverlappingFieldsCanBeMergedRule.js.map