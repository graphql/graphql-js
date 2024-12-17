import { inspect } from "../jsutils/inspect.mjs";
import { invariant } from "../jsutils/invariant.mjs";
import { keyMap } from "../jsutils/keyMap.mjs";
import { print } from "../language/printer.mjs";
import { isEnumType, isInputObjectType, isInterfaceType, isListType, isNamedType, isNonNullType, isObjectType, isRequiredArgument, isRequiredInputField, isScalarType, isUnionType, } from "../type/definition.mjs";
import { isSpecifiedScalarType } from "../type/scalars.mjs";
import { getDefaultValueAST } from "./getDefaultValueAST.mjs";
import { sortValueNode } from "./sortValueNode.mjs";
export const BreakingChangeType = {
    TYPE_REMOVED: 'TYPE_REMOVED',
    TYPE_CHANGED_KIND: 'TYPE_CHANGED_KIND',
    TYPE_REMOVED_FROM_UNION: 'TYPE_REMOVED_FROM_UNION',
    VALUE_REMOVED_FROM_ENUM: 'VALUE_REMOVED_FROM_ENUM',
    REQUIRED_INPUT_FIELD_ADDED: 'REQUIRED_INPUT_FIELD_ADDED',
    IMPLEMENTED_INTERFACE_REMOVED: 'IMPLEMENTED_INTERFACE_REMOVED',
    FIELD_REMOVED: 'FIELD_REMOVED',
    FIELD_CHANGED_KIND: 'FIELD_CHANGED_KIND',
    REQUIRED_ARG_ADDED: 'REQUIRED_ARG_ADDED',
    ARG_REMOVED: 'ARG_REMOVED',
    ARG_CHANGED_KIND: 'ARG_CHANGED_KIND',
    DIRECTIVE_REMOVED: 'DIRECTIVE_REMOVED',
    DIRECTIVE_ARG_REMOVED: 'DIRECTIVE_ARG_REMOVED',
    REQUIRED_DIRECTIVE_ARG_ADDED: 'REQUIRED_DIRECTIVE_ARG_ADDED',
    DIRECTIVE_REPEATABLE_REMOVED: 'DIRECTIVE_REPEATABLE_REMOVED',
    DIRECTIVE_LOCATION_REMOVED: 'DIRECTIVE_LOCATION_REMOVED',
};
export const DangerousChangeType = {
    VALUE_ADDED_TO_ENUM: 'VALUE_ADDED_TO_ENUM',
    TYPE_ADDED_TO_UNION: 'TYPE_ADDED_TO_UNION',
    OPTIONAL_INPUT_FIELD_ADDED: 'OPTIONAL_INPUT_FIELD_ADDED',
    OPTIONAL_ARG_ADDED: 'OPTIONAL_ARG_ADDED',
    IMPLEMENTED_INTERFACE_ADDED: 'IMPLEMENTED_INTERFACE_ADDED',
    ARG_DEFAULT_VALUE_CHANGE: 'ARG_DEFAULT_VALUE_CHANGE',
};
export const SafeChangeType = {
    DESCRIPTION_CHANGED: 'DESCRIPTION_CHANGED',
    TYPE_ADDED: 'TYPE_ADDED',
    OPTIONAL_INPUT_FIELD_ADDED: 'OPTIONAL_INPUT_FIELD_ADDED',
    OPTIONAL_ARG_ADDED: 'OPTIONAL_ARG_ADDED',
    DIRECTIVE_ADDED: 'DIRECTIVE_ADDED',
    FIELD_ADDED: 'FIELD_ADDED',
    DIRECTIVE_REPEATABLE_ADDED: 'DIRECTIVE_REPEATABLE_ADDED',
    DIRECTIVE_LOCATION_ADDED: 'DIRECTIVE_LOCATION_ADDED',
    OPTIONAL_DIRECTIVE_ARG_ADDED: 'OPTIONAL_DIRECTIVE_ARG_ADDED',
    FIELD_CHANGED_KIND_SAFE: 'FIELD_CHANGED_KIND_SAFE',
    ARG_CHANGED_KIND_SAFE: 'ARG_CHANGED_KIND_SAFE',
    ARG_DEFAULT_VALUE_ADDED: 'ARG_DEFAULT_VALUE_ADDED',
};
/**
 * Given two schemas, returns an Array containing descriptions of all the types
 * of breaking changes covered by the other functions down below.
 *
 * @deprecated Please use `findSchemaChanges` instead. Will be removed in v18.
 */
export function findBreakingChanges(oldSchema, newSchema) {
    // @ts-expect-error
    return findSchemaChanges(oldSchema, newSchema).filter((change) => change.type in BreakingChangeType);
}
/**
 * Given two schemas, returns an Array containing descriptions of all the types
 * of potentially dangerous changes covered by the other functions down below.
 *
 * @deprecated Please use `findSchemaChanges` instead. Will be removed in v18.
 */
export function findDangerousChanges(oldSchema, newSchema) {
    // @ts-expect-error
    return findSchemaChanges(oldSchema, newSchema).filter((change) => change.type in DangerousChangeType);
}
export function findSchemaChanges(oldSchema, newSchema) {
    return [
        ...findTypeChanges(oldSchema, newSchema),
        ...findDirectiveChanges(oldSchema, newSchema),
    ];
}
function findDirectiveChanges(oldSchema, newSchema) {
    const schemaChanges = [];
    const directivesDiff = diff(oldSchema.getDirectives(), newSchema.getDirectives());
    for (const oldDirective of directivesDiff.removed) {
        schemaChanges.push({
            type: BreakingChangeType.DIRECTIVE_REMOVED,
            description: `Directive ${oldDirective} was removed.`,
        });
    }
    for (const newDirective of directivesDiff.added) {
        schemaChanges.push({
            type: SafeChangeType.DIRECTIVE_ADDED,
            description: `Directive @${newDirective.name} was added.`,
        });
    }
    for (const [oldDirective, newDirective] of directivesDiff.persisted) {
        const argsDiff = diff(oldDirective.args, newDirective.args);
        for (const newArg of argsDiff.added) {
            if (isRequiredArgument(newArg)) {
                schemaChanges.push({
                    type: BreakingChangeType.REQUIRED_DIRECTIVE_ARG_ADDED,
                    description: `A required argument ${newArg} was added.`,
                });
            }
            else {
                schemaChanges.push({
                    type: SafeChangeType.OPTIONAL_DIRECTIVE_ARG_ADDED,
                    description: `An optional argument @${oldDirective.name}(${newArg.name}:) was added.`,
                });
            }
        }
        for (const oldArg of argsDiff.removed) {
            schemaChanges.push({
                type: BreakingChangeType.DIRECTIVE_ARG_REMOVED,
                description: `Argument ${oldArg} was removed.`,
            });
        }
        for (const [oldArg, newArg] of argsDiff.persisted) {
            const isSafe = isChangeSafeForInputObjectFieldOrFieldArg(oldArg.type, newArg.type);
            const oldDefaultValueStr = getDefaultValue(oldArg);
            const newDefaultValueStr = getDefaultValue(newArg);
            if (!isSafe) {
                schemaChanges.push({
                    type: BreakingChangeType.ARG_CHANGED_KIND,
                    description: `Argument @${oldDirective.name}(${oldArg.name}:) has changed type from ` +
                        `${String(oldArg.type)} to ${String(newArg.type)}.`,
                });
            }
            else if (oldDefaultValueStr !== undefined) {
                if (newDefaultValueStr === undefined) {
                    schemaChanges.push({
                        type: DangerousChangeType.ARG_DEFAULT_VALUE_CHANGE,
                        description: `@${oldDirective.name}(${oldArg.name}:) defaultValue was removed.`,
                    });
                }
                else if (oldDefaultValueStr !== newDefaultValueStr) {
                    schemaChanges.push({
                        type: DangerousChangeType.ARG_DEFAULT_VALUE_CHANGE,
                        description: `@${oldDirective.name}(${oldArg.name}:) has changed defaultValue from ${oldDefaultValueStr} to ${newDefaultValueStr}.`,
                    });
                }
            }
            else if (newDefaultValueStr !== undefined &&
                oldDefaultValueStr === undefined) {
                schemaChanges.push({
                    type: SafeChangeType.ARG_DEFAULT_VALUE_ADDED,
                    description: `@${oldDirective.name}(${oldArg.name}:) added a defaultValue ${newDefaultValueStr}.`,
                });
            }
            else if (oldArg.type.toString() !== newArg.type.toString()) {
                schemaChanges.push({
                    type: SafeChangeType.ARG_CHANGED_KIND_SAFE,
                    description: `Argument @${oldDirective.name}(${oldArg.name}:) has changed type from ` +
                        `${String(oldArg.type)} to ${String(newArg.type)}.`,
                });
            }
            if (oldArg.description !== newArg.description) {
                schemaChanges.push({
                    type: SafeChangeType.DESCRIPTION_CHANGED,
                    description: `Description of @${oldDirective.name}(${oldDirective.name}) has changed to "${newArg.description}".`,
                });
            }
        }
        if (oldDirective.isRepeatable && !newDirective.isRepeatable) {
            schemaChanges.push({
                type: BreakingChangeType.DIRECTIVE_REPEATABLE_REMOVED,
                description: `Repeatable flag was removed from ${oldDirective}.`,
            });
        }
        else if (newDirective.isRepeatable && !oldDirective.isRepeatable) {
            schemaChanges.push({
                type: SafeChangeType.DIRECTIVE_REPEATABLE_ADDED,
                description: `Repeatable flag was added to @${oldDirective.name}.`,
            });
        }
        if (oldDirective.description !== newDirective.description) {
            schemaChanges.push({
                type: SafeChangeType.DESCRIPTION_CHANGED,
                description: `Description of @${oldDirective.name} has changed to "${newDirective.description}".`,
            });
        }
        for (const location of oldDirective.locations) {
            if (!newDirective.locations.includes(location)) {
                schemaChanges.push({
                    type: BreakingChangeType.DIRECTIVE_LOCATION_REMOVED,
                    description: `${location} was removed from ${oldDirective}.`,
                });
            }
        }
        for (const location of newDirective.locations) {
            if (!oldDirective.locations.includes(location)) {
                schemaChanges.push({
                    type: SafeChangeType.DIRECTIVE_LOCATION_ADDED,
                    description: `${location} was added to @${oldDirective.name}.`,
                });
            }
        }
    }
    return schemaChanges;
}
function findTypeChanges(oldSchema, newSchema) {
    const schemaChanges = [];
    const typesDiff = diff(Object.values(oldSchema.getTypeMap()), Object.values(newSchema.getTypeMap()));
    for (const oldType of typesDiff.removed) {
        schemaChanges.push({
            type: BreakingChangeType.TYPE_REMOVED,
            description: isSpecifiedScalarType(oldType)
                ? `Standard scalar ${oldType} was removed because it is not referenced anymore.`
                : `${oldType} was removed.`,
        });
    }
    for (const newType of typesDiff.added) {
        schemaChanges.push({
            type: SafeChangeType.TYPE_ADDED,
            description: `${newType} was added.`,
        });
    }
    for (const [oldType, newType] of typesDiff.persisted) {
        if (oldType.description !== newType.description) {
            schemaChanges.push({
                type: SafeChangeType.DESCRIPTION_CHANGED,
                description: `Description of ${oldType.name} has changed to "${newType.description}".`,
            });
        }
        if (isEnumType(oldType) && isEnumType(newType)) {
            schemaChanges.push(...findEnumTypeChanges(oldType, newType));
        }
        else if (isUnionType(oldType) && isUnionType(newType)) {
            schemaChanges.push(...findUnionTypeChanges(oldType, newType));
        }
        else if (isInputObjectType(oldType) && isInputObjectType(newType)) {
            schemaChanges.push(...findInputObjectTypeChanges(oldType, newType));
        }
        else if (isObjectType(oldType) && isObjectType(newType)) {
            schemaChanges.push(...findFieldChanges(oldType, newType), ...findImplementedInterfacesChanges(oldType, newType));
        }
        else if (isInterfaceType(oldType) && isInterfaceType(newType)) {
            schemaChanges.push(...findFieldChanges(oldType, newType), ...findImplementedInterfacesChanges(oldType, newType));
        }
        else if (oldType.constructor !== newType.constructor) {
            schemaChanges.push({
                type: BreakingChangeType.TYPE_CHANGED_KIND,
                description: `${oldType} changed from ${typeKindName(oldType)} to ${typeKindName(newType)}.`,
            });
        }
    }
    return schemaChanges;
}
function findInputObjectTypeChanges(oldType, newType) {
    const schemaChanges = [];
    const fieldsDiff = diff(Object.values(oldType.getFields()), Object.values(newType.getFields()));
    for (const newField of fieldsDiff.added) {
        if (isRequiredInputField(newField)) {
            schemaChanges.push({
                type: BreakingChangeType.REQUIRED_INPUT_FIELD_ADDED,
                description: `A required field ${newField} was added.`,
            });
        }
        else {
            schemaChanges.push({
                type: DangerousChangeType.OPTIONAL_INPUT_FIELD_ADDED,
                description: `An optional field ${newField} was added.`,
            });
        }
    }
    for (const oldField of fieldsDiff.removed) {
        schemaChanges.push({
            type: BreakingChangeType.FIELD_REMOVED,
            description: `Field ${oldField} was removed.`,
        });
    }
    for (const [oldField, newField] of fieldsDiff.persisted) {
        const isSafe = isChangeSafeForInputObjectFieldOrFieldArg(oldField.type, newField.type);
        if (!isSafe) {
            schemaChanges.push({
                type: BreakingChangeType.FIELD_CHANGED_KIND,
                description: `Field ${newField} changed type from ${oldField.type} to ${newField.type}.`,
            });
        }
        else if (oldField.type.toString() !== newField.type.toString()) {
            schemaChanges.push({
                type: SafeChangeType.FIELD_CHANGED_KIND_SAFE,
                description: `Field ${oldType}.${oldField.name} changed type from ` +
                    `${String(oldField.type)} to ${String(newField.type)}.`,
            });
        }
        if (oldField.description !== newField.description) {
            schemaChanges.push({
                type: SafeChangeType.DESCRIPTION_CHANGED,
                description: `Description of input-field ${newType}.${newField.name} has changed to "${newField.description}".`,
            });
        }
    }
    return schemaChanges;
}
function findUnionTypeChanges(oldType, newType) {
    const schemaChanges = [];
    const possibleTypesDiff = diff(oldType.getTypes(), newType.getTypes());
    for (const newPossibleType of possibleTypesDiff.added) {
        schemaChanges.push({
            type: DangerousChangeType.TYPE_ADDED_TO_UNION,
            description: `${newPossibleType} was added to union type ${oldType}.`,
        });
    }
    for (const oldPossibleType of possibleTypesDiff.removed) {
        schemaChanges.push({
            type: BreakingChangeType.TYPE_REMOVED_FROM_UNION,
            description: `${oldPossibleType} was removed from union type ${oldType}.`,
        });
    }
    return schemaChanges;
}
function findEnumTypeChanges(oldType, newType) {
    const schemaChanges = [];
    const valuesDiff = diff(oldType.getValues(), newType.getValues());
    for (const newValue of valuesDiff.added) {
        schemaChanges.push({
            type: DangerousChangeType.VALUE_ADDED_TO_ENUM,
            description: `Enum value ${newValue} was added.`,
        });
    }
    for (const oldValue of valuesDiff.removed) {
        schemaChanges.push({
            type: BreakingChangeType.VALUE_REMOVED_FROM_ENUM,
            description: `Enum value ${oldValue} was removed.`,
        });
    }
    for (const [oldValue, newValue] of valuesDiff.persisted) {
        if (oldValue.description !== newValue.description) {
            schemaChanges.push({
                type: SafeChangeType.DESCRIPTION_CHANGED,
                description: `Description of enum value ${oldType}.${oldValue.name} has changed to "${newValue.description}".`,
            });
        }
    }
    return schemaChanges;
}
function findImplementedInterfacesChanges(oldType, newType) {
    const schemaChanges = [];
    const interfacesDiff = diff(oldType.getInterfaces(), newType.getInterfaces());
    for (const newInterface of interfacesDiff.added) {
        schemaChanges.push({
            type: DangerousChangeType.IMPLEMENTED_INTERFACE_ADDED,
            description: `${newInterface} added to interfaces implemented by ${oldType}.`,
        });
    }
    for (const oldInterface of interfacesDiff.removed) {
        schemaChanges.push({
            type: BreakingChangeType.IMPLEMENTED_INTERFACE_REMOVED,
            description: `${oldType} no longer implements interface ${oldInterface}.`,
        });
    }
    return schemaChanges;
}
function findFieldChanges(oldType, newType) {
    const schemaChanges = [];
    const fieldsDiff = diff(Object.values(oldType.getFields()), Object.values(newType.getFields()));
    for (const oldField of fieldsDiff.removed) {
        schemaChanges.push({
            type: BreakingChangeType.FIELD_REMOVED,
            description: `Field ${oldField} was removed.`,
        });
    }
    for (const newField of fieldsDiff.added) {
        schemaChanges.push({
            type: SafeChangeType.FIELD_ADDED,
            description: `Field ${oldType}.${newField.name} was added.`,
        });
    }
    for (const [oldField, newField] of fieldsDiff.persisted) {
        schemaChanges.push(...findArgChanges(oldField, newField));
        const isSafe = isChangeSafeForObjectOrInterfaceField(oldField.type, newField.type);
        if (!isSafe) {
            schemaChanges.push({
                type: BreakingChangeType.FIELD_CHANGED_KIND,
                description: `Field ${newField} changed type from ${oldField.type} to ${newField.type}.`,
            });
        }
        else if (oldField.type.toString() !== newField.type.toString()) {
            schemaChanges.push({
                type: SafeChangeType.FIELD_CHANGED_KIND_SAFE,
                description: `Field ${oldType}.${oldField.name} changed type from ` +
                    `${String(oldField.type)} to ${String(newField.type)}.`,
            });
        }
        if (oldField.description !== newField.description) {
            schemaChanges.push({
                type: SafeChangeType.DESCRIPTION_CHANGED,
                description: `Description of field ${oldType}.${oldField.name} has changed to "${newField.description}".`,
            });
        }
    }
    return schemaChanges;
}
function findArgChanges(oldField, newField) {
    const schemaChanges = [];
    const argsDiff = diff(oldField.args, newField.args);
    for (const oldArg of argsDiff.removed) {
        schemaChanges.push({
            type: BreakingChangeType.ARG_REMOVED,
            description: `Argument ${oldArg} was removed.`,
        });
    }
    for (const [oldArg, newArg] of argsDiff.persisted) {
        const isSafe = isChangeSafeForInputObjectFieldOrFieldArg(oldArg.type, newArg.type);
        const oldDefaultValueStr = getDefaultValue(oldArg);
        const newDefaultValueStr = getDefaultValue(newArg);
        if (!isSafe) {
            schemaChanges.push({
                type: BreakingChangeType.ARG_CHANGED_KIND,
                description: `Argument ${newArg} has changed type from ${oldArg.type} to ${newArg.type}.`,
            });
        }
        else if (oldDefaultValueStr !== undefined) {
            if (newDefaultValueStr === undefined) {
                schemaChanges.push({
                    type: DangerousChangeType.ARG_DEFAULT_VALUE_CHANGE,
                    description: `${oldArg} defaultValue was removed.`,
                });
            }
            else if (oldDefaultValueStr !== newDefaultValueStr) {
                schemaChanges.push({
                    type: DangerousChangeType.ARG_DEFAULT_VALUE_CHANGE,
                    description: `${oldArg} has changed defaultValue from ${oldDefaultValueStr} to ${newDefaultValueStr}.`,
                });
            }
        }
        else if (newDefaultValueStr !== undefined &&
            oldDefaultValueStr === undefined) {
            schemaChanges.push({
                type: SafeChangeType.ARG_DEFAULT_VALUE_ADDED,
                description: `${oldArg} added a defaultValue ${newDefaultValueStr}.`,
            });
        }
        else if (oldArg.type.toString() !== newArg.type.toString()) {
            schemaChanges.push({
                type: SafeChangeType.ARG_CHANGED_KIND_SAFE,
                description: `Argument ${oldArg} has changed type from ` +
                    `${String(oldArg.type)} to ${String(newArg.type)}.`,
            });
        }
        if (oldArg.description !== newArg.description) {
            schemaChanges.push({
                type: SafeChangeType.DESCRIPTION_CHANGED,
                description: `Description of argument ${oldArg} has changed to "${newArg.description}".`,
            });
        }
    }
    for (const newArg of argsDiff.added) {
        if (isRequiredArgument(newArg)) {
            schemaChanges.push({
                type: BreakingChangeType.REQUIRED_ARG_ADDED,
                description: `A required argument ${newArg} was added.`,
            });
        }
        else {
            schemaChanges.push({
                type: DangerousChangeType.OPTIONAL_ARG_ADDED,
                description: `An optional argument ${newArg} was added.`,
            });
        }
    }
    return schemaChanges;
}
function isChangeSafeForObjectOrInterfaceField(oldType, newType) {
    if (isListType(oldType)) {
        return (
        // if they're both lists, make sure the underlying types are compatible
        (isListType(newType) &&
            isChangeSafeForObjectOrInterfaceField(oldType.ofType, newType.ofType)) ||
            // moving from nullable to non-null of the same underlying type is safe
            (isNonNullType(newType) &&
                isChangeSafeForObjectOrInterfaceField(oldType, newType.ofType)));
    }
    if (isNonNullType(oldType)) {
        // if they're both non-null, make sure the underlying types are compatible
        return (isNonNullType(newType) &&
            isChangeSafeForObjectOrInterfaceField(oldType.ofType, newType.ofType));
    }
    return (
    // if they're both named types, see if their names are equivalent
    (isNamedType(newType) && oldType.name === newType.name) ||
        // moving from nullable to non-null of the same underlying type is safe
        (isNonNullType(newType) &&
            isChangeSafeForObjectOrInterfaceField(oldType, newType.ofType)));
}
function isChangeSafeForInputObjectFieldOrFieldArg(oldType, newType) {
    if (isListType(oldType)) {
        // if they're both lists, make sure the underlying types are compatible
        return (isListType(newType) &&
            isChangeSafeForInputObjectFieldOrFieldArg(oldType.ofType, newType.ofType));
    }
    if (isNonNullType(oldType)) {
        return (
        // if they're both non-null, make sure the underlying types are
        // compatible
        (isNonNullType(newType) &&
            isChangeSafeForInputObjectFieldOrFieldArg(oldType.ofType, newType.ofType)) ||
            // moving from non-null to nullable of the same underlying type is safe
            (!isNonNullType(newType) &&
                isChangeSafeForInputObjectFieldOrFieldArg(oldType.ofType, newType)));
    }
    // if they're both named types, see if their names are equivalent
    return isNamedType(newType) && oldType.name === newType.name;
}
function typeKindName(type) {
    if (isScalarType(type)) {
        return 'a Scalar type';
    }
    if (isObjectType(type)) {
        return 'an Object type';
    }
    if (isInterfaceType(type)) {
        return 'an Interface type';
    }
    if (isUnionType(type)) {
        return 'a Union type';
    }
    if (isEnumType(type)) {
        return 'an Enum type';
    }
    if (isInputObjectType(type)) {
        return 'an Input type';
    }
    /* c8 ignore next 3 */
    // Not reachable, all possible types have been considered.
    (false) || invariant(false, 'Unexpected type: ' + inspect(type));
}
// Since we looking only for client's observable changes we should
// compare default values in the same representation as they are
// represented inside introspection.
function getDefaultValue(argOrInputField) {
    const ast = getDefaultValueAST(argOrInputField);
    if (ast) {
        return print(sortValueNode(ast));
    }
}
function diff(oldArray, newArray) {
    const added = [];
    const removed = [];
    const persisted = [];
    const oldMap = keyMap(oldArray, ({ name }) => name);
    const newMap = keyMap(newArray, ({ name }) => name);
    for (const oldItem of oldArray) {
        const newItem = newMap[oldItem.name];
        if (newItem === undefined) {
            removed.push(oldItem);
        }
        else {
            persisted.push([oldItem, newItem]);
        }
    }
    for (const newItem of newArray) {
        if (oldMap[newItem.name] === undefined) {
            added.push(newItem);
        }
    }
    return { added, persisted, removed };
}
//# sourceMappingURL=findSchemaChanges.js.map