import { inspect } from '../jsutils/inspect.js';
import { invariant } from '../jsutils/invariant.js';
import { keyMap } from '../jsutils/keyMap.js';

import { print } from '../language/printer.js';

import type {
  GraphQLArgument,
  GraphQLEnumType,
  GraphQLField,
  GraphQLInputField,
  GraphQLInputObjectType,
  GraphQLInterfaceType,
  GraphQLNamedType,
  GraphQLObjectType,
  GraphQLType,
  GraphQLUnionType,
} from '../type/definition.js';
import {
  isEnumType,
  isInputObjectType,
  isInterfaceType,
  isListType,
  isNamedType,
  isNonNullType,
  isObjectType,
  isRequiredArgument,
  isRequiredInputField,
  isScalarType,
  isUnionType,
} from '../type/definition.js';
import { isSpecifiedScalarType } from '../type/scalars.js';
import type { GraphQLSchema } from '../type/schema.js';

import { getDefaultValueAST } from './getDefaultValueAST.js';
import { sortValueNode } from './sortValueNode.js';

export const BreakingChangeType = {
  TYPE_REMOVED: 'TYPE_REMOVED' as const,
  TYPE_CHANGED_KIND: 'TYPE_CHANGED_KIND' as const,
  TYPE_REMOVED_FROM_UNION: 'TYPE_REMOVED_FROM_UNION' as const,
  VALUE_REMOVED_FROM_ENUM: 'VALUE_REMOVED_FROM_ENUM' as const,
  REQUIRED_INPUT_FIELD_ADDED: 'REQUIRED_INPUT_FIELD_ADDED' as const,
  IMPLEMENTED_INTERFACE_REMOVED: 'IMPLEMENTED_INTERFACE_REMOVED' as const,
  FIELD_REMOVED: 'FIELD_REMOVED' as const,
  FIELD_CHANGED_KIND: 'FIELD_CHANGED_KIND' as const,
  REQUIRED_ARG_ADDED: 'REQUIRED_ARG_ADDED' as const,
  ARG_REMOVED: 'ARG_REMOVED' as const,
  ARG_CHANGED_KIND: 'ARG_CHANGED_KIND' as const,
  DIRECTIVE_REMOVED: 'DIRECTIVE_REMOVED' as const,
  DIRECTIVE_ARG_REMOVED: 'DIRECTIVE_ARG_REMOVED' as const,
  REQUIRED_DIRECTIVE_ARG_ADDED: 'REQUIRED_DIRECTIVE_ARG_ADDED' as const,
  DIRECTIVE_REPEATABLE_REMOVED: 'DIRECTIVE_REPEATABLE_REMOVED' as const,
  DIRECTIVE_LOCATION_REMOVED: 'DIRECTIVE_LOCATION_REMOVED' as const,
} as const;
// eslint-disable-next-line @typescript-eslint/no-redeclare
export type BreakingChangeType =
  (typeof BreakingChangeType)[keyof typeof BreakingChangeType];

export const DangerousChangeType = {
  VALUE_ADDED_TO_ENUM: 'VALUE_ADDED_TO_ENUM' as const,
  TYPE_ADDED_TO_UNION: 'TYPE_ADDED_TO_UNION' as const,
  OPTIONAL_INPUT_FIELD_ADDED: 'OPTIONAL_INPUT_FIELD_ADDED' as const,
  OPTIONAL_ARG_ADDED: 'OPTIONAL_ARG_ADDED' as const,
  IMPLEMENTED_INTERFACE_ADDED: 'IMPLEMENTED_INTERFACE_ADDED' as const,
  ARG_DEFAULT_VALUE_CHANGE: 'ARG_DEFAULT_VALUE_CHANGE' as const,
};
// eslint-disable-next-line @typescript-eslint/no-redeclare
export type DangerousChangeType =
  (typeof DangerousChangeType)[keyof typeof DangerousChangeType];

export const SafeChangeType = {
  DESCRIPTION_CHANGED: 'DESCRIPTION_CHANGED' as const,
  TYPE_ADDED: 'TYPE_ADDED' as const,
  OPTIONAL_INPUT_FIELD_ADDED: 'OPTIONAL_INPUT_FIELD_ADDED' as const,
  OPTIONAL_ARG_ADDED: 'OPTIONAL_ARG_ADDED' as const,
  DIRECTIVE_ADDED: 'DIRECTIVE_ADDED' as const,
  FIELD_ADDED: 'FIELD_ADDED' as const,
  DIRECTIVE_REPEATABLE_ADDED: 'DIRECTIVE_REPEATABLE_ADDED' as const,
  DIRECTIVE_LOCATION_ADDED: 'DIRECTIVE_LOCATION_ADDED' as const,
  OPTIONAL_DIRECTIVE_ARG_ADDED: 'OPTIONAL_DIRECTIVE_ARG_ADDED' as const,
  FIELD_CHANGED_KIND_SAFE: 'FIELD_CHANGED_KIND_SAFE' as const,
  ARG_CHANGED_KIND_SAFE: 'ARG_CHANGED_KIND_SAFE' as const,
  ARG_DEFAULT_VALUE_ADDED: 'ARG_DEFAULT_VALUE_ADDED' as const,
};
// eslint-disable-next-line @typescript-eslint/no-redeclare
export type SafeChangeType =
  (typeof SafeChangeType)[keyof typeof SafeChangeType];

export interface BreakingChange {
  type: BreakingChangeType;
  description: string;
}

export interface DangerousChange {
  type: DangerousChangeType;
  description: string;
}

export interface SafeChange {
  type: SafeChangeType;
  description: string;
}

export type SchemaChange = SafeChange | DangerousChange | BreakingChange;

/**
 * Given two schemas, returns an Array containing descriptions of all the types
 * of breaking changes covered by the other functions down below.
 *
 * @deprecated Please use `findSchemaChanges` instead. Will be removed in v18.
 */
export function findBreakingChanges(
  oldSchema: GraphQLSchema,
  newSchema: GraphQLSchema,
): Array<BreakingChange> {
  // @ts-expect-error
  return findSchemaChanges(oldSchema, newSchema).filter(
    (change) => change.type in BreakingChangeType,
  );
}

/**
 * Given two schemas, returns an Array containing descriptions of all the types
 * of potentially dangerous changes covered by the other functions down below.
 *
 * @deprecated Please use `findSchemaChanges` instead. Will be removed in v18.
 */
export function findDangerousChanges(
  oldSchema: GraphQLSchema,
  newSchema: GraphQLSchema,
): Array<DangerousChange> {
  // @ts-expect-error
  return findSchemaChanges(oldSchema, newSchema).filter(
    (change) => change.type in DangerousChangeType,
  );
}

export function findSchemaChanges(
  oldSchema: GraphQLSchema,
  newSchema: GraphQLSchema,
): Array<SchemaChange> {
  return [
    ...findTypeChanges(oldSchema, newSchema),
    ...findDirectiveChanges(oldSchema, newSchema),
  ];
}

function findDirectiveChanges(
  oldSchema: GraphQLSchema,
  newSchema: GraphQLSchema,
): Array<SchemaChange> {
  const schemaChanges = [];

  const directivesDiff = diff(
    oldSchema.getDirectives(),
    newSchema.getDirectives(),
  );

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
      } else {
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
      const isSafe = isChangeSafeForInputObjectFieldOrFieldArg(
        oldArg.type,
        newArg.type,
      );

      const oldDefaultValueStr = getDefaultValue(oldArg);
      const newDefaultValueStr = getDefaultValue(newArg);
      if (!isSafe) {
        schemaChanges.push({
          type: BreakingChangeType.ARG_CHANGED_KIND,
          description:
            `Argument @${oldDirective.name}(${oldArg.name}:) has changed type from ` +
            `${String(oldArg.type)} to ${String(newArg.type)}.`,
        });
      } else if (oldDefaultValueStr !== undefined) {
        if (newDefaultValueStr === undefined) {
          schemaChanges.push({
            type: DangerousChangeType.ARG_DEFAULT_VALUE_CHANGE,
            description: `@${oldDirective.name}(${oldArg.name}:) defaultValue was removed.`,
          });
        } else if (oldDefaultValueStr !== newDefaultValueStr) {
          schemaChanges.push({
            type: DangerousChangeType.ARG_DEFAULT_VALUE_CHANGE,
            description: `@${oldDirective.name}(${oldArg.name}:) has changed defaultValue from ${oldDefaultValueStr} to ${newDefaultValueStr}.`,
          });
        }
      } else if (
        newDefaultValueStr !== undefined &&
        oldDefaultValueStr === undefined
      ) {
        schemaChanges.push({
          type: SafeChangeType.ARG_DEFAULT_VALUE_ADDED,
          description: `@${oldDirective.name}(${oldArg.name}:) added a defaultValue ${newDefaultValueStr}.`,
        });
      } else if (oldArg.type.toString() !== newArg.type.toString()) {
        schemaChanges.push({
          type: SafeChangeType.ARG_CHANGED_KIND_SAFE,
          description:
            `Argument @${oldDirective.name}(${oldArg.name}:) has changed type from ` +
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
    } else if (newDirective.isRepeatable && !oldDirective.isRepeatable) {
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

function findTypeChanges(
  oldSchema: GraphQLSchema,
  newSchema: GraphQLSchema,
): Array<SchemaChange> {
  const schemaChanges = [];

  const typesDiff = diff(
    Object.values(oldSchema.getTypeMap()),
    Object.values(newSchema.getTypeMap()),
  );

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
    } else if (isUnionType(oldType) && isUnionType(newType)) {
      schemaChanges.push(...findUnionTypeChanges(oldType, newType));
    } else if (isInputObjectType(oldType) && isInputObjectType(newType)) {
      schemaChanges.push(...findInputObjectTypeChanges(oldType, newType));
    } else if (isObjectType(oldType) && isObjectType(newType)) {
      schemaChanges.push(
        ...findFieldChanges(oldType, newType),
        ...findImplementedInterfacesChanges(oldType, newType),
      );
    } else if (isInterfaceType(oldType) && isInterfaceType(newType)) {
      schemaChanges.push(
        ...findFieldChanges(oldType, newType),
        ...findImplementedInterfacesChanges(oldType, newType),
      );
    } else if (oldType.constructor !== newType.constructor) {
      schemaChanges.push({
        type: BreakingChangeType.TYPE_CHANGED_KIND,
        description: `${oldType} changed from ${typeKindName(
          oldType,
        )} to ${typeKindName(newType)}.`,
      });
    }
  }

  return schemaChanges;
}

function findInputObjectTypeChanges(
  oldType: GraphQLInputObjectType,
  newType: GraphQLInputObjectType,
): Array<SchemaChange> {
  const schemaChanges = [];
  const fieldsDiff = diff(
    Object.values(oldType.getFields()),
    Object.values(newType.getFields()),
  );

  for (const newField of fieldsDiff.added) {
    if (isRequiredInputField(newField)) {
      schemaChanges.push({
        type: BreakingChangeType.REQUIRED_INPUT_FIELD_ADDED,
        description: `A required field ${newField} was added.`,
      });
    } else {
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
    const isSafe = isChangeSafeForInputObjectFieldOrFieldArg(
      oldField.type,
      newField.type,
    );
    if (!isSafe) {
      schemaChanges.push({
        type: BreakingChangeType.FIELD_CHANGED_KIND,
        description: `Field ${newField} changed type from ${oldField.type} to ${newField.type}.`,
      });
    } else if (oldField.type.toString() !== newField.type.toString()) {
      schemaChanges.push({
        type: SafeChangeType.FIELD_CHANGED_KIND_SAFE,
        description:
          `Field ${oldType}.${oldField.name} changed type from ` +
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

function findUnionTypeChanges(
  oldType: GraphQLUnionType,
  newType: GraphQLUnionType,
): Array<BreakingChange | DangerousChange> {
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

function findEnumTypeChanges(
  oldType: GraphQLEnumType,
  newType: GraphQLEnumType,
): Array<SchemaChange> {
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

function findImplementedInterfacesChanges(
  oldType: GraphQLObjectType | GraphQLInterfaceType,
  newType: GraphQLObjectType | GraphQLInterfaceType,
): Array<BreakingChange | DangerousChange> {
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

function findFieldChanges(
  oldType: GraphQLObjectType | GraphQLInterfaceType,
  newType: GraphQLObjectType | GraphQLInterfaceType,
): Array<SchemaChange> {
  const schemaChanges = [];
  const fieldsDiff = diff(
    Object.values(oldType.getFields()),
    Object.values(newType.getFields()),
  );

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

    const isSafe = isChangeSafeForObjectOrInterfaceField(
      oldField.type,
      newField.type,
    );
    if (!isSafe) {
      schemaChanges.push({
        type: BreakingChangeType.FIELD_CHANGED_KIND,
        description: `Field ${newField} changed type from ${oldField.type} to ${newField.type}.`,
      });
    } else if (oldField.type.toString() !== newField.type.toString()) {
      schemaChanges.push({
        type: SafeChangeType.FIELD_CHANGED_KIND_SAFE,
        description:
          `Field ${oldType}.${oldField.name} changed type from ` +
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

function findArgChanges(
  oldField: GraphQLField<unknown, unknown>,
  newField: GraphQLField<unknown, unknown>,
): Array<SchemaChange> {
  const schemaChanges = [];
  const argsDiff = diff(oldField.args, newField.args);

  for (const oldArg of argsDiff.removed) {
    schemaChanges.push({
      type: BreakingChangeType.ARG_REMOVED,
      description: `Argument ${oldArg} was removed.`,
    });
  }

  for (const [oldArg, newArg] of argsDiff.persisted) {
    const isSafe = isChangeSafeForInputObjectFieldOrFieldArg(
      oldArg.type,
      newArg.type,
    );

    const oldDefaultValueStr = getDefaultValue(oldArg);
    const newDefaultValueStr = getDefaultValue(newArg);
    if (!isSafe) {
      schemaChanges.push({
        type: BreakingChangeType.ARG_CHANGED_KIND,
        description: `Argument ${newArg} has changed type from ${oldArg.type} to ${newArg.type}.`,
      });
    } else if (oldDefaultValueStr !== undefined) {
      if (newDefaultValueStr === undefined) {
        schemaChanges.push({
          type: DangerousChangeType.ARG_DEFAULT_VALUE_CHANGE,
          description: `${oldArg} defaultValue was removed.`,
        });
      } else if (oldDefaultValueStr !== newDefaultValueStr) {
        schemaChanges.push({
          type: DangerousChangeType.ARG_DEFAULT_VALUE_CHANGE,
          description: `${oldArg} has changed defaultValue from ${oldDefaultValueStr} to ${newDefaultValueStr}.`,
        });
      }
    } else if (
      newDefaultValueStr !== undefined &&
      oldDefaultValueStr === undefined
    ) {
      schemaChanges.push({
        type: SafeChangeType.ARG_DEFAULT_VALUE_ADDED,
        description: `${oldArg} added a defaultValue ${newDefaultValueStr}.`,
      });
    } else if (oldArg.type.toString() !== newArg.type.toString()) {
      schemaChanges.push({
        type: SafeChangeType.ARG_CHANGED_KIND_SAFE,
        description:
          `Argument ${oldArg} has changed type from ` +
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
    } else {
      schemaChanges.push({
        type: DangerousChangeType.OPTIONAL_ARG_ADDED,
        description: `An optional argument ${newArg} was added.`,
      });
    }
  }

  return schemaChanges;
}

function isChangeSafeForObjectOrInterfaceField(
  oldType: GraphQLType,
  newType: GraphQLType,
): boolean {
  if (isListType(oldType)) {
    return (
      // if they're both lists, make sure the underlying types are compatible
      (isListType(newType) &&
        isChangeSafeForObjectOrInterfaceField(
          oldType.ofType,
          newType.ofType,
        )) ||
      // moving from nullable to non-null of the same underlying type is safe
      (isNonNullType(newType) &&
        isChangeSafeForObjectOrInterfaceField(oldType, newType.ofType))
    );
  }

  if (isNonNullType(oldType)) {
    // if they're both non-null, make sure the underlying types are compatible
    return (
      isNonNullType(newType) &&
      isChangeSafeForObjectOrInterfaceField(oldType.ofType, newType.ofType)
    );
  }

  return (
    // if they're both named types, see if their names are equivalent
    (isNamedType(newType) && oldType.name === newType.name) ||
    // moving from nullable to non-null of the same underlying type is safe
    (isNonNullType(newType) &&
      isChangeSafeForObjectOrInterfaceField(oldType, newType.ofType))
  );
}

function isChangeSafeForInputObjectFieldOrFieldArg(
  oldType: GraphQLType,
  newType: GraphQLType,
): boolean {
  if (isListType(oldType)) {
    // if they're both lists, make sure the underlying types are compatible
    return (
      isListType(newType) &&
      isChangeSafeForInputObjectFieldOrFieldArg(oldType.ofType, newType.ofType)
    );
  }

  if (isNonNullType(oldType)) {
    return (
      // if they're both non-null, make sure the underlying types are
      // compatible
      (isNonNullType(newType) &&
        isChangeSafeForInputObjectFieldOrFieldArg(
          oldType.ofType,
          newType.ofType,
        )) ||
      // moving from non-null to nullable of the same underlying type is safe
      (!isNonNullType(newType) &&
        isChangeSafeForInputObjectFieldOrFieldArg(oldType.ofType, newType))
    );
  }

  // if they're both named types, see if their names are equivalent
  return isNamedType(newType) && oldType.name === newType.name;
}

function typeKindName(type: GraphQLNamedType): string {
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
  invariant(false, 'Unexpected type: ' + inspect(type));
}

// Since we looking only for client's observable changes we should
// compare default values in the same representation as they are
// represented inside introspection.
function getDefaultValue(
  argOrInputField: GraphQLArgument | GraphQLInputField,
): string | undefined {
  const ast = getDefaultValueAST(argOrInputField);
  if (ast) {
    return print(sortValueNode(ast));
  }
}

function diff<T extends { name: string }>(
  oldArray: ReadonlyArray<T>,
  newArray: ReadonlyArray<T>,
): {
  added: ReadonlyArray<T>;
  removed: ReadonlyArray<T>;
  persisted: ReadonlyArray<[T, T]>;
} {
  const added: Array<T> = [];
  const removed: Array<T> = [];
  const persisted: Array<[T, T]> = [];

  const oldMap = keyMap(oldArray, ({ name }) => name);
  const newMap = keyMap(newArray, ({ name }) => name);

  for (const oldItem of oldArray) {
    const newItem = newMap[oldItem.name];
    if (newItem === undefined) {
      removed.push(oldItem);
    } else {
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
