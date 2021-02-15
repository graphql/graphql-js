import { objectValues } from "../polyfills/objectValues.mjs";
import { inspect } from "../jsutils/inspect.mjs";
import { invariant } from "../jsutils/invariant.mjs";
import { print } from "../language/printer.mjs";
import { printBlockString } from "../language/blockString.mjs";
import { isIntrospectionType } from "../type/introspection.mjs";
import { GraphQLString, isSpecifiedScalarType } from "../type/scalars.mjs";
import { DEFAULT_DEPRECATION_REASON, isSpecifiedDirective } from "../type/directives.mjs";
import { isScalarType, isObjectType, isInterfaceType, isUnionType, isEnumType, isInputObjectType } from "../type/definition.mjs";
import { astFromValue } from "./astFromValue.mjs";
export function printSchema(schema) {
  return printFilteredSchema(schema, function (n) {
    return !isSpecifiedDirective(n);
  }, isDefinedType);
}
export function printIntrospectionSchema(schema) {
  return printFilteredSchema(schema, isSpecifiedDirective, isIntrospectionType);
}

function isDefinedType(type) {
  return !isSpecifiedScalarType(type) && !isIntrospectionType(type);
}

function printFilteredSchema(schema, directiveFilter, typeFilter) {
  var directives = schema.getDirectives().filter(directiveFilter);
  var types = objectValues(schema.getTypeMap()).filter(typeFilter);
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

export function printType(type) {
  if (isScalarType(type)) {
    return printScalar(type);
  }

  if (isObjectType(type)) {
    return printObject(type);
  }

  if (isInterfaceType(type)) {
    return printInterface(type);
  }

  if (isUnionType(type)) {
    return printUnion(type);
  }

  if (isEnumType(type)) {
    return printEnum(type);
  } // istanbul ignore else (See: 'https://github.com/graphql/graphql-js/issues/2618')


  if (isInputObjectType(type)) {
    return printInputObject(type);
  } // istanbul ignore next (Not reachable. All possible types have been considered)


  false || invariant(0, 'Unexpected type: ' + inspect(type));
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
  var fields = objectValues(type.getFields()).map(function (f, i) {
    return printDescription(f, '  ', !i) + '  ' + printInputValue(f);
  });
  return printDescription(type) + "input ".concat(type.name) + printBlock(fields);
}

function printFields(type) {
  var fields = objectValues(type.getFields()).map(function (f, i) {
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
  var defaultAST = astFromValue(arg.defaultValue, arg.type);
  var argDecl = arg.name + ': ' + String(arg.type);

  if (defaultAST) {
    argDecl += " = ".concat(print(defaultAST));
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

  var reasonAST = astFromValue(reason, GraphQLString);

  if (reasonAST && reason !== DEFAULT_DEPRECATION_REASON) {
    return ' @deprecated(reason: ' + print(reasonAST) + ')';
  }

  return ' @deprecated';
}

function printSpecifiedByUrl(scalar) {
  if (scalar.specifiedByUrl == null) {
    return '';
  }

  var url = scalar.specifiedByUrl;
  var urlAST = astFromValue(url, GraphQLString);
  urlAST || invariant(0, 'Unexpected null value returned from `astFromValue` for specifiedByUrl');
  return ' @specifiedBy(url: ' + print(urlAST) + ')';
}

function printDescription(def) {
  var indentation = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : '';
  var firstInBlock = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : true;
  var description = def.description;

  if (description == null) {
    return '';
  }

  var preferMultipleLines = description.length > 70;
  var blockString = printBlockString(description, '', preferMultipleLines);
  var prefix = indentation && !firstInBlock ? '\n' + indentation : indentation;
  return prefix + blockString.replace(/\n/g, '\n' + indentation) + '\n';
}
