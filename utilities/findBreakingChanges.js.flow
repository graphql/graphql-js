/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow strict
 */

import objectValues from '../polyfills/objectValues';
import keyMap from '../jsutils/keyMap';
import inspect from '../jsutils/inspect';
import {
  type GraphQLNamedType,
  type GraphQLType,
  isScalarType,
  isObjectType,
  isInterfaceType,
  isUnionType,
  isEnumType,
  isInputObjectType,
  isNonNullType,
  isListType,
  isNamedType,
  isRequiredArgument,
  isRequiredInputField,
} from '../type/definition';
import { type GraphQLSchema } from '../type/schema';

export const BreakingChangeType = Object.freeze({
  FIELD_CHANGED_KIND: 'FIELD_CHANGED_KIND',
  FIELD_REMOVED: 'FIELD_REMOVED',
  TYPE_CHANGED_KIND: 'TYPE_CHANGED_KIND',
  TYPE_REMOVED: 'TYPE_REMOVED',
  TYPE_REMOVED_FROM_UNION: 'TYPE_REMOVED_FROM_UNION',
  VALUE_REMOVED_FROM_ENUM: 'VALUE_REMOVED_FROM_ENUM',
  ARG_REMOVED: 'ARG_REMOVED',
  ARG_CHANGED_KIND: 'ARG_CHANGED_KIND',
  REQUIRED_ARG_ADDED: 'REQUIRED_ARG_ADDED',
  REQUIRED_INPUT_FIELD_ADDED: 'REQUIRED_INPUT_FIELD_ADDED',
  INTERFACE_REMOVED_FROM_OBJECT: 'INTERFACE_REMOVED_FROM_OBJECT',
  DIRECTIVE_REMOVED: 'DIRECTIVE_REMOVED',
  DIRECTIVE_ARG_REMOVED: 'DIRECTIVE_ARG_REMOVED',
  DIRECTIVE_LOCATION_REMOVED: 'DIRECTIVE_LOCATION_REMOVED',
  REQUIRED_DIRECTIVE_ARG_ADDED: 'REQUIRED_DIRECTIVE_ARG_ADDED',
});

export const DangerousChangeType = Object.freeze({
  ARG_DEFAULT_VALUE_CHANGE: 'ARG_DEFAULT_VALUE_CHANGE',
  VALUE_ADDED_TO_ENUM: 'VALUE_ADDED_TO_ENUM',
  INTERFACE_ADDED_TO_OBJECT: 'INTERFACE_ADDED_TO_OBJECT',
  TYPE_ADDED_TO_UNION: 'TYPE_ADDED_TO_UNION',
  OPTIONAL_INPUT_FIELD_ADDED: 'OPTIONAL_INPUT_FIELD_ADDED',
  OPTIONAL_ARG_ADDED: 'OPTIONAL_ARG_ADDED',
});

export type BreakingChange = {
  type: $Keys<typeof BreakingChangeType>,
  description: string,
};

export type DangerousChange = {
  type: $Keys<typeof DangerousChangeType>,
  description: string,
};

/**
 * Given two schemas, returns an Array containing descriptions of all the types
 * of breaking changes covered by the other functions down below.
 */
export function findBreakingChanges(
  oldSchema: GraphQLSchema,
  newSchema: GraphQLSchema,
): Array<BreakingChange> {
  const breakingChanges = findSchemaChanges(oldSchema, newSchema).filter(
    change => change.type in BreakingChangeType,
  );
  return ((breakingChanges: any): Array<BreakingChange>);
}

/**
 * Given two schemas, returns an Array containing descriptions of all the types
 * of potentially dangerous changes covered by the other functions down below.
 */
export function findDangerousChanges(
  oldSchema: GraphQLSchema,
  newSchema: GraphQLSchema,
): Array<DangerousChange> {
  const dangerousChanges = findSchemaChanges(oldSchema, newSchema).filter(
    change => change.type in DangerousChangeType,
  );
  return ((dangerousChanges: any): Array<DangerousChange>);
}

function findSchemaChanges(
  oldSchema: GraphQLSchema,
  newSchema: GraphQLSchema,
): Array<BreakingChange | DangerousChange> {
  return [
    ...findTypeChanges(oldSchema, newSchema),
    ...findFieldChanges(oldSchema, newSchema),
    ...findInputObjectTypeChanges(oldSchema, newSchema),
    ...findUnionTypeChanges(oldSchema, newSchema),
    ...findEnumTypeChanges(oldSchema, newSchema),
    ...findArgChanges(oldSchema, newSchema),
    ...findObjectTypeChanges(oldSchema, newSchema),
    ...findDirectiveChanges(oldSchema, newSchema),
  ];
}

function findTypeChanges(
  oldSchema: GraphQLSchema,
  newSchema: GraphQLSchema,
): Array<BreakingChange | DangerousChange> {
  const schemaChanges = [];

  const typesDiff = diff(
    objectValues(oldSchema.getTypeMap()),
    objectValues(newSchema.getTypeMap()),
  );

  for (const oldType of typesDiff.removed) {
    schemaChanges.push({
      type: BreakingChangeType.TYPE_REMOVED,
      description: `${oldType.name} was removed.`,
    });
  }

  for (const [oldType, newType] of typesDiff.persisted) {
    if (oldType.constructor !== newType.constructor) {
      schemaChanges.push({
        type: BreakingChangeType.TYPE_CHANGED_KIND,
        description:
          `${oldType.name} changed from ` +
          `${typeKindName(oldType)} to ${typeKindName(newType)}.`,
      });
    }
  }

  return schemaChanges;
}

function findArgChanges(
  oldSchema: GraphQLSchema,
  newSchema: GraphQLSchema,
): Array<BreakingChange | DangerousChange> {
  const schemaChanges = [];

  const typesDiff = diff(
    objectValues(oldSchema.getTypeMap()),
    objectValues(newSchema.getTypeMap()),
  );

  for (const [oldType, newType] of typesDiff.persisted) {
    if (
      !(isObjectType(oldType) || isInterfaceType(oldType)) ||
      !(isObjectType(newType) || isInterfaceType(newType)) ||
      newType.constructor !== oldType.constructor
    ) {
      continue;
    }

    const fieldsDiff = diff(
      objectValues(oldType.getFields()),
      objectValues(newType.getFields()),
    );

    for (const [oldField, newField] of fieldsDiff.persisted) {
      const argsDiff = diff(oldField.args, newField.args);

      for (const oldArg of argsDiff.removed) {
        schemaChanges.push({
          type: BreakingChangeType.ARG_REMOVED,
          description:
            `${oldType.name}.${oldField.name} arg ` +
            `${oldArg.name} was removed.`,
        });
      }

      for (const [oldArg, newArg] of argsDiff.persisted) {
        const isSafe = isChangeSafeForInputObjectFieldOrFieldArg(
          oldArg.type,
          newArg.type,
        );
        if (!isSafe) {
          schemaChanges.push({
            type: BreakingChangeType.ARG_CHANGED_KIND,
            description:
              `${oldType.name}.${oldField.name} arg ` +
              `${oldArg.name} has changed type from ` +
              `${String(oldArg.type)} to ${String(newArg.type)}.`,
          });
        } else if (
          oldArg.defaultValue !== undefined &&
          oldArg.defaultValue !== newArg.defaultValue
        ) {
          schemaChanges.push({
            type: DangerousChangeType.ARG_DEFAULT_VALUE_CHANGE,
            description:
              `${oldType.name}.${oldField.name} arg ` +
              `${oldArg.name} has changed defaultValue.`,
          });
        }
      }

      for (const newArg of argsDiff.added) {
        if (isRequiredArgument(newArg)) {
          schemaChanges.push({
            type: BreakingChangeType.REQUIRED_ARG_ADDED,
            description:
              `A required arg ${newArg.name} on ` +
              `${newType.name}.${newField.name} was added.`,
          });
        } else {
          schemaChanges.push({
            type: DangerousChangeType.OPTIONAL_ARG_ADDED,
            description:
              `An optional arg ${newArg.name} on ` +
              `${newType.name}.${newField.name} was added.`,
          });
        }
      }
    }
  }

  return schemaChanges;
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

  // Not reachable. All possible named types have been considered.
  /* istanbul ignore next */
  throw new TypeError(`Unexpected type: ${inspect((type: empty))}.`);
}

function findFieldChanges(
  oldSchema: GraphQLSchema,
  newSchema: GraphQLSchema,
): Array<BreakingChange | DangerousChange> {
  const schemaChanges = [];

  const typesDiff = diff(
    objectValues(oldSchema.getTypeMap()),
    objectValues(newSchema.getTypeMap()),
  );

  for (const [oldType, newType] of typesDiff.persisted) {
    if (
      !(isObjectType(oldType) || isInterfaceType(oldType)) ||
      !(isObjectType(newType) || isInterfaceType(newType)) ||
      newType.constructor !== oldType.constructor
    ) {
      continue;
    }

    const fieldsDiff = diff(
      objectValues(oldType.getFields()),
      objectValues(newType.getFields()),
    );

    for (const oldField of fieldsDiff.removed) {
      schemaChanges.push({
        type: BreakingChangeType.FIELD_REMOVED,
        description: `${oldType.name}.${oldField.name} was removed.`,
      });
    }

    for (const [oldField, newField] of fieldsDiff.persisted) {
      const isSafe = isChangeSafeForObjectOrInterfaceField(
        oldField.type,
        newField.type,
      );
      if (!isSafe) {
        schemaChanges.push({
          type: BreakingChangeType.FIELD_CHANGED_KIND,
          description:
            `${oldType.name}.${oldField.name} changed type from ` +
            `${String(oldField.type)} to ${String(newField.type)}.`,
        });
      }
    }
  }
  return schemaChanges;
}

function findInputObjectTypeChanges(
  oldSchema: GraphQLSchema,
  newSchema: GraphQLSchema,
): Array<BreakingChange | DangerousChange> {
  const schemaChanges = [];

  const typesDiff = diff(
    objectValues(oldSchema.getTypeMap()),
    objectValues(newSchema.getTypeMap()),
  );

  for (const [oldType, newType] of typesDiff.persisted) {
    if (!isInputObjectType(oldType) || !isInputObjectType(newType)) {
      continue;
    }

    const fieldsDiff = diff(
      objectValues(oldType.getFields()),
      objectValues(newType.getFields()),
    );

    for (const oldField of fieldsDiff.removed) {
      schemaChanges.push({
        type: BreakingChangeType.FIELD_REMOVED,
        description: `${oldType.name}.${oldField.name} was removed.`,
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
          description:
            `${oldType.name}.${oldField.name} changed type from ` +
            `${String(oldField.type)} to ${String(newField.type)}.`,
        });
      }
    }

    for (const newField of fieldsDiff.added) {
      if (isRequiredInputField(newField)) {
        schemaChanges.push({
          type: BreakingChangeType.REQUIRED_INPUT_FIELD_ADDED,
          description:
            `A required field ${newField.name} on ` +
            `input type ${oldType.name} was added.`,
        });
      } else {
        schemaChanges.push({
          type: DangerousChangeType.OPTIONAL_INPUT_FIELD_ADDED,
          description:
            `An optional field ${newField.name} on ` +
            `input type ${oldType.name} was added.`,
        });
      }
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

function findUnionTypeChanges(
  oldSchema: GraphQLSchema,
  newSchema: GraphQLSchema,
): Array<BreakingChange | DangerousChange> {
  const schemaChanges = [];

  const typesDiff = diff(
    objectValues(oldSchema.getTypeMap()),
    objectValues(newSchema.getTypeMap()),
  );

  for (const [oldType, newType] of typesDiff.persisted) {
    if (!isUnionType(oldType) || !isUnionType(newType)) {
      continue;
    }

    const possibleTypesDiff = diff(oldType.getTypes(), newType.getTypes());

    for (const newPossibleType of possibleTypesDiff.added) {
      schemaChanges.push({
        type: DangerousChangeType.TYPE_ADDED_TO_UNION,
        description:
          `${newPossibleType.name} was added to ` +
          `union type ${oldType.name}.`,
      });
    }

    for (const oldPossibleType of possibleTypesDiff.removed) {
      schemaChanges.push({
        type: BreakingChangeType.TYPE_REMOVED_FROM_UNION,
        description:
          `${oldPossibleType.name} was removed from ` +
          `union type ${oldType.name}.`,
      });
    }
  }

  return schemaChanges;
}

function findEnumTypeChanges(
  oldSchema: GraphQLSchema,
  newSchema: GraphQLSchema,
): Array<BreakingChange | DangerousChange> {
  const schemaChanges = [];

  const typesDiff = diff(
    objectValues(oldSchema.getTypeMap()),
    objectValues(newSchema.getTypeMap()),
  );

  for (const [oldType, newType] of typesDiff.persisted) {
    if (!isEnumType(oldType) || !isEnumType(newType)) {
      continue;
    }

    const valuesDiff = diff(oldType.getValues(), newType.getValues());

    for (const newValue of valuesDiff.added) {
      schemaChanges.push({
        type: DangerousChangeType.VALUE_ADDED_TO_ENUM,
        description: `${newValue.name} was added to enum type ${oldType.name}.`,
      });
    }

    for (const oldValue of valuesDiff.removed) {
      schemaChanges.push({
        type: BreakingChangeType.VALUE_REMOVED_FROM_ENUM,
        description: `${oldValue.name} was removed from enum type ${
          oldType.name
        }.`,
      });
    }
  }

  return schemaChanges;
}

function findObjectTypeChanges(
  oldSchema: GraphQLSchema,
  newSchema: GraphQLSchema,
): Array<BreakingChange | DangerousChange> {
  const schemaChanges = [];

  const typesDiff = diff(
    objectValues(oldSchema.getTypeMap()),
    objectValues(newSchema.getTypeMap()),
  );

  for (const [oldType, newType] of typesDiff.persisted) {
    if (!isObjectType(oldType) || !isObjectType(newType)) {
      continue;
    }

    const interfacesDiff = diff(
      oldType.getInterfaces(),
      newType.getInterfaces(),
    );

    for (const newInterface of interfacesDiff.added) {
      schemaChanges.push({
        type: DangerousChangeType.INTERFACE_ADDED_TO_OBJECT,
        description:
          `${newInterface.name} added to interfaces implemented ` +
          `by ${oldType.name}.`,
      });
    }

    for (const oldInterface of interfacesDiff.removed) {
      schemaChanges.push({
        type: BreakingChangeType.INTERFACE_REMOVED_FROM_OBJECT,
        description:
          `${oldType.name} no longer implements interface ` +
          `${oldInterface.name}.`,
      });
    }
  }
  return schemaChanges;
}

function findDirectiveChanges(
  oldSchema: GraphQLSchema,
  newSchema: GraphQLSchema,
): Array<BreakingChange | DangerousChange> {
  const schemaChanges = [];

  const directivesDiff = diff(
    oldSchema.getDirectives(),
    newSchema.getDirectives(),
  );

  for (const oldDirective of directivesDiff.removed) {
    schemaChanges.push({
      type: BreakingChangeType.DIRECTIVE_REMOVED,
      description: `${oldDirective.name} was removed.`,
    });
  }

  for (const [oldDirective, newDirective] of directivesDiff.persisted) {
    const argsDiff = diff(oldDirective.args, newDirective.args);

    for (const newArg of argsDiff.added) {
      if (isRequiredArgument(newArg)) {
        schemaChanges.push({
          type: BreakingChangeType.REQUIRED_DIRECTIVE_ARG_ADDED,
          description:
            `A required arg ${newArg.name} on directive ` +
            `${newDirective.name} was added.`,
        });
      }
    }

    for (const oldArg of argsDiff.removed) {
      schemaChanges.push({
        type: BreakingChangeType.DIRECTIVE_ARG_REMOVED,
        description: `${oldArg.name} was removed from ${oldDirective.name}.`,
      });
    }

    for (const location of oldDirective.locations) {
      if (newDirective.locations.indexOf(location) === -1) {
        schemaChanges.push({
          type: BreakingChangeType.DIRECTIVE_LOCATION_REMOVED,
          description: `${location} was removed from ${oldDirective.name}.`,
        });
      }
    }
  }

  return schemaChanges;
}

function diff<T: { name: string }>(
  oldArray: $ReadOnlyArray<T>,
  newArray: $ReadOnlyArray<T>,
): {
  added: Array<T>,
  removed: Array<T>,
  persisted: Array<[T, T]>,
} {
  const added = [];
  const removed = [];
  const persisted = [];

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
