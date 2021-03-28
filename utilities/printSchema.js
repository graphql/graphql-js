"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.printSchema = printSchema;
exports.printIntrospectionSchema = printIntrospectionSchema;
exports.printType = printType;

var _inspect = require("../jsutils/inspect.js");

var _invariant = require("../jsutils/invariant.js");

var _printer = require("../language/printer.js");

var _blockString = require("../language/blockString.js");

var _introspection = require("../type/introspection.js");

var _scalars = require("../type/scalars.js");

var _directives = require("../type/directives.js");

var _definition = require("../type/definition.js");

var _astFromValue = require("./astFromValue.js");

function printSchema(schema) {
  return printFilteredSchema(schema, n => !(0, _directives.isSpecifiedDirective)(n), isDefinedType);
}

function printIntrospectionSchema(schema) {
  return printFilteredSchema(schema, _directives.isSpecifiedDirective, _introspection.isIntrospectionType);
}

function isDefinedType(type) {
  return !(0, _scalars.isSpecifiedScalarType)(type) && !(0, _introspection.isIntrospectionType)(type);
}

function printFilteredSchema(schema, directiveFilter, typeFilter) {
  const directives = schema.getDirectives().filter(directiveFilter);
  const types = Object.values(schema.getTypeMap()).filter(typeFilter);
  return [printSchemaDefinition(schema)].concat(directives.map(directive => printDirective(directive)), types.map(type => printType(type))).filter(Boolean).join('\n\n');
}

function printSchemaDefinition(schema) {
  if (schema.description == null && isSchemaOfCommonNames(schema)) {
    return;
  }

  const operationTypes = [];
  const queryType = schema.getQueryType();

  if (queryType) {
    operationTypes.push(`  query: ${queryType.name}`);
  }

  const mutationType = schema.getMutationType();

  if (mutationType) {
    operationTypes.push(`  mutation: ${mutationType.name}`);
  }

  const subscriptionType = schema.getSubscriptionType();

  if (subscriptionType) {
    operationTypes.push(`  subscription: ${subscriptionType.name}`);
  }

  return printDescription(schema) + `schema {\n${operationTypes.join('\n')}\n}`;
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
  const queryType = schema.getQueryType();

  if (queryType && queryType.name !== 'Query') {
    return false;
  }

  const mutationType = schema.getMutationType();

  if (mutationType && mutationType.name !== 'Mutation') {
    return false;
  }

  const subscriptionType = schema.getSubscriptionType();

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


  false || (0, _invariant.invariant)(0, 'Unexpected type: ' + (0, _inspect.inspect)(type));
}

function printScalar(type) {
  return printDescription(type) + `scalar ${type.name}` + printSpecifiedByUrl(type);
}

function printImplementedInterfaces(type) {
  const interfaces = type.getInterfaces();
  return interfaces.length ? ' implements ' + interfaces.map(i => i.name).join(' & ') : '';
}

function printObject(type) {
  return printDescription(type) + `type ${type.name}` + printImplementedInterfaces(type) + printFields(type);
}

function printInterface(type) {
  return printDescription(type) + `interface ${type.name}` + printImplementedInterfaces(type) + printFields(type);
}

function printUnion(type) {
  const types = type.getTypes();
  const possibleTypes = types.length ? ' = ' + types.join(' | ') : '';
  return printDescription(type) + 'union ' + type.name + possibleTypes;
}

function printEnum(type) {
  const values = type.getValues().map((value, i) => printDescription(value, '  ', !i) + '  ' + value.name + printDeprecated(value.deprecationReason));
  return printDescription(type) + `enum ${type.name}` + printBlock(values);
}

function printInputObject(type) {
  const fields = Object.values(type.getFields()).map((f, i) => printDescription(f, '  ', !i) + '  ' + printInputValue(f));
  return printDescription(type) + `input ${type.name}` + printBlock(fields);
}

function printFields(type) {
  const fields = Object.values(type.getFields()).map((f, i) => printDescription(f, '  ', !i) + '  ' + f.name + printArgs(f.args, '  ') + ': ' + String(f.type) + printDeprecated(f.deprecationReason));
  return printBlock(fields);
}

function printBlock(items) {
  return items.length !== 0 ? ' {\n' + items.join('\n') + '\n}' : '';
}

function printArgs(args, indentation = '') {
  if (args.length === 0) {
    return '';
  } // If every arg does not have a description, print them on one line.


  if (args.every(arg => !arg.description)) {
    return '(' + args.map(printInputValue).join(', ') + ')';
  }

  return '(\n' + args.map((arg, i) => printDescription(arg, '  ' + indentation, !i) + '  ' + indentation + printInputValue(arg)).join('\n') + '\n' + indentation + ')';
}

function printInputValue(arg) {
  const defaultAST = (0, _astFromValue.astFromValue)(arg.defaultValue, arg.type);
  let argDecl = arg.name + ': ' + String(arg.type);

  if (defaultAST) {
    argDecl += ` = ${(0, _printer.print)(defaultAST)}`;
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

  const reasonAST = (0, _astFromValue.astFromValue)(reason, _scalars.GraphQLString);

  if (reasonAST && reason !== _directives.DEFAULT_DEPRECATION_REASON) {
    return ' @deprecated(reason: ' + (0, _printer.print)(reasonAST) + ')';
  }

  return ' @deprecated';
}

function printSpecifiedByUrl(scalar) {
  if (scalar.specifiedByUrl == null) {
    return '';
  }

  const url = scalar.specifiedByUrl;
  const urlAST = (0, _astFromValue.astFromValue)(url, _scalars.GraphQLString);
  urlAST || (0, _invariant.invariant)(0, 'Unexpected null value returned from `astFromValue` for specifiedByUrl');
  return ' @specifiedBy(url: ' + (0, _printer.print)(urlAST) + ')';
}

function printDescription(def, indentation = '', firstInBlock = true) {
  const {
    description
  } = def;

  if (description == null) {
    return '';
  }

  const preferMultipleLines = description.length > 70;
  const blockString = (0, _blockString.printBlockString)(description, preferMultipleLines);
  const prefix = indentation && !firstInBlock ? '\n' + indentation : indentation;
  return prefix + blockString.replace(/\n/g, '\n' + indentation) + '\n';
}
