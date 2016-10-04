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
  GraphQLEnumType,
  GraphQLInputObjectType,
  GraphQLInterfaceType,
  GraphQLObjectType,
  GraphQLUnionType,
} from '../type/definition';
import {
  GraphQLSchema,
} from '../type/schema';

export const BreakingChangeType = {
  FIELD_CHANGED_KIND: 'FIELD_CHANGED_KIND',
  FIELD_REMOVED: 'FIELD_REMOVED',
  TYPE_CHANGED_KIND: 'TYPE_CHANGED_KIND',
  TYPE_REMOVED: 'TYPE_REMOVED',
  TYPE_REMOVED_FROM_UNION: 'TYPE_REMOVED_FROM_UNION',
  VALUE_REMOVED_FROM_ENUM: 'VALUE_REMOVED_FROM_ENUM',
};

export type BreakingChange = {
  type: $Keys<typeof BreakingChangeType>;
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
    ...findValuesRemovedFromEnums(oldSchema, newSchema)
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
  const oldTypes = Object.keys(oldSchema.getTypeMap());
  const newTypes = new Set(Object.keys(newSchema.getTypeMap()));
  return oldTypes.filter(typeName => !newTypes.has(typeName)).map(
    type => {
      return {
        type: BreakingChangeType.TYPE_REMOVED,
        description: `${type} was removed`,
      };
    }
  );
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

  const typesThatChangedType = [];
  Object.keys(oldTypeMap).forEach(typeName => {
    if (!newTypeMap[typeName]) {
      return;
    }
    const oldType = oldTypeMap[typeName];
    const newType = newTypeMap[typeName];
    if (!(oldType instanceof newType.constructor)) {
      typesThatChangedType.push(
        {
          type: BreakingChangeType.TYPE_CHANGED_KIND,
          description: `${typeName} changed from a ` +
            `${oldType.constructor.name} to a ${newType.constructor.name}`,
        }
      );
    }
  });
  return typesThatChangedType;
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
        breakingFieldChanges.push(
          {
            type: BreakingChangeType.FIELD_REMOVED,
            description: `${typeName}.${fieldName} was removed`,
          }
        );
      } else {
        // Check if the field's type has changed in the new schema.
        const oldFieldType = getNamedType(oldTypeFieldsDef[fieldName].type);
        const newFieldType = getNamedType(newTypeFieldsDef[fieldName].type);
        if (
          oldFieldType && newFieldType &&
          (oldFieldType.name !== newFieldType.name)
        ) {
          breakingFieldChanges.push(
            {
              type: BreakingChangeType.FIELD_CHANGED_KIND,
              description: `${typeName}.${fieldName} changed type from ` +
                `${oldFieldType.name} to ${newFieldType.name}`,
            }
          );
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
    if (
      !(oldType instanceof GraphQLUnionType) ||
      !(newType instanceof GraphQLUnionType)
    ) {
      return;
    }
    const typeNamesInNewUnion = new Set(
      newType.getTypes().map(type => type.name)
    );
    oldType.getTypes().forEach(typeInOldUnion => {
      if (!typeNamesInNewUnion.has(typeInOldUnion.name)) {
        typesRemovedFromUnion.push(
          {
            type: BreakingChangeType.TYPE_REMOVED_FROM_UNION,
            description: `${typeInOldUnion.name} was removed from union ` +
              `type ${typeName}`,
          }
        );
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
    if (
      !(oldType instanceof GraphQLEnumType) ||
      !(newType instanceof GraphQLEnumType)
    ) {
      return;
    }
    const valuesInNewEnum = new Set(
      newType.getValues().map(value => value.name)
    );
    oldType.getValues().forEach(valueInOldEnum => {
      if (!valuesInNewEnum.has(valueInOldEnum.name)) {
        valuesRemovedFromEnums.push(
          {
            type: BreakingChangeType.VALUE_REMOVED_FROM_ENUM,
            description: `${valueInOldEnum.name} was removed from enum ` +
              `type ${typeName}`,
          }
        );
      }
    });
  });
  return valuesRemovedFromEnums;
}
