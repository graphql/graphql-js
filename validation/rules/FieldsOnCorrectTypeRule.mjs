import { didYouMean } from "../../jsutils/didYouMean.mjs";
import { naturalCompare } from "../../jsutils/naturalCompare.mjs";
import { suggestionList } from "../../jsutils/suggestionList.mjs";
import { GraphQLError } from "../../error/GraphQLError.mjs";
import { isAbstractType, isInterfaceType, isObjectType, } from "../../type/definition.mjs";
export function FieldsOnCorrectTypeRule(context) {
    return {
        Field(node) {
            const type = context.getParentType();
            if (type) {
                const fieldDef = context.getFieldDef();
                if (!fieldDef) {
                    const schema = context.getSchema();
                    const fieldName = node.name.value;
                    let suggestion = didYouMean('to use an inline fragment on', context.hideSuggestions
                        ? []
                        : getSuggestedTypeNames(schema, type, fieldName));
                    if (suggestion === '') {
                        suggestion = didYouMean(context.hideSuggestions
                            ? []
                            : getSuggestedFieldNames(type, fieldName));
                    }
                    context.reportError(new GraphQLError(`Cannot query field "${fieldName}" on type "${type}".` +
                        suggestion, { nodes: node }));
                }
            }
        },
    };
}
function getSuggestedTypeNames(schema, type, fieldName) {
    if (!isAbstractType(type)) {
        return [];
    }
    const suggestedTypes = new Set();
    const usageCount = Object.create(null);
    for (const possibleType of schema.getPossibleTypes(type)) {
        if (possibleType.getFields()[fieldName] == null) {
            continue;
        }
        suggestedTypes.add(possibleType);
        usageCount[possibleType.name] = 1;
        for (const possibleInterface of possibleType.getInterfaces()) {
            if (possibleInterface.getFields()[fieldName] == null) {
                continue;
            }
            suggestedTypes.add(possibleInterface);
            usageCount[possibleInterface.name] =
                (usageCount[possibleInterface.name] ?? 0) + 1;
        }
    }
    return [...suggestedTypes]
        .sort((typeA, typeB) => {
        const usageCountDiff = usageCount[typeB.name] - usageCount[typeA.name];
        if (usageCountDiff !== 0) {
            return usageCountDiff;
        }
        if (isInterfaceType(typeA) && schema.isSubType(typeA, typeB)) {
            return -1;
        }
        if (isInterfaceType(typeB) && schema.isSubType(typeB, typeA)) {
            return 1;
        }
        return naturalCompare(typeA.name, typeB.name);
    })
        .map((x) => x.name);
}
function getSuggestedFieldNames(type, fieldName) {
    if (isObjectType(type) || isInterfaceType(type)) {
        const possibleFieldNames = Object.keys(type.getFields());
        return suggestionList(fieldName, possibleFieldNames);
    }
    return [];
}
//# sourceMappingURL=FieldsOnCorrectTypeRule.mjs.map