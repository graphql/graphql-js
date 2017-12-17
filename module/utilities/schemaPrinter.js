/**
 * Copyright (c) 2015-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * 
 */

import isNullish from '../jsutils/isNullish';
import isInvalid from '../jsutils/isInvalid';
import { astFromValue } from '../utilities/astFromValue';
import { print } from '../language/printer';

import { isScalarType, isObjectType, isInterfaceType, isUnionType, isEnumType, isInputObjectType } from '../type/definition';

import { GraphQLString, isSpecifiedScalarType } from '../type/scalars';
import { GraphQLDirective, DEFAULT_DEPRECATION_REASON, isSpecifiedDirective } from '../type/directives';
import { isIntrospectionType } from '../type/introspection';

/**
 * Accepts options as a second argument:
 *
 *    - commentDescriptions:
 *        Provide true to use preceding comments as the description.
 *
 */
export function printSchema(schema, options) {
  return printFilteredSchema(schema, function (n) {
    return !isSpecifiedDirective(n);
  }, isDefinedType, options);
}

export function printIntrospectionSchema(schema, options) {
  return printFilteredSchema(schema, isSpecifiedDirective, isIntrospectionType, options);
}

function isDefinedType(type) {
  return !isSpecifiedScalarType(type) && !isIntrospectionType(type);
}

function printFilteredSchema(schema, directiveFilter, typeFilter, options) {
  var directives = schema.getDirectives().filter(directiveFilter);
  var typeMap = schema.getTypeMap();
  var types = Object.keys(typeMap).sort(function (name1, name2) {
    return name1.localeCompare(name2);
  }).map(function (typeName) {
    return typeMap[typeName];
  }).filter(typeFilter);

  return [printSchemaDefinition(schema)].concat(directives.map(function (directive) {
    return printDirective(directive, options);
  }), types.map(function (type) {
    return printType(type, options);
  })).filter(Boolean).join('\n\n') + '\n';
}

function printSchemaDefinition(schema) {
  if (isSchemaOfCommonNames(schema)) {
    return;
  }

  var operationTypes = [];

  var queryType = schema.getQueryType();
  if (queryType) {
    operationTypes.push('  query: ' + queryType.name);
  }

  var mutationType = schema.getMutationType();
  if (mutationType) {
    operationTypes.push('  mutation: ' + mutationType.name);
  }

  var subscriptionType = schema.getSubscriptionType();
  if (subscriptionType) {
    operationTypes.push('  subscription: ' + subscriptionType.name);
  }

  return 'schema {\n' + operationTypes.join('\n') + '\n}';
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

export function printType(type, options) {
  if (isScalarType(type)) {
    return printScalar(type, options);
  } else if (isObjectType(type)) {
    return printObject(type, options);
  } else if (isInterfaceType(type)) {
    return printInterface(type, options);
  } else if (isUnionType(type)) {
    return printUnion(type, options);
  } else if (isEnumType(type)) {
    return printEnum(type, options);
  } else if (isInputObjectType(type)) {
    return printInputObject(type, options);
  }
  /* istanbul ignore next */
  throw new Error('Unknown type: ' + type + '.');
}

function printScalar(type, options) {
  return printDescription(options, type) + ('scalar ' + type.name);
}

function printObject(type, options) {
  var interfaces = type.getInterfaces();
  var implementedInterfaces = interfaces.length ? ' implements ' + interfaces.map(function (i) {
    return i.name;
  }).join(', ') : '';
  return printDescription(options, type) + ('type ' + type.name + implementedInterfaces + ' {\n') + printFields(options, type) + '\n' + '}';
}

function printInterface(type, options) {
  return printDescription(options, type) + ('interface ' + type.name + ' {\n') + printFields(options, type) + '\n' + '}';
}

function printUnion(type, options) {
  return printDescription(options, type) + ('union ' + type.name + ' = ' + type.getTypes().join(' | '));
}

function printEnum(type, options) {
  return printDescription(options, type) + ('enum ' + type.name + ' {\n') + printEnumValues(type.getValues(), options) + '\n' + '}';
}

function printEnumValues(values, options) {
  return values.map(function (value, i) {
    return printDescription(options, value, '  ', !i) + '  ' + value.name + printDeprecated(value);
  }).join('\n');
}

function printInputObject(type, options) {
  var fieldMap = type.getFields();
  var fields = Object.keys(fieldMap).map(function (fieldName) {
    return fieldMap[fieldName];
  });
  return printDescription(options, type) + ('input ' + type.name + ' {\n') + fields.map(function (f, i) {
    return printDescription(options, f, '  ', !i) + '  ' + printInputValue(f);
  }).join('\n') + '\n' + '}';
}

function printFields(options, type) {
  var fieldMap = type.getFields();
  var fields = Object.keys(fieldMap).map(function (fieldName) {
    return fieldMap[fieldName];
  });
  return fields.map(function (f, i) {
    return printDescription(options, f, '  ', !i) + '  ' + f.name + printArgs(options, f.args, '  ') + ': ' + String(f.type) + printDeprecated(f);
  }).join('\n');
}

function printArgs(options, args) {
  var indentation = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : '';

  if (args.length === 0) {
    return '';
  }

  // If every arg does not have a description, print them on one line.
  if (args.every(function (arg) {
    return !arg.description;
  })) {
    return '(' + args.map(printInputValue).join(', ') + ')';
  }

  return '(\n' + args.map(function (arg, i) {
    return printDescription(options, arg, '  ' + indentation, !i) + '  ' + indentation + printInputValue(arg);
  }).join('\n') + '\n' + indentation + ')';
}

function printInputValue(arg) {
  var argDecl = arg.name + ': ' + String(arg.type);
  if (!isInvalid(arg.defaultValue)) {
    argDecl += ' = ' + print(astFromValue(arg.defaultValue, arg.type));
  }
  return argDecl;
}

function printDirective(directive, options) {
  return printDescription(options, directive) + 'directive @' + directive.name + printArgs(options, directive.args) + ' on ' + directive.locations.join(' | ');
}

function printDeprecated(fieldOrEnumVal) {
  if (!fieldOrEnumVal.isDeprecated) {
    return '';
  }
  var reason = fieldOrEnumVal.deprecationReason;
  if (isNullish(reason) || reason === '' || reason === DEFAULT_DEPRECATION_REASON) {
    return ' @deprecated';
  }
  return ' @deprecated(reason: ' + print(astFromValue(reason, GraphQLString)) + ')';
}

function printDescription(options, def) {
  var indentation = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : '';
  var firstInBlock = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : true;

  if (!def.description) {
    return '';
  }

  var lines = descriptionLines(def.description, 120 - indentation.length);
  if (options && options.commentDescriptions) {
    return printDescriptionWithComments(lines, indentation, firstInBlock);
  }

  var description = indentation && !firstInBlock ? '\n' : '';
  if (lines.length === 1 && lines[0].length < 70) {
    description += indentation + '"""' + escapeQuote(lines[0]) + '"""\n';
    return description;
  }

  description += indentation + '"""\n';
  for (var i = 0; i < lines.length; i++) {
    description += indentation + escapeQuote(lines[i]) + '\n';
  }
  description += indentation + '"""\n';
  return description;
}

function escapeQuote(line) {
  return line.replace(/"""/g, '\\"""');
}

function printDescriptionWithComments(lines, indentation, firstInBlock) {
  var description = indentation && !firstInBlock ? '\n' : '';
  for (var i = 0; i < lines.length; i++) {
    if (lines[i] === '') {
      description += indentation + '#\n';
    } else {
      description += indentation + '# ' + lines[i] + '\n';
    }
  }
  return description;
}

function descriptionLines(description, maxLen) {
  var lines = [];
  var rawLines = description.split('\n');
  for (var i = 0; i < rawLines.length; i++) {
    if (rawLines[i] === '') {
      lines.push(rawLines[i]);
    } else {
      // For > 120 character long lines, cut at space boundaries into sublines
      // of ~80 chars.
      var sublines = breakLine(rawLines[i], maxLen);
      for (var j = 0; j < sublines.length; j++) {
        lines.push(sublines[j]);
      }
    }
  }
  return lines;
}

function breakLine(line, maxLen) {
  if (line.length < maxLen + 5) {
    return [line];
  }
  var parts = line.split(new RegExp('((?: |^).{15,' + (maxLen - 40) + '}(?= |$))'));
  if (parts.length < 4) {
    return [line];
  }
  var sublines = [parts[0] + parts[1] + parts[2]];
  for (var i = 3; i < parts.length; i += 2) {
    sublines.push(parts[i].slice(1) + parts[i + 1]);
  }
  return sublines;
}