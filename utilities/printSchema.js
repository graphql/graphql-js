"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.printSchema = printSchema;
exports.printIntrospectionSchema = printIntrospectionSchema;
exports.printType = printType;

var _objectValues = _interopRequireDefault(require("../polyfills/objectValues.js"));

var _inspect = _interopRequireDefault(require("../jsutils/inspect.js"));

var _invariant = _interopRequireDefault(require("../jsutils/invariant.js"));

var _printer = require("../language/printer.js");

var _blockString = require("../language/blockString.js");

var _introspection = require("../type/introspection.js");

var _scalars = require("../type/scalars.js");

var _directives = require("../type/directives.js");

var _definition = require("../type/definition.js");

var _astFromValue = require("./astFromValue.js");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function printSchema(schema) {
  return printFilteredSchema(schema, function (n) {
    return !(0, _directives.isSpecifiedDirective)(n);
  }, isDefinedType);
}

function printIntrospectionSchema(schema) {
  return printFilteredSchema(schema, _directives.isSpecifiedDirective, _introspection.isIntrospectionType);
}

function isDefinedType(type) {
  return !(0, _scalars.isSpecifiedScalarType)(type) && !(0, _introspection.isIntrospectionType)(type);
}

function printFilteredSchema(schema, directiveFilter, typeFilter) {
  var directives = schema.getDirectives().filter(directiveFilter);
  var types = (0, _objectValues.default)(schema.getTypeMap()).filter(typeFilter);
  return [printSchemaDefinition(schema)].concat(directives.map(function (directive) {
    return printDirective(directive);
  }), types.map(function (type) {
    return printType(type);
  })).filter(Boolean).join('\n\n') + '\n';
}

function printSchemaDefinition(schema) {
  if (schema.description == null && isSchemaOfCommonNames(schema)) {
    return;
  }

  var operationTypes = [];
  var queryType = schema.getQueryType();

  if (queryType) {
    operationTypes.push("  query: ".concat(queryType.name));
  }

  var mutationType = schema.getMutationType();

  if (mutationType) {
    operationTypes.push("  mutation: ".concat(mutationType.name));
  }

  var subscriptionType = schema.getSubscriptionType();

  if (subscriptionType) {
    operationTypes.push("  subscription: ".concat(subscriptionType.name));
  }

  return printDescription(schema) + "schema {\n".concat(operationTypes.join('\n'), "\n}");
}
/**
 * GraphQL schema define root types for each type of operation. These types are
 * the same as any other type and can be named in any manner, however there is
 * a common naming convention:
 *
 *   schema {
 *     query: Query
 *     mutation: Mutation
 *   }
 *
 * When using this naming convention, the schema description can be omitted.
 */


function isSchemaOfCommonNames(schema) {
  var queryType = schema.getQueryType();

  if (queryType && queryType.name !== 'Query') {
    return false;
  }

  var mutationType = schema.getMutationType();

  if (mutationType && mutationType.name !== 'Mutation') {
    return false;
  }

  var subscriptionType = schema.getSubscriptionType();

  if (subscriptionType && subscriptionType.name !== 'Subscription') {
    return false;
  }

  return true;
}

function printType(type) {
  if ((0, _definition.isScalarType)(type)) {
    return printScalar(type);
  }

  if ((0, _definition.isObjectType)(type)) {
    return printObject(type);
  }

  if ((0, _definition.isInterfaceType)(type)) {
    return printInterface(type);
  }

  if ((0, _definition.isUnionType)(type)) {
    return printUnion(type);
  }

  if ((0, _definition.isEnumType)(type)) {
    return printEnum(type);
  } // istanbul ignore else (See: 'https://github.com/graphql/graphql-js/issues/2618')


  if ((0, _definition.isInputObjectType)(type)) {
    return printInputObject(type);
  } // istanbul ignore next (Not reachable. All possible types have been considered)


  false || (0, _invariant.default)(0, 'Unexpected type: ' + (0, _inspect.default)(type));
}

function printScalar(type) {
  return printDescription(type) + "scalar ".concat(type.name) + printSpecifiedByUrl(type);
}

function printImplementedInterfaces(type) {
  var interfaces = type.getInterfaces();
  return interfaces.length ? ' implements ' + interfaces.map(function (i) {
    return i.name;
  }).join(' & ') : '';
}

function printObject(type) {
  return printDescription(type) + "type ".concat(type.name) + printImplementedInterfaces(type) + printFields(type);
}

function printInterface(type) {
  return printDescription(type) + "interface ".concat(type.name) + printImplementedInterfaces(type) + printFields(type);
}

function printUnion(type) {
  var types = type.getTypes();
  var possibleTypes = types.length ? ' = ' + types.join(' | ') : '';
  return printDescription(type) + 'union ' + type.name + possibleTypes;
}

function printEnum(type) {
  var values = type.getValues().map(function (value, i) {
    return printDescription(value, '  ', !i) + '  ' + value.name + printDeprecated(value.deprecationReason);
  });
  return printDescription(type) + "enum ".concat(type.name) + printBlock(values);
}

function printInputObject(type) {
  var fields = (0, _objectValues.default)(type.getFields()).map(function (f, i) {
    return printDescription(f, '  ', !i) + '  ' + printInputValue(f);
  });
  return printDescription(type) + "input ".concat(type.name) + printBlock(fields);
}

function printFields(type) {
  var fields = (0, _objectValues.default)(type.getFields()).map(function (f, i) {
    return printDescription(f, '  ', !i) + '  ' + f.name + printArgs(f.args, '  ') + ': ' + String(f.type) + printDeprecated(f.deprecationReason);
  });
  return printBlock(fields);
}

function printBlock(items) {
  return items.length !== 0 ? ' {\n' + items.join('\n') + '\n}' : '';
}

function printArgs(args) {
  var indentation = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : '';

  if (args.length === 0) {
    return '';
  } // If every arg does not have a description, print them on one line.


  if (args.every(function (arg) {
    return !arg.description;
  })) {
    return '(' + args.map(printInputValue).join(', ') + ')';
  }

  return '(\n' + args.map(function (arg, i) {
    return printDescription(arg, '  ' + indentation, !i) + '  ' + indentation + printInputValue(arg);
  }).join('\n') + '\n' + indentation + ')';
}

function printInputValue(arg) {
  var defaultAST = (0, _astFromValue.astFromValue)(arg.defaultValue, arg.type);
  var argDecl = arg.name + ': ' + String(arg.type);

  if (defaultAST) {
    argDecl += " = ".concat((0, _printer.print)(defaultAST));
  }

  return argDecl + printDeprecated(arg.deprecationReason);
}

function printDirective(directive) {
  return printDescription(directive) + 'directive @' + directive.name + printArgs(directive.args) + (directive.isRepeatable ? ' repeatable' : '') + ' on ' + directive.locations.join(' | ');
}

function printDeprecated(reason) {
  if (reason == null) {
    return '';
  }

  var reasonAST = (0, _astFromValue.astFromValue)(reason, _scalars.GraphQLString);

  if (reasonAST && reason !== _directives.DEFAULT_DEPRECATION_REASON) {
    return ' @deprecated(reason: ' + (0, _printer.print)(reasonAST) + ')';
  }

  return ' @deprecated';
}

function printSpecifiedByUrl(scalar) {
  if (scalar.specifiedByUrl == null) {
    return '';
  }

  var url = scalar.specifiedByUrl;
  var urlAST = (0, _astFromValue.astFromValue)(url, _scalars.GraphQLString);
  urlAST || (0, _invariant.default)(0, 'Unexpected null value returned from `astFromValue` for specifiedByUrl');
  return ' @specifiedBy(url: ' + (0, _printer.print)(urlAST) + ')';
}

function printDescription(def) {
  var indentation = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : '';
  var firstInBlock = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : true;
  var description = def.description;

  if (description == null) {
    return '';
  }

  var preferMultipleLines = description.length > 70;
  var blockString = (0, _blockString.printBlockString)(description, '', preferMultipleLines);
  var prefix = indentation && !firstInBlock ? '\n' + indentation : indentation;
  return prefix + blockString.replace(/\n/g, '\n' + indentation) + '\n';
}
