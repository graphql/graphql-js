/**
 * Copyright (c) 2016-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 *  strict
 */
import { isScalarType, isObjectType, isInterfaceType, isUnionType, isEnumType, isInputObjectType, isNonNullType, isListType, isNamedType } from '../type/definition';
import { GraphQLDirective } from '../type/directives';
import { GraphQLSchema } from '../type/schema';
import keyMap from '../jsutils/keyMap';
export var BreakingChangeType = {
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
  NON_NULL_DIRECTIVE_ARG_ADDED: 'NON_NULL_DIRECTIVE_ARG_ADDED'
};
export var DangerousChangeType = {
  ARG_DEFAULT_VALUE_CHANGE: 'ARG_DEFAULT_VALUE_CHANGE',
  VALUE_ADDED_TO_ENUM: 'VALUE_ADDED_TO_ENUM',
  INTERFACE_ADDED_TO_OBJECT: 'INTERFACE_ADDED_TO_OBJECT',
  TYPE_ADDED_TO_UNION: 'TYPE_ADDED_TO_UNION',
  NULLABLE_INPUT_FIELD_ADDED: 'NULLABLE_INPUT_FIELD_ADDED',
  NULLABLE_ARG_ADDED: 'NULLABLE_ARG_ADDED'
};

/**
 * Given two schemas, returns an Array containing descriptions of all the types
 * of breaking changes covered by the other functions down below.
 */
export function findBreakingChanges(oldSchema, newSchema) {
  return findRemovedTypes(oldSchema, newSchema).concat(findTypesThatChangedKind(oldSchema, newSchema), findFieldsThatChangedTypeOnObjectOrInterfaceTypes(oldSchema, newSchema), findFieldsThatChangedTypeOnInputObjectTypes(oldSchema, newSchema).breakingChanges, findTypesRemovedFromUnions(oldSchema, newSchema), findValuesRemovedFromEnums(oldSchema, newSchema), findArgChanges(oldSchema, newSchema).breakingChanges, findInterfacesRemovedFromObjectTypes(oldSchema, newSchema), findRemovedDirectives(oldSchema, newSchema), findRemovedDirectiveArgs(oldSchema, newSchema), findAddedNonNullDirectiveArgs(oldSchema, newSchema), findRemovedDirectiveLocations(oldSchema, newSchema));
}
/**
 * Given two schemas, returns an Array containing descriptions of all the types
 * of potentially dangerous changes covered by the other functions down below.
 */

export function findDangerousChanges(oldSchema, newSchema) {
  return findArgChanges(oldSchema, newSchema).dangerousChanges.concat(findValuesAddedToEnums(oldSchema, newSchema), findInterfacesAddedToObjectTypes(oldSchema, newSchema), findTypesAddedToUnions(oldSchema, newSchema), findFieldsThatChangedTypeOnInputObjectTypes(oldSchema, newSchema).dangerousChanges);
}
/**
 * Given two schemas, returns an Array containing descriptions of any breaking
 * changes in the newSchema related to removing an entire type.
 */

export function findRemovedTypes(oldSchema, newSchema) {
  var oldTypeMap = oldSchema.getTypeMap();
  var newTypeMap = newSchema.getTypeMap();
  var breakingChanges = [];
  Object.keys(oldTypeMap).forEach(function (typeName) {
    if (!newTypeMap[typeName]) {
      breakingChanges.push({
        type: BreakingChangeType.TYPE_REMOVED,
        description: "".concat(typeName, " was removed.")
      });
    }
  });
  return breakingChanges;
}
/**
 * Given two schemas, returns an Array containing descriptions of any breaking
 * changes in the newSchema related to changing the type of a type.
 */

export function findTypesThatChangedKind(oldSchema, newSchema) {
  var oldTypeMap = oldSchema.getTypeMap();
  var newTypeMap = newSchema.getTypeMap();
  var breakingChanges = [];
  Object.keys(oldTypeMap).forEach(function (typeName) {
    if (!newTypeMap[typeName]) {
      return;
    }

    var oldType = oldTypeMap[typeName];
    var newType = newTypeMap[typeName];

    if (oldType.constructor !== newType.constructor) {
      breakingChanges.push({
        type: BreakingChangeType.TYPE_CHANGED_KIND,
        description: "".concat(typeName, " changed from ") + "".concat(typeKindName(oldType), " to ").concat(typeKindName(newType), ".")
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

export function findArgChanges(oldSchema, newSchema) {
  var oldTypeMap = oldSchema.getTypeMap();
  var newTypeMap = newSchema.getTypeMap();
  var breakingChanges = [];
  var dangerousChanges = [];
  Object.keys(oldTypeMap).forEach(function (typeName) {
    var oldType = oldTypeMap[typeName];
    var newType = newTypeMap[typeName];

    if (!(isObjectType(oldType) || isInterfaceType(oldType)) || !(isObjectType(newType) || isInterfaceType(newType)) || newType.constructor !== oldType.constructor) {
      return;
    }

    var oldTypeFields = oldType.getFields();
    var newTypeFields = newType.getFields();
    Object.keys(oldTypeFields).forEach(function (fieldName) {
      if (!newTypeFields[fieldName]) {
        return;
      }

      oldTypeFields[fieldName].args.forEach(function (oldArgDef) {
        var newArgs = newTypeFields[fieldName].args;
        var newArgDef = newArgs.find(function (arg) {
          return arg.name === oldArgDef.name;
        }); // Arg not present

        if (!newArgDef) {
          breakingChanges.push({
            type: BreakingChangeType.ARG_REMOVED,
            description: "".concat(oldType.name, ".").concat(fieldName, " arg ") + "".concat(oldArgDef.name, " was removed")
          });
        } else {
          var isSafe = isChangeSafeForInputObjectFieldOrFieldArg(oldArgDef.type, newArgDef.type);

          if (!isSafe) {
            breakingChanges.push({
              type: BreakingChangeType.ARG_CHANGED_KIND,
              description: "".concat(oldType.name, ".").concat(fieldName, " arg ") + "".concat(oldArgDef.name, " has changed type from ") + "".concat(oldArgDef.type.toString(), " to ").concat(newArgDef.type.toString())
            });
          } else if (oldArgDef.defaultValue !== undefined && oldArgDef.defaultValue !== newArgDef.defaultValue) {
            dangerousChanges.push({
              type: DangerousChangeType.ARG_DEFAULT_VALUE_CHANGE,
              description: "".concat(oldType.name, ".").concat(fieldName, " arg ") + "".concat(oldArgDef.name, " has changed defaultValue")
            });
          }
        }
      }); // Check if a non-null arg was added to the field

      newTypeFields[fieldName].args.forEach(function (newArgDef) {
        var oldArgs = oldTypeFields[fieldName].args;
        var oldArgDef = oldArgs.find(function (arg) {
          return arg.name === newArgDef.name;
        });

        if (!oldArgDef) {
          if (isNonNullType(newArgDef.type)) {
            breakingChanges.push({
              type: BreakingChangeType.NON_NULL_ARG_ADDED,
              description: "A non-null arg ".concat(newArgDef.name, " on ") + "".concat(newType.name, ".").concat(fieldName, " was added")
            });
          } else {
            dangerousChanges.push({
              type: DangerousChangeType.NULLABLE_ARG_ADDED,
              description: "A nullable arg ".concat(newArgDef.name, " on ") + "".concat(newType.name, ".").concat(fieldName, " was added")
            });
          }
        }
      });
    });
  });
  return {
    breakingChanges: breakingChanges,
    dangerousChanges: dangerousChanges
  };
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

  throw new TypeError('Unknown type ' + type.constructor.name);
}

export function findFieldsThatChangedTypeOnObjectOrInterfaceTypes(oldSchema, newSchema) {
  var oldTypeMap = oldSchema.getTypeMap();
  var newTypeMap = newSchema.getTypeMap();
  var breakingChanges = [];
  Object.keys(oldTypeMap).forEach(function (typeName) {
    var oldType = oldTypeMap[typeName];
    var newType = newTypeMap[typeName];

    if (!(isObjectType(oldType) || isInterfaceType(oldType)) || !(isObjectType(newType) || isInterfaceType(newType)) || newType.constructor !== oldType.constructor) {
      return;
    }

    var oldTypeFieldsDef = oldType.getFields();
    var newTypeFieldsDef = newType.getFields();
    Object.keys(oldTypeFieldsDef).forEach(function (fieldName) {
      // Check if the field is missing on the type in the new schema.
      if (!(fieldName in newTypeFieldsDef)) {
        breakingChanges.push({
          type: BreakingChangeType.FIELD_REMOVED,
          description: "".concat(typeName, ".").concat(fieldName, " was removed.")
        });
      } else {
        var oldFieldType = oldTypeFieldsDef[fieldName].type;
        var newFieldType = newTypeFieldsDef[fieldName].type;
        var isSafe = isChangeSafeForObjectOrInterfaceField(oldFieldType, newFieldType);

        if (!isSafe) {
          var oldFieldTypeString = isNamedType(oldFieldType) ? oldFieldType.name : oldFieldType.toString();
          var newFieldTypeString = isNamedType(newFieldType) ? newFieldType.name : newFieldType.toString();
          breakingChanges.push({
            type: BreakingChangeType.FIELD_CHANGED_KIND,
            description: "".concat(typeName, ".").concat(fieldName, " changed type from ") + "".concat(oldFieldTypeString, " to ").concat(newFieldTypeString, ".")
          });
        }
      }
    });
  });
  return breakingChanges;
}
export function findFieldsThatChangedTypeOnInputObjectTypes(oldSchema, newSchema) {
  var oldTypeMap = oldSchema.getTypeMap();
  var newTypeMap = newSchema.getTypeMap();
  var breakingChanges = [];
  var dangerousChanges = [];
  Object.keys(oldTypeMap).forEach(function (typeName) {
    var oldType = oldTypeMap[typeName];
    var newType = newTypeMap[typeName];

    if (!isInputObjectType(oldType) || !isInputObjectType(newType)) {
      return;
    }

    var oldTypeFieldsDef = oldType.getFields();
    var newTypeFieldsDef = newType.getFields();
    Object.keys(oldTypeFieldsDef).forEach(function (fieldName) {
      // Check if the field is missing on the type in the new schema.
      if (!(fieldName in newTypeFieldsDef)) {
        breakingChanges.push({
          type: BreakingChangeType.FIELD_REMOVED,
          description: "".concat(typeName, ".").concat(fieldName, " was removed.")
        });
      } else {
        var oldFieldType = oldTypeFieldsDef[fieldName].type;
        var newFieldType = newTypeFieldsDef[fieldName].type;
        var isSafe = isChangeSafeForInputObjectFieldOrFieldArg(oldFieldType, newFieldType);

        if (!isSafe) {
          var oldFieldTypeString = isNamedType(oldFieldType) ? oldFieldType.name : oldFieldType.toString();
          var newFieldTypeString = isNamedType(newFieldType) ? newFieldType.name : newFieldType.toString();
          breakingChanges.push({
            type: BreakingChangeType.FIELD_CHANGED_KIND,
            description: "".concat(typeName, ".").concat(fieldName, " changed type from ") + "".concat(oldFieldTypeString, " to ").concat(newFieldTypeString, ".")
          });
        }
      }
    }); // Check if a field was added to the input object type

    Object.keys(newTypeFieldsDef).forEach(function (fieldName) {
      if (!(fieldName in oldTypeFieldsDef)) {
        if (isNonNullType(newTypeFieldsDef[fieldName].type)) {
          breakingChanges.push({
            type: BreakingChangeType.NON_NULL_INPUT_FIELD_ADDED,
            description: "A non-null field ".concat(fieldName, " on ") + "input type ".concat(newType.name, " was added.")
          });
        } else {
          dangerousChanges.push({
            type: DangerousChangeType.NULLABLE_INPUT_FIELD_ADDED,
            description: "A nullable field ".concat(fieldName, " on ") + "input type ".concat(newType.name, " was added.")
          });
        }
      }
    });
  });
  return {
    breakingChanges: breakingChanges,
    dangerousChanges: dangerousChanges
  };
}

function isChangeSafeForObjectOrInterfaceField(oldType, newType) {
  if (isNamedType(oldType)) {
    return (// if they're both named types, see if their names are equivalent
      isNamedType(newType) && oldType.name === newType.name || // moving from nullable to non-null of the same underlying type is safe
      isNonNullType(newType) && isChangeSafeForObjectOrInterfaceField(oldType, newType.ofType)
    );
  } else if (isListType(oldType)) {
    return (// if they're both lists, make sure the underlying types are compatible
      isListType(newType) && isChangeSafeForObjectOrInterfaceField(oldType.ofType, newType.ofType) || // moving from nullable to non-null of the same underlying type is safe
      isNonNullType(newType) && isChangeSafeForObjectOrInterfaceField(oldType, newType.ofType)
    );
  } else if (isNonNullType(oldType)) {
    // if they're both non-null, make sure the underlying types are compatible
    return isNonNullType(newType) && isChangeSafeForObjectOrInterfaceField(oldType.ofType, newType.ofType);
  }

  return false;
}

function isChangeSafeForInputObjectFieldOrFieldArg(oldType, newType) {
  if (isNamedType(oldType)) {
    // if they're both named types, see if their names are equivalent
    return isNamedType(newType) && oldType.name === newType.name;
  } else if (isListType(oldType)) {
    // if they're both lists, make sure the underlying types are compatible
    return isListType(newType) && isChangeSafeForInputObjectFieldOrFieldArg(oldType.ofType, newType.ofType);
  } else if (isNonNullType(oldType)) {
    return (// if they're both non-null, make sure the underlying types are
      // compatible
      isNonNullType(newType) && isChangeSafeForInputObjectFieldOrFieldArg(oldType.ofType, newType.ofType) || // moving from non-null to nullable of the same underlying type is safe
      !isNonNullType(newType) && isChangeSafeForInputObjectFieldOrFieldArg(oldType.ofType, newType)
    );
  }

  return false;
}
/**
 * Given two schemas, returns an Array containing descriptions of any breaking
 * changes in the newSchema related to removing types from a union type.
 */


export function findTypesRemovedFromUnions(oldSchema, newSchema) {
  var oldTypeMap = oldSchema.getTypeMap();
  var newTypeMap = newSchema.getTypeMap();
  var typesRemovedFromUnion = [];
  Object.keys(oldTypeMap).forEach(function (typeName) {
    var oldType = oldTypeMap[typeName];
    var newType = newTypeMap[typeName];

    if (!isUnionType(oldType) || !isUnionType(newType)) {
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
          description: "".concat(type.name, " was removed from union type ").concat(typeName, ".")
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

export function findTypesAddedToUnions(oldSchema, newSchema) {
  var oldTypeMap = oldSchema.getTypeMap();
  var newTypeMap = newSchema.getTypeMap();
  var typesAddedToUnion = [];
  Object.keys(newTypeMap).forEach(function (typeName) {
    var oldType = oldTypeMap[typeName];
    var newType = newTypeMap[typeName];

    if (!isUnionType(oldType) || !isUnionType(newType)) {
      return;
    }

    var typeNamesInOldUnion = Object.create(null);
    oldType.getTypes().forEach(function (type) {
      typeNamesInOldUnion[type.name] = true;
    });
    newType.getTypes().forEach(function (type) {
      if (!typeNamesInOldUnion[type.name]) {
        typesAddedToUnion.push({
          type: DangerousChangeType.TYPE_ADDED_TO_UNION,
          description: "".concat(type.name, " was added to union type ").concat(typeName, ".")
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

export function findValuesRemovedFromEnums(oldSchema, newSchema) {
  var oldTypeMap = oldSchema.getTypeMap();
  var newTypeMap = newSchema.getTypeMap();
  var valuesRemovedFromEnums = [];
  Object.keys(oldTypeMap).forEach(function (typeName) {
    var oldType = oldTypeMap[typeName];
    var newType = newTypeMap[typeName];

    if (!isEnumType(oldType) || !isEnumType(newType)) {
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
          description: "".concat(value.name, " was removed from enum type ").concat(typeName, ".")
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

export function findValuesAddedToEnums(oldSchema, newSchema) {
  var oldTypeMap = oldSchema.getTypeMap();
  var newTypeMap = newSchema.getTypeMap();
  var valuesAddedToEnums = [];
  Object.keys(oldTypeMap).forEach(function (typeName) {
    var oldType = oldTypeMap[typeName];
    var newType = newTypeMap[typeName];

    if (!isEnumType(oldType) || !isEnumType(newType)) {
      return;
    }

    var valuesInOldEnum = Object.create(null);
    oldType.getValues().forEach(function (value) {
      valuesInOldEnum[value.name] = true;
    });
    newType.getValues().forEach(function (value) {
      if (!valuesInOldEnum[value.name]) {
        valuesAddedToEnums.push({
          type: DangerousChangeType.VALUE_ADDED_TO_ENUM,
          description: "".concat(value.name, " was added to enum type ").concat(typeName, ".")
        });
      }
    });
  });
  return valuesAddedToEnums;
}
export function findInterfacesRemovedFromObjectTypes(oldSchema, newSchema) {
  var oldTypeMap = oldSchema.getTypeMap();
  var newTypeMap = newSchema.getTypeMap();
  var breakingChanges = [];
  Object.keys(oldTypeMap).forEach(function (typeName) {
    var oldType = oldTypeMap[typeName];
    var newType = newTypeMap[typeName];

    if (!isObjectType(oldType) || !isObjectType(newType)) {
      return;
    }

    var oldInterfaces = oldType.getInterfaces();
    var newInterfaces = newType.getInterfaces();
    oldInterfaces.forEach(function (oldInterface) {
      if (!newInterfaces.some(function (int) {
        return int.name === oldInterface.name;
      })) {
        breakingChanges.push({
          type: BreakingChangeType.INTERFACE_REMOVED_FROM_OBJECT,
          description: "".concat(typeName, " no longer implements interface ") + "".concat(oldInterface.name, ".")
        });
      }
    });
  });
  return breakingChanges;
}
export function findInterfacesAddedToObjectTypes(oldSchema, newSchema) {
  var oldTypeMap = oldSchema.getTypeMap();
  var newTypeMap = newSchema.getTypeMap();
  var interfacesAddedToObjectTypes = [];
  Object.keys(newTypeMap).forEach(function (typeName) {
    var oldType = oldTypeMap[typeName];
    var newType = newTypeMap[typeName];

    if (!isObjectType(oldType) || !isObjectType(newType)) {
      return;
    }

    var oldInterfaces = oldType.getInterfaces();
    var newInterfaces = newType.getInterfaces();
    newInterfaces.forEach(function (newInterface) {
      if (!oldInterfaces.some(function (int) {
        return int.name === newInterface.name;
      })) {
        interfacesAddedToObjectTypes.push({
          type: DangerousChangeType.INTERFACE_ADDED_TO_OBJECT,
          description: "".concat(newInterface.name, " added to interfaces implemented ") + "by ".concat(typeName, ".")
        });
      }
    });
  });
  return interfacesAddedToObjectTypes;
}
export function findRemovedDirectives(oldSchema, newSchema) {
  var removedDirectives = [];
  var newSchemaDirectiveMap = getDirectiveMapForSchema(newSchema);
  oldSchema.getDirectives().forEach(function (directive) {
    if (!newSchemaDirectiveMap[directive.name]) {
      removedDirectives.push({
        type: BreakingChangeType.DIRECTIVE_REMOVED,
        description: "".concat(directive.name, " was removed")
      });
    }
  });
  return removedDirectives;
}

function findRemovedArgsForDirective(oldDirective, newDirective) {
  var removedArgs = [];
  var newArgMap = getArgumentMapForDirective(newDirective);
  oldDirective.args.forEach(function (arg) {
    if (!newArgMap[arg.name]) {
      removedArgs.push(arg);
    }
  });
  return removedArgs;
}

export function findRemovedDirectiveArgs(oldSchema, newSchema) {
  var removedDirectiveArgs = [];
  var oldSchemaDirectiveMap = getDirectiveMapForSchema(oldSchema);
  newSchema.getDirectives().forEach(function (newDirective) {
    var oldDirective = oldSchemaDirectiveMap[newDirective.name];

    if (!oldDirective) {
      return;
    }

    findRemovedArgsForDirective(oldDirective, newDirective).forEach(function (arg) {
      removedDirectiveArgs.push({
        type: BreakingChangeType.DIRECTIVE_ARG_REMOVED,
        description: "".concat(arg.name, " was removed from ").concat(newDirective.name)
      });
    });
  });
  return removedDirectiveArgs;
}

function findAddedArgsForDirective(oldDirective, newDirective) {
  var addedArgs = [];
  var oldArgMap = getArgumentMapForDirective(oldDirective);
  newDirective.args.forEach(function (arg) {
    if (!oldArgMap[arg.name]) {
      addedArgs.push(arg);
    }
  });
  return addedArgs;
}

export function findAddedNonNullDirectiveArgs(oldSchema, newSchema) {
  var addedNonNullableArgs = [];
  var oldSchemaDirectiveMap = getDirectiveMapForSchema(oldSchema);
  newSchema.getDirectives().forEach(function (newDirective) {
    var oldDirective = oldSchemaDirectiveMap[newDirective.name];

    if (!oldDirective) {
      return;
    }

    findAddedArgsForDirective(oldDirective, newDirective).forEach(function (arg) {
      if (!isNonNullType(arg.type)) {
        return;
      }

      addedNonNullableArgs.push({
        type: BreakingChangeType.NON_NULL_DIRECTIVE_ARG_ADDED,
        description: "A non-null arg ".concat(arg.name, " on directive ") + "".concat(newDirective.name, " was added")
      });
    });
  });
  return addedNonNullableArgs;
}
export function findRemovedLocationsForDirective(oldDirective, newDirective) {
  var removedLocations = [];
  var newLocationSet = new Set(newDirective.locations);
  oldDirective.locations.forEach(function (oldLocation) {
    if (!newLocationSet.has(oldLocation)) {
      removedLocations.push(oldLocation);
    }
  });
  return removedLocations;
}
export function findRemovedDirectiveLocations(oldSchema, newSchema) {
  var removedLocations = [];
  var oldSchemaDirectiveMap = getDirectiveMapForSchema(oldSchema);
  newSchema.getDirectives().forEach(function (newDirective) {
    var oldDirective = oldSchemaDirectiveMap[newDirective.name];

    if (!oldDirective) {
      return;
    }

    findRemovedLocationsForDirective(oldDirective, newDirective).forEach(function (location) {
      removedLocations.push({
        type: BreakingChangeType.DIRECTIVE_LOCATION_REMOVED,
        description: "".concat(location, " was removed from ").concat(newDirective.name)
      });
    });
  });
  return removedLocations;
}

function getDirectiveMapForSchema(schema) {
  return keyMap(schema.getDirectives(), function (dir) {
    return dir.name;
  });
}

function getArgumentMapForDirective(directive) {
  return keyMap(directive.args, function (arg) {
    return arg.name;
  });
}