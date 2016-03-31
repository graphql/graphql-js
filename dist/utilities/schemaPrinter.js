'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _keys = require('babel-runtime/core-js/object/keys');

var _keys2 = _interopRequireDefault(_keys);

exports.printSchema = printSchema;
exports.printIntrospectionSchema = printIntrospectionSchema;

var _invariant = require('../jsutils/invariant');

var _invariant2 = _interopRequireDefault(_invariant);

var _isNullish = require('../jsutils/isNullish');

var _isNullish2 = _interopRequireDefault(_isNullish);

var _astFromValue = require('../utilities/astFromValue');

var _printer = require('../language/printer');

var _definition = require('../type/definition');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function printSchema(schema) {
  return printFilteredSchema(schema, function (n) {
    return !isSpecDirective(n);
  }, isDefinedType);
}
/**
 *  Copyright (c) 2015, Facebook, Inc.
 *  All rights reserved.
 *
 *  This source code is licensed under the BSD-style license found in the
 *  LICENSE file in the root directory of this source tree. An additional grant
 *  of patent rights can be found in the PATENTS file in the same directory.
 */

function printIntrospectionSchema(schema) {
  return printFilteredSchema(schema, isSpecDirective, isIntrospectionType);
}

function isSpecDirective(directiveName) {
  return directiveName === 'skip' || directiveName === 'include';
}

function isDefinedType(typename) {
  return !isIntrospectionType(typename) && !isBuiltInScalar(typename);
}

function isIntrospectionType(typename) {
  return typename.indexOf('__') === 0;
}

function isBuiltInScalar(typename) {
  return typename === 'String' || typename === 'Boolean' || typename === 'Int' || typename === 'Float' || typename === 'ID';
}

function printFilteredSchema(schema, directiveFilter, typeFilter) {
  var directives = schema.getDirectives().filter(function (directive) {
    return directiveFilter(directive.name);
  });
  var typeMap = schema.getTypeMap();
  var types = (0, _keys2.default)(typeMap).filter(typeFilter).sort(function (name1, name2) {
    return name1.localeCompare(name2);
  }).map(function (typeName) {
    return typeMap[typeName];
  });
  return [printSchemaDefinition(schema)].concat(directives.map(printDirective), types.map(printType)).join('\n\n') + '\n';
}

function printSchemaDefinition(schema) {
  var operationTypes = [];

  var queryType = schema.getQueryType();
  if (queryType) {
    operationTypes.push('  query: ' + queryType);
  }

  var mutationType = schema.getMutationType();
  if (mutationType) {
    operationTypes.push('  mutation: ' + mutationType);
  }

  var subscriptionType = schema.getSubscriptionType();
  if (subscriptionType) {
    operationTypes.push('  subscription: ' + subscriptionType);
  }

  return 'schema {\n' + operationTypes.join('\n') + '\n}';
}

function printType(type) {
  if (type instanceof _definition.GraphQLScalarType) {
    return printScalar(type);
  } else if (type instanceof _definition.GraphQLObjectType) {
    return printObject(type);
  } else if (type instanceof _definition.GraphQLInterfaceType) {
    return printInterface(type);
  } else if (type instanceof _definition.GraphQLUnionType) {
    return printUnion(type);
  } else if (type instanceof _definition.GraphQLEnumType) {
    return printEnum(type);
  }
  (0, _invariant2.default)(type instanceof _definition.GraphQLInputObjectType);
  return printInputObject(type);
}

function printScalar(type) {
  return 'scalar ' + type.name;
}

function printObject(type) {
  var interfaces = type.getInterfaces();
  var implementedInterfaces = interfaces.length ? ' implements ' + interfaces.map(function (i) {
    return i.name;
  }).join(', ') : '';
  return 'type ' + type.name + implementedInterfaces + ' {\n' + printFields(type) + '\n' + '}';
}

function printInterface(type) {
  return 'interface ' + type.name + ' {\n' + printFields(type) + '\n' + '}';
}

function printUnion(type) {
  return 'union ' + type.name + ' = ' + type.getTypes().join(' | ');
}

function printEnum(type) {
  var values = type.getValues();
  return 'enum ' + type.name + ' {\n' + values.map(function (v) {
    return '  ' + v.name;
  }).join('\n') + '\n' + '}';
}

function printInputObject(type) {
  var fieldMap = type.getFields();
  var fields = (0, _keys2.default)(fieldMap).map(function (fieldName) {
    return fieldMap[fieldName];
  });
  return 'input ' + type.name + ' {\n' + fields.map(function (f) {
    return '  ' + printInputValue(f);
  }).join('\n') + '\n' + '}';
}

function printFields(type) {
  var fieldMap = type.getFields();
  var fields = (0, _keys2.default)(fieldMap).map(function (fieldName) {
    return fieldMap[fieldName];
  });
  return fields.map(function (f) {
    return '  ' + f.name + printArgs(f) + ': ' + f.type;
  }).join('\n');
}

function printArgs(fieldOrDirectives) {
  if (fieldOrDirectives.args.length === 0) {
    return '';
  }
  return '(' + fieldOrDirectives.args.map(printInputValue).join(', ') + ')';
}

function printInputValue(arg) {
  var argDecl = arg.name + ': ' + arg.type;
  if (!(0, _isNullish2.default)(arg.defaultValue)) {
    argDecl += ' = ' + (0, _printer.print)((0, _astFromValue.astFromValue)(arg.defaultValue, arg.type));
  }
  return argDecl;
}

function printDirective(directive) {
  return 'directive @' + directive.name + printArgs(directive) + ' on ' + directive.locations.join(' | ');
}