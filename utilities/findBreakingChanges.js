'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.BreakingChangeType = undefined;
exports.findBreakingChanges = findBreakingChanges;
exports.findRemovedTypes = findRemovedTypes;
exports.findTypesThatChangedKind = findTypesThatChangedKind;
exports.findFieldsThatChangedType = findFieldsThatChangedType;
exports.findTypesRemovedFromUnions = findTypesRemovedFromUnions;
exports.findValuesRemovedFromEnums = findValuesRemovedFromEnums;

var _definition = require('../type/definition');

var _schema = require('../type/schema');

/**
 *  Copyright (c) 2016, Facebook, Inc.
 *  All rights reserved.
 *
 *  This source code is licensed under the BSD-style license found in the
 *  LICENSE file in the root directory of this source tree. An additional grant
 *  of patent rights can be found in the PATENTS file in the same directory.
 */

var BreakingChangeType = exports.BreakingChangeType = {
  FIELD_CHANGED_KIND: 'FIELD_CHANGED_KIND',
  FIELD_REMOVED: 'FIELD_REMOVED',
  TYPE_CHANGED_KIND: 'TYPE_CHANGED_KIND',
  TYPE_REMOVED: 'TYPE_REMOVED',
  TYPE_REMOVED_FROM_UNION: 'TYPE_REMOVED_FROM_UNION',
  VALUE_REMOVED_FROM_ENUM: 'VALUE_REMOVED_FROM_ENUM'
};

/**
 * Given two schemas, returns an Array containing descriptions of all the types
 * of breaking changes covered by the other functions down below.
 */
function findBreakingChanges(oldSchema, newSchema) {
  return [].concat(findRemovedTypes(oldSchema, newSchema), findTypesThatChangedKind(oldSchema, newSchema), findFieldsThatChangedType(oldSchema, newSchema), findTypesRemovedFromUnions(oldSchema, newSchema), findValuesRemovedFromEnums(oldSchema, newSchema));
}

/**
 * Given two schemas, returns an Array containing descriptions of any breaking
 * changes in the newSchema related to removing an entire type.
 */
function findRemovedTypes(oldSchema, newSchema) {
  var oldTypeMap = oldSchema.getTypeMap();
  var newTypeMap = newSchema.getTypeMap();

  var breakingChanges = [];
  Object.keys(oldTypeMap).forEach(function (typeName) {
    if (!newTypeMap[typeName]) {
      breakingChanges.push({
        type: BreakingChangeType.TYPE_REMOVED,
        description: typeName + ' was removed.'
      });
    }
  });
  return breakingChanges;
}

/**
 * Given two schemas, returns an Array containing descriptions of any breaking
 * changes in the newSchema related to changing the type of a type.
 */
function findTypesThatChangedKind(oldSchema, newSchema) {
  var oldTypeMap = oldSchema.getTypeMap();
  var newTypeMap = newSchema.getTypeMap();

  var breakingChanges = [];
  Object.keys(oldTypeMap).forEach(function (typeName) {
    if (!newTypeMap[typeName]) {
      return;
    }
    var oldType = oldTypeMap[typeName];
    var newType = newTypeMap[typeName];
    if (!(oldType instanceof newType.constructor)) {
      breakingChanges.push({
        type: BreakingChangeType.TYPE_CHANGED_KIND,
        description: typeName + ' changed from ' + (typeKindName(oldType) + ' to ' + typeKindName(newType) + '.')
      });
    }
  });
  return breakingChanges;
}

function typeKindName(type) {
  if (type instanceof _definition.GraphQLScalarType) {
    return 'a Scalar type';
  }
  if (type instanceof _definition.GraphQLObjectType) {
    return 'an Object type';
  }
  if (type instanceof _definition.GraphQLInterfaceType) {
    return 'an Interface type';
  }
  if (type instanceof _definition.GraphQLUnionType) {
    return 'a Union type';
  }
  if (type instanceof _definition.GraphQLEnumType) {
    return 'an Enum type';
  }
  if (type instanceof _definition.GraphQLInputObjectType) {
    return 'an Input type';
  }
  throw new TypeError('Unknown type ' + type.constructor.name);
}

/**
 * Given two schemas, returns an Array containing descriptions of any breaking
 * changes in the newSchema related to the fields on a type. This includes if
 * a field has been removed from a type or if a field has changed type.
 */
function findFieldsThatChangedType(oldSchema, newSchema) {
  var oldTypeMap = oldSchema.getTypeMap();
  var newTypeMap = newSchema.getTypeMap();

  var breakingFieldChanges = [];
  Object.keys(oldTypeMap).forEach(function (typeName) {
    var oldType = oldTypeMap[typeName];
    var newType = newTypeMap[typeName];
    if (!(oldType instanceof _definition.GraphQLObjectType || oldType instanceof _definition.GraphQLInterfaceType || oldType instanceof _definition.GraphQLInputObjectType) || !(newType instanceof oldType.constructor)) {
      return;
    }

    var oldTypeFieldsDef = oldType.getFields();
    var newTypeFieldsDef = newType.getFields();
    Object.keys(oldTypeFieldsDef).forEach(function (fieldName) {
      // Check if the field is missing on the type in the new schema.
      if (!(fieldName in newTypeFieldsDef)) {
        breakingFieldChanges.push({
          type: BreakingChangeType.FIELD_REMOVED,
          description: typeName + '.' + fieldName + ' was removed.'
        });
      } else {
        // Check if the field's type has changed in the new schema.
        var oldFieldType = (0, _definition.getNamedType)(oldTypeFieldsDef[fieldName].type);
        var newFieldType = (0, _definition.getNamedType)(newTypeFieldsDef[fieldName].type);
        if (oldFieldType && newFieldType && oldFieldType.name !== newFieldType.name) {
          breakingFieldChanges.push({
            type: BreakingChangeType.FIELD_CHANGED_KIND,
            description: typeName + '.' + fieldName + ' changed type from ' + (oldFieldType.name + ' to ' + newFieldType.name + '.')
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
function findTypesRemovedFromUnions(oldSchema, newSchema) {
  var oldTypeMap = oldSchema.getTypeMap();
  var newTypeMap = newSchema.getTypeMap();

  var typesRemovedFromUnion = [];
  Object.keys(oldTypeMap).forEach(function (typeName) {
    var oldType = oldTypeMap[typeName];
    var newType = newTypeMap[typeName];
    if (!(oldType instanceof _definition.GraphQLUnionType) || !(newType instanceof _definition.GraphQLUnionType)) {
      return;
    }
    var typeNamesInNewUnion = Object.create(null);
    newType.getTypes().forEach(function (type) {
      typeNamesInNewUnion[type.name] = true;
    });
    oldType.getTypes().forEach(function (type) {
      if (!typeNamesInNewUnion[type.name]) {
        typesRemovedFromUnion.push({
          type: BreakingChangeType.TYPE_REMOVED_FROM_UNION,
          description: type.name + ' was removed from union type ' + typeName + '.'
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
function findValuesRemovedFromEnums(oldSchema, newSchema) {
  var oldTypeMap = oldSchema.getTypeMap();
  var newTypeMap = newSchema.getTypeMap();

  var valuesRemovedFromEnums = [];
  Object.keys(oldTypeMap).forEach(function (typeName) {
    var oldType = oldTypeMap[typeName];
    var newType = newTypeMap[typeName];
    if (!(oldType instanceof _definition.GraphQLEnumType) || !(newType instanceof _definition.GraphQLEnumType)) {
      return;
    }
    var valuesInNewEnum = Object.create(null);
    newType.getValues().forEach(function (value) {
      valuesInNewEnum[value.name] = true;
    });
    oldType.getValues().forEach(function (value) {
      if (!valuesInNewEnum[value.name]) {
        valuesRemovedFromEnums.push({
          type: BreakingChangeType.VALUE_REMOVED_FROM_ENUM,
          description: value.name + ' was removed from enum type ' + typeName + '.'
        });
      }
    });
  });
  return valuesRemovedFromEnums;
}