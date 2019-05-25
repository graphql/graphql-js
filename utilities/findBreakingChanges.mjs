/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * 
 */
import find from '../polyfills/find';
import objectValues from '../polyfills/objectValues';
import inspect from '../jsutils/inspect';
import { isScalarType, isObjectType, isInterfaceType, isUnionType, isEnumType, isInputObjectType, isNonNullType, isListType, isNamedType, isRequiredArgument, isRequiredInputField } from '../type/definition';
export var BreakingChangeType = Object.freeze({
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
  REQUIRED_DIRECTIVE_ARG_ADDED: 'REQUIRED_DIRECTIVE_ARG_ADDED'
});
export var DangerousChangeType = Object.freeze({
  ARG_DEFAULT_VALUE_CHANGE: 'ARG_DEFAULT_VALUE_CHANGE',
  VALUE_ADDED_TO_ENUM: 'VALUE_ADDED_TO_ENUM',
  INTERFACE_ADDED_TO_OBJECT: 'INTERFACE_ADDED_TO_OBJECT',
  TYPE_ADDED_TO_UNION: 'TYPE_ADDED_TO_UNION',
  OPTIONAL_INPUT_FIELD_ADDED: 'OPTIONAL_INPUT_FIELD_ADDED',
  OPTIONAL_ARG_ADDED: 'OPTIONAL_ARG_ADDED'
});

/**
 * Given two schemas, returns an Array containing descriptions of all the types
 * of breaking changes covered by the other functions down below.
 */
export function findBreakingChanges(oldSchema, newSchema) {
  var breakingChanges = findSchemaChanges(oldSchema, newSchema).filter(function (change) {
    return change.type in BreakingChangeType;
  });
  return breakingChanges;
}
/**
 * Given two schemas, returns an Array containing descriptions of all the types
 * of potentially dangerous changes covered by the other functions down below.
 */

export function findDangerousChanges(oldSchema, newSchema) {
  var dangerousChanges = findSchemaChanges(oldSchema, newSchema).filter(function (change) {
    return change.type in DangerousChangeType;
  });
  return dangerousChanges;
}

function findSchemaChanges(oldSchema, newSchema) {
  return [].concat(findRemovedTypes(oldSchema, newSchema), findTypesThatChangedKind(oldSchema, newSchema), findFieldsThatChangedTypeOnObjectOrInterfaceTypes(oldSchema, newSchema), findFieldsThatChangedTypeOnInputObjectTypes(oldSchema, newSchema), findTypesAddedToUnions(oldSchema, newSchema), findTypesRemovedFromUnions(oldSchema, newSchema), findValuesAddedToEnums(oldSchema, newSchema), findValuesRemovedFromEnums(oldSchema, newSchema), findArgChanges(oldSchema, newSchema), findInterfacesAddedToObjectTypes(oldSchema, newSchema), findInterfacesRemovedFromObjectTypes(oldSchema, newSchema), findRemovedDirectives(oldSchema, newSchema), findRemovedDirectiveArgs(oldSchema, newSchema), findAddedNonNullDirectiveArgs(oldSchema, newSchema), findRemovedDirectiveLocations(oldSchema, newSchema));
}
/**
 * Given two schemas, returns an Array containing descriptions of any breaking
 * changes in the newSchema related to removing an entire type.
 */


function findRemovedTypes(oldSchema, newSchema) {
  var schemaChanges = [];
  var oldTypeMap = oldSchema.getTypeMap();
  var newTypeMap = newSchema.getTypeMap();
  var _iteratorNormalCompletion = true;
  var _didIteratorError = false;
  var _iteratorError = undefined;

  try {
    for (var _iterator = objectValues(oldTypeMap)[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
      var oldType = _step.value;

      if (!newTypeMap[oldType.name]) {
        schemaChanges.push({
          type: BreakingChangeType.TYPE_REMOVED,
          description: "".concat(oldType.name, " was removed.")
        });
      }
    }
  } catch (err) {
    _didIteratorError = true;
    _iteratorError = err;
  } finally {
    try {
      if (!_iteratorNormalCompletion && _iterator.return != null) {
        _iterator.return();
      }
    } finally {
      if (_didIteratorError) {
        throw _iteratorError;
      }
    }
  }

  return schemaChanges;
}
/**
 * Given two schemas, returns an Array containing descriptions of any breaking
 * changes in the newSchema related to changing the type of a type.
 */


function findTypesThatChangedKind(oldSchema, newSchema) {
  var schemaChanges = [];
  var oldTypeMap = oldSchema.getTypeMap();
  var newTypeMap = newSchema.getTypeMap();
  var _iteratorNormalCompletion2 = true;
  var _didIteratorError2 = false;
  var _iteratorError2 = undefined;

  try {
    for (var _iterator2 = objectValues(oldTypeMap)[Symbol.iterator](), _step2; !(_iteratorNormalCompletion2 = (_step2 = _iterator2.next()).done); _iteratorNormalCompletion2 = true) {
      var oldType = _step2.value;
      var newType = newTypeMap[oldType.name];

      if (!newType) {
        continue;
      }

      if (oldType.constructor !== newType.constructor) {
        schemaChanges.push({
          type: BreakingChangeType.TYPE_CHANGED_KIND,
          description: "".concat(oldType.name, " changed from ") + "".concat(typeKindName(oldType), " to ").concat(typeKindName(newType), ".")
        });
      }
    }
  } catch (err) {
    _didIteratorError2 = true;
    _iteratorError2 = err;
  } finally {
    try {
      if (!_iteratorNormalCompletion2 && _iterator2.return != null) {
        _iterator2.return();
      }
    } finally {
      if (_didIteratorError2) {
        throw _iteratorError2;
      }
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


function findArgChanges(oldSchema, newSchema) {
  var schemaChanges = [];
  var oldTypeMap = oldSchema.getTypeMap();
  var newTypeMap = newSchema.getTypeMap();
  var _iteratorNormalCompletion3 = true;
  var _didIteratorError3 = false;
  var _iteratorError3 = undefined;

  try {
    for (var _iterator3 = objectValues(oldTypeMap)[Symbol.iterator](), _step3; !(_iteratorNormalCompletion3 = (_step3 = _iterator3.next()).done); _iteratorNormalCompletion3 = true) {
      var oldType = _step3.value;
      var newType = newTypeMap[oldType.name];

      if (!(isObjectType(oldType) || isInterfaceType(oldType)) || !(isObjectType(newType) || isInterfaceType(newType)) || newType.constructor !== oldType.constructor) {
        continue;
      }

      var oldFields = oldType.getFields();
      var newFields = newType.getFields();
      var _iteratorNormalCompletion4 = true;
      var _didIteratorError4 = false;
      var _iteratorError4 = undefined;

      try {
        for (var _iterator4 = objectValues(oldFields)[Symbol.iterator](), _step4; !(_iteratorNormalCompletion4 = (_step4 = _iterator4.next()).done); _iteratorNormalCompletion4 = true) {
          var oldField = _step4.value;
          var newField = newFields[oldField.name];

          if (newField === undefined) {
            continue;
          }

          var _iteratorNormalCompletion5 = true;
          var _didIteratorError5 = false;
          var _iteratorError5 = undefined;

          try {
            for (var _iterator5 = oldField.args[Symbol.iterator](), _step5; !(_iteratorNormalCompletion5 = (_step5 = _iterator5.next()).done); _iteratorNormalCompletion5 = true) {
              var oldArg = _step5.value;
              var newArg = findByName(newField.args, oldArg.name); // Arg not present

              if (newArg === undefined) {
                schemaChanges.push({
                  type: BreakingChangeType.ARG_REMOVED,
                  description: "".concat(oldType.name, ".").concat(oldField.name, " arg ") + "".concat(oldArg.name, " was removed.")
                });
                continue;
              }

              var isSafe = isChangeSafeForInputObjectFieldOrFieldArg(oldArg.type, newArg.type);

              if (!isSafe) {
                schemaChanges.push({
                  type: BreakingChangeType.ARG_CHANGED_KIND,
                  description: "".concat(oldType.name, ".").concat(oldField.name, " arg ") + "".concat(oldArg.name, " has changed type from ") + "".concat(String(oldArg.type), " to ").concat(String(newArg.type), ".")
                });
              } else if (oldArg.defaultValue !== undefined && oldArg.defaultValue !== newArg.defaultValue) {
                schemaChanges.push({
                  type: DangerousChangeType.ARG_DEFAULT_VALUE_CHANGE,
                  description: "".concat(oldType.name, ".").concat(oldField.name, " arg ") + "".concat(oldArg.name, " has changed defaultValue.")
                });
              }
            } // Check if arg was added to the field

          } catch (err) {
            _didIteratorError5 = true;
            _iteratorError5 = err;
          } finally {
            try {
              if (!_iteratorNormalCompletion5 && _iterator5.return != null) {
                _iterator5.return();
              }
            } finally {
              if (_didIteratorError5) {
                throw _iteratorError5;
              }
            }
          }

          var _iteratorNormalCompletion6 = true;
          var _didIteratorError6 = false;
          var _iteratorError6 = undefined;

          try {
            for (var _iterator6 = newField.args[Symbol.iterator](), _step6; !(_iteratorNormalCompletion6 = (_step6 = _iterator6.next()).done); _iteratorNormalCompletion6 = true) {
              var _newArg = _step6.value;

              var _oldArg = findByName(oldField.args, _newArg.name);

              if (_oldArg === undefined) {
                if (isRequiredArgument(_newArg)) {
                  schemaChanges.push({
                    type: BreakingChangeType.REQUIRED_ARG_ADDED,
                    description: "A required arg ".concat(_newArg.name, " on ") + "".concat(newType.name, ".").concat(newField.name, " was added.")
                  });
                } else {
                  schemaChanges.push({
                    type: DangerousChangeType.OPTIONAL_ARG_ADDED,
                    description: "An optional arg ".concat(_newArg.name, " on ") + "".concat(newType.name, ".").concat(newField.name, " was added.")
                  });
                }
              }
            }
          } catch (err) {
            _didIteratorError6 = true;
            _iteratorError6 = err;
          } finally {
            try {
              if (!_iteratorNormalCompletion6 && _iterator6.return != null) {
                _iterator6.return();
              }
            } finally {
              if (_didIteratorError6) {
                throw _iteratorError6;
              }
            }
          }
        }
      } catch (err) {
        _didIteratorError4 = true;
        _iteratorError4 = err;
      } finally {
        try {
          if (!_iteratorNormalCompletion4 && _iterator4.return != null) {
            _iterator4.return();
          }
        } finally {
          if (_didIteratorError4) {
            throw _iteratorError4;
          }
        }
      }
    }
  } catch (err) {
    _didIteratorError3 = true;
    _iteratorError3 = err;
  } finally {
    try {
      if (!_iteratorNormalCompletion3 && _iterator3.return != null) {
        _iterator3.return();
      }
    } finally {
      if (_didIteratorError3) {
        throw _iteratorError3;
      }
    }
  }

  return schemaChanges;
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
  } // Not reachable. All possible named types have been considered.

  /* istanbul ignore next */


  throw new TypeError("Unexpected type: ".concat(inspect(type), "."));
}

function findFieldsThatChangedTypeOnObjectOrInterfaceTypes(oldSchema, newSchema) {
  var schemaChanges = [];
  var oldTypeMap = oldSchema.getTypeMap();
  var newTypeMap = newSchema.getTypeMap();
  var _iteratorNormalCompletion7 = true;
  var _didIteratorError7 = false;
  var _iteratorError7 = undefined;

  try {
    for (var _iterator7 = objectValues(oldTypeMap)[Symbol.iterator](), _step7; !(_iteratorNormalCompletion7 = (_step7 = _iterator7.next()).done); _iteratorNormalCompletion7 = true) {
      var oldType = _step7.value;
      var newType = newTypeMap[oldType.name];

      if (!(isObjectType(oldType) || isInterfaceType(oldType)) || !(isObjectType(newType) || isInterfaceType(newType)) || newType.constructor !== oldType.constructor) {
        continue;
      }

      var oldFields = oldType.getFields();
      var newFields = newType.getFields();
      var _iteratorNormalCompletion8 = true;
      var _didIteratorError8 = false;
      var _iteratorError8 = undefined;

      try {
        for (var _iterator8 = objectValues(oldFields)[Symbol.iterator](), _step8; !(_iteratorNormalCompletion8 = (_step8 = _iterator8.next()).done); _iteratorNormalCompletion8 = true) {
          var oldField = _step8.value;
          var newField = newFields[oldField.name]; // Check if the field is missing on the type in the new schema.

          if (newField === undefined) {
            schemaChanges.push({
              type: BreakingChangeType.FIELD_REMOVED,
              description: "".concat(oldType.name, ".").concat(oldField.name, " was removed.")
            });
            continue;
          }

          var isSafe = isChangeSafeForObjectOrInterfaceField(oldField.type, newField.type);

          if (!isSafe) {
            schemaChanges.push({
              type: BreakingChangeType.FIELD_CHANGED_KIND,
              description: "".concat(oldType.name, ".").concat(oldField.name, " changed type from ") + "".concat(String(oldField.type), " to ").concat(String(newField.type), ".")
            });
          }
        }
      } catch (err) {
        _didIteratorError8 = true;
        _iteratorError8 = err;
      } finally {
        try {
          if (!_iteratorNormalCompletion8 && _iterator8.return != null) {
            _iterator8.return();
          }
        } finally {
          if (_didIteratorError8) {
            throw _iteratorError8;
          }
        }
      }
    }
  } catch (err) {
    _didIteratorError7 = true;
    _iteratorError7 = err;
  } finally {
    try {
      if (!_iteratorNormalCompletion7 && _iterator7.return != null) {
        _iterator7.return();
      }
    } finally {
      if (_didIteratorError7) {
        throw _iteratorError7;
      }
    }
  }

  return schemaChanges;
}

function findFieldsThatChangedTypeOnInputObjectTypes(oldSchema, newSchema) {
  var schemaChanges = [];
  var oldTypeMap = oldSchema.getTypeMap();
  var newTypeMap = newSchema.getTypeMap();
  var _iteratorNormalCompletion9 = true;
  var _didIteratorError9 = false;
  var _iteratorError9 = undefined;

  try {
    for (var _iterator9 = objectValues(oldTypeMap)[Symbol.iterator](), _step9; !(_iteratorNormalCompletion9 = (_step9 = _iterator9.next()).done); _iteratorNormalCompletion9 = true) {
      var oldType = _step9.value;
      var newType = newTypeMap[oldType.name];

      if (!isInputObjectType(oldType) || !isInputObjectType(newType)) {
        continue;
      }

      var oldFields = oldType.getFields();
      var newFields = newType.getFields();
      var _iteratorNormalCompletion10 = true;
      var _didIteratorError10 = false;
      var _iteratorError10 = undefined;

      try {
        for (var _iterator10 = objectValues(oldFields)[Symbol.iterator](), _step10; !(_iteratorNormalCompletion10 = (_step10 = _iterator10.next()).done); _iteratorNormalCompletion10 = true) {
          var oldField = _step10.value;
          var newField = newFields[oldField.name]; // Check if the field is missing on the type in the new schema.

          if (newField === undefined) {
            schemaChanges.push({
              type: BreakingChangeType.FIELD_REMOVED,
              description: "".concat(oldType.name, ".").concat(oldField.name, " was removed.")
            });
            continue;
          }

          var isSafe = isChangeSafeForInputObjectFieldOrFieldArg(oldField.type, newField.type);

          if (!isSafe) {
            schemaChanges.push({
              type: BreakingChangeType.FIELD_CHANGED_KIND,
              description: "".concat(oldType.name, ".").concat(oldField.name, " changed type from ") + "".concat(String(oldField.type), " to ").concat(String(newField.type), ".")
            });
          }
        } // Check if a field was added to the input object type

      } catch (err) {
        _didIteratorError10 = true;
        _iteratorError10 = err;
      } finally {
        try {
          if (!_iteratorNormalCompletion10 && _iterator10.return != null) {
            _iterator10.return();
          }
        } finally {
          if (_didIteratorError10) {
            throw _iteratorError10;
          }
        }
      }

      var _iteratorNormalCompletion11 = true;
      var _didIteratorError11 = false;
      var _iteratorError11 = undefined;

      try {
        for (var _iterator11 = objectValues(newFields)[Symbol.iterator](), _step11; !(_iteratorNormalCompletion11 = (_step11 = _iterator11.next()).done); _iteratorNormalCompletion11 = true) {
          var _newField = _step11.value;
          var _oldField = oldFields[_newField.name];

          if (_oldField === undefined) {
            if (isRequiredInputField(_newField)) {
              schemaChanges.push({
                type: BreakingChangeType.REQUIRED_INPUT_FIELD_ADDED,
                description: "A required field ".concat(_newField.name, " on ") + "input type ".concat(oldType.name, " was added.")
              });
            } else {
              schemaChanges.push({
                type: DangerousChangeType.OPTIONAL_INPUT_FIELD_ADDED,
                description: "An optional field ".concat(_newField.name, " on ") + "input type ".concat(oldType.name, " was added.")
              });
            }
          }
        }
      } catch (err) {
        _didIteratorError11 = true;
        _iteratorError11 = err;
      } finally {
        try {
          if (!_iteratorNormalCompletion11 && _iterator11.return != null) {
            _iterator11.return();
          }
        } finally {
          if (_didIteratorError11) {
            throw _iteratorError11;
          }
        }
      }
    }
  } catch (err) {
    _didIteratorError9 = true;
    _iteratorError9 = err;
  } finally {
    try {
      if (!_iteratorNormalCompletion9 && _iterator9.return != null) {
        _iterator9.return();
      }
    } finally {
      if (_didIteratorError9) {
        throw _iteratorError9;
      }
    }
  }

  return schemaChanges;
}

function isChangeSafeForObjectOrInterfaceField(oldType, newType) {
  if (isListType(oldType)) {
    return (// if they're both lists, make sure the underlying types are compatible
      isListType(newType) && isChangeSafeForObjectOrInterfaceField(oldType.ofType, newType.ofType) || // moving from nullable to non-null of the same underlying type is safe
      isNonNullType(newType) && isChangeSafeForObjectOrInterfaceField(oldType, newType.ofType)
    );
  }

  if (isNonNullType(oldType)) {
    // if they're both non-null, make sure the underlying types are compatible
    return isNonNullType(newType) && isChangeSafeForObjectOrInterfaceField(oldType.ofType, newType.ofType);
  }

  return (// if they're both named types, see if their names are equivalent
    isNamedType(newType) && oldType.name === newType.name || // moving from nullable to non-null of the same underlying type is safe
    isNonNullType(newType) && isChangeSafeForObjectOrInterfaceField(oldType, newType.ofType)
  );
}

function isChangeSafeForInputObjectFieldOrFieldArg(oldType, newType) {
  if (isListType(oldType)) {
    // if they're both lists, make sure the underlying types are compatible
    return isListType(newType) && isChangeSafeForInputObjectFieldOrFieldArg(oldType.ofType, newType.ofType);
  }

  if (isNonNullType(oldType)) {
    return (// if they're both non-null, make sure the underlying types are
      // compatible
      isNonNullType(newType) && isChangeSafeForInputObjectFieldOrFieldArg(oldType.ofType, newType.ofType) || // moving from non-null to nullable of the same underlying type is safe
      !isNonNullType(newType) && isChangeSafeForInputObjectFieldOrFieldArg(oldType.ofType, newType)
    );
  } // if they're both named types, see if their names are equivalent


  return isNamedType(newType) && oldType.name === newType.name;
}
/**
 * Given two schemas, returns an Array containing descriptions of any breaking
 * changes in the newSchema related to removing types from a union type.
 */


function findTypesRemovedFromUnions(oldSchema, newSchema) {
  var schemaChanges = [];
  var oldTypeMap = oldSchema.getTypeMap();
  var newTypeMap = newSchema.getTypeMap();
  var _iteratorNormalCompletion12 = true;
  var _didIteratorError12 = false;
  var _iteratorError12 = undefined;

  try {
    for (var _iterator12 = objectValues(oldTypeMap)[Symbol.iterator](), _step12; !(_iteratorNormalCompletion12 = (_step12 = _iterator12.next()).done); _iteratorNormalCompletion12 = true) {
      var oldType = _step12.value;
      var newType = newTypeMap[oldType.name];

      if (!isUnionType(oldType) || !isUnionType(newType)) {
        continue;
      }

      var oldPossibleTypes = oldType.getTypes();
      var newPossibleTypes = newType.getTypes();
      var _iteratorNormalCompletion13 = true;
      var _didIteratorError13 = false;
      var _iteratorError13 = undefined;

      try {
        for (var _iterator13 = oldPossibleTypes[Symbol.iterator](), _step13; !(_iteratorNormalCompletion13 = (_step13 = _iterator13.next()).done); _iteratorNormalCompletion13 = true) {
          var oldPossibleType = _step13.value;
          var newPossibleType = findByName(newPossibleTypes, oldPossibleType.name);

          if (newPossibleType === undefined) {
            schemaChanges.push({
              type: BreakingChangeType.TYPE_REMOVED_FROM_UNION,
              description: "".concat(oldPossibleType.name, " was removed from ") + "union type ".concat(oldType.name, ".")
            });
          }
        }
      } catch (err) {
        _didIteratorError13 = true;
        _iteratorError13 = err;
      } finally {
        try {
          if (!_iteratorNormalCompletion13 && _iterator13.return != null) {
            _iterator13.return();
          }
        } finally {
          if (_didIteratorError13) {
            throw _iteratorError13;
          }
        }
      }
    }
  } catch (err) {
    _didIteratorError12 = true;
    _iteratorError12 = err;
  } finally {
    try {
      if (!_iteratorNormalCompletion12 && _iterator12.return != null) {
        _iterator12.return();
      }
    } finally {
      if (_didIteratorError12) {
        throw _iteratorError12;
      }
    }
  }

  return schemaChanges;
}
/**
 * Given two schemas, returns an Array containing descriptions of any dangerous
 * changes in the newSchema related to adding types to a union type.
 */


function findTypesAddedToUnions(oldSchema, newSchema) {
  var schemaChanges = [];
  var oldTypeMap = oldSchema.getTypeMap();
  var newTypeMap = newSchema.getTypeMap();
  var _iteratorNormalCompletion14 = true;
  var _didIteratorError14 = false;
  var _iteratorError14 = undefined;

  try {
    for (var _iterator14 = objectValues(oldTypeMap)[Symbol.iterator](), _step14; !(_iteratorNormalCompletion14 = (_step14 = _iterator14.next()).done); _iteratorNormalCompletion14 = true) {
      var oldType = _step14.value;
      var newType = newTypeMap[oldType.name];

      if (!isUnionType(oldType) || !isUnionType(newType)) {
        continue;
      }

      var oldPossibleTypes = oldType.getTypes();
      var newPossibleTypes = newType.getTypes();
      var _iteratorNormalCompletion15 = true;
      var _didIteratorError15 = false;
      var _iteratorError15 = undefined;

      try {
        for (var _iterator15 = newPossibleTypes[Symbol.iterator](), _step15; !(_iteratorNormalCompletion15 = (_step15 = _iterator15.next()).done); _iteratorNormalCompletion15 = true) {
          var newPossibleType = _step15.value;
          var oldPossibleType = findByName(oldPossibleTypes, newPossibleType.name);

          if (oldPossibleType === undefined) {
            schemaChanges.push({
              type: DangerousChangeType.TYPE_ADDED_TO_UNION,
              description: "".concat(newPossibleType.name, " was added to ") + "union type ".concat(oldType.name, ".")
            });
          }
        }
      } catch (err) {
        _didIteratorError15 = true;
        _iteratorError15 = err;
      } finally {
        try {
          if (!_iteratorNormalCompletion15 && _iterator15.return != null) {
            _iterator15.return();
          }
        } finally {
          if (_didIteratorError15) {
            throw _iteratorError15;
          }
        }
      }
    }
  } catch (err) {
    _didIteratorError14 = true;
    _iteratorError14 = err;
  } finally {
    try {
      if (!_iteratorNormalCompletion14 && _iterator14.return != null) {
        _iterator14.return();
      }
    } finally {
      if (_didIteratorError14) {
        throw _iteratorError14;
      }
    }
  }

  return schemaChanges;
}
/**
 * Given two schemas, returns an Array containing descriptions of any breaking
 * changes in the newSchema related to removing values from an enum type.
 */


function findValuesRemovedFromEnums(oldSchema, newSchema) {
  var schemaChanges = [];
  var oldTypeMap = oldSchema.getTypeMap();
  var newTypeMap = newSchema.getTypeMap();
  var _iteratorNormalCompletion16 = true;
  var _didIteratorError16 = false;
  var _iteratorError16 = undefined;

  try {
    for (var _iterator16 = objectValues(oldTypeMap)[Symbol.iterator](), _step16; !(_iteratorNormalCompletion16 = (_step16 = _iterator16.next()).done); _iteratorNormalCompletion16 = true) {
      var oldType = _step16.value;
      var newType = newTypeMap[oldType.name];

      if (!isEnumType(oldType) || !isEnumType(newType)) {
        continue;
      }

      var oldValues = oldType.getValues();
      var newValues = newType.getValues();
      var _iteratorNormalCompletion17 = true;
      var _didIteratorError17 = false;
      var _iteratorError17 = undefined;

      try {
        for (var _iterator17 = oldValues[Symbol.iterator](), _step17; !(_iteratorNormalCompletion17 = (_step17 = _iterator17.next()).done); _iteratorNormalCompletion17 = true) {
          var oldValue = _step17.value;
          var newValue = findByName(newValues, oldValue.name);

          if (newValue === undefined) {
            schemaChanges.push({
              type: BreakingChangeType.VALUE_REMOVED_FROM_ENUM,
              description: "".concat(oldValue.name, " was removed from enum type ").concat(oldType.name, ".")
            });
          }
        }
      } catch (err) {
        _didIteratorError17 = true;
        _iteratorError17 = err;
      } finally {
        try {
          if (!_iteratorNormalCompletion17 && _iterator17.return != null) {
            _iterator17.return();
          }
        } finally {
          if (_didIteratorError17) {
            throw _iteratorError17;
          }
        }
      }
    }
  } catch (err) {
    _didIteratorError16 = true;
    _iteratorError16 = err;
  } finally {
    try {
      if (!_iteratorNormalCompletion16 && _iterator16.return != null) {
        _iterator16.return();
      }
    } finally {
      if (_didIteratorError16) {
        throw _iteratorError16;
      }
    }
  }

  return schemaChanges;
}
/**
 * Given two schemas, returns an Array containing descriptions of any dangerous
 * changes in the newSchema related to adding values to an enum type.
 */


function findValuesAddedToEnums(oldSchema, newSchema) {
  var schemaChanges = [];
  var oldTypeMap = oldSchema.getTypeMap();
  var newTypeMap = newSchema.getTypeMap();
  var _iteratorNormalCompletion18 = true;
  var _didIteratorError18 = false;
  var _iteratorError18 = undefined;

  try {
    for (var _iterator18 = objectValues(oldTypeMap)[Symbol.iterator](), _step18; !(_iteratorNormalCompletion18 = (_step18 = _iterator18.next()).done); _iteratorNormalCompletion18 = true) {
      var oldType = _step18.value;
      var newType = newTypeMap[oldType.name];

      if (!isEnumType(oldType) || !isEnumType(newType)) {
        continue;
      }

      var oldValues = oldType.getValues();
      var newValues = newType.getValues();
      var _iteratorNormalCompletion19 = true;
      var _didIteratorError19 = false;
      var _iteratorError19 = undefined;

      try {
        for (var _iterator19 = newValues[Symbol.iterator](), _step19; !(_iteratorNormalCompletion19 = (_step19 = _iterator19.next()).done); _iteratorNormalCompletion19 = true) {
          var newValue = _step19.value;
          var oldValue = findByName(oldValues, newValue.name);

          if (oldValue === undefined) {
            schemaChanges.push({
              type: DangerousChangeType.VALUE_ADDED_TO_ENUM,
              description: "".concat(newValue.name, " was added to enum type ").concat(oldType.name, ".")
            });
          }
        }
      } catch (err) {
        _didIteratorError19 = true;
        _iteratorError19 = err;
      } finally {
        try {
          if (!_iteratorNormalCompletion19 && _iterator19.return != null) {
            _iterator19.return();
          }
        } finally {
          if (_didIteratorError19) {
            throw _iteratorError19;
          }
        }
      }
    }
  } catch (err) {
    _didIteratorError18 = true;
    _iteratorError18 = err;
  } finally {
    try {
      if (!_iteratorNormalCompletion18 && _iterator18.return != null) {
        _iterator18.return();
      }
    } finally {
      if (_didIteratorError18) {
        throw _iteratorError18;
      }
    }
  }

  return schemaChanges;
}

function findInterfacesRemovedFromObjectTypes(oldSchema, newSchema) {
  var schemaChanges = [];
  var oldTypeMap = oldSchema.getTypeMap();
  var newTypeMap = newSchema.getTypeMap();
  var _iteratorNormalCompletion20 = true;
  var _didIteratorError20 = false;
  var _iteratorError20 = undefined;

  try {
    for (var _iterator20 = objectValues(oldTypeMap)[Symbol.iterator](), _step20; !(_iteratorNormalCompletion20 = (_step20 = _iterator20.next()).done); _iteratorNormalCompletion20 = true) {
      var oldType = _step20.value;
      var newType = newTypeMap[oldType.name];

      if (!isObjectType(oldType) || !isObjectType(newType)) {
        continue;
      }

      var oldInterfaces = oldType.getInterfaces();
      var newInterfaces = newType.getInterfaces();
      var _iteratorNormalCompletion21 = true;
      var _didIteratorError21 = false;
      var _iteratorError21 = undefined;

      try {
        for (var _iterator21 = oldInterfaces[Symbol.iterator](), _step21; !(_iteratorNormalCompletion21 = (_step21 = _iterator21.next()).done); _iteratorNormalCompletion21 = true) {
          var oldInterface = _step21.value;
          var newInterface = findByName(newInterfaces, oldInterface.name);

          if (newInterface === undefined) {
            schemaChanges.push({
              type: BreakingChangeType.INTERFACE_REMOVED_FROM_OBJECT,
              description: "".concat(oldType.name, " no longer implements interface ") + "".concat(oldInterface.name, ".")
            });
          }
        }
      } catch (err) {
        _didIteratorError21 = true;
        _iteratorError21 = err;
      } finally {
        try {
          if (!_iteratorNormalCompletion21 && _iterator21.return != null) {
            _iterator21.return();
          }
        } finally {
          if (_didIteratorError21) {
            throw _iteratorError21;
          }
        }
      }
    }
  } catch (err) {
    _didIteratorError20 = true;
    _iteratorError20 = err;
  } finally {
    try {
      if (!_iteratorNormalCompletion20 && _iterator20.return != null) {
        _iterator20.return();
      }
    } finally {
      if (_didIteratorError20) {
        throw _iteratorError20;
      }
    }
  }

  return schemaChanges;
}

function findInterfacesAddedToObjectTypes(oldSchema, newSchema) {
  var schemaChanges = [];
  var oldTypeMap = oldSchema.getTypeMap();
  var newTypeMap = newSchema.getTypeMap();
  var _iteratorNormalCompletion22 = true;
  var _didIteratorError22 = false;
  var _iteratorError22 = undefined;

  try {
    for (var _iterator22 = objectValues(oldTypeMap)[Symbol.iterator](), _step22; !(_iteratorNormalCompletion22 = (_step22 = _iterator22.next()).done); _iteratorNormalCompletion22 = true) {
      var oldType = _step22.value;
      var newType = newTypeMap[oldType.name];

      if (!isObjectType(oldType) || !isObjectType(newType)) {
        continue;
      }

      var oldInterfaces = oldType.getInterfaces();
      var newInterfaces = newType.getInterfaces();
      var _iteratorNormalCompletion23 = true;
      var _didIteratorError23 = false;
      var _iteratorError23 = undefined;

      try {
        for (var _iterator23 = newInterfaces[Symbol.iterator](), _step23; !(_iteratorNormalCompletion23 = (_step23 = _iterator23.next()).done); _iteratorNormalCompletion23 = true) {
          var newInterface = _step23.value;
          var oldInterface = findByName(oldInterfaces, newInterface.name);

          if (oldInterface === undefined) {
            schemaChanges.push({
              type: DangerousChangeType.INTERFACE_ADDED_TO_OBJECT,
              description: "".concat(newInterface.name, " added to interfaces implemented ") + "by ".concat(oldType.name, ".")
            });
          }
        }
      } catch (err) {
        _didIteratorError23 = true;
        _iteratorError23 = err;
      } finally {
        try {
          if (!_iteratorNormalCompletion23 && _iterator23.return != null) {
            _iterator23.return();
          }
        } finally {
          if (_didIteratorError23) {
            throw _iteratorError23;
          }
        }
      }
    }
  } catch (err) {
    _didIteratorError22 = true;
    _iteratorError22 = err;
  } finally {
    try {
      if (!_iteratorNormalCompletion22 && _iterator22.return != null) {
        _iterator22.return();
      }
    } finally {
      if (_didIteratorError22) {
        throw _iteratorError22;
      }
    }
  }

  return schemaChanges;
}

function findRemovedDirectives(oldSchema, newSchema) {
  var schemaChanges = [];
  var oldDirectives = oldSchema.getDirectives();
  var newDirectives = newSchema.getDirectives();
  var _iteratorNormalCompletion24 = true;
  var _didIteratorError24 = false;
  var _iteratorError24 = undefined;

  try {
    for (var _iterator24 = oldDirectives[Symbol.iterator](), _step24; !(_iteratorNormalCompletion24 = (_step24 = _iterator24.next()).done); _iteratorNormalCompletion24 = true) {
      var oldDirective = _step24.value;
      var newDirective = findByName(newDirectives, oldDirective.name);

      if (newDirective === undefined) {
        schemaChanges.push({
          type: BreakingChangeType.DIRECTIVE_REMOVED,
          description: "".concat(oldDirective.name, " was removed.")
        });
      }
    }
  } catch (err) {
    _didIteratorError24 = true;
    _iteratorError24 = err;
  } finally {
    try {
      if (!_iteratorNormalCompletion24 && _iterator24.return != null) {
        _iterator24.return();
      }
    } finally {
      if (_didIteratorError24) {
        throw _iteratorError24;
      }
    }
  }

  return schemaChanges;
}

function findRemovedDirectiveArgs(oldSchema, newSchema) {
  var schemaChanges = [];
  var oldDirectives = oldSchema.getDirectives();
  var newDirectives = newSchema.getDirectives();
  var _iteratorNormalCompletion25 = true;
  var _didIteratorError25 = false;
  var _iteratorError25 = undefined;

  try {
    for (var _iterator25 = oldDirectives[Symbol.iterator](), _step25; !(_iteratorNormalCompletion25 = (_step25 = _iterator25.next()).done); _iteratorNormalCompletion25 = true) {
      var oldDirective = _step25.value;
      var newDirective = findByName(newDirectives, oldDirective.name);

      if (newDirective === undefined) {
        continue;
      }

      var _iteratorNormalCompletion26 = true;
      var _didIteratorError26 = false;
      var _iteratorError26 = undefined;

      try {
        for (var _iterator26 = oldDirective.args[Symbol.iterator](), _step26; !(_iteratorNormalCompletion26 = (_step26 = _iterator26.next()).done); _iteratorNormalCompletion26 = true) {
          var oldArg = _step26.value;
          var newArg = findByName(newDirective.args, oldArg.name);

          if (newArg === undefined) {
            schemaChanges.push({
              type: BreakingChangeType.DIRECTIVE_ARG_REMOVED,
              description: "".concat(oldArg.name, " was removed from ").concat(oldDirective.name, ".")
            });
          }
        }
      } catch (err) {
        _didIteratorError26 = true;
        _iteratorError26 = err;
      } finally {
        try {
          if (!_iteratorNormalCompletion26 && _iterator26.return != null) {
            _iterator26.return();
          }
        } finally {
          if (_didIteratorError26) {
            throw _iteratorError26;
          }
        }
      }
    }
  } catch (err) {
    _didIteratorError25 = true;
    _iteratorError25 = err;
  } finally {
    try {
      if (!_iteratorNormalCompletion25 && _iterator25.return != null) {
        _iterator25.return();
      }
    } finally {
      if (_didIteratorError25) {
        throw _iteratorError25;
      }
    }
  }

  return schemaChanges;
}

function findAddedNonNullDirectiveArgs(oldSchema, newSchema) {
  var schemaChanges = [];
  var oldDirectives = oldSchema.getDirectives();
  var newDirectives = newSchema.getDirectives();
  var _iteratorNormalCompletion27 = true;
  var _didIteratorError27 = false;
  var _iteratorError27 = undefined;

  try {
    for (var _iterator27 = oldDirectives[Symbol.iterator](), _step27; !(_iteratorNormalCompletion27 = (_step27 = _iterator27.next()).done); _iteratorNormalCompletion27 = true) {
      var oldDirective = _step27.value;
      var newDirective = findByName(newDirectives, oldDirective.name);

      if (newDirective === undefined) {
        continue;
      }

      var _iteratorNormalCompletion28 = true;
      var _didIteratorError28 = false;
      var _iteratorError28 = undefined;

      try {
        for (var _iterator28 = newDirective.args[Symbol.iterator](), _step28; !(_iteratorNormalCompletion28 = (_step28 = _iterator28.next()).done); _iteratorNormalCompletion28 = true) {
          var newArg = _step28.value;
          var oldArg = findByName(oldDirective.args, newArg.name);

          if (oldArg === undefined && isRequiredArgument(newArg)) {
            schemaChanges.push({
              type: BreakingChangeType.REQUIRED_DIRECTIVE_ARG_ADDED,
              description: "A required arg ".concat(newArg.name, " on directive ") + "".concat(newDirective.name, " was added.")
            });
          }
        }
      } catch (err) {
        _didIteratorError28 = true;
        _iteratorError28 = err;
      } finally {
        try {
          if (!_iteratorNormalCompletion28 && _iterator28.return != null) {
            _iterator28.return();
          }
        } finally {
          if (_didIteratorError28) {
            throw _iteratorError28;
          }
        }
      }
    }
  } catch (err) {
    _didIteratorError27 = true;
    _iteratorError27 = err;
  } finally {
    try {
      if (!_iteratorNormalCompletion27 && _iterator27.return != null) {
        _iterator27.return();
      }
    } finally {
      if (_didIteratorError27) {
        throw _iteratorError27;
      }
    }
  }

  return schemaChanges;
}

function findRemovedDirectiveLocations(oldSchema, newSchema) {
  var schemaChanges = [];
  var oldDirectives = oldSchema.getDirectives();
  var newDirectives = newSchema.getDirectives();
  var _iteratorNormalCompletion29 = true;
  var _didIteratorError29 = false;
  var _iteratorError29 = undefined;

  try {
    for (var _iterator29 = oldDirectives[Symbol.iterator](), _step29; !(_iteratorNormalCompletion29 = (_step29 = _iterator29.next()).done); _iteratorNormalCompletion29 = true) {
      var oldDirective = _step29.value;
      var newDirective = findByName(newDirectives, oldDirective.name);

      if (newDirective === undefined) {
        continue;
      }

      var _iteratorNormalCompletion30 = true;
      var _didIteratorError30 = false;
      var _iteratorError30 = undefined;

      try {
        for (var _iterator30 = oldDirective.locations[Symbol.iterator](), _step30; !(_iteratorNormalCompletion30 = (_step30 = _iterator30.next()).done); _iteratorNormalCompletion30 = true) {
          var location = _step30.value;

          if (newDirective.locations.indexOf(location) === -1) {
            schemaChanges.push({
              type: BreakingChangeType.DIRECTIVE_LOCATION_REMOVED,
              description: "".concat(location, " was removed from ").concat(oldDirective.name, ".")
            });
          }
        }
      } catch (err) {
        _didIteratorError30 = true;
        _iteratorError30 = err;
      } finally {
        try {
          if (!_iteratorNormalCompletion30 && _iterator30.return != null) {
            _iterator30.return();
          }
        } finally {
          if (_didIteratorError30) {
            throw _iteratorError30;
          }
        }
      }
    }
  } catch (err) {
    _didIteratorError29 = true;
    _iteratorError29 = err;
  } finally {
    try {
      if (!_iteratorNormalCompletion29 && _iterator29.return != null) {
        _iterator29.return();
      }
    } finally {
      if (_didIteratorError29) {
        throw _iteratorError29;
      }
    }
  }

  return schemaChanges;
}

function findByName(array, name) {
  return find(array, function (item) {
    return item.name === name;
  });
}
