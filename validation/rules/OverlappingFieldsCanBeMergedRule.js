"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OverlappingFieldsCanBeMergedRule = OverlappingFieldsCanBeMergedRule;
const inspect_ts_1 = require("../../jsutils/inspect.js");
const GraphQLError_ts_1 = require("../../error/GraphQLError.js");
const kinds_ts_1 = require("../../language/kinds.js");
const printer_ts_1 = require("../../language/printer.js");
const definition_ts_1 = require("../../type/definition.js");
const sortValueNode_ts_1 = require("../../utilities/sortValueNode.js");
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
        comparedFragmentPairs: new PairSet(),
        cachedCollectFieldsResults: new Map(),
    };
    let fragmentScope;
    return {
        FragmentDefinition: {
            enter(node) {
                const fragmentName = node.name.value;
                const fragmentSignature = validationContext.getFragmentSignatureByName()(fragmentName);
                fragmentScope = getVariableScope(fragmentSignature, fragmentName);
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
        const fragmentSpreads = getFragmentSpreads(validationContext, collectFieldsResult, scope);
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
    let comparedFieldsAndFragmentPairs = ruleContext.comparedFieldsAndFragmentPairs.get(scope);
    if (comparedFieldsAndFragmentPairs === undefined) {
        comparedFieldsAndFragmentPairs = new OrderedPairSet();
        ruleContext.comparedFieldsAndFragmentPairs.set(scope, comparedFieldsAndFragmentPairs);
    }
    if (comparedFieldsAndFragmentPairs.has(collectFieldsResult, fragmentSpread.key, areMutuallyExclusive)) {
        return;
    }
    comparedFieldsAndFragmentPairs.add(collectFieldsResult, fragmentSpread.key, areMutuallyExclusive);
    const fragment = validationContext.getFragment(fragmentSpread.node.name.value);
    if (!fragment) {
        return;
    }
    const collectFieldsResult2 = collectFragmentFields(validationContext, ruleContext, fragment);
    const referencedFragmentSpreads = getFragmentSpreads(validationContext, collectFieldsResult2, fragmentSpread.scope);
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
    const { comparedFragmentPairs } = ruleContext;
    if (fragmentSpread1.key === fragmentSpread2.key) {
        return;
    }
    if (fragmentSpread1.node.name.value === fragmentSpread2.node.name.value) {
        if (comparedFragmentPairs.has(fragmentSpread1.key, fragmentSpread2.key, false)) {
            return;
        }
        comparedFragmentPairs.add(fragmentSpread1.key, fragmentSpread2.key, false);
        validationContext.reportError(new GraphQLError_ts_1.GraphQLError(`Spreads "${fragmentSpread1.node.name.value}" conflict because ${getFragmentSpreadDescription(fragmentSpread1.node)} and ${getFragmentSpreadDescription(fragmentSpread2.node)} have different fragment arguments.`, { nodes: [fragmentSpread1.node, fragmentSpread2.node] }));
        return;
    }
    if (comparedFragmentPairs.has(fragmentSpread1.key, fragmentSpread2.key, areMutuallyExclusive)) {
        return;
    }
    comparedFragmentPairs.add(fragmentSpread1.key, fragmentSpread2.key, areMutuallyExclusive);
    const fragment1 = validationContext.getFragment(fragmentSpread1.node.name.value);
    const fragment2 = validationContext.getFragment(fragmentSpread2.node.name.value);
    if (!fragment1 || !fragment2) {
        return;
    }
    const collectFieldsResult1 = collectFragmentFields(validationContext, ruleContext, fragment1);
    const referencedFragmentSpreads1 = getFragmentSpreads(validationContext, collectFieldsResult1, fragmentSpread1.scope);
    const collectFieldsResult2 = collectFragmentFields(validationContext, ruleContext, fragment2);
    const referencedFragmentSpreads2 = getFragmentSpreads(validationContext, collectFieldsResult2, fragmentSpread2.scope);
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
    const fragmentSpreads1 = getFragmentSpreads(validationContext, collectFieldsResult1, scope1);
    const collectFieldsResult2 = collectFields(validationContext, ruleContext, parentType2, selectionSet2);
    const fragmentSpreads2 = getFragmentSpreads(validationContext, collectFieldsResult2, scope2);
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
    if (!areMutuallyExclusive) {
        const name1 = node1.name.value;
        const name2 = node2.name.value;
        if (name1 !== name2) {
            return {
                responseName,
                reason: `"${name1}" and "${name2}" are different fields`,
                fields1: [node1],
                fields2: [node2],
            };
        }
        if (!sameArguments(node1.arguments, scope1, node2.arguments, scope2)) {
            return {
                responseName,
                reason: 'they have differing arguments',
                fields1: [node1],
                fields2: [node2],
            };
        }
    }
    const directives1 = node1.directives;
    const directives2 = node2.directives;
    const overlappingStreamReason = hasNoOverlappingStreams(directives1, scope1, directives2, scope2);
    if (overlappingStreamReason !== undefined) {
        return {
            responseName,
            reason: overlappingStreamReason,
            fields1: [node1],
            fields2: [node2],
        };
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
function sameArguments(args1, scope1, args2, scope2) {
    if (args1 === undefined || args1.length === 0) {
        return args2 === undefined || args2.length === 0;
    }
    if (args2 === undefined || args2.length === 0) {
        return false;
    }
    if (args1.length !== args2.length) {
        return false;
    }
    const values2 = new Map(args2.map(({ name, value }) => [
        name.value,
        scope2 === undefined ? value : replaceFragmentVariables(value, scope2),
    ]));
    return args1.every((arg1) => {
        let value1 = arg1.value;
        if (scope1) {
            value1 = replaceFragmentVariables(value1, scope1);
        }
        const value2 = values2.get(arg1.name.value);
        if (value2 === undefined) {
            return false;
        }
        return stringifyValue(value1) === stringifyValue(value2);
    });
}
function replaceFragmentVariables(valueNode, scope) {
    switch (valueNode.kind) {
        case kinds_ts_1.Kind.VARIABLE:
            return scope.get(valueNode.name.value) ?? valueNode;
        case kinds_ts_1.Kind.LIST:
            return {
                ...valueNode,
                values: valueNode.values.map((node) => replaceFragmentVariables(node, scope)),
            };
        case kinds_ts_1.Kind.OBJECT:
            return {
                ...valueNode,
                fields: valueNode.fields.map((field) => ({
                    ...field,
                    value: replaceFragmentVariables(field.value, scope),
                })),
            };
        default: {
            return valueNode;
        }
    }
}
function stringifyValue(value) {
    return (0, printer_ts_1.print)((0, sortValueNode_ts_1.sortValueNode)(value));
}
function getStreamDirective(directives) {
    return directives?.find((directive) => directive.name.value === 'stream');
}
function hasNoOverlappingStreams(directives1, scope1, directives2, scope2) {
    const stream1 = getStreamDirective(directives1);
    const stream2 = getStreamDirective(directives2);
    if (!stream1 && !stream2) {
        return;
    }
    else if (stream1 && stream2) {
        if (sameArguments(stream1.arguments, scope1, stream2.arguments, scope2)) {
            return 'they have overlapping stream directives. See https://github.com/graphql/defer-stream-wg/discussions/100';
        }
        return 'they have overlapping stream directives';
    }
    return 'they have overlapping stream directives';
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
function getFragmentSpreads(validationContext, collectFieldsResult, scope) {
    const byScope = (collectFieldsResult.byScope ??= new Map());
    const cached = byScope.get(scope);
    if (cached) {
        return cached;
    }
    const fragmentSpreads = new Map();
    for (const spreadNode of collectFieldsResult.spreads) {
        const spread = getFragmentSpread(validationContext, spreadNode, scope);
        fragmentSpreads.set(spread.key, spread);
    }
    const result = Array.from(fragmentSpreads.values());
    byScope.set(scope, result);
    return result;
}
function getFragmentSpread(validationContext, fragmentSpreadNode, scope) {
    let key = '';
    const fragmentSignature = validationContext.getFragmentSignatureByName()(fragmentSpreadNode.name.value);
    const argMap = new Map();
    if (fragmentSpreadNode.arguments) {
        for (const arg of fragmentSpreadNode.arguments) {
            argMap.set(arg.name.value, arg.value);
        }
    }
    if (fragmentSignature?.variableDefinitions) {
        key += fragmentSpreadNode.name.value + '(';
        for (const varName of fragmentSignature.variableDefinitions.keys()) {
            const value = argMap.get(varName);
            if (value) {
                const scopedValue = scope
                    ? replaceFragmentVariables(value, scope)
                    : value;
                key += varName + ': ' + stringifyValue(scopedValue);
            }
        }
        key += ')';
    }
    return {
        key,
        node: fragmentSpreadNode,
        scope: getVariableScope(fragmentSignature, key),
    };
}
function getVariableScope(fragmentSignature, key = '') {
    if (!fragmentSignature || fragmentSignature.variableDefinitions.size === 0) {
        return;
    }
    const scope = new Map();
    for (const variableName of fragmentSignature.variableDefinitions.keys()) {
        scope.set(variableName, {
            kind: kinds_ts_1.Kind.VARIABLE,
            name: { kind: kinds_ts_1.Kind.NAME, value: JSON.stringify([key, variableName]) },
        });
    }
    return scope;
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