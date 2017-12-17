'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.validateSchema = validateSchema;
exports.assertValidSchema = assertValidSchema;

var _definition = require('./definition');

var _directives = require('./directives');

var _introspection = require('./introspection');

var _schema = require('./schema');

var _find = require('../jsutils/find');

var _find2 = _interopRequireDefault(_find);

var _invariant = require('../jsutils/invariant');

var _invariant2 = _interopRequireDefault(_invariant);

var _GraphQLError = require('../error/GraphQLError');

var _assertValidName = require('../utilities/assertValidName');

var _typeComparators = require('../utilities/typeComparators');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } } /**
                                                                                                                                                           * Copyright (c) 2015-present, Facebook, Inc.
                                                                                                                                                           *
                                                                                                                                                           * This source code is licensed under the MIT license found in the
                                                                                                                                                           * LICENSE file in the root directory of this source tree.
                                                                                                                                                           *
                                                                                                                                                           * 
                                                                                                                                                           */

/**
 * Implements the "Type Validation" sub-sections of the specification's
 * "Type System" section.
 *
 * Validation runs synchronously, returning an array of encountered errors, or
 * an empty array if no errors were encountered and the Schema is valid.
 */
function validateSchema(schema) {
  // First check to ensure the provided value is in fact a GraphQLSchema.
  !(0, _schema.isSchema)(schema) ? (0, _invariant2.default)(0, 'Expected ' + String(schema) + ' to be a GraphQL schema.') : void 0;

  // If this Schema has already been validated, return the previous results.
  if (schema.__validationErrors) {
    return schema.__validationErrors;
  }

  // Validate the schema, producing a list of errors.
  var context = new SchemaValidationContext(schema);
  validateRootTypes(context);
  validateDirectives(context);
  validateTypes(context);

  // Persist the results of validation before returning to ensure validation
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

var SchemaValidationContext = function () {
  function SchemaValidationContext(schema) {
    _classCallCheck(this, SchemaValidationContext);

    this._errors = [];
    this.schema = schema;
  }

  SchemaValidationContext.prototype.reportError = function reportError(message, nodes) {
    var _nodes = (Array.isArray(nodes) ? nodes : [nodes]).filter(Boolean);
    this.addError(new _GraphQLError.GraphQLError(message, _nodes));
  };

  SchemaValidationContext.prototype.addError = function addError(error) {
    this._errors.push(error);
  };

  SchemaValidationContext.prototype.getErrors = function getErrors() {
    return this._errors;
  };

  return SchemaValidationContext;
}();

function validateRootTypes(context) {
  var schema = context.schema;
  var queryType = schema.getQueryType();
  if (!queryType) {
    context.reportError('Query root type must be provided.', schema.astNode);
  } else if (!(0, _definition.isObjectType)(queryType)) {
    context.reportError('Query root type must be Object type, it cannot be ' + String(queryType) + '.', getOperationTypeNode(schema, queryType, 'query'));
  }

  var mutationType = schema.getMutationType();
  if (mutationType && !(0, _definition.isObjectType)(mutationType)) {
    context.reportError('Mutation root type must be Object type if provided, it cannot be ' + (String(mutationType) + '.'), getOperationTypeNode(schema, mutationType, 'mutation'));
  }

  var subscriptionType = schema.getSubscriptionType();
  if (subscriptionType && !(0, _definition.isObjectType)(subscriptionType)) {
    context.reportError('Subscription root type must be Object type if provided, it cannot be ' + (String(subscriptionType) + '.'), getOperationTypeNode(schema, subscriptionType, 'subscription'));
  }
}

function getOperationTypeNode(schema, type, operation) {
  var astNode = schema.astNode;
  var operationTypeNode = astNode && astNode.operationTypes.find(function (operationType) {
    return operationType.operation === operation;
  });
  return operationTypeNode ? operationTypeNode.type : type && type.astNode;
}

function validateDirectives(context) {
  var directives = context.schema.getDirectives();
  directives.forEach(function (directive) {
    // Ensure all directives are in fact GraphQL directives.
    if (!(0, _directives.isDirective)(directive)) {
      context.reportError('Expected directive but got: ' + String(directive) + '.', directive && directive.astNode);
      return;
    }

    // Ensure they are named correctly.
    validateName(context, directive);

    // TODO: Ensure proper locations.

    // Ensure the arguments are valid.
    var argNames = Object.create(null);
    directive.args.forEach(function (arg) {
      var argName = arg.name;

      // Ensure they are named correctly.
      validateName(context, arg);

      // Ensure they are unique per directive.
      if (argNames[argName]) {
        context.reportError('Argument @' + directive.name + '(' + argName + ':) can only be defined once.', getAllDirectiveArgNodes(directive, argName));
        return; // continue loop
      }
      argNames[argName] = true;

      // Ensure the type is an input type.
      if (!(0, _definition.isInputType)(arg.type)) {
        context.reportError('The type of @' + directive.name + '(' + argName + ':) must be Input Type ' + ('but got: ' + String(arg.type) + '.'), getDirectiveArgTypeNode(directive, argName));
      }
    });
  });
}

function validateName(context, node) {
  // Ensure names are valid, however introspection types opt out.
  var error = (0, _assertValidName.isValidNameError)(node.name, node.astNode || undefined);
  if (error && !(0, _introspection.isIntrospectionType)(node)) {
    context.addError(error);
  }
}

function validateTypes(context) {
  var typeMap = context.schema.getTypeMap();
  Object.keys(typeMap).forEach(function (typeName) {
    var type = typeMap[typeName];

    // Ensure all provided types are in fact GraphQL type.
    if (!(0, _definition.isNamedType)(type)) {
      context.reportError('Expected GraphQL named type but got: ' + String(type) + '.', type && type.astNode);
      return;
    }

    // Ensure they are named correctly.
    validateName(context, type);

    if ((0, _definition.isObjectType)(type)) {
      // Ensure fields are valid
      validateFields(context, type);

      // Ensure objects implement the interfaces they claim to.
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
  var fieldMap = type.getFields();
  var fieldNames = Object.keys(fieldMap);

  // Objects and Interfaces both must define one or more fields.
  if (fieldNames.length === 0) {
    context.reportError('Type ' + type.name + ' must define one or more fields.', getAllObjectOrInterfaceNodes(type));
  }

  fieldNames.forEach(function (fieldName) {
    var field = fieldMap[fieldName];

    // Ensure they are named correctly.
    validateName(context, field);

    // Ensure they were defined at most once.
    var fieldNodes = getAllFieldNodes(type, fieldName);
    if (fieldNodes.length > 1) {
      context.reportError('Field ' + type.name + '.' + fieldName + ' can only be defined once.', fieldNodes);
      return; // continue loop
    }

    // Ensure the type is an output type
    if (!(0, _definition.isOutputType)(field.type)) {
      context.reportError('The type of ' + type.name + '.' + fieldName + ' must be Output Type ' + ('but got: ' + String(field.type) + '.'), getFieldTypeNode(type, fieldName));
    }

    // Ensure the arguments are valid
    var argNames = Object.create(null);
    field.args.forEach(function (arg) {
      var argName = arg.name;

      // Ensure they are named correctly.
      validateName(context, arg);

      // Ensure they are unique per field.
      if (argNames[argName]) {
        context.reportError('Field argument ' + type.name + '.' + fieldName + '(' + argName + ':) can only ' + 'be defined once.', getAllFieldArgNodes(type, fieldName, argName));
      }
      argNames[argName] = true;

      // Ensure the type is an input type
      if (!(0, _definition.isInputType)(arg.type)) {
        context.reportError('The type of ' + type.name + '.' + fieldName + '(' + argName + ':) must be Input ' + ('Type but got: ' + String(arg.type) + '.'), getFieldArgTypeNode(type, fieldName, argName));
      }
    });
  });
}

function validateObjectInterfaces(context, object) {
  var implementedTypeNames = Object.create(null);
  object.getInterfaces().forEach(function (iface) {
    if (implementedTypeNames[iface.name]) {
      context.reportError('Type ' + object.name + ' can only implement ' + iface.name + ' once.', getAllImplementsInterfaceNodes(object, iface));
      return; // continue loop
    }
    implementedTypeNames[iface.name] = true;
    validateObjectImplementsInterface(context, object, iface);
  });
}

function validateObjectImplementsInterface(context, object, iface) {
  if (!(0, _definition.isInterfaceType)(iface)) {
    context.reportError('Type ' + String(object) + ' must only implement Interface types, ' + ('it cannot implement ' + String(iface) + '.'), getImplementsInterfaceNode(object, iface));
    return;
  }

  var objectFieldMap = object.getFields();
  var ifaceFieldMap = iface.getFields();

  // Assert each interface field is implemented.
  Object.keys(ifaceFieldMap).forEach(function (fieldName) {
    var objectField = objectFieldMap[fieldName];
    var ifaceField = ifaceFieldMap[fieldName];

    // Assert interface field exists on object.
    if (!objectField) {
      context.reportError('Interface field ' + iface.name + '.' + fieldName + ' expected but ' + (object.name + ' does not provide it.'), [getFieldNode(iface, fieldName), object.astNode]);
      // Continue loop over fields.
      return;
    }

    // Assert interface field type is satisfied by object field type, by being
    // a valid subtype. (covariant)
    if (!(0, _typeComparators.isTypeSubTypeOf)(context.schema, objectField.type, ifaceField.type)) {
      context.reportError('Interface field ' + iface.name + '.' + fieldName + ' expects type ' + (String(ifaceField.type) + ' but ' + object.name + '.' + fieldName + ' ') + ('is type ' + String(objectField.type) + '.'), [getFieldTypeNode(iface, fieldName), getFieldTypeNode(object, fieldName)]);
    }

    // Assert each interface field arg is implemented.
    ifaceField.args.forEach(function (ifaceArg) {
      var argName = ifaceArg.name;
      var objectArg = (0, _find2.default)(objectField.args, function (arg) {
        return arg.name === argName;
      });

      // Assert interface field arg exists on object field.
      if (!objectArg) {
        context.reportError('Interface field argument ' + iface.name + '.' + fieldName + '(' + argName + ':) ' + ('expected but ' + object.name + '.' + fieldName + ' does not provide it.'), [getFieldArgNode(iface, fieldName, argName), getFieldNode(object, fieldName)]);
        // Continue loop over arguments.
        return;
      }

      // Assert interface field arg type matches object field arg type.
      // (invariant)
      // TODO: change to contravariant?
      if (!(0, _typeComparators.isEqualType)(ifaceArg.type, objectArg.type)) {
        context.reportError('Interface field argument ' + iface.name + '.' + fieldName + '(' + argName + ':) ' + ('expects type ' + String(ifaceArg.type) + ' but ') + (object.name + '.' + fieldName + '(' + argName + ':) is type ') + (String(objectArg.type) + '.'), [getFieldArgTypeNode(iface, fieldName, argName), getFieldArgTypeNode(object, fieldName, argName)]);
      }

      // TODO: validate default values?
    });

    // Assert additional arguments must not be required.
    objectField.args.forEach(function (objectArg) {
      var argName = objectArg.name;
      var ifaceArg = (0, _find2.default)(ifaceField.args, function (arg) {
        return arg.name === argName;
      });
      if (!ifaceArg && (0, _definition.isNonNullType)(objectArg.type)) {
        context.reportError('Object field argument ' + object.name + '.' + fieldName + '(' + argName + ':) ' + ('is of required type ' + String(objectArg.type) + ' but is not also ') + ('provided by the Interface field ' + iface.name + '.' + fieldName + '.'), [getFieldArgTypeNode(object, fieldName, argName), getFieldNode(iface, fieldName)]);
      }
    });
  });
}

function validateUnionMembers(context, union) {
  var memberTypes = union.getTypes();

  if (memberTypes.length === 0) {
    context.reportError('Union type ' + union.name + ' must define one or more member types.', union.astNode);
  }

  var includedTypeNames = Object.create(null);
  memberTypes.forEach(function (memberType) {
    if (includedTypeNames[memberType.name]) {
      context.reportError('Union type ' + union.name + ' can only include type ' + (memberType.name + ' once.'), getUnionMemberTypeNodes(union, memberType.name));
      return; // continue loop
    }
    includedTypeNames[memberType.name] = true;
    if (!(0, _definition.isObjectType)(memberType)) {
      context.reportError('Union type ' + union.name + ' can only include Object types, ' + ('it cannot include ' + String(memberType) + '.'), getUnionMemberTypeNodes(union, String(memberType)));
    }
  });
}

function validateEnumValues(context, enumType) {
  var enumValues = enumType.getValues();

  if (enumValues.length === 0) {
    context.reportError('Enum type ' + enumType.name + ' must define one or more values.', enumType.astNode);
  }

  enumValues.forEach(function (enumValue) {
    var valueName = enumValue.name;

    // Ensure no duplicates.
    var allNodes = getEnumValueNodes(enumType, valueName);
    if (allNodes && allNodes.length > 1) {
      context.reportError('Enum type ' + enumType.name + ' can include value ' + valueName + ' only once.', allNodes);
    }

    // Ensure valid name.
    validateName(context, enumValue);
    if (valueName === 'true' || valueName === 'false' || valueName === 'null') {
      context.reportError('Enum type ' + enumType.name + ' cannot include value: ' + valueName + '.', enumValue.astNode);
    }
  });
}

function validateInputFields(context, inputObj) {
  var fieldMap = inputObj.getFields();
  var fieldNames = Object.keys(fieldMap);

  if (fieldNames.length === 0) {
    context.reportError('Input Object type ' + inputObj.name + ' must define one or more fields.', inputObj.astNode);
  }

  // Ensure the arguments are valid
  fieldNames.forEach(function (fieldName) {
    var field = fieldMap[fieldName];

    // Ensure they are named correctly.
    validateName(context, field);

    // TODO: Ensure they are unique per field.

    // Ensure the type is an input type
    if (!(0, _definition.isInputType)(field.type)) {
      context.reportError('The type of ' + inputObj.name + '.' + fieldName + ' must be Input Type ' + ('but got: ' + String(field.type) + '.'), field.astNode && field.astNode.type);
    }
  });
}

function getAllObjectNodes(type) {
  return type.astNode ? type.extensionASTNodes ? [type.astNode].concat(type.extensionASTNodes) : [type.astNode] : type.extensionASTNodes || [];
}

function getAllObjectOrInterfaceNodes(type) {
  return type.astNode ? type.extensionASTNodes ? [type.astNode].concat(type.extensionASTNodes) : [type.astNode] : type.extensionASTNodes || [];
}

function getImplementsInterfaceNode(type, iface) {
  return getAllImplementsInterfaceNodes(type, iface)[0];
}

function getAllImplementsInterfaceNodes(type, iface) {
  var implementsNodes = [];
  var astNodes = getAllObjectNodes(type);
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
  var astNodes = getAllObjectOrInterfaceNodes(type);
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