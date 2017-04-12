/* @flow */
/**
 *  Copyright (c) 2016, Facebook, Inc.
 *  All rights reserved.
 *
 *  This source code is licensed under the BSD-style license found in the
 *  LICENSE file in the root directory of this source tree. An additional grant
 *  of patent rights can be found in the PATENTS file in the same directory.
 */

import {
  getNamedType,
  GraphQLScalarType,
  GraphQLEnumType,
  GraphQLInputObjectType,
  GraphQLInterfaceType,
  GraphQLObjectType,
  GraphQLUnionType,
} from '../type/definition';

import type { GraphQLNamedType, GraphQLFieldMap } from '../type/definition';

import { GraphQLSchema } from '../type/schema';

export const BreakingChangeType = {
  FIELD_CHANGED_KIND: 'FIELD_CHANGED_KIND',
  FIELD_REMOVED: 'FIELD_REMOVED',
  TYPE_CHANGED_KIND: 'TYPE_CHANGED_KIND',
  TYPE_REMOVED: 'TYPE_REMOVED',
  TYPE_REMOVED_FROM_UNION: 'TYPE_REMOVED_FROM_UNION',
  VALUE_REMOVED_FROM_ENUM: 'VALUE_REMOVED_FROM_ENUM',
  ARG_REMOVED: 'ARG_REMOVED',
  ARG_CHANGED_KIND: 'ARG_CHANGED_KIND',
};

export const DangerousChangeType = {
  ARG_DEFAULT_VALUE_CHANGE: 'ARG_DEFAULT_VALUE_CHANGE',
};

export type BreakingChange = {
  type: $Keys<typeof BreakingChangeType>;
  description: string;
};

export type DangerousChange = {
  type: $Keys<typeof DangerousChangeType>;
  description: string;
};

/**
 * Given two schemas, returns an Array containing descriptions of all the types
 * of breaking changes covered by the other functions down below.
 */
export function findBreakingChanges(
  oldSchema: GraphQLSchema,
  newSchema: GraphQLSchema
): Array<BreakingChange> {
  return [
    ...findRemovedTypes(oldSchema, newSchema),
    ...findTypesThatChangedKind(oldSchema, newSchema),
    ...findFieldsThatChangedType(oldSchema, newSchema),
    ...findTypesRemovedFromUnions(oldSchema, newSchema),
    ...findValuesRemovedFromEnums(oldSchema, newSchema),
    ...findArgChanges(oldSchema, newSchema).breakingChanges,
  ];
}

/**
 * Given two schemas, returns an Array containing descriptions of all the types
 * of potentially dangerous changes covered by the other functions down below.
 */
export function findDangerousChanges(
  oldSchema: GraphQLSchema,
  newSchema: GraphQLSchema
): Array<DangerousChange> {
  return [
    ...findArgChanges(oldSchema, newSchema).dangerousChanges,
  ];
}

/**
 * Given two schemas, returns an Array containing descriptions of any breaking
 * changes in the newSchema related to removing an entire type.
 */
export function findRemovedTypes(
  oldSchema: GraphQLSchema,
  newSchema: GraphQLSchema
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
 newSchema: GraphQLSchema
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
    if (!(oldType instanceof newType.constructor)) {
      breakingChanges.push({
        type: BreakingChangeType.TYPE_CHANGED_KIND,
        description: `${typeName} changed from ` +
          `${typeKindName(oldType)} to ${typeKindName(newType)}.`
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
 newSchema: GraphQLSchema
): {
  breakingChanges: Array<BreakingChange>,
  dangerousChanges: Array<DangerousChange>
} {
  const oldTypeMap = oldSchema.getTypeMap();
  const newTypeMap = newSchema.getTypeMap();

  const breakingChanges = [];
  const dangerousChanges = [];

  Object.keys(oldTypeMap).forEach(typeName => {
    const oldType = oldTypeMap[typeName];
    const newType = newTypeMap[typeName];
    if (
      !(oldType instanceof GraphQLObjectType) ||
      !(newType instanceof oldType.constructor)
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
        const newTypeArgIndex = newArgs.findIndex(
          arg => arg.name === oldArgDef.name
        );
        const newArgDef = newArgs[newTypeArgIndex];

        const oldArgTypeName = getNamedType(oldArgDef.type);
        const newArgTypeName = newArgDef ?
          getNamedType(newArgDef.type) :
          null;

        if (!oldArgTypeName) {
          return;
        }

        // Arg not present
        if (!newArgTypeName) {
          breakingChanges.push({
            type: BreakingChangeType.ARG_REMOVED,
            description: `${oldType.name}.${fieldName} arg ` +
              `${oldArgDef.name} was removed`,
          });

        // Arg changed type in a breaking way
        } else if (
          oldArgTypeName.name !== newArgTypeName.name
        ) {
          breakingChanges.push({
            type: BreakingChangeType.ARG_CHANGED_KIND,
            description: `${oldType.name}.${fieldName} arg ` +
              `${oldArgDef.name} has changed type from ` +
              `${oldArgDef.type.toString()} to ${newArgDef.type.toString()}`,
          });

        // Arg default value has changed
        } else if (oldArgDef.defaultValue !== undefined &&
          oldArgDef.defaultValue !== newArgDef.defaultValue) {
          dangerousChanges.push({
            type: DangerousChangeType.ARG_DEFAULT_VALUE_CHANGE,
            description: `${oldType.name}.${fieldName} arg ${oldArgDef.name} ` +
              'has changed defaultValue',
          });
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
  if (type instanceof GraphQLScalarType) {
    return 'a Scalar type';
  }
  if (type instanceof GraphQLObjectType) {
    return 'an Object type';
  }
  if (type instanceof GraphQLInterfaceType) {
    return 'an Interface type';
  }
  if (type instanceof GraphQLUnionType) {
    return 'a Union type';
  }
  if (type instanceof GraphQLEnumType) {
    return 'an Enum type';
  }
  if (type instanceof GraphQLInputObjectType) {
    return 'an Input type';
  }
  throw new TypeError('Unknown type ' + type.constructor.name);
}

/**
 * Given two schemas, returns an Array containing descriptions of any breaking
 * changes in the newSchema related to the fields on a type. This includes if
 * a field has been removed from a type or if a field has changed type.
 */
export function findFieldsThatChangedType(
  oldSchema: GraphQLSchema,
  newSchema: GraphQLSchema
): Array<BreakingChange> {
  const oldTypeMap = oldSchema.getTypeMap();
  const newTypeMap = newSchema.getTypeMap();

  const breakingFieldChanges = [];
  Object.keys(oldTypeMap).forEach(typeName => {
    const oldType = oldTypeMap[typeName];
    const newType = newTypeMap[typeName];
    if (
      !(oldType instanceof GraphQLObjectType ||
        oldType instanceof GraphQLInterfaceType ||
        oldType instanceof GraphQLInputObjectType) ||
      !(newType instanceof oldType.constructor)
    ) {
      return;
    }

    const oldTypeFieldsDef = oldType.getFields();
    const newTypeFieldsDef = newType.getFields();
    Object.keys(oldTypeFieldsDef).forEach(fieldName => {
      // Check if the field is missing on the type in the new schema.
      if (!(fieldName in newTypeFieldsDef)) {
        breakingFieldChanges.push({
          type: BreakingChangeType.FIELD_REMOVED,
          description: `${typeName}.${fieldName} was removed.`,
        });
      } else {
        // Check if the field's type has changed in the new schema.
        const oldFieldType = getNamedType(oldTypeFieldsDef[fieldName].type);
        const newFieldType = getNamedType(newTypeFieldsDef[fieldName].type);
        if (oldFieldType &&
            newFieldType &&
            oldFieldType.name !== newFieldType.name) {
          breakingFieldChanges.push({
            type: BreakingChangeType.FIELD_CHANGED_KIND,
            description: `${typeName}.${fieldName} changed type from ` +
              `${oldFieldType.name} to ${newFieldType.name}.`,
          });
        }
      }
    });
  });
  return breakingFieldChanges;
}

/**
 * Given two schemas, returns an Array containing descriptions of any breaking
 * changes in the newSchema related to removing types from a union type.
 */
export function findTypesRemovedFromUnions(
  oldSchema: GraphQLSchema,
  newSchema: GraphQLSchema
): Array<BreakingChange> {
  const oldTypeMap = oldSchema.getTypeMap();
  const newTypeMap = newSchema.getTypeMap();

  const typesRemovedFromUnion = [];
  Object.keys(oldTypeMap).forEach(typeName => {
    const oldType = oldTypeMap[typeName];
    const newType = newTypeMap[typeName];
    if (!(oldType instanceof GraphQLUnionType) ||
        !(newType instanceof GraphQLUnionType)) {
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
          description: `${type.name} was removed from union type ${typeName}.`
        });
      }
    });
  });
  return typesRemovedFromUnion;
}

/**
 * Given two schemas, returns an Array containing descriptions of any breaking
 * changes in the newSchema related to removing values from an enum type.
 */
export function findValuesRemovedFromEnums(
  oldSchema: GraphQLSchema,
  newSchema: GraphQLSchema
): Array<BreakingChange> {
  const oldTypeMap = oldSchema.getTypeMap();
  const newTypeMap = newSchema.getTypeMap();

  const valuesRemovedFromEnums = [];
  Object.keys(oldTypeMap).forEach(typeName => {
    const oldType = oldTypeMap[typeName];
    const newType = newTypeMap[typeName];
    if (!(oldType instanceof GraphQLEnumType) ||
        !(newType instanceof GraphQLEnumType)) {
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
          description: `${value.name} was removed from enum type ${typeName}.`
        });
      }
    });
  });
  return valuesRemovedFromEnums;
}
