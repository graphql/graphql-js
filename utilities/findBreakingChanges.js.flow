/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow strict
 */

import find from '../polyfills/find';
import objectValues from '../polyfills/objectValues';
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
    ...findRemovedTypes(oldSchema, newSchema),
    ...findTypesThatChangedKind(oldSchema, newSchema),
    ...findFieldsThatChangedTypeOnObjectOrInterfaceTypes(oldSchema, newSchema),
    ...findFieldsThatChangedTypeOnInputObjectTypes(oldSchema, newSchema),
    ...findTypesAddedToUnions(oldSchema, newSchema),
    ...findTypesRemovedFromUnions(oldSchema, newSchema),
    ...findValuesAddedToEnums(oldSchema, newSchema),
    ...findValuesRemovedFromEnums(oldSchema, newSchema),
    ...findArgChanges(oldSchema, newSchema),
    ...findInterfacesAddedToObjectTypes(oldSchema, newSchema),
    ...findInterfacesRemovedFromObjectTypes(oldSchema, newSchema),
    ...findRemovedDirectives(oldSchema, newSchema),
    ...findRemovedDirectiveArgs(oldSchema, newSchema),
    ...findAddedNonNullDirectiveArgs(oldSchema, newSchema),
    ...findRemovedDirectiveLocations(oldSchema, newSchema),
  ];
}

/**
 * Given two schemas, returns an Array containing descriptions of any breaking
 * changes in the newSchema related to removing an entire type.
 */
function findRemovedTypes(
  oldSchema: GraphQLSchema,
  newSchema: GraphQLSchema,
): Array<BreakingChange> {
  const schemaChanges = [];

  const oldTypeMap = oldSchema.getTypeMap();
  const newTypeMap = newSchema.getTypeMap();
  for (const oldType of objectValues(oldTypeMap)) {
    if (!newTypeMap[oldType.name]) {
      schemaChanges.push({
        type: BreakingChangeType.TYPE_REMOVED,
        description: `${oldType.name} was removed.`,
      });
    }
  }
  return schemaChanges;
}

/**
 * Given two schemas, returns an Array containing descriptions of any breaking
 * changes in the newSchema related to changing the type of a type.
 */
function findTypesThatChangedKind(
  oldSchema: GraphQLSchema,
  newSchema: GraphQLSchema,
): Array<BreakingChange> {
  const schemaChanges = [];

  const oldTypeMap = oldSchema.getTypeMap();
  const newTypeMap = newSchema.getTypeMap();
  for (const oldType of objectValues(oldTypeMap)) {
    const newType = newTypeMap[oldType.name];
    if (!newType) {
      continue;
    }

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

/**
 * Given two schemas, returns an Array containing descriptions of any
 * breaking or dangerous changes in the newSchema related to arguments
 * (such as removal or change of type of an argument, or a change in an
 * argument's default value).
 */
function findArgChanges(
  oldSchema: GraphQLSchema,
  newSchema: GraphQLSchema,
): Array<BreakingChange | DangerousChange> {
  const schemaChanges = [];

  const oldTypeMap = oldSchema.getTypeMap();
  const newTypeMap = newSchema.getTypeMap();
  for (const oldType of objectValues(oldTypeMap)) {
    const newType = newTypeMap[oldType.name];

    if (
      !(isObjectType(oldType) || isInterfaceType(oldType)) ||
      !(isObjectType(newType) || isInterfaceType(newType)) ||
      newType.constructor !== oldType.constructor
    ) {
      continue;
    }

    const oldFields = oldType.getFields();
    const newFields = newType.getFields();
    for (const oldField of objectValues(oldFields)) {
      const newField = newFields[oldField.name];
      if (newField === undefined) {
        continue;
      }

      for (const oldArg of oldField.args) {
        const newArg = findByName(newField.args, oldArg.name);

        // Arg not present
        if (newArg === undefined) {
          schemaChanges.push({
            type: BreakingChangeType.ARG_REMOVED,
            description:
              `${oldType.name}.${oldField.name} arg ` +
              `${oldArg.name} was removed.`,
          });
          continue;
        }

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
      // Check if arg was added to the field
      for (const newArg of newField.args) {
        const oldArg = findByName(oldField.args, newArg.name);
        if (oldArg === undefined) {
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

function findFieldsThatChangedTypeOnObjectOrInterfaceTypes(
  oldSchema: GraphQLSchema,
  newSchema: GraphQLSchema,
): Array<BreakingChange> {
  const schemaChanges = [];

  const oldTypeMap = oldSchema.getTypeMap();
  const newTypeMap = newSchema.getTypeMap();
  for (const oldType of objectValues(oldTypeMap)) {
    const newType = newTypeMap[oldType.name];
    if (
      !(isObjectType(oldType) || isInterfaceType(oldType)) ||
      !(isObjectType(newType) || isInterfaceType(newType)) ||
      newType.constructor !== oldType.constructor
    ) {
      continue;
    }

    const oldFields = oldType.getFields();
    const newFields = newType.getFields();
    for (const oldField of objectValues(oldFields)) {
      const newField = newFields[oldField.name];

      // Check if the field is missing on the type in the new schema.
      if (newField === undefined) {
        schemaChanges.push({
          type: BreakingChangeType.FIELD_REMOVED,
          description: `${oldType.name}.${oldField.name} was removed.`,
        });
        continue;
      }

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

function findFieldsThatChangedTypeOnInputObjectTypes(
  oldSchema: GraphQLSchema,
  newSchema: GraphQLSchema,
): Array<BreakingChange | DangerousChange> {
  const schemaChanges = [];

  const oldTypeMap = oldSchema.getTypeMap();
  const newTypeMap = newSchema.getTypeMap();
  for (const oldType of objectValues(oldTypeMap)) {
    const newType = newTypeMap[oldType.name];
    if (!isInputObjectType(oldType) || !isInputObjectType(newType)) {
      continue;
    }

    const oldFields = oldType.getFields();
    const newFields = newType.getFields();
    for (const oldField of objectValues(oldFields)) {
      const newField = newFields[oldField.name];

      // Check if the field is missing on the type in the new schema.
      if (newField === undefined) {
        schemaChanges.push({
          type: BreakingChangeType.FIELD_REMOVED,
          description: `${oldType.name}.${oldField.name} was removed.`,
        });
        continue;
      }

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

    // Check if a field was added to the input object type
    for (const newField of objectValues(newFields)) {
      const oldField = oldFields[newField.name];

      if (oldField === undefined) {
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

/**
 * Given two schemas, returns an Array containing descriptions of any breaking
 * changes in the newSchema related to removing types from a union type.
 */
function findTypesRemovedFromUnions(
  oldSchema: GraphQLSchema,
  newSchema: GraphQLSchema,
): Array<BreakingChange> {
  const schemaChanges = [];

  const oldTypeMap = oldSchema.getTypeMap();
  const newTypeMap = newSchema.getTypeMap();
  for (const oldType of objectValues(oldTypeMap)) {
    const newType = newTypeMap[oldType.name];
    if (!isUnionType(oldType) || !isUnionType(newType)) {
      continue;
    }

    const oldPossibleTypes = oldType.getTypes();
    const newPossibleTypes = newType.getTypes();
    for (const oldPossibleType of oldPossibleTypes) {
      const newPossibleType = findByName(
        newPossibleTypes,
        oldPossibleType.name,
      );

      if (newPossibleType === undefined) {
        schemaChanges.push({
          type: BreakingChangeType.TYPE_REMOVED_FROM_UNION,
          description:
            `${oldPossibleType.name} was removed from ` +
            `union type ${oldType.name}.`,
        });
      }
    }
  }
  return schemaChanges;
}

/**
 * Given two schemas, returns an Array containing descriptions of any dangerous
 * changes in the newSchema related to adding types to a union type.
 */
function findTypesAddedToUnions(
  oldSchema: GraphQLSchema,
  newSchema: GraphQLSchema,
): Array<DangerousChange> {
  const schemaChanges = [];

  const oldTypeMap = oldSchema.getTypeMap();
  const newTypeMap = newSchema.getTypeMap();
  for (const oldType of objectValues(oldTypeMap)) {
    const newType = newTypeMap[oldType.name];
    if (!isUnionType(oldType) || !isUnionType(newType)) {
      continue;
    }

    const oldPossibleTypes = oldType.getTypes();
    const newPossibleTypes = newType.getTypes();
    for (const newPossibleType of newPossibleTypes) {
      const oldPossibleType = findByName(
        oldPossibleTypes,
        newPossibleType.name,
      );

      if (oldPossibleType === undefined) {
        schemaChanges.push({
          type: DangerousChangeType.TYPE_ADDED_TO_UNION,
          description:
            `${newPossibleType.name} was added to ` +
            `union type ${oldType.name}.`,
        });
      }
    }
  }
  return schemaChanges;
}
/**
 * Given two schemas, returns an Array containing descriptions of any breaking
 * changes in the newSchema related to removing values from an enum type.
 */
function findValuesRemovedFromEnums(
  oldSchema: GraphQLSchema,
  newSchema: GraphQLSchema,
): Array<BreakingChange> {
  const schemaChanges = [];

  const oldTypeMap = oldSchema.getTypeMap();
  const newTypeMap = newSchema.getTypeMap();
  for (const oldType of objectValues(oldTypeMap)) {
    const newType = newTypeMap[oldType.name];
    if (!isEnumType(oldType) || !isEnumType(newType)) {
      continue;
    }

    const oldValues = oldType.getValues();
    const newValues = newType.getValues();
    for (const oldValue of oldValues) {
      const newValue = findByName(newValues, oldValue.name);
      if (newValue === undefined) {
        schemaChanges.push({
          type: BreakingChangeType.VALUE_REMOVED_FROM_ENUM,
          description: `${oldValue.name} was removed from enum type ${
            oldType.name
          }.`,
        });
      }
    }
  }
  return schemaChanges;
}

/**
 * Given two schemas, returns an Array containing descriptions of any dangerous
 * changes in the newSchema related to adding values to an enum type.
 */
function findValuesAddedToEnums(
  oldSchema: GraphQLSchema,
  newSchema: GraphQLSchema,
): Array<DangerousChange> {
  const schemaChanges = [];

  const oldTypeMap = oldSchema.getTypeMap();
  const newTypeMap = newSchema.getTypeMap();
  for (const oldType of objectValues(oldTypeMap)) {
    const newType = newTypeMap[oldType.name];
    if (!isEnumType(oldType) || !isEnumType(newType)) {
      continue;
    }

    const oldValues = oldType.getValues();
    const newValues = newType.getValues();
    for (const newValue of newValues) {
      const oldValue = findByName(oldValues, newValue.name);
      if (oldValue === undefined) {
        schemaChanges.push({
          type: DangerousChangeType.VALUE_ADDED_TO_ENUM,
          description: `${newValue.name} was added to enum type ${
            oldType.name
          }.`,
        });
      }
    }
  }
  return schemaChanges;
}

function findInterfacesRemovedFromObjectTypes(
  oldSchema: GraphQLSchema,
  newSchema: GraphQLSchema,
): Array<BreakingChange> {
  const schemaChanges = [];

  const oldTypeMap = oldSchema.getTypeMap();
  const newTypeMap = newSchema.getTypeMap();
  for (const oldType of objectValues(oldTypeMap)) {
    const newType = newTypeMap[oldType.name];
    if (!isObjectType(oldType) || !isObjectType(newType)) {
      continue;
    }

    const oldInterfaces = oldType.getInterfaces();
    const newInterfaces = newType.getInterfaces();
    for (const oldInterface of oldInterfaces) {
      const newInterface = findByName(newInterfaces, oldInterface.name);
      if (newInterface === undefined) {
        schemaChanges.push({
          type: BreakingChangeType.INTERFACE_REMOVED_FROM_OBJECT,
          description:
            `${oldType.name} no longer implements interface ` +
            `${oldInterface.name}.`,
        });
      }
    }
  }
  return schemaChanges;
}

function findInterfacesAddedToObjectTypes(
  oldSchema: GraphQLSchema,
  newSchema: GraphQLSchema,
): Array<DangerousChange> {
  const schemaChanges = [];

  const oldTypeMap = oldSchema.getTypeMap();
  const newTypeMap = newSchema.getTypeMap();
  for (const oldType of objectValues(oldTypeMap)) {
    const newType = newTypeMap[oldType.name];
    if (!isObjectType(oldType) || !isObjectType(newType)) {
      continue;
    }

    const oldInterfaces = oldType.getInterfaces();
    const newInterfaces = newType.getInterfaces();
    for (const newInterface of newInterfaces) {
      const oldInterface = findByName(oldInterfaces, newInterface.name);
      if (oldInterface === undefined) {
        schemaChanges.push({
          type: DangerousChangeType.INTERFACE_ADDED_TO_OBJECT,
          description:
            `${newInterface.name} added to interfaces implemented ` +
            `by ${oldType.name}.`,
        });
      }
    }
  }
  return schemaChanges;
}

function findRemovedDirectives(
  oldSchema: GraphQLSchema,
  newSchema: GraphQLSchema,
): Array<BreakingChange> {
  const schemaChanges = [];

  const oldDirectives = oldSchema.getDirectives();
  const newDirectives = newSchema.getDirectives();
  for (const oldDirective of oldDirectives) {
    const newDirective = findByName(newDirectives, oldDirective.name);
    if (newDirective === undefined) {
      schemaChanges.push({
        type: BreakingChangeType.DIRECTIVE_REMOVED,
        description: `${oldDirective.name} was removed.`,
      });
    }
  }

  return schemaChanges;
}

function findRemovedDirectiveArgs(
  oldSchema: GraphQLSchema,
  newSchema: GraphQLSchema,
): Array<BreakingChange> {
  const schemaChanges = [];

  const oldDirectives = oldSchema.getDirectives();
  const newDirectives = newSchema.getDirectives();
  for (const oldDirective of oldDirectives) {
    const newDirective = findByName(newDirectives, oldDirective.name);
    if (newDirective === undefined) {
      continue;
    }

    for (const oldArg of oldDirective.args) {
      const newArg = findByName(newDirective.args, oldArg.name);
      if (newArg === undefined) {
        schemaChanges.push({
          type: BreakingChangeType.DIRECTIVE_ARG_REMOVED,
          description: `${oldArg.name} was removed from ${oldDirective.name}.`,
        });
      }
    }
  }

  return schemaChanges;
}

function findAddedNonNullDirectiveArgs(
  oldSchema: GraphQLSchema,
  newSchema: GraphQLSchema,
): Array<BreakingChange> {
  const schemaChanges = [];

  const oldDirectives = oldSchema.getDirectives();
  const newDirectives = newSchema.getDirectives();
  for (const oldDirective of oldDirectives) {
    const newDirective = findByName(newDirectives, oldDirective.name);
    if (newDirective === undefined) {
      continue;
    }

    for (const newArg of newDirective.args) {
      const oldArg = findByName(oldDirective.args, newArg.name);
      if (oldArg === undefined && isRequiredArgument(newArg)) {
        schemaChanges.push({
          type: BreakingChangeType.REQUIRED_DIRECTIVE_ARG_ADDED,
          description:
            `A required arg ${newArg.name} on directive ` +
            `${newDirective.name} was added.`,
        });
      }
    }
  }

  return schemaChanges;
}

function findRemovedDirectiveLocations(
  oldSchema: GraphQLSchema,
  newSchema: GraphQLSchema,
): Array<BreakingChange> {
  const schemaChanges = [];

  const oldDirectives = oldSchema.getDirectives();
  const newDirectives = newSchema.getDirectives();
  for (const oldDirective of oldDirectives) {
    const newDirective = findByName(newDirectives, oldDirective.name);
    if (newDirective === undefined) {
      continue;
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

function findByName<T: { name: string }>(
  array: $ReadOnlyArray<T>,
  name: string,
): T | void {
  return find(array, item => item.name === name);
}
