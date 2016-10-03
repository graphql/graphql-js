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
import type {
  GraphQLFieldDefinitionMap,
  GraphQLNamedType,
  GraphQLType,
  InputObjectFieldMap,
} from '../type/definition';
import {
  GraphQLSchema,
} from '../type/schema';
import type {
  TypeMap,
} from '../type/schema';

/**
 * Given two schemas, returns a Set containing descriptions of all the types of
 * breaking changes covered by the other functions down below.
 */
export function findBreakingChanges(
  oldSchema: GraphQLSchema,
  newSchema: GraphQLSchema
): Set<string> {
  return new Set([
    ...Array.from(findRemovedTypes(oldSchema, newSchema)),
    ...Array.from(findTypesThatChangedType(oldSchema, newSchema)),
    ...Array.from(findBreakingFieldChanges(oldSchema, newSchema)),
    ...Array.from(findTypesRemovedFromUnions(oldSchema, newSchema)),
    ...Array.from(findValuesRemovedFromEnums(oldSchema, newSchema))
  ]);
}

/**
* Given two schemas, returns a Set containing descriptions of any breaking
* changes in the newSchema related to removing an entire type.
*/
export function findRemovedTypes(
  oldSchema: GraphQLSchema,
  newSchema: GraphQLSchema
): Set<string> {
  const oldTypes: Set<string> = new Set(Object.keys(oldSchema.getTypeMap()));
  const newTypes: Set<string> = new Set(Object.keys(newSchema.getTypeMap()));
  const removedTypes: Set<string> = new Set(
    Array.from(oldTypes).filter(typeName => !newTypes.has(typeName)).map(
     type => `${type} was removed`
    )
  );
  return removedTypes;
}

/**
* Given two schemas, returns a Set containing descriptions of any breaking
* changes in the newSchema related to changing the type of a type.
*/
export function findTypesThatChangedType(
 oldSchema: GraphQLSchema,
 newSchema: GraphQLSchema
): Set<string> {
  const oldTypeMap: TypeMap = oldSchema.getTypeMap();
  const newTypeMap: TypeMap = newSchema.getTypeMap();

  const typesThatChangedType: Array<string> = [];
  for (const typeName: string in oldTypeMap) {
    if (!newTypeMap[typeName]) {
      continue;
    }
    const oldType: GraphQLType = oldTypeMap[typeName];
    const newType: GraphQLType = newTypeMap[typeName];
    if (!(oldType instanceof newType.constructor)) {
      typesThatChangedType.push(`${typeName} changed from a ` +
        `${oldType.constructor.name} to a ${newType.constructor.name}`);
    }
  }
  return new Set(typesThatChangedType);
}

/**
* Given two schemas, returns a Set containing descriptions of any breaking
* changes in the newSchema related to the fields on a type. This includes if
* a field has been removed from a type or if a field has changed type.
*/
export function findBreakingFieldChanges(
  oldSchema: GraphQLSchema,
  newSchema: GraphQLSchema
): Set<string> {
  const oldTypeMap: TypeMap = oldSchema.getTypeMap();
  const newTypeMap: TypeMap = newSchema.getTypeMap();

  const breakingFieldChanges: Array<string> = [];
  for (const typeName: string in oldTypeMap) {
    if (!{}.hasOwnProperty.call(oldTypeMap,typeName)) {
      continue;
    }
    const oldType:GraphQLType = oldTypeMap[typeName];
    const newType:GraphQLType = newTypeMap[typeName];
    if (
      !(oldType instanceof GraphQLObjectType ||
        oldType instanceof GraphQLInterfaceType ||
        oldType instanceof GraphQLInputObjectType) ||
      !(newType instanceof oldType.constructor)
    ) {
      continue;
    }

    const oldTypeFieldsDef: InputObjectFieldMap | GraphQLFieldDefinitionMap =
      oldType.getFields();
    const newTypeFieldsDef: InputObjectFieldMap | GraphQLFieldDefinitionMap =
      newType.getFields();
    for (const fieldName: string in oldTypeFieldsDef) {
      // Check if the field is missing on the type in the new schema.
      if (!(fieldName in newTypeFieldsDef)) {
        breakingFieldChanges.push(`${typeName}.${fieldName} was removed`);
      } else {
        // Check if the field's type has changed in the new schema.
        const oldFieldType: ?GraphQLNamedType =
          getNamedType(oldTypeFieldsDef[fieldName].type);
        const newFieldType: ?GraphQLNamedType =
          getNamedType(newTypeFieldsDef[fieldName].type);
        if (
          oldFieldType && newFieldType &&
          (oldFieldType.name !== newFieldType.name)
        ) {
          breakingFieldChanges.push(`${typeName}.${fieldName} changed type ` +
            `from ${oldFieldType.name} to ${newFieldType.name}`);
        }
      }
    }
  }
  return new Set(breakingFieldChanges);
}

/**
* Given two schemas, returns a Set containing descriptions of any breaking
* changes in the newSchema related to removing types from a union type.
*/
export function findTypesRemovedFromUnions(
  oldSchema: GraphQLSchema,
  newSchema: GraphQLSchema
): Set<string> {
  const oldTypeMap: TypeMap = oldSchema.getTypeMap();
  const newTypeMap: TypeMap = newSchema.getTypeMap();

  const typesRemovedFromUnion: Array<string> = [];
  for (const typeName: string in oldTypeMap) {
    if (!{}.hasOwnProperty.call(oldTypeMap,typeName)) {
      continue;
    }
    const oldType: GraphQLType = oldTypeMap[typeName];
    const newType: GraphQLType = newTypeMap[typeName];
    if (
      !(oldType instanceof GraphQLUnionType) ||
      !(newType instanceof GraphQLUnionType)
    ) {
      continue;
    }
    const typeNamesInNewUnion: Set<string> =
      new Set(newType.getTypes().map(type => type.name));
    oldType.getTypes().forEach(typeInOldUnion => {
      if (!typeNamesInNewUnion.has(typeInOldUnion.name)) {
        typesRemovedFromUnion.push(
          `${typeInOldUnion.name} was removed from union type ${typeName}`
        );
      }
    });
  }
  return new Set(typesRemovedFromUnion);
}

/**
* Given two schemas, returns a Set containing descriptions of any breaking
* changes in the newSchema related to removing values from an enum type.
*/
export function findValuesRemovedFromEnums(
  oldSchema: GraphQLSchema,
  newSchema: GraphQLSchema
): Set<string> {
  const oldTypeMap: TypeMap = oldSchema.getTypeMap();
  const newTypeMap: TypeMap = newSchema.getTypeMap();

  const valuesRemovedFromEnums: Array<string> = [];
  for (const typeName: string in oldTypeMap) {
    if (!{}.hasOwnProperty.call(oldTypeMap,typeName)) {
      continue;
    }
    const oldType: GraphQLType = oldTypeMap[typeName];
    const newType: GraphQLType = newTypeMap[typeName];
    if (
      !(oldType instanceof GraphQLEnumType) ||
      !(newType instanceof GraphQLEnumType)
    ) {
      continue;
    }
    const valuesInNewEnum: Set<string> =
      new Set(newType.getValues().map(value => value.name));
    oldType.getValues().forEach(valueInOldEnum => {
      if (!valuesInNewEnum.has(valueInOldEnum.name)) {
        valuesRemovedFromEnums.push(
          `${valueInOldEnum.name} was removed from enum type ${typeName}`
        );
      }
    });
  }
  return new Set(valuesRemovedFromEnums);
}
