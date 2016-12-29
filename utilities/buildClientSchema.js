'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.buildClientSchema = buildClientSchema;

var _invariant = require('../jsutils/invariant');

var _invariant2 = _interopRequireDefault(_invariant);

var _keyMap = require('../jsutils/keyMap');

var _keyMap2 = _interopRequireDefault(_keyMap);

var _keyValMap = require('../jsutils/keyValMap');

var _keyValMap2 = _interopRequireDefault(_keyValMap);

var _valueFromAST = require('./valueFromAST');

var _parser = require('../language/parser');

var _schema = require('../type/schema');

var _definition = require('../type/definition');

var _introspection = require('../type/introspection');

var _scalars = require('../type/scalars');

var _directives = require('../type/directives');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/**
 * Build a GraphQLSchema for use by client tools.
 *
 * Given the result of a client running the introspection query, creates and
 * returns a GraphQLSchema instance which can be then used with all graphql-js
 * tools, but cannot be used to execute a query, as introspection does not
 * represent the "resolver", "parse" or "serialize" functions or any other
 * server-internal mechanisms.
 */
function buildClientSchema(introspection) {

  // Get the schema from the introspection result.
  var schemaIntrospection = introspection.__schema;

  // Converts the list of types into a keyMap based on the type names.
  var typeIntrospectionMap = (0, _keyMap2.default)(schemaIntrospection.types, function (type) {
    return type.name;
  });

  // A cache to use to store the actual GraphQLType definition objects by name.
  // Initialize to the GraphQL built in scalars. All functions below are inline
  // so that this type def cache is within the scope of the closure.
  var typeDefCache = {
    String: _scalars.GraphQLString,
    Int: _scalars.GraphQLInt,
    Float: _scalars.GraphQLFloat,
    Boolean: _scalars.GraphQLBoolean,
    ID: _scalars.GraphQLID,
    __Schema: _introspection.__Schema,
    __Directive: _introspection.__Directive,
    __DirectiveLocation: _introspection.__DirectiveLocation,
    __Type: _introspection.__Type,
    __Field: _introspection.__Field,
    __InputValue: _introspection.__InputValue,
    __EnumValue: _introspection.__EnumValue,
    __TypeKind: _introspection.__TypeKind
  };

  // Given a type reference in introspection, return the GraphQLType instance.
  // preferring cached instances before building new instances.
  function getType(typeRef) {
    if (typeRef.kind === _introspection.TypeKind.LIST) {
      var itemRef = typeRef.ofType;
      if (!itemRef) {
        throw new Error('Decorated type deeper than introspection query.');
      }
      return new _definition.GraphQLList(getType(itemRef));
    }
    if (typeRef.kind === _introspection.TypeKind.NON_NULL) {
      var nullableRef = typeRef.ofType;
      if (!nullableRef) {
        throw new Error('Decorated type deeper than introspection query.');
      }
      var nullableType = getType(nullableRef);
      (0, _invariant2.default)(!(nullableType instanceof _definition.GraphQLNonNull), 'No nesting nonnull.');
      return new _definition.GraphQLNonNull(nullableType);
    }
    return getNamedType(typeRef.name);
  }

  function getNamedType(typeName) {
    if (typeDefCache[typeName]) {
      return typeDefCache[typeName];
    }
    var typeIntrospection = typeIntrospectionMap[typeName];
    if (!typeIntrospection) {
      throw new Error('Invalid or incomplete schema, unknown type: ' + typeName + '. Ensure ' + 'that a full introspection query is used in order to build a ' + 'client schema.');
    }
    var typeDef = buildType(typeIntrospection);
    typeDefCache[typeName] = typeDef;
    return typeDef;
  }

  function getInputType(typeRef) {
    var type = getType(typeRef);
    (0, _invariant2.default)((0, _definition.isInputType)(type), 'Introspection must provide input type for arguments.');
    return type;
  }

  function getOutputType(typeRef) {
    var type = getType(typeRef);
    (0, _invariant2.default)((0, _definition.isOutputType)(type), 'Introspection must provide output type for fields.');
    return type;
  }

  function getObjectType(typeRef) {
    var type = getType(typeRef);
    (0, _invariant2.default)(type instanceof _definition.GraphQLObjectType, 'Introspection must provide object type for possibleTypes.');
    return type;
  }

  function getInterfaceType(typeRef) {
    var type = getType(typeRef);
    (0, _invariant2.default)(type instanceof _definition.GraphQLInterfaceType, 'Introspection must provide interface type for interfaces.');
    return type;
  }

  // Given a type's introspection result, construct the correct
  // GraphQLType instance.
  function buildType(type) {
    switch (type.kind) {
      case _introspection.TypeKind.SCALAR:
        return buildScalarDef(type);
      case _introspection.TypeKind.OBJECT:
        return buildObjectDef(type);
      case _introspection.TypeKind.INTERFACE:
        return buildInterfaceDef(type);
      case _introspection.TypeKind.UNION:
        return buildUnionDef(type);
      case _introspection.TypeKind.ENUM:
        return buildEnumDef(type);
      case _introspection.TypeKind.INPUT_OBJECT:
        return buildInputObjectDef(type);
      default:
        throw new Error('Invalid or incomplete schema, unknown kind: ' + type.kind + '. Ensure ' + 'that a full introspection query is used in order to build a ' + 'client schema.');
    }
  }

  function buildScalarDef(scalarIntrospection) {
    return new _definition.GraphQLScalarType({
      name: scalarIntrospection.name,
      description: scalarIntrospection.description,
      serialize: function serialize(id) {
        return id;
      },
      // Note: validation calls the parse functions to determine if a
      // literal value is correct. Returning null would cause use of custom
      // scalars to always fail validation. Returning false causes them to
      // always pass validation.
      parseValue: function parseValue() {
        return false;
      },
      parseLiteral: function parseLiteral() {
        return false;
      }
    });
  }

  function buildObjectDef(objectIntrospection) {
    return new _definition.GraphQLObjectType({
      name: objectIntrospection.name,
      description: objectIntrospection.description,
      interfaces: objectIntrospection.interfaces.map(getInterfaceType),
      fields: function fields() {
        return buildFieldDefMap(objectIntrospection);
      }
    });
  }

  function buildInterfaceDef(interfaceIntrospection) {
    return new _definition.GraphQLInterfaceType({
      name: interfaceIntrospection.name,
      description: interfaceIntrospection.description,
      fields: function fields() {
        return buildFieldDefMap(interfaceIntrospection);
      },
      resolveType: cannotExecuteClientSchema
    });
  }

  function buildUnionDef(unionIntrospection) {
    return new _definition.GraphQLUnionType({
      name: unionIntrospection.name,
      description: unionIntrospection.description,
      types: unionIntrospection.possibleTypes.map(getObjectType),
      resolveType: cannotExecuteClientSchema
    });
  }

  function buildEnumDef(enumIntrospection) {
    return new _definition.GraphQLEnumType({
      name: enumIntrospection.name,
      description: enumIntrospection.description,
      values: (0, _keyValMap2.default)(enumIntrospection.enumValues, function (valueIntrospection) {
        return valueIntrospection.name;
      }, function (valueIntrospection) {
        return {
          description: valueIntrospection.description,
          deprecationReason: valueIntrospection.deprecationReason
        };
      })
    });
  }

  function buildInputObjectDef(inputObjectIntrospection) {
    return new _definition.GraphQLInputObjectType({
      name: inputObjectIntrospection.name,
      description: inputObjectIntrospection.description,
      fields: function fields() {
        return buildInputValueDefMap(inputObjectIntrospection.inputFields);
      }
    });
  }

  function buildFieldDefMap(typeIntrospection) {
    return (0, _keyValMap2.default)(typeIntrospection.fields, function (fieldIntrospection) {
      return fieldIntrospection.name;
    }, function (fieldIntrospection) {
      return {
        description: fieldIntrospection.description,
        deprecationReason: fieldIntrospection.deprecationReason,
        type: getOutputType(fieldIntrospection.type),
        args: buildInputValueDefMap(fieldIntrospection.args)
      };
    });
  }

  function buildInputValueDefMap(inputValueIntrospections) {
    return (0, _keyValMap2.default)(inputValueIntrospections, function (inputValue) {
      return inputValue.name;
    }, buildInputValue);
  }

  function buildInputValue(inputValueIntrospection) {
    var type = getInputType(inputValueIntrospection.type);
    var defaultValue = inputValueIntrospection.defaultValue ? (0, _valueFromAST.valueFromAST)((0, _parser.parseValue)(inputValueIntrospection.defaultValue), type) : undefined;
    return {
      name: inputValueIntrospection.name,
      description: inputValueIntrospection.description,
      type: type,
      defaultValue: defaultValue
    };
  }

  function buildDirective(directiveIntrospection) {
    // Support deprecated `on****` fields for building `locations`, as this
    // is used by GraphiQL which may need to support outdated servers.
    var locations = directiveIntrospection.locations ? directiveIntrospection.locations.slice() : [].concat(!directiveIntrospection.onField ? [] : [_directives.DirectiveLocation.FIELD], !directiveIntrospection.onOperation ? [] : [_directives.DirectiveLocation.QUERY, _directives.DirectiveLocation.MUTATION, _directives.DirectiveLocation.SUBSCRIPTION], !directiveIntrospection.onFragment ? [] : [_directives.DirectiveLocation.FRAGMENT_DEFINITION, _directives.DirectiveLocation.FRAGMENT_SPREAD, _directives.DirectiveLocation.INLINE_FRAGMENT]);
    return new _directives.GraphQLDirective({
      name: directiveIntrospection.name,
      description: directiveIntrospection.description,
      locations: locations,
      args: buildInputValueDefMap(directiveIntrospection.args)
    });
  }

  // Iterate through all types, getting the type definition for each, ensuring
  // that any type not directly referenced by a field will get created.
  var types = schemaIntrospection.types.map(function (typeIntrospection) {
    return getNamedType(typeIntrospection.name);
  });

  // Get the root Query, Mutation, and Subscription types.
  var queryType = getObjectType(schemaIntrospection.queryType);

  var mutationType = schemaIntrospection.mutationType ? getObjectType(schemaIntrospection.mutationType) : null;

  var subscriptionType = schemaIntrospection.subscriptionType ? getObjectType(schemaIntrospection.subscriptionType) : null;

  // Get the directives supported by Introspection, assuming empty-set if
  // directives were not queried for.
  var directives = schemaIntrospection.directives ? schemaIntrospection.directives.map(buildDirective) : [];

  // Then produce and return a Schema with these types.
  return new _schema.GraphQLSchema({
    query: queryType,
    mutation: mutationType,
    subscription: subscriptionType,
    types: types,
    directives: directives
  });
}
/**
 *  Copyright (c) 2015, Facebook, Inc.
 *  All rights reserved.
 *
 *  This source code is licensed under the BSD-style license found in the
 *  LICENSE file in the root directory of this source tree. An additional grant
 *  of patent rights can be found in the PATENTS file in the same directory.
 */

function cannotExecuteClientSchema() {
  throw new Error('Client Schema cannot use Interface or Union types for execution.');
}