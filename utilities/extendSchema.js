"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.extendSchema = extendSchema;

var _invariant = _interopRequireDefault(require("../jsutils/invariant"));

var _keyMap = _interopRequireDefault(require("../jsutils/keyMap"));

var _keyValMap = _interopRequireDefault(require("../jsutils/keyValMap"));

var _objectValues = _interopRequireDefault(require("../jsutils/objectValues"));

var _buildASTSchema = require("./buildASTSchema");

var _validate = require("../validation/validate");

var _GraphQLError = require("../error/GraphQLError");

var _schema = require("../type/schema");

var _introspection = require("../type/introspection");

var _scalars = require("../type/scalars");

var _definition = require("../type/definition");

var _directives = require("../type/directives");

var _kinds = require("../language/kinds");

var _predicates = require("../language/predicates");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i] != null ? arguments[i] : {}; var ownKeys = Object.keys(source); if (typeof Object.getOwnPropertySymbols === 'function') { ownKeys = ownKeys.concat(Object.getOwnPropertySymbols(source).filter(function (sym) { return Object.getOwnPropertyDescriptor(source, sym).enumerable; })); } ownKeys.forEach(function (key) { _defineProperty(target, key, source[key]); }); } return target; }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

/**
 * Produces a new schema given an existing schema and a document which may
 * contain GraphQL type extensions and definitions. The original schema will
 * remain unaltered.
 *
 * Because a schema represents a graph of references, a schema cannot be
 * extended without effectively making an entire copy. We do not know until it's
 * too late if subgraphs remain unchanged.
 *
 * This algorithm copies the provided schema, applying extensions while
 * producing the copy. The original schema remains unaltered.
 *
 * Accepts options as a third argument:
 *
 *    - commentDescriptions:
 *        Provide true to use preceding comments as the description.
 *
 */
function extendSchema(schema, documentAST, options) {
  !(0, _schema.isSchema)(schema) ? (0, _invariant.default)(0, 'Must provide valid GraphQLSchema') : void 0;
  !(documentAST && documentAST.kind === _kinds.Kind.DOCUMENT) ? (0, _invariant.default)(0, 'Must provide valid Document AST') : void 0;

  if (!options || !(options.assumeValid || options.assumeValidSDL)) {
    (0, _validate.assertValidSDLExtension)(documentAST, schema);
  } // Collect the type definitions and extensions found in the document.


  var typeDefinitionMap = Object.create(null);
  var typeExtensionsMap = Object.create(null); // New directives and types are separate because a directives and types can
  // have the same name. For example, a type named "skip".

  var directiveDefinitions = [];
  var schemaDef; // Schema extensions are collected which may add additional operation types.

  var schemaExtensions = [];

  for (var i = 0; i < documentAST.definitions.length; i++) {
    var def = documentAST.definitions[i];

    if (def.kind === _kinds.Kind.SCHEMA_DEFINITION) {
      schemaDef = def;
    } else if (def.kind === _kinds.Kind.SCHEMA_EXTENSION) {
      schemaExtensions.push(def);
    } else if ((0, _predicates.isTypeDefinitionNode)(def)) {
      // Sanity check that none of the defined types conflict with the
      // schema's existing types.
      var typeName = def.name.value;

      if (schema.getType(typeName)) {
        throw new _GraphQLError.GraphQLError("Type \"".concat(typeName, "\" already exists in the schema. It cannot also ") + 'be defined in this type definition.', [def]);
      }

      typeDefinitionMap[typeName] = def;
    } else if ((0, _predicates.isTypeExtensionNode)(def)) {
      // Sanity check that this type extension exists within the
      // schema's existing types.
      var extendedTypeName = def.name.value;
      var existingType = schema.getType(extendedTypeName);

      if (!existingType) {
        throw new _GraphQLError.GraphQLError("Cannot extend type \"".concat(extendedTypeName, "\" because it does not ") + 'exist in the existing schema.', [def]);
      }

      checkExtensionNode(existingType, def);
      var existingTypeExtensions = typeExtensionsMap[extendedTypeName];
      typeExtensionsMap[extendedTypeName] = existingTypeExtensions ? existingTypeExtensions.concat([def]) : [def];
    } else if (def.kind === _kinds.Kind.DIRECTIVE_DEFINITION) {
      var directiveName = def.name.value;
      var existingDirective = schema.getDirective(directiveName);

      if (existingDirective) {
        throw new _GraphQLError.GraphQLError("Directive \"".concat(directiveName, "\" already exists in the schema. It ") + 'cannot be redefined.', [def]);
      }

      directiveDefinitions.push(def);
    }
  } // If this document contains no new types, extensions, or directives then
  // return the same unmodified GraphQLSchema instance.


  if (Object.keys(typeExtensionsMap).length === 0 && Object.keys(typeDefinitionMap).length === 0 && directiveDefinitions.length === 0 && schemaExtensions.length === 0 && !schemaDef) {
    return schema;
  }

  var astBuilder = new _buildASTSchema.ASTDefinitionBuilder(typeDefinitionMap, options, function (typeRef) {
    var typeName = typeRef.name.value;
    var existingType = schema.getType(typeName);

    if (existingType) {
      return extendNamedType(existingType);
    }

    throw new _GraphQLError.GraphQLError("Unknown type: \"".concat(typeName, "\". Ensure that this type exists ") + 'either in the original schema, or is added in a type definition.', [typeRef]);
  });
  var extendTypeCache = Object.create(null); // Get the extended root operation types.

  var operationTypes = {
    query: extendMaybeNamedType(schema.getQueryType()),
    mutation: extendMaybeNamedType(schema.getMutationType()),
    subscription: extendMaybeNamedType(schema.getSubscriptionType())
  };

  if (schemaDef) {
    var _iteratorNormalCompletion = true;
    var _didIteratorError = false;
    var _iteratorError = undefined;

    try {
      for (var _iterator = schemaDef.operationTypes[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
        var _ref2 = _step.value;
        var operation = _ref2.operation,
            type = _ref2.type;

        if (operationTypes[operation]) {
          throw new Error("Must provide only one ".concat(operation, " type in schema."));
        } // Note: While this could make early assertions to get the correctly
        // typed values, that would throw immediately while type system
        // validation with validateSchema() will produce more actionable results.


        operationTypes[operation] = astBuilder.buildType(type);
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
  } // Then, incorporate schema definition and all schema extensions.


  for (var _i = 0; _i < schemaExtensions.length; _i++) {
    var schemaExtension = schemaExtensions[_i];

    if (schemaExtension.operationTypes) {
      var _iteratorNormalCompletion12 = true;
      var _didIteratorError12 = false;
      var _iteratorError12 = undefined;

      try {
        for (var _iterator12 = schemaExtension.operationTypes[Symbol.iterator](), _step12; !(_iteratorNormalCompletion12 = (_step12 = _iterator12.next()).done); _iteratorNormalCompletion12 = true) {
          var _ref4 = _step12.value;
          var operation = _ref4.operation,
              type = _ref4.type;

          if (operationTypes[operation]) {
            throw new Error("Must provide only one ".concat(operation, " type in schema."));
          } // Note: While this could make early assertions to get the correctly
          // typed values, that would throw immediately while type system
          // validation with validateSchema() will produce more actionable results.


          operationTypes[operation] = astBuilder.buildType(type);
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
    }
  }

  var schemaExtensionASTNodes = schemaExtensions ? schema.extensionASTNodes ? schema.extensionASTNodes.concat(schemaExtensions) : schemaExtensions : schema.extensionASTNodes;
  var types = (0, _objectValues.default)(schema.getTypeMap()).map(function (type) {
    return extendNamedType(type);
  }).concat((0, _objectValues.default)(typeDefinitionMap).map(function (type) {
    return astBuilder.buildType(type);
  })); // Support both original legacy names and extended legacy names.

  var allowedLegacyNames = schema.__allowedLegacyNames.concat(options && options.allowedLegacyNames || []); // Then produce and return a Schema with these types.


  return new _schema.GraphQLSchema(_objectSpread({}, operationTypes, {
    types: types,
    directives: getMergedDirectives(),
    astNode: schema.astNode,
    extensionASTNodes: schemaExtensionASTNodes,
    allowedLegacyNames: allowedLegacyNames
  })); // Below are functions used for producing this schema that have closed over
  // this scope and have access to the schema, cache, and newly defined types.

  function getMergedDirectives() {
    var existingDirectives = schema.getDirectives().map(extendDirective);
    !existingDirectives ? (0, _invariant.default)(0, 'schema must have default directives') : void 0;
    return existingDirectives.concat(directiveDefinitions.map(function (node) {
      return astBuilder.buildDirective(node);
    }));
  }

  function extendMaybeNamedType(type) {
    return type ? extendNamedType(type) : null;
  }

  function extendNamedType(type) {
    if ((0, _introspection.isIntrospectionType)(type) || (0, _scalars.isSpecifiedScalarType)(type)) {
      // Builtin types are not extended.
      return type;
    }

    var name = type.name;

    if (!extendTypeCache[name]) {
      if ((0, _definition.isScalarType)(type)) {
        extendTypeCache[name] = extendScalarType(type);
      } else if ((0, _definition.isObjectType)(type)) {
        extendTypeCache[name] = extendObjectType(type);
      } else if ((0, _definition.isInterfaceType)(type)) {
        extendTypeCache[name] = extendInterfaceType(type);
      } else if ((0, _definition.isUnionType)(type)) {
        extendTypeCache[name] = extendUnionType(type);
      } else if ((0, _definition.isEnumType)(type)) {
        extendTypeCache[name] = extendEnumType(type);
      } else if ((0, _definition.isInputObjectType)(type)) {
        extendTypeCache[name] = extendInputObjectType(type);
      }
    }

    return extendTypeCache[name];
  }

  function extendDirective(directive) {
    return new _directives.GraphQLDirective({
      name: directive.name,
      description: directive.description,
      locations: directive.locations,
      args: extendArgs(directive.args),
      astNode: directive.astNode
    });
  }

  function extendInputObjectType(type) {
    var name = type.name;
    var extensionASTNodes = typeExtensionsMap[name] ? type.extensionASTNodes ? type.extensionASTNodes.concat(typeExtensionsMap[name]) : typeExtensionsMap[name] : type.extensionASTNodes;
    return new _definition.GraphQLInputObjectType({
      name: name,
      description: type.description,
      fields: function fields() {
        return extendInputFieldMap(type);
      },
      astNode: type.astNode,
      extensionASTNodes: extensionASTNodes
    });
  }

  function extendInputFieldMap(type) {
    var newFieldMap = Object.create(null);
    var oldFieldMap = type.getFields();

    var _arr = Object.keys(oldFieldMap);

    for (var _i2 = 0; _i2 < _arr.length; _i2++) {
      var _fieldName = _arr[_i2];
      var _field = oldFieldMap[_fieldName];
      newFieldMap[_fieldName] = {
        description: _field.description,
        type: extendType(_field.type),
        defaultValue: _field.defaultValue,
        astNode: _field.astNode
      };
    } // If there are any extensions to the fields, apply those here.


    var extensions = typeExtensionsMap[type.name];

    if (extensions) {
      var _iteratorNormalCompletion2 = true;
      var _didIteratorError2 = false;
      var _iteratorError2 = undefined;

      try {
        for (var _iterator2 = extensions[Symbol.iterator](), _step2; !(_iteratorNormalCompletion2 = (_step2 = _iterator2.next()).done); _iteratorNormalCompletion2 = true) {
          var extension = _step2.value;
          var _iteratorNormalCompletion3 = true;
          var _didIteratorError3 = false;
          var _iteratorError3 = undefined;

          try {
            for (var _iterator3 = extension.fields[Symbol.iterator](), _step3; !(_iteratorNormalCompletion3 = (_step3 = _iterator3.next()).done); _iteratorNormalCompletion3 = true) {
              var field = _step3.value;
              var fieldName = field.name.value;

              if (oldFieldMap[fieldName]) {
                throw new _GraphQLError.GraphQLError("Field \"".concat(type.name, ".").concat(fieldName, "\" already exists in the ") + 'schema. It cannot also be defined in this type extension.', [field]);
              }

              newFieldMap[fieldName] = astBuilder.buildInputField(field);
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

    return newFieldMap;
  }

  function extendEnumType(type) {
    var name = type.name;
    var extensionASTNodes = typeExtensionsMap[name] ? type.extensionASTNodes ? type.extensionASTNodes.concat(typeExtensionsMap[name]) : typeExtensionsMap[name] : type.extensionASTNodes;
    return new _definition.GraphQLEnumType({
      name: name,
      description: type.description,
      values: extendValueMap(type),
      astNode: type.astNode,
      extensionASTNodes: extensionASTNodes
    });
  }

  function extendValueMap(type) {
    var newValueMap = Object.create(null);
    var oldValueMap = (0, _keyMap.default)(type.getValues(), function (value) {
      return value.name;
    });

    var _arr2 = Object.keys(oldValueMap);

    for (var _i3 = 0; _i3 < _arr2.length; _i3++) {
      var _valueName = _arr2[_i3];
      var _value = oldValueMap[_valueName];
      newValueMap[_valueName] = {
        name: _value.name,
        description: _value.description,
        value: _value.value,
        deprecationReason: _value.deprecationReason,
        astNode: _value.astNode
      };
    } // If there are any extensions to the values, apply those here.


    var extensions = typeExtensionsMap[type.name];

    if (extensions) {
      var _iteratorNormalCompletion4 = true;
      var _didIteratorError4 = false;
      var _iteratorError4 = undefined;

      try {
        for (var _iterator4 = extensions[Symbol.iterator](), _step4; !(_iteratorNormalCompletion4 = (_step4 = _iterator4.next()).done); _iteratorNormalCompletion4 = true) {
          var extension = _step4.value;
          var _iteratorNormalCompletion5 = true;
          var _didIteratorError5 = false;
          var _iteratorError5 = undefined;

          try {
            for (var _iterator5 = extension.values[Symbol.iterator](), _step5; !(_iteratorNormalCompletion5 = (_step5 = _iterator5.next()).done); _iteratorNormalCompletion5 = true) {
              var value = _step5.value;
              var valueName = value.name.value;

              if (oldValueMap[valueName]) {
                throw new _GraphQLError.GraphQLError("Enum value \"".concat(type.name, ".").concat(valueName, "\" already exists in the ") + 'schema. It cannot also be defined in this type extension.', [value]);
              }

              newValueMap[valueName] = astBuilder.buildEnumValue(value);
            }
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

    return newValueMap;
  }

  function extendScalarType(type) {
    var name = type.name;
    var extensionASTNodes = typeExtensionsMap[name] ? type.extensionASTNodes ? type.extensionASTNodes.concat(typeExtensionsMap[name]) : typeExtensionsMap[name] : type.extensionASTNodes;
    return new _definition.GraphQLScalarType({
      name: name,
      description: type.description,
      astNode: type.astNode,
      extensionASTNodes: extensionASTNodes,
      serialize: type.serialize,
      parseValue: type.parseValue,
      parseLiteral: type.parseLiteral
    });
  }

  function extendObjectType(type) {
    var name = type.name;
    var extensionASTNodes = typeExtensionsMap[name] ? type.extensionASTNodes ? type.extensionASTNodes.concat(typeExtensionsMap[name]) : typeExtensionsMap[name] : type.extensionASTNodes;
    return new _definition.GraphQLObjectType({
      name: name,
      description: type.description,
      interfaces: function interfaces() {
        return extendImplementedInterfaces(type);
      },
      fields: function fields() {
        return extendFieldMap(type);
      },
      astNode: type.astNode,
      extensionASTNodes: extensionASTNodes,
      isTypeOf: type.isTypeOf
    });
  }

  function extendArgs(args) {
    return (0, _keyValMap.default)(args, function (arg) {
      return arg.name;
    }, function (arg) {
      return {
        type: extendType(arg.type),
        defaultValue: arg.defaultValue,
        description: arg.description,
        astNode: arg.astNode
      };
    });
  }

  function extendInterfaceType(type) {
    var name = type.name;
    var extensionASTNodes = typeExtensionsMap[name] ? type.extensionASTNodes ? type.extensionASTNodes.concat(typeExtensionsMap[name]) : typeExtensionsMap[name] : type.extensionASTNodes;
    return new _definition.GraphQLInterfaceType({
      name: type.name,
      description: type.description,
      fields: function fields() {
        return extendFieldMap(type);
      },
      astNode: type.astNode,
      extensionASTNodes: extensionASTNodes,
      resolveType: type.resolveType
    });
  }

  function extendUnionType(type) {
    var name = type.name;
    var extensionASTNodes = typeExtensionsMap[name] ? type.extensionASTNodes ? type.extensionASTNodes.concat(typeExtensionsMap[name]) : typeExtensionsMap[name] : type.extensionASTNodes;
    return new _definition.GraphQLUnionType({
      name: name,
      description: type.description,
      types: function types() {
        return extendPossibleTypes(type);
      },
      astNode: type.astNode,
      resolveType: type.resolveType,
      extensionASTNodes: extensionASTNodes
    });
  }

  function extendPossibleTypes(type) {
    var possibleTypes = type.getTypes().map(extendNamedType); // If there are any extensions to the union, apply those here.

    var extensions = typeExtensionsMap[type.name];

    if (extensions) {
      var _iteratorNormalCompletion6 = true;
      var _didIteratorError6 = false;
      var _iteratorError6 = undefined;

      try {
        for (var _iterator6 = extensions[Symbol.iterator](), _step6; !(_iteratorNormalCompletion6 = (_step6 = _iterator6.next()).done); _iteratorNormalCompletion6 = true) {
          var extension = _step6.value;
          var _iteratorNormalCompletion7 = true;
          var _didIteratorError7 = false;
          var _iteratorError7 = undefined;

          try {
            for (var _iterator7 = extension.types[Symbol.iterator](), _step7; !(_iteratorNormalCompletion7 = (_step7 = _iterator7.next()).done); _iteratorNormalCompletion7 = true) {
              var namedType = _step7.value;
              // Note: While this could make early assertions to get the correctly
              // typed values, that would throw immediately while type system
              // validation with validateSchema() will produce more actionable results.
              possibleTypes.push(astBuilder.buildType(namedType));
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

    return possibleTypes;
  }

  function extendImplementedInterfaces(type) {
    var interfaces = type.getInterfaces().map(extendNamedType); // If there are any extensions to the interfaces, apply those here.

    var extensions = typeExtensionsMap[type.name];

    if (extensions) {
      var _iteratorNormalCompletion8 = true;
      var _didIteratorError8 = false;
      var _iteratorError8 = undefined;

      try {
        for (var _iterator8 = extensions[Symbol.iterator](), _step8; !(_iteratorNormalCompletion8 = (_step8 = _iterator8.next()).done); _iteratorNormalCompletion8 = true) {
          var extension = _step8.value;
          var _iteratorNormalCompletion9 = true;
          var _didIteratorError9 = false;
          var _iteratorError9 = undefined;

          try {
            for (var _iterator9 = extension.interfaces[Symbol.iterator](), _step9; !(_iteratorNormalCompletion9 = (_step9 = _iterator9.next()).done); _iteratorNormalCompletion9 = true) {
              var namedType = _step9.value;
              // Note: While this could make early assertions to get the correctly
              // typed values, that would throw immediately while type system
              // validation with validateSchema() will produce more actionable results.
              interfaces.push(astBuilder.buildType(namedType));
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

    return interfaces;
  }

  function extendFieldMap(type) {
    var newFieldMap = Object.create(null);
    var oldFieldMap = type.getFields();

    var _arr3 = Object.keys(oldFieldMap);

    for (var _i4 = 0; _i4 < _arr3.length; _i4++) {
      var _fieldName2 = _arr3[_i4];
      var _field2 = oldFieldMap[_fieldName2];
      newFieldMap[_fieldName2] = {
        description: _field2.description,
        deprecationReason: _field2.deprecationReason,
        type: extendType(_field2.type),
        args: extendArgs(_field2.args),
        astNode: _field2.astNode,
        resolve: _field2.resolve
      };
    } // If there are any extensions to the fields, apply those here.


    var extensions = typeExtensionsMap[type.name];

    if (extensions) {
      var _iteratorNormalCompletion10 = true;
      var _didIteratorError10 = false;
      var _iteratorError10 = undefined;

      try {
        for (var _iterator10 = extensions[Symbol.iterator](), _step10; !(_iteratorNormalCompletion10 = (_step10 = _iterator10.next()).done); _iteratorNormalCompletion10 = true) {
          var extension = _step10.value;
          var _iteratorNormalCompletion11 = true;
          var _didIteratorError11 = false;
          var _iteratorError11 = undefined;

          try {
            for (var _iterator11 = extension.fields[Symbol.iterator](), _step11; !(_iteratorNormalCompletion11 = (_step11 = _iterator11.next()).done); _iteratorNormalCompletion11 = true) {
              var field = _step11.value;
              var fieldName = field.name.value;

              if (oldFieldMap[fieldName]) {
                throw new _GraphQLError.GraphQLError("Field \"".concat(type.name, ".").concat(fieldName, "\" already exists in the ") + 'schema. It cannot also be defined in this type extension.', [field]);
              }

              newFieldMap[fieldName] = astBuilder.buildField(field);
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
    }

    return newFieldMap;
  }

  function extendType(typeDef) {
    if ((0, _definition.isListType)(typeDef)) {
      return (0, _definition.GraphQLList)(extendType(typeDef.ofType));
    }

    if ((0, _definition.isNonNullType)(typeDef)) {
      return (0, _definition.GraphQLNonNull)(extendType(typeDef.ofType));
    }

    return extendNamedType(typeDef);
  }
}

function checkExtensionNode(type, node) {
  switch (node.kind) {
    case _kinds.Kind.OBJECT_TYPE_EXTENSION:
      if (!(0, _definition.isObjectType)(type)) {
        throw new _GraphQLError.GraphQLError("Cannot extend non-object type \"".concat(type.name, "\"."), [node]);
      }

      break;

    case _kinds.Kind.INTERFACE_TYPE_EXTENSION:
      if (!(0, _definition.isInterfaceType)(type)) {
        throw new _GraphQLError.GraphQLError("Cannot extend non-interface type \"".concat(type.name, "\"."), [node]);
      }

      break;

    case _kinds.Kind.ENUM_TYPE_EXTENSION:
      if (!(0, _definition.isEnumType)(type)) {
        throw new _GraphQLError.GraphQLError("Cannot extend non-enum type \"".concat(type.name, "\"."), [node]);
      }

      break;

    case _kinds.Kind.UNION_TYPE_EXTENSION:
      if (!(0, _definition.isUnionType)(type)) {
        throw new _GraphQLError.GraphQLError("Cannot extend non-union type \"".concat(type.name, "\"."), [node]);
      }

      break;

    case _kinds.Kind.INPUT_OBJECT_TYPE_EXTENSION:
      if (!(0, _definition.isInputObjectType)(type)) {
        throw new _GraphQLError.GraphQLError("Cannot extend non-input object type \"".concat(type.name, "\"."), [node]);
      }

      break;
  }
}