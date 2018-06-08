"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.validateSchema = validateSchema;
exports.assertValidSchema = assertValidSchema;

var _definition = require("./definition");

var _directives = require("./directives");

var _introspection = require("./introspection");

var _schema = require("./schema");

var _inspect = _interopRequireDefault(require("../jsutils/inspect"));

var _find = _interopRequireDefault(require("../jsutils/find"));

var _invariant = _interopRequireDefault(require("../jsutils/invariant"));

var _objectValues = _interopRequireDefault(require("../jsutils/objectValues"));

var _GraphQLError = require("../error/GraphQLError");

var _assertValidName = require("../utilities/assertValidName");

var _typeComparators = require("../utilities/typeComparators");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

/**
 * Implements the "Type Validation" sub-sections of the specification's
 * "Type System" section.
 *
 * Validation runs synchronously, returning an array of encountered errors, or
 * an empty array if no errors were encountered and the Schema is valid.
 */
function validateSchema(schema) {
  // First check to ensure the provided value is in fact a GraphQLSchema.
  !(0, _schema.isSchema)(schema) ? (0, _invariant.default)(0, "Expected ".concat((0, _inspect.default)(schema), " to be a GraphQL schema.")) : void 0; // If this Schema has already been validated, return the previous results.

  if (schema.__validationErrors) {
    return schema.__validationErrors;
  } // Validate the schema, producing a list of errors.


  var context = new SchemaValidationContext(schema);
  validateRootTypes(context);
  validateDirectives(context);
  validateTypes(context); // Persist the results of validation before returning to ensure validation
  // does not run multiple times for this schema.

  var errors = context.getErrors();
  schema.__validationErrors = errors;
  return errors;
}
/**
 * Utility function which asserts a schema is valid by throwing an error if
 * it is invalid.
 */


function assertValidSchema(schema) {
  var errors = validateSchema(schema);

  if (errors.length !== 0) {
    throw new Error(errors.map(function (error) {
      return error.message;
    }).join('\n\n'));
  }
}

var SchemaValidationContext =
/*#__PURE__*/
function () {
  function SchemaValidationContext(schema) {
    _defineProperty(this, "_errors", void 0);

    _defineProperty(this, "schema", void 0);

    this._errors = [];
    this.schema = schema;
  }

  var _proto = SchemaValidationContext.prototype;

  _proto.reportError = function reportError(message, nodes) {
    var _nodes = (Array.isArray(nodes) ? nodes : [nodes]).filter(Boolean);

    this.addError(new _GraphQLError.GraphQLError(message, _nodes));
  };

  _proto.addError = function addError(error) {
    this._errors.push(error);
  };

  _proto.getErrors = function getErrors() {
    return this._errors;
  };

  return SchemaValidationContext;
}();

function validateRootTypes(context) {
  var schema = context.schema;
  var queryType = schema.getQueryType();

  if (!queryType) {
    context.reportError("Query root type must be provided.", schema.astNode);
  } else if (!(0, _definition.isObjectType)(queryType)) {
    context.reportError("Query root type must be Object type, it cannot be ".concat((0, _inspect.default)(queryType), "."), getOperationTypeNode(schema, queryType, 'query'));
  }

  var mutationType = schema.getMutationType();

  if (mutationType && !(0, _definition.isObjectType)(mutationType)) {
    context.reportError('Mutation root type must be Object type if provided, it cannot be ' + "".concat((0, _inspect.default)(mutationType), "."), getOperationTypeNode(schema, mutationType, 'mutation'));
  }

  var subscriptionType = schema.getSubscriptionType();

  if (subscriptionType && !(0, _definition.isObjectType)(subscriptionType)) {
    context.reportError('Subscription root type must be Object type if provided, it cannot be ' + "".concat((0, _inspect.default)(subscriptionType), "."), getOperationTypeNode(schema, subscriptionType, 'subscription'));
  }
}

function getOperationTypeNode(schema, type, operation) {
  var _iteratorNormalCompletion = true;
  var _didIteratorError = false;
  var _iteratorError = undefined;

  try {
    for (var _iterator = getAllNodes(schema)[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
      var node = _step.value;

      if (node.operationTypes) {
        var _iteratorNormalCompletion2 = true;
        var _didIteratorError2 = false;
        var _iteratorError2 = undefined;

        try {
          for (var _iterator2 = node.operationTypes[Symbol.iterator](), _step2; !(_iteratorNormalCompletion2 = (_step2 = _iterator2.next()).done); _iteratorNormalCompletion2 = true) {
            var operationType = _step2.value;

            if (operationType.operation === operation) {
              return operationType.type;
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

  return type.astNode;
}

function validateDirectives(context) {
  var directives = context.schema.getDirectives();
  directives.forEach(function (directive) {
    // Ensure all directives are in fact GraphQL directives.
    if (!(0, _directives.isDirective)(directive)) {
      context.reportError("Expected directive but got: ".concat((0, _inspect.default)(directive), "."), directive && directive.astNode);
      return;
    } // Ensure they are named correctly.


    validateName(context, directive); // TODO: Ensure proper locations.
    // Ensure the arguments are valid.

    var argNames = Object.create(null);
    directive.args.forEach(function (arg) {
      var argName = arg.name; // Ensure they are named correctly.

      validateName(context, arg); // Ensure they are unique per directive.

      if (argNames[argName]) {
        context.reportError("Argument @".concat(directive.name, "(").concat(argName, ":) can only be defined once."), getAllDirectiveArgNodes(directive, argName));
        return; // continue loop
      }

      argNames[argName] = true; // Ensure the type is an input type.

      if (!(0, _definition.isInputType)(arg.type)) {
        context.reportError("The type of @".concat(directive.name, "(").concat(argName, ":) must be Input Type ") + "but got: ".concat((0, _inspect.default)(arg.type), "."), getDirectiveArgTypeNode(directive, argName));
      }
    });
  });
}

function validateName(context, node) {
  // If a schema explicitly allows some legacy name which is no longer valid,
  // allow it to be assumed valid.
  if (context.schema.__allowedLegacyNames.indexOf(node.name) !== -1) {
    return;
  } // Ensure names are valid, however introspection types opt out.


  var error = (0, _assertValidName.isValidNameError)(node.name, node.astNode || undefined);

  if (error) {
    context.addError(error);
  }
}

function validateTypes(context) {
  var typeMap = context.schema.getTypeMap();
  (0, _objectValues.default)(typeMap).forEach(function (type) {
    // Ensure all provided types are in fact GraphQL type.
    if (!(0, _definition.isNamedType)(type)) {
      context.reportError("Expected GraphQL named type but got: ".concat((0, _inspect.default)(type), "."), type && type.astNode);
      return;
    } // Ensure it is named correctly (excluding introspection types).


    if (!(0, _introspection.isIntrospectionType)(type)) {
      validateName(context, type);
    }

    if ((0, _definition.isObjectType)(type)) {
      // Ensure fields are valid
      validateFields(context, type); // Ensure objects implement the interfaces they claim to.

      validateObjectInterfaces(context, type);
    } else if ((0, _definition.isInterfaceType)(type)) {
      // Ensure fields are valid.
      validateFields(context, type);
    } else if ((0, _definition.isUnionType)(type)) {
      // Ensure Unions include valid member types.
      validateUnionMembers(context, type);
    } else if ((0, _definition.isEnumType)(type)) {
      // Ensure Enums have valid values.
      validateEnumValues(context, type);
    } else if ((0, _definition.isInputObjectType)(type)) {
      // Ensure Input Object fields are valid.
      validateInputFields(context, type);
    }
  });
}

function validateFields(context, type) {
  var fields = (0, _objectValues.default)(type.getFields()); // Objects and Interfaces both must define one or more fields.

  if (fields.length === 0) {
    context.reportError("Type ".concat(type.name, " must define one or more fields."), getAllNodes(type));
  }

  fields.forEach(function (field) {
    // Ensure they are named correctly.
    validateName(context, field); // Ensure they were defined at most once.

    var fieldNodes = getAllFieldNodes(type, field.name);

    if (fieldNodes.length > 1) {
      context.reportError("Field ".concat(type.name, ".").concat(field.name, " can only be defined once."), fieldNodes);
      return; // continue loop
    } // Ensure the type is an output type


    if (!(0, _definition.isOutputType)(field.type)) {
      context.reportError("The type of ".concat(type.name, ".").concat(field.name, " must be Output Type ") + "but got: ".concat((0, _inspect.default)(field.type), "."), getFieldTypeNode(type, field.name));
    } // Ensure the arguments are valid


    var argNames = Object.create(null);
    field.args.forEach(function (arg) {
      var argName = arg.name; // Ensure they are named correctly.

      validateName(context, arg); // Ensure they are unique per field.

      if (argNames[argName]) {
        context.reportError("Field argument ".concat(type.name, ".").concat(field.name, "(").concat(argName, ":) can only ") + 'be defined once.', getAllFieldArgNodes(type, field.name, argName));
      }

      argNames[argName] = true; // Ensure the type is an input type

      if (!(0, _definition.isInputType)(arg.type)) {
        context.reportError("The type of ".concat(type.name, ".").concat(field.name, "(").concat(argName, ":) must be Input ") + "Type but got: ".concat((0, _inspect.default)(arg.type), "."), getFieldArgTypeNode(type, field.name, argName));
      }
    });
  });
}

function validateObjectInterfaces(context, object) {
  var implementedTypeNames = Object.create(null);
  object.getInterfaces().forEach(function (iface) {
    if (!(0, _definition.isInterfaceType)(iface)) {
      context.reportError("Type ".concat((0, _inspect.default)(object), " must only implement Interface types, ") + "it cannot implement ".concat((0, _inspect.default)(iface), "."), getImplementsInterfaceNode(object, iface));
      return;
    }

    if (implementedTypeNames[iface.name]) {
      context.reportError("Type ".concat(object.name, " can only implement ").concat(iface.name, " once."), getAllImplementsInterfaceNodes(object, iface));
      return; // continue loop
    }

    implementedTypeNames[iface.name] = true;
    validateObjectImplementsInterface(context, object, iface);
  });
}

function validateObjectImplementsInterface(context, object, iface) {
  var objectFieldMap = object.getFields();
  var ifaceFieldMap = iface.getFields(); // Assert each interface field is implemented.

  Object.keys(ifaceFieldMap).forEach(function (fieldName) {
    var objectField = objectFieldMap[fieldName];
    var ifaceField = ifaceFieldMap[fieldName]; // Assert interface field exists on object.

    if (!objectField) {
      context.reportError("Interface field ".concat(iface.name, ".").concat(fieldName, " expected but ") + "".concat(object.name, " does not provide it."), [getFieldNode(iface, fieldName), object.astNode]); // Continue loop over fields.

      return;
    } // Assert interface field type is satisfied by object field type, by being
    // a valid subtype. (covariant)


    if (!(0, _typeComparators.isTypeSubTypeOf)(context.schema, objectField.type, ifaceField.type)) {
      context.reportError("Interface field ".concat(iface.name, ".").concat(fieldName, " expects type ") + "".concat((0, _inspect.default)(ifaceField.type), " but ").concat(object.name, ".").concat(fieldName, " ") + "is type ".concat((0, _inspect.default)(objectField.type), "."), [getFieldTypeNode(iface, fieldName), getFieldTypeNode(object, fieldName)]);
    } // Assert each interface field arg is implemented.


    ifaceField.args.forEach(function (ifaceArg) {
      var argName = ifaceArg.name;
      var objectArg = (0, _find.default)(objectField.args, function (arg) {
        return arg.name === argName;
      }); // Assert interface field arg exists on object field.

      if (!objectArg) {
        context.reportError("Interface field argument ".concat(iface.name, ".").concat(fieldName, "(").concat(argName, ":) ") + "expected but ".concat(object.name, ".").concat(fieldName, " does not provide it."), [getFieldArgNode(iface, fieldName, argName), getFieldNode(object, fieldName)]); // Continue loop over arguments.

        return;
      } // Assert interface field arg type matches object field arg type.
      // (invariant)
      // TODO: change to contravariant?


      if (!(0, _typeComparators.isEqualType)(ifaceArg.type, objectArg.type)) {
        context.reportError("Interface field argument ".concat(iface.name, ".").concat(fieldName, "(").concat(argName, ":) ") + "expects type ".concat((0, _inspect.default)(ifaceArg.type), " but ") + "".concat(object.name, ".").concat(fieldName, "(").concat(argName, ":) is type ") + "".concat((0, _inspect.default)(objectArg.type), "."), [getFieldArgTypeNode(iface, fieldName, argName), getFieldArgTypeNode(object, fieldName, argName)]);
      } // TODO: validate default values?

    }); // Assert additional arguments must not be required.

    objectField.args.forEach(function (objectArg) {
      var argName = objectArg.name;
      var ifaceArg = (0, _find.default)(ifaceField.args, function (arg) {
        return arg.name === argName;
      });

      if (!ifaceArg && (0, _definition.isNonNullType)(objectArg.type)) {
        context.reportError("Object field argument ".concat(object.name, ".").concat(fieldName, "(").concat(argName, ":) ") + "is of required type ".concat((0, _inspect.default)(objectArg.type), " but is not also ") + "provided by the Interface field ".concat(iface.name, ".").concat(fieldName, "."), [getFieldArgTypeNode(object, fieldName, argName), getFieldNode(iface, fieldName)]);
      }
    });
  });
}

function validateUnionMembers(context, union) {
  var memberTypes = union.getTypes();

  if (memberTypes.length === 0) {
    context.reportError("Union type ".concat(union.name, " must define one or more member types."), union.astNode);
  }

  var includedTypeNames = Object.create(null);
  memberTypes.forEach(function (memberType) {
    if (includedTypeNames[memberType.name]) {
      context.reportError("Union type ".concat(union.name, " can only include type ") + "".concat(memberType.name, " once."), getUnionMemberTypeNodes(union, memberType.name));
      return; // continue loop
    }

    includedTypeNames[memberType.name] = true;

    if (!(0, _definition.isObjectType)(memberType)) {
      context.reportError("Union type ".concat(union.name, " can only include Object types, ") + "it cannot include ".concat((0, _inspect.default)(memberType), "."), getUnionMemberTypeNodes(union, String(memberType)));
    }
  });
}

function validateEnumValues(context, enumType) {
  var enumValues = enumType.getValues();

  if (enumValues.length === 0) {
    context.reportError("Enum type ".concat(enumType.name, " must define one or more values."), enumType.astNode);
  }

  enumValues.forEach(function (enumValue) {
    var valueName = enumValue.name; // Ensure no duplicates.

    var allNodes = getEnumValueNodes(enumType, valueName);

    if (allNodes && allNodes.length > 1) {
      context.reportError("Enum type ".concat(enumType.name, " can include value ").concat(valueName, " only once."), allNodes);
    } // Ensure valid name.


    validateName(context, enumValue);

    if (valueName === 'true' || valueName === 'false' || valueName === 'null') {
      context.reportError("Enum type ".concat(enumType.name, " cannot include value: ").concat(valueName, "."), enumValue.astNode);
    }
  });
}

function validateInputFields(context, inputObj) {
  var fields = (0, _objectValues.default)(inputObj.getFields());

  if (fields.length === 0) {
    context.reportError("Input Object type ".concat(inputObj.name, " must define one or more fields."), inputObj.astNode);
  } // Ensure the arguments are valid


  fields.forEach(function (field) {
    // Ensure they are named correctly.
    validateName(context, field); // TODO: Ensure they are unique per field.
    // Ensure the type is an input type

    if (!(0, _definition.isInputType)(field.type)) {
      context.reportError("The type of ".concat(inputObj.name, ".").concat(field.name, " must be Input Type ") + "but got: ".concat((0, _inspect.default)(field.type), "."), field.astNode && field.astNode.type);
    }
  });
}

function getAllNodes(object) {
  var astNode = object.astNode,
      extensionASTNodes = object.extensionASTNodes;
  return astNode ? extensionASTNodes ? [astNode].concat(extensionASTNodes) : [astNode] : extensionASTNodes || [];
}

function getImplementsInterfaceNode(type, iface) {
  return getAllImplementsInterfaceNodes(type, iface)[0];
}

function getAllImplementsInterfaceNodes(type, iface) {
  var implementsNodes = [];
  var astNodes = getAllNodes(type);

  for (var i = 0; i < astNodes.length; i++) {
    var _astNode = astNodes[i];

    if (_astNode && _astNode.interfaces) {
      _astNode.interfaces.forEach(function (node) {
        if (node.name.value === iface.name) {
          implementsNodes.push(node);
        }
      });
    }
  }

  return implementsNodes;
}

function getFieldNode(type, fieldName) {
  return getAllFieldNodes(type, fieldName)[0];
}

function getAllFieldNodes(type, fieldName) {
  var fieldNodes = [];
  var astNodes = getAllNodes(type);

  for (var i = 0; i < astNodes.length; i++) {
    var _astNode2 = astNodes[i];

    if (_astNode2 && _astNode2.fields) {
      _astNode2.fields.forEach(function (node) {
        if (node.name.value === fieldName) {
          fieldNodes.push(node);
        }
      });
    }
  }

  return fieldNodes;
}

function getFieldTypeNode(type, fieldName) {
  var fieldNode = getFieldNode(type, fieldName);
  return fieldNode && fieldNode.type;
}

function getFieldArgNode(type, fieldName, argName) {
  return getAllFieldArgNodes(type, fieldName, argName)[0];
}

function getAllFieldArgNodes(type, fieldName, argName) {
  var argNodes = [];
  var fieldNode = getFieldNode(type, fieldName);

  if (fieldNode && fieldNode.arguments) {
    fieldNode.arguments.forEach(function (node) {
      if (node.name.value === argName) {
        argNodes.push(node);
      }
    });
  }

  return argNodes;
}

function getFieldArgTypeNode(type, fieldName, argName) {
  var fieldArgNode = getFieldArgNode(type, fieldName, argName);
  return fieldArgNode && fieldArgNode.type;
}

function getAllDirectiveArgNodes(directive, argName) {
  var argNodes = [];
  var directiveNode = directive.astNode;

  if (directiveNode && directiveNode.arguments) {
    directiveNode.arguments.forEach(function (node) {
      if (node.name.value === argName) {
        argNodes.push(node);
      }
    });
  }

  return argNodes;
}

function getDirectiveArgTypeNode(directive, argName) {
  var argNode = getAllDirectiveArgNodes(directive, argName)[0];
  return argNode && argNode.type;
}

function getUnionMemberTypeNodes(union, typeName) {
  return union.astNode && union.astNode.types && union.astNode.types.filter(function (type) {
    return type.name.value === typeName;
  });
}

function getEnumValueNodes(enumType, valueName) {
  return enumType.astNode && enumType.astNode.values && enumType.astNode.values.filter(function (value) {
    return value.name.value === valueName;
  });
}