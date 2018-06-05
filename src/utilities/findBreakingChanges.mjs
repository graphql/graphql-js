/**
 * Copyright (c) 2016-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow strict
 */

import {
  isScalarType,
  isObjectType,
  isInterfaceType,
  isUnionType,
  isEnumType,
  isInputObjectType,
  isNonNullType,
  isListType,
  isNamedType,
} from '../type/definition';

import type {
  GraphQLNamedType,
  GraphQLFieldMap,
  GraphQLType,
  GraphQLArgument,
} from '../type/definition';

import { GraphQLDirective } from '../type/directives';
import { GraphQLSchema } from '../type/schema';
import keyMap from '../jsutils/keyMap';

import type { ObjMap } from '../jsutils/ObjMap';
import type { DirectiveLocationEnum } from '../language/directiveLocation';

export const BreakingChangeType = {
  FIELD_CHANGED_KIND: 'FIELD_CHANGED_KIND',
  FIELD_REMOVED: 'FIELD_REMOVED',
  TYPE_CHANGED_KIND: 'TYPE_CHANGED_KIND',
  TYPE_REMOVED: 'TYPE_REMOVED',
  TYPE_REMOVED_FROM_UNION: 'TYPE_REMOVED_FROM_UNION',
  VALUE_REMOVED_FROM_ENUM: 'VALUE_REMOVED_FROM_ENUM',
  ARG_REMOVED: 'ARG_REMOVED',
  ARG_CHANGED_KIND: 'ARG_CHANGED_KIND',
  NON_NULL_ARG_ADDED: 'NON_NULL_ARG_ADDED',
  NON_NULL_INPUT_FIELD_ADDED: 'NON_NULL_INPUT_FIELD_ADDED',
  INTERFACE_REMOVED_FROM_OBJECT: 'INTERFACE_REMOVED_FROM_OBJECT',
  DIRECTIVE_REMOVED: 'DIRECTIVE_REMOVED',
  DIRECTIVE_ARG_REMOVED: 'DIRECTIVE_ARG_REMOVED',
  DIRECTIVE_LOCATION_REMOVED: 'DIRECTIVE_LOCATION_REMOVED',
  NON_NULL_DIRECTIVE_ARG_ADDED: 'NON_NULL_DIRECTIVE_ARG_ADDED',
};

export const DangerousChangeType = {
  ARG_DEFAULT_VALUE_CHANGE: 'ARG_DEFAULT_VALUE_CHANGE',
  VALUE_ADDED_TO_ENUM: 'VALUE_ADDED_TO_ENUM',
  INTERFACE_ADDED_TO_OBJECT: 'INTERFACE_ADDED_TO_OBJECT',
  TYPE_ADDED_TO_UNION: 'TYPE_ADDED_TO_UNION',
  NULLABLE_INPUT_FIELD_ADDED: 'NULLABLE_INPUT_FIELD_ADDED',
  NULLABLE_ARG_ADDED: 'NULLABLE_ARG_ADDED',
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
export function findRemovedTypes(
  oldSchema: GraphQLSchema,
  newSchema: GraphQLSchema,
): Array<BreakingChange> {
  const oldTypeMap = oldSchema.getTypeMap();
  const newTypeMap = newSchema.getTypeMap();

  const breakingChanges = [];
  Object.keys(oldTypeMap).forEach(typeName => {
    if (!newTypeMap[typeName]) {
      breakingChanges.push({
        type: BreakingChangeType.TYPE_REMOVED,
        description: `${typeName} was removed.`,
      });
    }
  });
  return breakingChanges;
}

/**
 * Given two schemas, returns an Array containing descriptions of any breaking
 * changes in the newSchema related to changing the type of a type.
 */
export function findTypesThatChangedKind(
  oldSchema: GraphQLSchema,
  newSchema: GraphQLSchema,
): Array<BreakingChange> {
  const oldTypeMap = oldSchema.getTypeMap();
  const newTypeMap = newSchema.getTypeMap();

  const breakingChanges = [];
  Object.keys(oldTypeMap).forEach(typeName => {
    if (!newTypeMap[typeName]) {
      return;
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
  });
  return breakingChanges;
}

/**
 * Given two schemas, returns an Array containing descriptions of any
 * breaking or dangerous changes in the newSchema related to arguments
 * (such as removal or change of type of an argument, or a change in an
 * argument's default value).
 */
export function findArgChanges(
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

  Object.keys(oldTypeMap).forEach(typeName => {
    const oldType = oldTypeMap[typeName];
    const newType = newTypeMap[typeName];
    if (
      !(isObjectType(oldType) || isInterfaceType(oldType)) ||
      !(isObjectType(newType) || isInterfaceType(newType)) ||
      newType.constructor !== oldType.constructor
    ) {
      return;
    }

    const oldTypeFields: GraphQLFieldMap<*, *> = oldType.getFields();
    const newTypeFields: GraphQLFieldMap<*, *> = newType.getFields();

    Object.keys(oldTypeFields).forEach(fieldName => {
      if (!newTypeFields[fieldName]) {
        return;
      }

      oldTypeFields[fieldName].args.forEach(oldArgDef => {
        const newArgs = newTypeFields[fieldName].args;
        const newArgDef = newArgs.find(arg => arg.name === oldArgDef.name);

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
      });
      // Check if a non-null arg was added to the field
      newTypeFields[fieldName].args.forEach(newArgDef => {
        const oldArgs = oldTypeFields[fieldName].args;
        const oldArgDef = oldArgs.find(arg => arg.name === newArgDef.name);
        if (!oldArgDef) {
          if (isNonNullType(newArgDef.type)) {
            breakingChanges.push({
              type: BreakingChangeType.NON_NULL_ARG_ADDED,
              description:
                `A non-null arg ${newArgDef.name} on ` +
                `${newType.name}.${fieldName} was added`,
            });
          } else {
            dangerousChanges.push({
              type: DangerousChangeType.NULLABLE_ARG_ADDED,
              description:
                `A nullable arg ${newArgDef.name} on ` +
                `${newType.name}.${fieldName} was added`,
            });
          }
        }
      });
    });
  });

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
  throw new TypeError('Unknown type ' + type.constructor.name);
}

export function findFieldsThatChangedTypeOnObjectOrInterfaceTypes(
  oldSchema: GraphQLSchema,
  newSchema: GraphQLSchema,
): Array<BreakingChange> {
  const oldTypeMap = oldSchema.getTypeMap();
  const newTypeMap = newSchema.getTypeMap();

  const breakingChanges = [];
  Object.keys(oldTypeMap).forEach(typeName => {
    const oldType = oldTypeMap[typeName];
    const newType = newTypeMap[typeName];
    if (
      !(isObjectType(oldType) || isInterfaceType(oldType)) ||
      !(isObjectType(newType) || isInterfaceType(newType)) ||
      newType.constructor !== oldType.constructor
    ) {
      return;
    }

    const oldTypeFieldsDef = oldType.getFields();
    const newTypeFieldsDef = newType.getFields();
    Object.keys(oldTypeFieldsDef).forEach(fieldName => {
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
    });
  });
  return breakingChanges;
}

export function findFieldsThatChangedTypeOnInputObjectTypes(
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
  Object.keys(oldTypeMap).forEach(typeName => {
    const oldType = oldTypeMap[typeName];
    const newType = newTypeMap[typeName];
    if (!isInputObjectType(oldType) || !isInputObjectType(newType)) {
      return;
    }

    const oldTypeFieldsDef = oldType.getFields();
    const newTypeFieldsDef = newType.getFields();
    Object.keys(oldTypeFieldsDef).forEach(fieldName => {
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
    });
    // Check if a field was added to the input object type
    Object.keys(newTypeFieldsDef).forEach(fieldName => {
      if (!(fieldName in oldTypeFieldsDef)) {
        if (isNonNullType(newTypeFieldsDef[fieldName].type)) {
          breakingChanges.push({
            type: BreakingChangeType.NON_NULL_INPUT_FIELD_ADDED,
            description:
              `A non-null field ${fieldName} on ` +
              `input type ${newType.name} was added.`,
          });
        } else {
          dangerousChanges.push({
            type: DangerousChangeType.NULLABLE_INPUT_FIELD_ADDED,
            description:
              `A nullable field ${fieldName} on ` +
              `input type ${newType.name} was added.`,
          });
        }
      }
    });
  });
  return {
    breakingChanges,
    dangerousChanges,
  };
}

function isChangeSafeForObjectOrInterfaceField(
  oldType: GraphQLType,
  newType: GraphQLType,
): boolean {
  if (isNamedType(oldType)) {
    return (
      // if they're both named types, see if their names are equivalent
      (isNamedType(newType) && oldType.name === newType.name) ||
      // moving from nullable to non-null of the same underlying type is safe
      (isNonNullType(newType) &&
        isChangeSafeForObjectOrInterfaceField(oldType, newType.ofType))
    );
  } else if (isListType(oldType)) {
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
  } else if (isNonNullType(oldType)) {
    // if they're both non-null, make sure the underlying types are compatible
    return (
      isNonNullType(newType) &&
      isChangeSafeForObjectOrInterfaceField(oldType.ofType, newType.ofType)
    );
  }
  return false;
}

function isChangeSafeForInputObjectFieldOrFieldArg(
  oldType: GraphQLType,
  newType: GraphQLType,
): boolean {
  if (isNamedType(oldType)) {
    // if they're both named types, see if their names are equivalent
    return isNamedType(newType) && oldType.name === newType.name;
  } else if (isListType(oldType)) {
    // if they're both lists, make sure the underlying types are compatible
    return (
      isListType(newType) &&
      isChangeSafeForInputObjectFieldOrFieldArg(oldType.ofType, newType.ofType)
    );
  } else if (isNonNullType(oldType)) {
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
  return false;
}

/**
 * Given two schemas, returns an Array containing descriptions of any breaking
 * changes in the newSchema related to removing types from a union type.
 */
export function findTypesRemovedFromUnions(
  oldSchema: GraphQLSchema,
  newSchema: GraphQLSchema,
): Array<BreakingChange> {
  const oldTypeMap = oldSchema.getTypeMap();
  const newTypeMap = newSchema.getTypeMap();

  const typesRemovedFromUnion = [];
  Object.keys(oldTypeMap).forEach(typeName => {
    const oldType = oldTypeMap[typeName];
    const newType = newTypeMap[typeName];
    if (!isUnionType(oldType) || !isUnionType(newType)) {
      return;
    }
    const typeNamesInNewUnion = Object.create(null);
    newType.getTypes().forEach(type => {
      typeNamesInNewUnion[type.name] = true;
    });
    oldType.getTypes().forEach(type => {
      if (!typeNamesInNewUnion[type.name]) {
        typesRemovedFromUnion.push({
          type: BreakingChangeType.TYPE_REMOVED_FROM_UNION,
          description: `${type.name} was removed from union type ${typeName}.`,
        });
      }
    });
  });
  return typesRemovedFromUnion;
}

/**
 * Given two schemas, returns an Array containing descriptions of any dangerous
 * changes in the newSchema related to adding types to a union type.
 */
export function findTypesAddedToUnions(
  oldSchema: GraphQLSchema,
  newSchema: GraphQLSchema,
): Array<DangerousChange> {
  const oldTypeMap = oldSchema.getTypeMap();
  const newTypeMap = newSchema.getTypeMap();

  const typesAddedToUnion = [];
  Object.keys(newTypeMap).forEach(typeName => {
    const oldType = oldTypeMap[typeName];
    const newType = newTypeMap[typeName];
    if (!isUnionType(oldType) || !isUnionType(newType)) {
      return;
    }
    const typeNamesInOldUnion = Object.create(null);
    oldType.getTypes().forEach(type => {
      typeNamesInOldUnion[type.name] = true;
    });
    newType.getTypes().forEach(type => {
      if (!typeNamesInOldUnion[type.name]) {
        typesAddedToUnion.push({
          type: DangerousChangeType.TYPE_ADDED_TO_UNION,
          description: `${type.name} was added to union type ${typeName}.`,
        });
      }
    });
  });
  return typesAddedToUnion;
}
/**
 * Given two schemas, returns an Array containing descriptions of any breaking
 * changes in the newSchema related to removing values from an enum type.
 */
export function findValuesRemovedFromEnums(
  oldSchema: GraphQLSchema,
  newSchema: GraphQLSchema,
): Array<BreakingChange> {
  const oldTypeMap = oldSchema.getTypeMap();
  const newTypeMap = newSchema.getTypeMap();

  const valuesRemovedFromEnums = [];
  Object.keys(oldTypeMap).forEach(typeName => {
    const oldType = oldTypeMap[typeName];
    const newType = newTypeMap[typeName];
    if (!isEnumType(oldType) || !isEnumType(newType)) {
      return;
    }
    const valuesInNewEnum = Object.create(null);
    newType.getValues().forEach(value => {
      valuesInNewEnum[value.name] = true;
    });
    oldType.getValues().forEach(value => {
      if (!valuesInNewEnum[value.name]) {
        valuesRemovedFromEnums.push({
          type: BreakingChangeType.VALUE_REMOVED_FROM_ENUM,
          description: `${value.name} was removed from enum type ${typeName}.`,
        });
      }
    });
  });
  return valuesRemovedFromEnums;
}

/**
 * Given two schemas, returns an Array containing descriptions of any dangerous
 * changes in the newSchema related to adding values to an enum type.
 */
export function findValuesAddedToEnums(
  oldSchema: GraphQLSchema,
  newSchema: GraphQLSchema,
): Array<DangerousChange> {
  const oldTypeMap = oldSchema.getTypeMap();
  const newTypeMap = newSchema.getTypeMap();

  const valuesAddedToEnums = [];
  Object.keys(oldTypeMap).forEach(typeName => {
    const oldType = oldTypeMap[typeName];
    const newType = newTypeMap[typeName];
    if (!isEnumType(oldType) || !isEnumType(newType)) {
      return;
    }

    const valuesInOldEnum = Object.create(null);
    oldType.getValues().forEach(value => {
      valuesInOldEnum[value.name] = true;
    });
    newType.getValues().forEach(value => {
      if (!valuesInOldEnum[value.name]) {
        valuesAddedToEnums.push({
          type: DangerousChangeType.VALUE_ADDED_TO_ENUM,
          description: `${value.name} was added to enum type ${typeName}.`,
        });
      }
    });
  });
  return valuesAddedToEnums;
}

export function findInterfacesRemovedFromObjectTypes(
  oldSchema: GraphQLSchema,
  newSchema: GraphQLSchema,
): Array<BreakingChange> {
  const oldTypeMap = oldSchema.getTypeMap();
  const newTypeMap = newSchema.getTypeMap();
  const breakingChanges = [];

  Object.keys(oldTypeMap).forEach(typeName => {
    const oldType = oldTypeMap[typeName];
    const newType = newTypeMap[typeName];
    if (!isObjectType(oldType) || !isObjectType(newType)) {
      return;
    }

    const oldInterfaces = oldType.getInterfaces();
    const newInterfaces = newType.getInterfaces();
    oldInterfaces.forEach(oldInterface => {
      if (!newInterfaces.some(int => int.name === oldInterface.name)) {
        breakingChanges.push({
          type: BreakingChangeType.INTERFACE_REMOVED_FROM_OBJECT,
          description:
            `${typeName} no longer implements interface ` +
            `${oldInterface.name}.`,
        });
      }
    });
  });
  return breakingChanges;
}

export function findInterfacesAddedToObjectTypes(
  oldSchema: GraphQLSchema,
  newSchema: GraphQLSchema,
): Array<DangerousChange> {
  const oldTypeMap = oldSchema.getTypeMap();
  const newTypeMap = newSchema.getTypeMap();
  const interfacesAddedToObjectTypes = [];

  Object.keys(newTypeMap).forEach(typeName => {
    const oldType = oldTypeMap[typeName];
    const newType = newTypeMap[typeName];
    if (!isObjectType(oldType) || !isObjectType(newType)) {
      return;
    }

    const oldInterfaces = oldType.getInterfaces();
    const newInterfaces = newType.getInterfaces();
    newInterfaces.forEach(newInterface => {
      if (!oldInterfaces.some(int => int.name === newInterface.name)) {
        interfacesAddedToObjectTypes.push({
          type: DangerousChangeType.INTERFACE_ADDED_TO_OBJECT,
          description:
            `${newInterface.name} added to interfaces implemented ` +
            `by ${typeName}.`,
        });
      }
    });
  });
  return interfacesAddedToObjectTypes;
}

export function findRemovedDirectives(
  oldSchema: GraphQLSchema,
  newSchema: GraphQLSchema,
): Array<BreakingChange> {
  const removedDirectives = [];

  const newSchemaDirectiveMap = getDirectiveMapForSchema(newSchema);
  oldSchema.getDirectives().forEach(directive => {
    if (!newSchemaDirectiveMap[directive.name]) {
      removedDirectives.push({
        type: BreakingChangeType.DIRECTIVE_REMOVED,
        description: `${directive.name} was removed`,
      });
    }
  });

  return removedDirectives;
}

function findRemovedArgsForDirective(
  oldDirective: GraphQLDirective,
  newDirective: GraphQLDirective,
): Array<GraphQLArgument> {
  const removedArgs = [];
  const newArgMap = getArgumentMapForDirective(newDirective);

  oldDirective.args.forEach(arg => {
    if (!newArgMap[arg.name]) {
      removedArgs.push(arg);
    }
  });

  return removedArgs;
}

export function findRemovedDirectiveArgs(
  oldSchema: GraphQLSchema,
  newSchema: GraphQLSchema,
): Array<BreakingChange> {
  const removedDirectiveArgs = [];
  const oldSchemaDirectiveMap = getDirectiveMapForSchema(oldSchema);

  newSchema.getDirectives().forEach(newDirective => {
    const oldDirective = oldSchemaDirectiveMap[newDirective.name];
    if (!oldDirective) {
      return;
    }

    findRemovedArgsForDirective(oldDirective, newDirective).forEach(arg => {
      removedDirectiveArgs.push({
        type: BreakingChangeType.DIRECTIVE_ARG_REMOVED,
        description: `${arg.name} was removed from ${newDirective.name}`,
      });
    });
  });

  return removedDirectiveArgs;
}

function findAddedArgsForDirective(
  oldDirective: GraphQLDirective,
  newDirective: GraphQLDirective,
): Array<GraphQLArgument> {
  const addedArgs = [];
  const oldArgMap = getArgumentMapForDirective(oldDirective);

  newDirective.args.forEach(arg => {
    if (!oldArgMap[arg.name]) {
      addedArgs.push(arg);
    }
  });

  return addedArgs;
}

export function findAddedNonNullDirectiveArgs(
  oldSchema: GraphQLSchema,
  newSchema: GraphQLSchema,
): Array<BreakingChange> {
  const addedNonNullableArgs = [];
  const oldSchemaDirectiveMap = getDirectiveMapForSchema(oldSchema);

  newSchema.getDirectives().forEach(newDirective => {
    const oldDirective = oldSchemaDirectiveMap[newDirective.name];
    if (!oldDirective) {
      return;
    }

    findAddedArgsForDirective(oldDirective, newDirective).forEach(arg => {
      if (!isNonNullType(arg.type)) {
        return;
      }

      addedNonNullableArgs.push({
        type: BreakingChangeType.NON_NULL_DIRECTIVE_ARG_ADDED,
        description:
          `A non-null arg ${arg.name} on directive ` +
          `${newDirective.name} was added`,
      });
    });
  });

  return addedNonNullableArgs;
}

export function findRemovedLocationsForDirective(
  oldDirective: GraphQLDirective,
  newDirective: GraphQLDirective,
): Array<DirectiveLocationEnum> {
  const removedLocations = [];
  const newLocationSet = new Set(newDirective.locations);

  oldDirective.locations.forEach(oldLocation => {
    if (!newLocationSet.has(oldLocation)) {
      removedLocations.push(oldLocation);
    }
  });

  return removedLocations;
}

export function findRemovedDirectiveLocations(
  oldSchema: GraphQLSchema,
  newSchema: GraphQLSchema,
): Array<BreakingChange> {
  const removedLocations = [];
  const oldSchemaDirectiveMap = getDirectiveMapForSchema(oldSchema);

  newSchema.getDirectives().forEach(newDirective => {
    const oldDirective = oldSchemaDirectiveMap[newDirective.name];
    if (!oldDirective) {
      return;
    }

    findRemovedLocationsForDirective(oldDirective, newDirective).forEach(
      location => {
        removedLocations.push({
          type: BreakingChangeType.DIRECTIVE_LOCATION_REMOVED,
          description: `${location} was removed from ${newDirective.name}`,
        });
      },
    );
  });

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
