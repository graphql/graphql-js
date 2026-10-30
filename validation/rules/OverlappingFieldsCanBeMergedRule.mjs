import { inspect } from "../../jsutils/inspect.mjs";
import { GraphQLError } from "../../error/GraphQLError.mjs";
import { isNode } from "../../language/ast.mjs";
import { Kind } from "../../language/kinds.mjs";
import { print } from "../../language/printer.mjs";
import { getNamedType, isInterfaceType, isLeafType, isListType, isNonNullType, isObjectType, } from "../../type/definition.mjs";
import { typeFromAST } from "../../utilities/typeFromAST.mjs";
import { validationAbortedError } from "../validationAbortedError.mjs";
const MAX_CONFLICT_DETAIL_LENGTH = 1000;
const MAX_CONFLICT_NODES = 20;
const MAX_FRAGMENT_ARGUMENT_SIZE = 256;
const MAX_COMPLEXITY_BUDGET = 500_000;
export function OverlappingFieldsCanBeMergedRule(validationContext) {
    const ruleContext = {
        comparedFieldsAndFragmentPairs: new Map(),
        comparedFragmentPairs: new Map(),
        cachedCollectFieldsResults: new Map(),
        valueInfoByNode: new Map(),
        fragmentSpreadInfoByNode: new Map(),
        fragmentSpreadInfoByKey: new Map(),
        remainingComplexityBudget: MAX_COMPLEXITY_BUDGET,
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
        SelectionSet(selectionSet, _key, parent) {
            if (parent && 'kind' in parent && parent.kind === Kind.INLINE_FRAGMENT) {
                return;
            }
            if (selectionSet.selections.length <= 1 &&
                selectionSet.selections[0]?.kind !== Kind.INLINE_FRAGMENT) {
                return;
            }
            const conflicts = findConflictsWithinSelectionSet(validationContext, ruleContext, validationContext.getParentType(), selectionSet, fragmentScope);
            for (const { responseName, reason, fields1, fields2 } of conflicts) {
                validationContext.reportError(new GraphQLError(`Fields "${maybeAbbreviate(responseName)}" conflict because ${reason}. Use different aliases on the fields to fetch both if this was intentional.`, { nodes: fields1.concat(fields2) }));
            }
        },
    };
}
function findConflictsWithinSelectionSet(validationContext, ruleContext, parentType, selectionSet, scope) {
    const conflicts = [];
    const collectFieldsResult = collectFields(validationContext, ruleContext, parentType, selectionSet);
    collectConflictsWithin(validationContext, ruleContext, conflicts, collectFieldsResult, scope);
    if (collectFieldsResult.spreads.length !== 0 &&
        (collectFieldsResult.groupedFieldSet.size !== 0 ||
            collectFieldsResult.spreads.length > 1)) {
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
    spendComplexityBudget(ruleContext, 1);
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
    spendComplexityBudget(ruleContext, 2);
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
        validationContext.reportError(new GraphQLError(`Spreads "${maybeAbbreviate(fragmentSpread1.node.name.value)}" conflict because ${getFragmentSpreadDescription(ruleContext, fragmentSpread1.node)} and ${getFragmentSpreadDescription(ruleContext, fragmentSpread2.node)} have different fragment arguments.`, { nodes: [fragmentSpread1.node, fragmentSpread2.node] }));
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
    for (const { responseName, fieldDetailsList1, fieldDetailsList2, } of getOverlappingFields(ruleContext, collectFieldsResult1, collectFieldsResult2)) {
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
function getOverlappingFields(ruleContext, collectFieldsResult1, collectFieldsResult2) {
    const byCollectFieldsResult = (collectFieldsResult1.overlappingFields ??=
        new Map());
    const cached = byCollectFieldsResult.get(collectFieldsResult2);
    if (cached !== undefined) {
        return cached;
    }
    const overlappingFields = [];
    for (const [responseName, fieldDetailsList1,] of collectFieldsResult1.groupedFieldSet.entries()) {
        spendComplexityBudget(ruleContext, 1);
        const fieldDetailsList2 = collectFieldsResult2.groupedFieldSet.get(responseName);
        if (fieldDetailsList2 != null) {
            overlappingFields.push({
                responseName,
                fieldDetailsList1,
                fieldDetailsList2,
            });
        }
    }
    byCollectFieldsResult.set(collectFieldsResult2, overlappingFields);
    return overlappingFields;
}
function findConflict(validationContext, ruleContext, parentFieldsAreMutuallyExclusive, responseName, fieldDetails1, scope1, fieldDetails2, scope2) {
    const { parentType: parentType1, node: node1, definition: def1, } = fieldDetails1;
    const { parentType: parentType2, node: node2, definition: def2, } = fieldDetails2;
    const areMutuallyExclusive = parentFieldsAreMutuallyExclusive ||
        (parentType1 !== parentType2 &&
            isObjectType(parentType1) &&
            isObjectType(parentType2));
    spendComplexityBudget(ruleContext, 2);
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
                reason: `"${maybeAbbreviate(name1)}" and "${maybeAbbreviate(name2)}" are different fields`,
                fields1: [node1],
                fields2: [node2],
            };
        }
        const comparedArguments = (comparison.arguments ??= compareArguments(ruleContext, fieldInfo1.arguments, fieldInfo2.arguments));
        if (!sameArguments(ruleContext, comparedArguments, scope1, scope2)) {
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
            if (sameArguments(ruleContext, comparedArguments, scope1, scope2)) {
                reason +=
                    '. See https://github.com/graphql/defer-stream-wg/discussions/100';
            }
        }
        return { responseName, reason, fields1: [node1], fields2: [node2] };
    }
    const type1 = def1?.type;
    const type2 = def2?.type;
    if (type1 && type2 && doTypesConflict(ruleContext, type1, type2)) {
        const type1String = (fieldInfo1.typeString ??= inspect(type1));
        const type2String = (fieldInfo2.typeString ??= inspect(type2));
        return {
            responseName,
            reason: `they return conflicting types "${type1String}" and "${type2String}"`,
            fields1: [node1],
            fields2: [node2],
        };
    }
    const selectionSet1 = node1.selectionSet;
    const selectionSet2 = node2.selectionSet;
    if (selectionSet1 && selectionSet2) {
        const conflicts = findConflictsBetweenSubSelectionSets(validationContext, ruleContext, areMutuallyExclusive, fieldInfo1.namedType, selectionSet1, scope1, fieldInfo2.namedType, selectionSet2, scope2);
        return subfieldConflicts(conflicts, responseName, node1, node2);
    }
}
function getFieldInfo(fieldDetails) {
    if (fieldDetails.info === undefined) {
        const node = fieldDetails.node;
        const stream = node.directives?.find((directive) => directive.name.value === 'stream');
        fieldDetails.info = {
            comparisons: new Map(),
            namedType: getNamedType(fieldDetails.definition?.type),
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
        spendComplexityBudget(ruleContext, 1);
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
function sameArguments(ruleContext, comparison, scope1, scope2) {
    if (!comparison.sameStructure) {
        return false;
    }
    return (scope1 === scope2 ||
        comparison.valuesWithVariables.every((value) => {
            spendComplexityBudget(ruleContext, 1);
            return (!usesLocalVariables(ruleContext, value, scope1) &&
                !usesLocalVariables(ruleContext, value, scope2));
        }));
}
function usesLocalVariables(ruleContext, value, scope) {
    if (scope === undefined) {
        return false;
    }
    const dependencies = (value.scopeDependencies ??= new Map());
    const cached = dependencies.get(scope.signature);
    if (cached !== undefined) {
        return cached;
    }
    const dependsOnScope = value.variables.some((variable) => {
        spendComplexityBudget(ruleContext, 1);
        return scope.signature.variableDefinitions.has(variable);
    });
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
                        .sort((first, second) => first.name.value < second.name.value
                        ? -1
                        : first.name.value > second.name.value
                            ? 1
                            : 0),
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
function doTypesConflict(ruleContext, type1, type2) {
    if (type1 === type2) {
        return false;
    }
    spendComplexityBudget(ruleContext, 1);
    if (isListType(type1)) {
        return isListType(type2)
            ? doTypesConflict(ruleContext, type1.ofType, type2.ofType)
            : true;
    }
    if (isListType(type2)) {
        return true;
    }
    if (isNonNullType(type1)) {
        return isNonNullType(type2)
            ? doTypesConflict(ruleContext, type1.ofType, type2.ofType)
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
    const fragmentType = typeFromAST(validationContext.getSchema(), fragment.typeCondition);
    return collectFields(validationContext, ruleContext, fragmentType, fragment.selectionSet);
}
function collectFieldsImpl(validationContext, parentType, selectionSet, groupedFieldSet, fragmentSpreads) {
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
    spendComplexityBudget(ruleContext, 1);
    let fragmentSpreadInfo = ruleContext.fragmentSpreadInfoByNode.get(fragmentSpreadNode);
    if (fragmentSpreadInfo === undefined) {
        const signature = validationContext.getFragmentSignatureByName()(fragmentSpreadNode.name.value);
        const argumentInfo = getArgumentInfo(fragmentSpreadNode.arguments);
        const parts = [];
        const values = [];
        if (signature && argumentInfo !== undefined) {
            const argMap = argumentInfo.values;
            const names = [];
            for (const name of argMap.keys()) {
                if (signature.variableDefinitions.has(name)) {
                    names.push(name);
                }
            }
            for (const name of names.sort()) {
                const argument = getValueInfo(ruleContext, argMap.get(name));
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
        fragmentSpreadInfo = ruleContext.fragmentSpreadInfoByKey.get(fragmentSpreadInfoKey);
        if (fragmentSpreadInfo === undefined) {
            fragmentSpreadInfo = {
                signature,
                values,
                byScope: new Map(),
            };
            ruleContext.fragmentSpreadInfoByKey.set(fragmentSpreadInfoKey, fragmentSpreadInfo);
        }
        ruleContext.fragmentSpreadInfoByNode.set(fragmentSpreadNode, fragmentSpreadInfo);
    }
    const variableScope = fragmentSpreadInfo.values.some((value) => {
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
function getVariableScope(fragmentSignature) {
    if (!fragmentSignature || fragmentSignature.variableDefinitions.size === 0) {
        return;
    }
    return { signature: fragmentSignature };
}
function getFragmentSpreadDescription(ruleContext, node) {
    const description = {
        ...node,
        name: { ...node.name, value: maybeAbbreviate(node.name.value) },
        directives: [],
    };
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
function subfieldConflicts(conflicts, responseName, node1, node2) {
    if (conflicts.length > 0) {
        let message = '';
        for (const { responseName: name, reason } of conflicts) {
            message +=
                (message === '' ? '' : ' and ') +
                    `subfields "${maybeAbbreviate(name)}" conflict because ${reason}`;
            if (message.length > MAX_CONFLICT_DETAIL_LENGTH) {
                break;
            }
        }
        return {
            responseName,
            reason: maybeAbbreviate(message),
            fields1: collectConflictNodes(node1, conflicts, 'fields1'),
            fields2: collectConflictNodes(node2, conflicts, 'fields2'),
        };
    }
}
function collectConflictNodes(node, conflicts, side) {
    const nodes = [node];
    for (const conflict of conflicts) {
        const remaining = MAX_CONFLICT_NODES - nodes.length;
        const retainedNodes = conflict[side].slice(-remaining);
        nodes.push(...retainedNodes);
        if (nodes.length === MAX_CONFLICT_NODES) {
            break;
        }
    }
    return nodes;
}
function maybeAbbreviate(text) {
    return text.length > MAX_CONFLICT_DETAIL_LENGTH
        ? text.slice(0, MAX_CONFLICT_DETAIL_LENGTH) + '...'
        : text;
}
function spendComplexityBudget(ruleContext, cost) {
    ruleContext.remainingComplexityBudget -= cost;
    if (ruleContext.remainingComplexityBudget < 0) {
        throw validationAbortedError;
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