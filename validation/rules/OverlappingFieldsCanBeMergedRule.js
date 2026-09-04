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
            .map(([responseName, subReason]) => `subfields "${responseName}" conflict because ` +
            reasonMessage(subReason))
            .join(' and ');
    }
    return reason;
}
function OverlappingFieldsCanBeMergedRule(context) {
    const comparedFieldsAndFragmentPairs = new OrderedPairSet();
    const comparedFragmentPairs = new PairSet();
    const cachedFieldsAndFragmentSpreads = new Map();
    let fragmentVarMap;
    return {
        FragmentDefinition: {
            enter(node) {
                const fragmentName = node.name.value;
                const fragmentSignature = context.getFragmentSignatureByName()(fragmentName);
                fragmentVarMap = getVarMap(fragmentSignature, fragmentName);
            },
            leave() {
                fragmentVarMap = undefined;
            },
        },
        SelectionSet(selectionSet) {
            const conflicts = findConflictsWithinSelectionSet(context, cachedFieldsAndFragmentSpreads, comparedFieldsAndFragmentPairs, comparedFragmentPairs, context.getParentType(), selectionSet, fragmentVarMap);
            for (const [[responseName, reason], fields1, fields2] of conflicts) {
                const reasonMsg = reasonMessage(reason);
                context.reportError(new GraphQLError_ts_1.GraphQLError(`Fields "${responseName}" conflict because ${reasonMsg}. Use different aliases on the fields to fetch both if this was intentional.`, { nodes: fields1.concat(fields2) }));
            }
        },
    };
}
function findConflictsWithinSelectionSet(context, cachedFieldsAndFragmentSpreads, comparedFieldsAndFragmentPairs, comparedFragmentPairs, parentType, selectionSet, varMap) {
    const conflicts = [];
    const [fieldMap, fragmentSpreads] = getFieldsAndFragmentSpreads(context, cachedFieldsAndFragmentSpreads, parentType, selectionSet, varMap);
    collectConflictsWithin(context, conflicts, cachedFieldsAndFragmentSpreads, comparedFieldsAndFragmentPairs, comparedFragmentPairs, fieldMap, varMap);
    if (fragmentSpreads.length !== 0) {
        for (let i = 0; i < fragmentSpreads.length; i++) {
            collectConflictsBetweenFieldsAndFragment(context, conflicts, cachedFieldsAndFragmentSpreads, comparedFieldsAndFragmentPairs, comparedFragmentPairs, false, fieldMap, varMap, fragmentSpreads[i]);
            for (let j = i + 1; j < fragmentSpreads.length; j++) {
                collectConflictsBetweenFragments(context, conflicts, cachedFieldsAndFragmentSpreads, comparedFieldsAndFragmentPairs, comparedFragmentPairs, false, fragmentSpreads[i], fragmentSpreads[j]);
            }
        }
    }
    return conflicts;
}
function collectConflictsBetweenFieldsAndFragment(context, conflicts, cachedFieldsAndFragmentSpreads, comparedFieldsAndFragmentPairs, comparedFragmentPairs, areMutuallyExclusive, fieldMap, varMap, fragmentSpread) {
    if (comparedFieldsAndFragmentPairs.has(fieldMap, fragmentSpread.key, areMutuallyExclusive)) {
        return;
    }
    comparedFieldsAndFragmentPairs.add(fieldMap, fragmentSpread.key, areMutuallyExclusive);
    const fragment = context.getFragment(fragmentSpread.node.name.value);
    if (!fragment) {
        return;
    }
    const [fieldMap2, referencedFragmentSpreads] = getReferencedFieldsAndFragmentSpreads(context, cachedFieldsAndFragmentSpreads, fragment, fragmentSpread.varMap);
    if (fieldMap === fieldMap2) {
        return;
    }
    collectConflictsBetween(context, conflicts, cachedFieldsAndFragmentSpreads, comparedFieldsAndFragmentPairs, comparedFragmentPairs, areMutuallyExclusive, fieldMap, varMap, fieldMap2, fragmentSpread.varMap);
    for (const referencedFragmentSpread of referencedFragmentSpreads) {
        collectConflictsBetweenFieldsAndFragment(context, conflicts, cachedFieldsAndFragmentSpreads, comparedFieldsAndFragmentPairs, comparedFragmentPairs, areMutuallyExclusive, fieldMap, varMap, referencedFragmentSpread);
    }
}
function collectConflictsBetweenFragments(context, conflicts, cachedFieldsAndFragmentSpreads, comparedFieldsAndFragmentPairs, comparedFragmentPairs, areMutuallyExclusive, fragmentSpread1, fragmentSpread2) {
    if (fragmentSpread1.key === fragmentSpread2.key) {
        return;
    }
    if (fragmentSpread1.node.name.value === fragmentSpread2.node.name.value) {
        if (comparedFragmentPairs.has(fragmentSpread1.key, fragmentSpread2.key, false)) {
            return;
        }
        comparedFragmentPairs.add(fragmentSpread1.key, fragmentSpread2.key, false);
        context.reportError(new GraphQLError_ts_1.GraphQLError(`Spreads "${fragmentSpread1.node.name.value}" conflict because ${getFragmentSpreadDescription(fragmentSpread1.node)} and ${getFragmentSpreadDescription(fragmentSpread2.node)} have different fragment arguments.`, { nodes: [fragmentSpread1.node, fragmentSpread2.node] }));
        return;
    }
    if (comparedFragmentPairs.has(fragmentSpread1.key, fragmentSpread2.key, areMutuallyExclusive)) {
        return;
    }
    comparedFragmentPairs.add(fragmentSpread1.key, fragmentSpread2.key, areMutuallyExclusive);
    const fragment1 = context.getFragment(fragmentSpread1.node.name.value);
    const fragment2 = context.getFragment(fragmentSpread2.node.name.value);
    if (!fragment1 || !fragment2) {
        return;
    }
    const [fieldMap1, referencedFragmentSpreads1] = getReferencedFieldsAndFragmentSpreads(context, cachedFieldsAndFragmentSpreads, fragment1, fragmentSpread1.varMap);
    const [fieldMap2, referencedFragmentSpreads2] = getReferencedFieldsAndFragmentSpreads(context, cachedFieldsAndFragmentSpreads, fragment2, fragmentSpread2.varMap);
    collectConflictsBetween(context, conflicts, cachedFieldsAndFragmentSpreads, comparedFieldsAndFragmentPairs, comparedFragmentPairs, areMutuallyExclusive, fieldMap1, fragmentSpread1.varMap, fieldMap2, fragmentSpread2.varMap);
    for (const referencedFragmentSpread2 of referencedFragmentSpreads2) {
        collectConflictsBetweenFragments(context, conflicts, cachedFieldsAndFragmentSpreads, comparedFieldsAndFragmentPairs, comparedFragmentPairs, areMutuallyExclusive, fragmentSpread1, referencedFragmentSpread2);
    }
    for (const referencedFragmentSpread1 of referencedFragmentSpreads1) {
        collectConflictsBetweenFragments(context, conflicts, cachedFieldsAndFragmentSpreads, comparedFieldsAndFragmentPairs, comparedFragmentPairs, areMutuallyExclusive, referencedFragmentSpread1, fragmentSpread2);
    }
}
function findConflictsBetweenSubSelectionSets(context, cachedFieldsAndFragmentSpreads, comparedFieldsAndFragmentPairs, comparedFragmentPairs, areMutuallyExclusive, parentType1, selectionSet1, varMap1, parentType2, selectionSet2, varMap2) {
    const conflicts = [];
    const [fieldMap1, fragmentSpreads1] = getFieldsAndFragmentSpreads(context, cachedFieldsAndFragmentSpreads, parentType1, selectionSet1, varMap1);
    const [fieldMap2, fragmentSpreads2] = getFieldsAndFragmentSpreads(context, cachedFieldsAndFragmentSpreads, parentType2, selectionSet2, varMap2);
    collectConflictsBetween(context, conflicts, cachedFieldsAndFragmentSpreads, comparedFieldsAndFragmentPairs, comparedFragmentPairs, areMutuallyExclusive, fieldMap1, varMap1, fieldMap2, varMap2);
    for (const fragmentSpread2 of fragmentSpreads2) {
        collectConflictsBetweenFieldsAndFragment(context, conflicts, cachedFieldsAndFragmentSpreads, comparedFieldsAndFragmentPairs, comparedFragmentPairs, areMutuallyExclusive, fieldMap1, varMap1, fragmentSpread2);
    }
    for (const fragmentSpread1 of fragmentSpreads1) {
        collectConflictsBetweenFieldsAndFragment(context, conflicts, cachedFieldsAndFragmentSpreads, comparedFieldsAndFragmentPairs, comparedFragmentPairs, areMutuallyExclusive, fieldMap2, varMap2, fragmentSpread1);
    }
    for (const fragmentSpread1 of fragmentSpreads1) {
        for (const fragmentSpread2 of fragmentSpreads2) {
            collectConflictsBetweenFragments(context, conflicts, cachedFieldsAndFragmentSpreads, comparedFieldsAndFragmentPairs, comparedFragmentPairs, areMutuallyExclusive, fragmentSpread1, fragmentSpread2);
        }
    }
    return conflicts;
}
function collectConflictsWithin(context, conflicts, cachedFieldsAndFragmentSpreads, comparedFieldsAndFragmentPairs, comparedFragmentPairs, fieldMap, varMap) {
    for (const [responseName, fields] of fieldMap.entries()) {
        if (fields.length > 1) {
            for (let i = 0; i < fields.length; i++) {
                for (let j = i + 1; j < fields.length; j++) {
                    const conflict = findConflict(context, cachedFieldsAndFragmentSpreads, comparedFieldsAndFragmentPairs, comparedFragmentPairs, false, responseName, fields[i], varMap, fields[j], varMap);
                    if (conflict) {
                        conflicts.push(conflict);
                    }
                }
            }
        }
    }
}
function collectConflictsBetween(context, conflicts, cachedFieldsAndFragmentSpreads, comparedFieldsAndFragmentPairs, comparedFragmentPairs, parentFieldsAreMutuallyExclusive, fieldMap1, varMap1, fieldMap2, varMap2) {
    for (const [responseName, fields1] of fieldMap1.entries()) {
        const fields2 = fieldMap2.get(responseName);
        if (fields2 != null) {
            for (const field1 of fields1) {
                for (const field2 of fields2) {
                    const conflict = findConflict(context, cachedFieldsAndFragmentSpreads, comparedFieldsAndFragmentPairs, comparedFragmentPairs, parentFieldsAreMutuallyExclusive, responseName, field1, varMap1, field2, varMap2);
                    if (conflict) {
                        conflicts.push(conflict);
                    }
                }
            }
        }
    }
}
function findConflict(context, cachedFieldsAndFragmentSpreads, comparedFieldsAndFragmentPairs, comparedFragmentPairs, parentFieldsAreMutuallyExclusive, responseName, field1, varMap1, field2, varMap2) {
    const [parentType1, node1, def1] = field1;
    const [parentType2, node2, def2] = field2;
    const areMutuallyExclusive = parentFieldsAreMutuallyExclusive ||
        (parentType1 !== parentType2 &&
            (0, definition_ts_1.isObjectType)(parentType1) &&
            (0, definition_ts_1.isObjectType)(parentType2));
    if (!areMutuallyExclusive) {
        const name1 = node1.name.value;
        const name2 = node2.name.value;
        if (name1 !== name2) {
            return [
                [responseName, `"${name1}" and "${name2}" are different fields`],
                [node1],
                [node2],
            ];
        }
        if (!sameArguments(node1.arguments, varMap1, node2.arguments, varMap2)) {
            return [
                [responseName, 'they have differing arguments'],
                [node1],
                [node2],
            ];
        }
    }
    const directives1 = node1.directives;
    const directives2 = node2.directives;
    const overlappingStreamReason = hasNoOverlappingStreams(directives1, varMap1, directives2, varMap2);
    if (overlappingStreamReason !== undefined) {
        return [[responseName, overlappingStreamReason], [node1], [node2]];
    }
    const type1 = def1?.type;
    const type2 = def2?.type;
    if (type1 && type2 && doTypesConflict(type1, type2)) {
        return [
            [
                responseName,
                `they return conflicting types "${(0, inspect_ts_1.inspect)(type1)}" and "${(0, inspect_ts_1.inspect)(type2)}"`,
            ],
            [node1],
            [node2],
        ];
    }
    const selectionSet1 = node1.selectionSet;
    const selectionSet2 = node2.selectionSet;
    if (selectionSet1 && selectionSet2) {
        const conflicts = findConflictsBetweenSubSelectionSets(context, cachedFieldsAndFragmentSpreads, comparedFieldsAndFragmentPairs, comparedFragmentPairs, areMutuallyExclusive, (0, definition_ts_1.getNamedType)(type1), selectionSet1, varMap1, (0, definition_ts_1.getNamedType)(type2), selectionSet2, varMap2);
        return subfieldConflicts(conflicts, responseName, node1, node2);
    }
}
function sameArguments(args1, varMap1, args2, varMap2) {
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
        varMap2 === undefined ? value : replaceFragmentVariables(value, varMap2),
    ]));
    return args1.every((arg1) => {
        let value1 = arg1.value;
        if (varMap1) {
            value1 = replaceFragmentVariables(value1, varMap1);
        }
        const value2 = values2.get(arg1.name.value);
        if (value2 === undefined) {
            return false;
        }
        return stringifyValue(value1) === stringifyValue(value2);
    });
}
function replaceFragmentVariables(valueNode, varMap) {
    switch (valueNode.kind) {
        case kinds_ts_1.Kind.VARIABLE:
            return varMap.get(valueNode.name.value) ?? valueNode;
        case kinds_ts_1.Kind.LIST:
            return {
                ...valueNode,
                values: valueNode.values.map((node) => replaceFragmentVariables(node, varMap)),
            };
        case kinds_ts_1.Kind.OBJECT:
            return {
                ...valueNode,
                fields: valueNode.fields.map((field) => ({
                    ...field,
                    value: replaceFragmentVariables(field.value, varMap),
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
function hasNoOverlappingStreams(directives1, varMap1, directives2, varMap2) {
    const stream1 = getStreamDirective(directives1);
    const stream2 = getStreamDirective(directives2);
    if (!stream1 && !stream2) {
        return;
    }
    else if (stream1 && stream2) {
        if (sameArguments(stream1.arguments, varMap1, stream2.arguments, varMap2)) {
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
function getFieldsAndFragmentSpreads(context, cachedFieldsAndFragmentSpreads, parentType, selectionSet, varMap) {
    let cache = cachedFieldsAndFragmentSpreads.get(selectionSet);
    if (!cache) {
        cache = new Map();
        cachedFieldsAndFragmentSpreads.set(selectionSet, cache);
    }
    const cached = cache.get(varMap);
    if (cached) {
        return cached;
    }
    const nodeAndDefs = new Map();
    const fragmentSpreads = new Map();
    _collectFieldsAndFragmentSpreads(context, parentType, selectionSet, nodeAndDefs, fragmentSpreads, varMap);
    const result = [
        nodeAndDefs,
        Array.from(fragmentSpreads.values()),
    ];
    cache.set(varMap, result);
    return result;
}
function getReferencedFieldsAndFragmentSpreads(context, cachedFieldsAndFragmentSpreads, fragment, varMap) {
    const cached = cachedFieldsAndFragmentSpreads
        .get(fragment.selectionSet)
        ?.get(varMap);
    if (cached) {
        return cached;
    }
    const fragmentType = (0, typeFromAST_ts_1.typeFromAST)(context.getSchema(), fragment.typeCondition);
    return getFieldsAndFragmentSpreads(context, cachedFieldsAndFragmentSpreads, fragmentType, fragment.selectionSet, varMap);
}
function _collectFieldsAndFragmentSpreads(context, parentType, selectionSet, nodeAndDefs, fragmentSpreads, varMap) {
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
                let nodeAndDefsList = nodeAndDefs.get(responseName);
                if (nodeAndDefsList == null) {
                    nodeAndDefsList = [];
                    nodeAndDefs.set(responseName, nodeAndDefsList);
                }
                nodeAndDefsList.push([parentType, selection, fieldDef]);
                break;
            }
            case kinds_ts_1.Kind.FRAGMENT_SPREAD: {
                const fragmentSpread = getFragmentSpread(context, selection, varMap);
                fragmentSpreads.set(fragmentSpread.key, fragmentSpread);
                break;
            }
            case kinds_ts_1.Kind.INLINE_FRAGMENT: {
                const typeCondition = selection.typeCondition;
                const inlineFragmentType = typeCondition
                    ? (0, typeFromAST_ts_1.typeFromAST)(context.getSchema(), typeCondition)
                    : parentType;
                _collectFieldsAndFragmentSpreads(context, inlineFragmentType, selection.selectionSet, nodeAndDefs, fragmentSpreads, varMap);
                break;
            }
        }
    }
}
function getFragmentSpread(context, fragmentSpreadNode, varMap) {
    let key = '';
    const fragmentSignature = context.getFragmentSignatureByName()(fragmentSpreadNode.name.value);
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
                const scopedValue = varMap
                    ? replaceFragmentVariables(value, varMap)
                    : value;
                key += varName + ': ' + stringifyValue(scopedValue);
            }
        }
        key += ')';
    }
    return {
        key,
        node: fragmentSpreadNode,
        varMap: getVarMap(fragmentSignature, key),
    };
}
function getVarMap(fragmentSignature, key = '') {
    if (!fragmentSignature || fragmentSignature.variableDefinitions.size === 0) {
        return;
    }
    const varMap = new Map();
    for (const variableName of fragmentSignature.variableDefinitions.keys()) {
        varMap.set(variableName, {
            kind: kinds_ts_1.Kind.VARIABLE,
            name: { kind: kinds_ts_1.Kind.NAME, value: JSON.stringify([key, variableName]) },
        });
    }
    return varMap;
}
function getFragmentSpreadDescription(node) {
    return (0, printer_ts_1.print)({ ...node, directives: [] }).slice(3);
}
function subfieldConflicts(conflicts, responseName, node1, node2) {
    if (conflicts.length > 0) {
        return [
            [responseName, conflicts.map(([reason]) => reason)],
            [node1, ...conflicts.map(([, fields1]) => fields1).flat()],
            [node2, ...conflicts.map(([, , fields2]) => fields2).flat()],
        ];
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
        return a < b
            ? this._orderedPairSet.has(a, b, weaklyPresent)
            : this._orderedPairSet.has(b, a, weaklyPresent);
    }
    add(a, b, weaklyPresent) {
        if (a < b) {
            this._orderedPairSet.add(a, b, weaklyPresent);
        }
        else {
            this._orderedPairSet.add(b, a, weaklyPresent);
        }
    }
}
//# sourceMappingURL=OverlappingFieldsCanBeMergedRule.js.map