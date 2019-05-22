/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow strict
 */

import find from '../polyfills/find';
import inspect from '../jsutils/inspect';
import {
  type GraphQLNamedType,
  type GraphQLFieldMap,
  type GraphQLType,
  type GraphQLArgument,
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
import { type GraphQLDirective } from '../type/directives';
import { type GraphQLSchema } from '../type/schema';
import keyMap from '../jsutils/keyMap';

import { type ObjMap } from '../jsutils/ObjMap';
import { type DirectiveLocationEnum } from '../language/directiveLocation';

export const BreakingChangeType = {
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
};

export const DangerousChangeType = {
  ARG_DEFAULT_VALUE_CHANGE: 'ARG_DEFAULT_VALUE_CHANGE',
  VALUE_ADDED_TO_ENUM: 'VALUE_ADDED_TO_ENUM',
  INTERFACE_ADDED_TO_OBJECT: 'INTERFACE_ADDED_TO_OBJECT',
  TYPE_ADDED_TO_UNION: 'TYPE_ADDED_TO_UNION',
  OPTIONAL_INPUT_FIELD_ADDED: 'OPTIONAL_INPUT_FIELD_ADDED',
  OPTIONAL_ARG_ADDED: 'OPTIONAL_ARG_ADDED',
};

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
  return [
    ...findRemovedTypes(oldSchema, newSchema),
    ...findTypesThatChangedKind(oldSchema, newSchema),
    ...findFieldsThatChangedTypeOnObjectOrInterfaceTypes(oldSchema, newSchema),
    ...findFieldsThatChangedTypeOnInputObjectTypes(oldSchema, newSchema)
      .breakingChanges,
    ...findTypesRemovedFromUnions(oldSchema, newSchema),
    ...findValuesRemovedFromEnums(oldSchema, newSchema),
    ...findArgChanges(oldSchema, newSchema).breakingChanges,
    ...findInterfacesRemovedFromObjectTypes(oldSchema, newSchema),
    ...findRemovedDirectives(oldSchema, newSchema),
    ...findRemovedDirectiveArgs(oldSchema, newSchema),
    ...findAddedNonNullDirectiveArgs(oldSchema, newSchema),
    ...findRemovedDirectiveLocations(oldSchema, newSchema),
  ];
}

/**
 * Given two schemas, returns an Array containing descriptions of all the types
 * of potentially dangerous changes covered by the other functions down below.
 */
export function findDangerousChanges(
  oldSchema: GraphQLSchema,
  newSchema: GraphQLSchema,
): Array<DangerousChange> {
  return [
    ...findArgChanges(oldSchema, newSchema).dangerousChanges,
    ...findValuesAddedToEnums(oldSchema, newSchema),
    ...findInterfacesAddedToObjectTypes(oldSchema, newSchema),
    ...findTypesAddedToUnions(oldSchema, newSchema),
    ...findFieldsThatChangedTypeOnInputObjectTypes(oldSchema, newSchema)
      .dangerousChanges,
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
  const oldTypeMap = oldSchema.getTypeMap();
  const newTypeMap = newSchema.getTypeMap();

  const breakingChanges = [];
  for (const typeName of Object.keys(oldTypeMap)) {
    if (!newTypeMap[typeName]) {
      breakingChanges.push({
        type: BreakingChangeType.TYPE_REMOVED,
        description: `${typeName} was removed.`,
      });
    }
  }
  return breakingChanges;
}

/**
 * Given two schemas, returns an Array containing descriptions of any breaking
 * changes in the newSchema related to changing the type of a type.
 */
function findTypesThatChangedKind(
  oldSchema: GraphQLSchema,
  newSchema: GraphQLSchema,
): Array<BreakingChange> {
  const oldTypeMap = oldSchema.getTypeMap();
  const newTypeMap = newSchema.getTypeMap();

  const breakingChanges = [];
  for (const typeName of Object.keys(oldTypeMap)) {
    if (!newTypeMap[typeName]) {
      continue;
    }
    const oldType = oldTypeMap[typeName];
    const newType = newTypeMap[typeName];
    if (oldType.constructor !== newType.constructor) {
      breakingChanges.push({
        type: BreakingChangeType.TYPE_CHANGED_KIND,
        description:
          `${typeName} changed from ` +
          `${typeKindName(oldType)} to ${typeKindName(newType)}.`,
      });
    }
  }
  return breakingChanges;
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
): {
  breakingChanges: Array<BreakingChange>,
  dangerousChanges: Array<DangerousChange>,
} {
  const oldTypeMap = oldSchema.getTypeMap();
  const newTypeMap = newSchema.getTypeMap();

  const breakingChanges = [];
  const dangerousChanges = [];

  for (const typeName of Object.keys(oldTypeMap)) {
    const oldType = oldTypeMap[typeName];
    const newType = newTypeMap[typeName];
    if (
      !(isObjectType(oldType) || isInterfaceType(oldType)) ||
      !(isObjectType(newType) || isInterfaceType(newType)) ||
      newType.constructor !== oldType.constructor
    ) {
      continue;
    }

    const oldTypeFields: GraphQLFieldMap<*, *> = oldType.getFields();
    const newTypeFields: GraphQLFieldMap<*, *> = newType.getFields();

    for (const fieldName of Object.keys(oldTypeFields)) {
      if (!newTypeFields[fieldName]) {
        continue;
      }

      for (const oldArgDef of oldTypeFields[fieldName].args) {
        const newArgs = newTypeFields[fieldName].args;
        const newArgDef = find(newArgs, arg => arg.name === oldArgDef.name);

        // Arg not present
        if (!newArgDef) {
          breakingChanges.push({
            type: BreakingChangeType.ARG_REMOVED,
            description:
              `${oldType.name}.${fieldName} arg ` +
              `${oldArgDef.name} was removed`,
          });
        } else {
          const isSafe = isChangeSafeForInputObjectFieldOrFieldArg(
            oldArgDef.type,
            newArgDef.type,
          );
          if (!isSafe) {
            breakingChanges.push({
              type: BreakingChangeType.ARG_CHANGED_KIND,
              description:
                `${oldType.name}.${fieldName} arg ` +
                `${oldArgDef.name} has changed type from ` +
                `${oldArgDef.type.toString()} to ${newArgDef.type.toString()}`,
            });
          } else if (
            oldArgDef.defaultValue !== undefined &&
            oldArgDef.defaultValue !== newArgDef.defaultValue
          ) {
            dangerousChanges.push({
              type: DangerousChangeType.ARG_DEFAULT_VALUE_CHANGE,
              description:
                `${oldType.name}.${fieldName} arg ` +
                `${oldArgDef.name} has changed defaultValue`,
            });
          }
        }
      }
      // Check if arg was added to the field
      for (const newArgDef of newTypeFields[fieldName].args) {
        const oldArgs = oldTypeFields[fieldName].args;
        const oldArgDef = find(oldArgs, arg => arg.name === newArgDef.name);
        if (!oldArgDef) {
          const argName = newArgDef.name;
          if (isRequiredArgument(newArgDef)) {
            breakingChanges.push({
              type: BreakingChangeType.REQUIRED_ARG_ADDED,
              description:
                `A required arg ${argName} on ` +
                `${typeName}.${fieldName} was added`,
            });
          } else {
            dangerousChanges.push({
              type: DangerousChangeType.OPTIONAL_ARG_ADDED,
              description:
                `An optional arg ${argName} on ` +
                `${typeName}.${fieldName} was added`,
            });
          }
        }
      }
    }
  }

  return {
    breakingChanges,
    dangerousChanges,
  };
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
  const oldTypeMap = oldSchema.getTypeMap();
  const newTypeMap = newSchema.getTypeMap();

  const breakingChanges = [];
  for (const typeName of Object.keys(oldTypeMap)) {
    const oldType = oldTypeMap[typeName];
    const newType = newTypeMap[typeName];
    if (
      !(isObjectType(oldType) || isInterfaceType(oldType)) ||
      !(isObjectType(newType) || isInterfaceType(newType)) ||
      newType.constructor !== oldType.constructor
    ) {
      continue;
    }

    const oldTypeFieldsDef = oldType.getFields();
    const newTypeFieldsDef = newType.getFields();
    for (const fieldName of Object.keys(oldTypeFieldsDef)) {
      // Check if the field is missing on the type in the new schema.
      if (!(fieldName in newTypeFieldsDef)) {
        breakingChanges.push({
          type: BreakingChangeType.FIELD_REMOVED,
          description: `${typeName}.${fieldName} was removed.`,
        });
      } else {
        const oldFieldType = oldTypeFieldsDef[fieldName].type;
        const newFieldType = newTypeFieldsDef[fieldName].type;
        const isSafe = isChangeSafeForObjectOrInterfaceField(
          oldFieldType,
          newFieldType,
        );
        if (!isSafe) {
          const oldFieldTypeString = isNamedType(oldFieldType)
            ? oldFieldType.name
            : oldFieldType.toString();
          const newFieldTypeString = isNamedType(newFieldType)
            ? newFieldType.name
            : newFieldType.toString();
          breakingChanges.push({
            type: BreakingChangeType.FIELD_CHANGED_KIND,
            description:
              `${typeName}.${fieldName} changed type from ` +
              `${oldFieldTypeString} to ${newFieldTypeString}.`,
          });
        }
      }
    }
  }
  return breakingChanges;
}

function findFieldsThatChangedTypeOnInputObjectTypes(
  oldSchema: GraphQLSchema,
  newSchema: GraphQLSchema,
): {
  breakingChanges: Array<BreakingChange>,
  dangerousChanges: Array<DangerousChange>,
} {
  const oldTypeMap = oldSchema.getTypeMap();
  const newTypeMap = newSchema.getTypeMap();

  const breakingChanges = [];
  const dangerousChanges = [];
  for (const typeName of Object.keys(oldTypeMap)) {
    const oldType = oldTypeMap[typeName];
    const newType = newTypeMap[typeName];
    if (!isInputObjectType(oldType) || !isInputObjectType(newType)) {
      continue;
    }

    const oldTypeFieldsDef = oldType.getFields();
    const newTypeFieldsDef = newType.getFields();
    for (const fieldName of Object.keys(oldTypeFieldsDef)) {
      // Check if the field is missing on the type in the new schema.
      if (!(fieldName in newTypeFieldsDef)) {
        breakingChanges.push({
          type: BreakingChangeType.FIELD_REMOVED,
          description: `${typeName}.${fieldName} was removed.`,
        });
      } else {
        const oldFieldType = oldTypeFieldsDef[fieldName].type;
        const newFieldType = newTypeFieldsDef[fieldName].type;

        const isSafe = isChangeSafeForInputObjectFieldOrFieldArg(
          oldFieldType,
          newFieldType,
        );
        if (!isSafe) {
          const oldFieldTypeString = isNamedType(oldFieldType)
            ? oldFieldType.name
            : oldFieldType.toString();
          const newFieldTypeString = isNamedType(newFieldType)
            ? newFieldType.name
            : newFieldType.toString();
          breakingChanges.push({
            type: BreakingChangeType.FIELD_CHANGED_KIND,
            description:
              `${typeName}.${fieldName} changed type from ` +
              `${oldFieldTypeString} to ${newFieldTypeString}.`,
          });
        }
      }
    }
    // Check if a field was added to the input object type
    for (const fieldName of Object.keys(newTypeFieldsDef)) {
      if (!(fieldName in oldTypeFieldsDef)) {
        if (isRequiredInputField(newTypeFieldsDef[fieldName])) {
          breakingChanges.push({
            type: BreakingChangeType.REQUIRED_INPUT_FIELD_ADDED,
            description:
              `A required field ${fieldName} on ` +
              `input type ${typeName} was added.`,
          });
        } else {
          dangerousChanges.push({
            type: DangerousChangeType.OPTIONAL_INPUT_FIELD_ADDED,
            description:
              `An optional field ${fieldName} on ` +
              `input type ${typeName} was added.`,
          });
        }
      }
    }
  }
  return {
    breakingChanges,
    dangerousChanges,
  };
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
  const oldTypeMap = oldSchema.getTypeMap();
  const newTypeMap = newSchema.getTypeMap();

  const typesRemovedFromUnion = [];
  for (const typeName of Object.keys(oldTypeMap)) {
    const oldType = oldTypeMap[typeName];
    const newType = newTypeMap[typeName];
    if (!isUnionType(oldType) || !isUnionType(newType)) {
      continue;
    }
    const typeNamesInNewUnion = Object.create(null);
    for (const type of newType.getTypes()) {
      typeNamesInNewUnion[type.name] = true;
    }
    for (const type of oldType.getTypes()) {
      if (!typeNamesInNewUnion[type.name]) {
        typesRemovedFromUnion.push({
          type: BreakingChangeType.TYPE_REMOVED_FROM_UNION,
          description: `${type.name} was removed from union type ${typeName}.`,
        });
      }
    }
  }
  return typesRemovedFromUnion;
}

/**
 * Given two schemas, returns an Array containing descriptions of any dangerous
 * changes in the newSchema related to adding types to a union type.
 */
function findTypesAddedToUnions(
  oldSchema: GraphQLSchema,
  newSchema: GraphQLSchema,
): Array<DangerousChange> {
  const oldTypeMap = oldSchema.getTypeMap();
  const newTypeMap = newSchema.getTypeMap();

  const typesAddedToUnion = [];
  for (const typeName of Object.keys(newTypeMap)) {
    const oldType = oldTypeMap[typeName];
    const newType = newTypeMap[typeName];
    if (!isUnionType(oldType) || !isUnionType(newType)) {
      continue;
    }
    const typeNamesInOldUnion = Object.create(null);
    for (const type of oldType.getTypes()) {
      typeNamesInOldUnion[type.name] = true;
    }
    for (const type of newType.getTypes()) {
      if (!typeNamesInOldUnion[type.name]) {
        typesAddedToUnion.push({
          type: DangerousChangeType.TYPE_ADDED_TO_UNION,
          description: `${type.name} was added to union type ${typeName}.`,
        });
      }
    }
  }
  return typesAddedToUnion;
}
/**
 * Given two schemas, returns an Array containing descriptions of any breaking
 * changes in the newSchema related to removing values from an enum type.
 */
function findValuesRemovedFromEnums(
  oldSchema: GraphQLSchema,
  newSchema: GraphQLSchema,
): Array<BreakingChange> {
  const oldTypeMap = oldSchema.getTypeMap();
  const newTypeMap = newSchema.getTypeMap();

  const valuesRemovedFromEnums = [];
  for (const typeName of Object.keys(oldTypeMap)) {
    const oldType = oldTypeMap[typeName];
    const newType = newTypeMap[typeName];
    if (!isEnumType(oldType) || !isEnumType(newType)) {
      continue;
    }
    const valuesInNewEnum = Object.create(null);
    for (const value of newType.getValues()) {
      valuesInNewEnum[value.name] = true;
    }
    for (const value of oldType.getValues()) {
      if (!valuesInNewEnum[value.name]) {
        valuesRemovedFromEnums.push({
          type: BreakingChangeType.VALUE_REMOVED_FROM_ENUM,
          description: `${value.name} was removed from enum type ${typeName}.`,
        });
      }
    }
  }
  return valuesRemovedFromEnums;
}

/**
 * Given two schemas, returns an Array containing descriptions of any dangerous
 * changes in the newSchema related to adding values to an enum type.
 */
function findValuesAddedToEnums(
  oldSchema: GraphQLSchema,
  newSchema: GraphQLSchema,
): Array<DangerousChange> {
  const oldTypeMap = oldSchema.getTypeMap();
  const newTypeMap = newSchema.getTypeMap();

  const valuesAddedToEnums = [];
  for (const typeName of Object.keys(oldTypeMap)) {
    const oldType = oldTypeMap[typeName];
    const newType = newTypeMap[typeName];
    if (!isEnumType(oldType) || !isEnumType(newType)) {
      continue;
    }

    const valuesInOldEnum = Object.create(null);
    for (const value of oldType.getValues()) {
      valuesInOldEnum[value.name] = true;
    }
    for (const value of newType.getValues()) {
      if (!valuesInOldEnum[value.name]) {
        valuesAddedToEnums.push({
          type: DangerousChangeType.VALUE_ADDED_TO_ENUM,
          description: `${value.name} was added to enum type ${typeName}.`,
        });
      }
    }
  }
  return valuesAddedToEnums;
}

function findInterfacesRemovedFromObjectTypes(
  oldSchema: GraphQLSchema,
  newSchema: GraphQLSchema,
): Array<BreakingChange> {
  const oldTypeMap = oldSchema.getTypeMap();
  const newTypeMap = newSchema.getTypeMap();
  const breakingChanges = [];

  for (const typeName of Object.keys(oldTypeMap)) {
    const oldType = oldTypeMap[typeName];
    const newType = newTypeMap[typeName];
    if (!isObjectType(oldType) || !isObjectType(newType)) {
      continue;
    }

    const oldInterfaces = oldType.getInterfaces();
    const newInterfaces = newType.getInterfaces();
    for (const oldInterface of oldInterfaces) {
      if (!newInterfaces.some(int => int.name === oldInterface.name)) {
        breakingChanges.push({
          type: BreakingChangeType.INTERFACE_REMOVED_FROM_OBJECT,
          description:
            `${typeName} no longer implements interface ` +
            `${oldInterface.name}.`,
        });
      }
    }
  }
  return breakingChanges;
}

function findInterfacesAddedToObjectTypes(
  oldSchema: GraphQLSchema,
  newSchema: GraphQLSchema,
): Array<DangerousChange> {
  const oldTypeMap = oldSchema.getTypeMap();
  const newTypeMap = newSchema.getTypeMap();
  const interfacesAddedToObjectTypes = [];

  for (const typeName of Object.keys(newTypeMap)) {
    const oldType = oldTypeMap[typeName];
    const newType = newTypeMap[typeName];
    if (!isObjectType(oldType) || !isObjectType(newType)) {
      continue;
    }

    const oldInterfaces = oldType.getInterfaces();
    const newInterfaces = newType.getInterfaces();
    for (const newInterface of newInterfaces) {
      if (!oldInterfaces.some(int => int.name === newInterface.name)) {
        interfacesAddedToObjectTypes.push({
          type: DangerousChangeType.INTERFACE_ADDED_TO_OBJECT,
          description:
            `${newInterface.name} added to interfaces implemented ` +
            `by ${typeName}.`,
        });
      }
    }
  }
  return interfacesAddedToObjectTypes;
}

function findRemovedDirectives(
  oldSchema: GraphQLSchema,
  newSchema: GraphQLSchema,
): Array<BreakingChange> {
  const removedDirectives = [];

  const newSchemaDirectiveMap = getDirectiveMapForSchema(newSchema);
  for (const directive of oldSchema.getDirectives()) {
    if (!newSchemaDirectiveMap[directive.name]) {
      removedDirectives.push({
        type: BreakingChangeType.DIRECTIVE_REMOVED,
        description: `${directive.name} was removed`,
      });
    }
  }

  return removedDirectives;
}

function findRemovedArgsForDirective(
  oldDirective: GraphQLDirective,
  newDirective: GraphQLDirective,
): Array<GraphQLArgument> {
  const removedArgs = [];
  const newArgMap = getArgumentMapForDirective(newDirective);

  for (const arg of oldDirective.args) {
    if (!newArgMap[arg.name]) {
      removedArgs.push(arg);
    }
  }

  return removedArgs;
}

function findRemovedDirectiveArgs(
  oldSchema: GraphQLSchema,
  newSchema: GraphQLSchema,
): Array<BreakingChange> {
  const removedDirectiveArgs = [];
  const oldSchemaDirectiveMap = getDirectiveMapForSchema(oldSchema);

  for (const newDirective of newSchema.getDirectives()) {
    const oldDirective = oldSchemaDirectiveMap[newDirective.name];
    if (!oldDirective) {
      continue;
    }

    for (const arg of findRemovedArgsForDirective(oldDirective, newDirective)) {
      removedDirectiveArgs.push({
        type: BreakingChangeType.DIRECTIVE_ARG_REMOVED,
        description: `${arg.name} was removed from ${newDirective.name}`,
      });
    }
  }

  return removedDirectiveArgs;
}

function findAddedArgsForDirective(
  oldDirective: GraphQLDirective,
  newDirective: GraphQLDirective,
): Array<GraphQLArgument> {
  const addedArgs = [];
  const oldArgMap = getArgumentMapForDirective(oldDirective);

  for (const arg of newDirective.args) {
    if (!oldArgMap[arg.name]) {
      addedArgs.push(arg);
    }
  }

  return addedArgs;
}

function findAddedNonNullDirectiveArgs(
  oldSchema: GraphQLSchema,
  newSchema: GraphQLSchema,
): Array<BreakingChange> {
  const addedNonNullableArgs = [];
  const oldSchemaDirectiveMap = getDirectiveMapForSchema(oldSchema);

  for (const newDirective of newSchema.getDirectives()) {
    const oldDirective = oldSchemaDirectiveMap[newDirective.name];
    if (!oldDirective) {
      continue;
    }

    for (const arg of findAddedArgsForDirective(oldDirective, newDirective)) {
      if (isRequiredArgument(arg)) {
        addedNonNullableArgs.push({
          type: BreakingChangeType.REQUIRED_DIRECTIVE_ARG_ADDED,
          description:
            `A required arg ${arg.name} on directive ` +
            `${newDirective.name} was added`,
        });
      }
    }
  }

  return addedNonNullableArgs;
}

function findRemovedLocationsForDirective(
  oldDirective: GraphQLDirective,
  newDirective: GraphQLDirective,
): Array<DirectiveLocationEnum> {
  const removedLocations = [];
  const newLocationSet = new Set(newDirective.locations);

  for (const oldLocation of oldDirective.locations) {
    if (!newLocationSet.has(oldLocation)) {
      removedLocations.push(oldLocation);
    }
  }

  return removedLocations;
}

function findRemovedDirectiveLocations(
  oldSchema: GraphQLSchema,
  newSchema: GraphQLSchema,
): Array<BreakingChange> {
  const removedLocations = [];
  const oldSchemaDirectiveMap = getDirectiveMapForSchema(oldSchema);

  for (const newDirective of newSchema.getDirectives()) {
    const oldDirective = oldSchemaDirectiveMap[newDirective.name];
    if (!oldDirective) {
      continue;
    }

    for (const location of findRemovedLocationsForDirective(
      oldDirective,
      newDirective,
    )) {
      removedLocations.push({
        type: BreakingChangeType.DIRECTIVE_LOCATION_REMOVED,
        description: `${location} was removed from ${newDirective.name}`,
      });
    }
  }

  return removedLocations;
}

function getDirectiveMapForSchema(
  schema: GraphQLSchema,
): ObjMap<GraphQLDirective> {
  return keyMap(schema.getDirectives(), dir => dir.name);
}

function getArgumentMapForDirective(
  directive: GraphQLDirective,
): ObjMap<GraphQLArgument> {
  return keyMap(directive.args, arg => arg.name);
}
