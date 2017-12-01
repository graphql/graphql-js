/**
 * Copyright (c) 2015-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow
 */

import invariant from '../jsutils/invariant';
import isNullish from '../jsutils/isNullish';
import isInvalid from '../jsutils/isInvalid';
import { astFromValue } from '../utilities/astFromValue';
import { print } from '../language/printer';
import type { GraphQLSchema } from '../type/schema';
import type { GraphQLType } from '../type/definition';
import {
  GraphQLScalarType,
  GraphQLObjectType,
  GraphQLInterfaceType,
  GraphQLUnionType,
  GraphQLEnumType,
  GraphQLInputObjectType,
} from '../type/definition';
import { GraphQLString } from '../type/scalars';
import { DEFAULT_DEPRECATION_REASON } from '../type/directives';

type Options = {| commentDescriptions?: boolean |};

/**
 * Accepts options as a second argument:
 *
 *    - commentDescriptions:
 *        Provide true to use preceding comments as the description.
 *
 */
export function printSchema(schema: GraphQLSchema, options?: Options): string {
  return printFilteredSchema(
    schema,
    n => !isSpecDirective(n),
    isDefinedType,
    options
  );
}

export function printIntrospectionSchema(
  schema: GraphQLSchema,
  options?: Options,
): string {
  return printFilteredSchema(
    schema,
    isSpecDirective,
    isIntrospectionType,
    options
  );
}

function isSpecDirective(directiveName: string): boolean {
  return (
    directiveName === 'skip' ||
    directiveName === 'include' ||
    directiveName === 'deprecated'
  );
}

function isDefinedType(typename: string): boolean {
  return !isIntrospectionType(typename) && !isBuiltInScalar(typename);
}

function isIntrospectionType(typename: string): boolean {
  return typename.indexOf('__') === 0;
}

function isBuiltInScalar(typename: string): boolean {
  return (
    typename === 'String' ||
    typename === 'Boolean' ||
    typename === 'Int' ||
    typename === 'Float' ||
    typename === 'ID'
  );
}

function printFilteredSchema(
  schema: GraphQLSchema,
  directiveFilter: (type: string) => boolean,
  typeFilter: (type: string) => boolean,
  options
): string {
  const directives = schema.getDirectives()
    .filter(directive => directiveFilter(directive.name));
  const typeMap = schema.getTypeMap();
  const types = Object.keys(typeMap)
    .filter(typeFilter)
    .sort((name1, name2) => name1.localeCompare(name2))
    .map(typeName => typeMap[typeName]);

  return [ printSchemaDefinition(schema) ].concat(
    directives.map(directive => printDirective(directive, options)),
    types.map(type => printType(type, options))
  ).filter(Boolean).join('\n\n') + '\n';
}

function printSchemaDefinition(schema: GraphQLSchema): ?string {
  if (isSchemaOfCommonNames(schema)) {
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

  return `schema {\n${operationTypes.join('\n')}\n}`;
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
function isSchemaOfCommonNames(schema: GraphQLSchema): boolean {
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

export function printType(
  type: GraphQLType,
  options?: Options,
): string {
  if (type instanceof GraphQLScalarType) {
    return printScalar(type, options);
  } else if (type instanceof GraphQLObjectType) {
    return printObject(type, options);
  } else if (type instanceof GraphQLInterfaceType) {
    return printInterface(type, options);
  } else if (type instanceof GraphQLUnionType) {
    return printUnion(type, options);
  } else if (type instanceof GraphQLEnumType) {
    return printEnum(type, options);
  }
  invariant(type instanceof GraphQLInputObjectType);
  return printInputObject(type, options);
}

function printScalar(type: GraphQLScalarType, options): string {
  return printDescription(options, type) +
    `scalar ${type.name}`;
}

function printObject(type: GraphQLObjectType, options): string {
  const interfaces = type.getInterfaces();
  const implementedInterfaces = interfaces.length ?
    ' implements ' + interfaces.map(i => i.name).join(', ') : '';
  return printDescription(options, type) +
    `type ${type.name}${implementedInterfaces} {\n` +
      printFields(options, type) + '\n' +
    '}';
}

function printInterface(type: GraphQLInterfaceType, options): string {
  return printDescription(options, type) +
    `interface ${type.name} {\n` +
      printFields(options, type) + '\n' +
    '}';
}

function printUnion(type: GraphQLUnionType, options): string {
  return printDescription(options, type) +
    `union ${type.name} = ${type.getTypes().join(' | ')}`;
}

function printEnum(type: GraphQLEnumType, options): string {
  return printDescription(options, type) +
    `enum ${type.name} {\n` +
      printEnumValues(type.getValues(), options) + '\n' +
    '}';
}

function printEnumValues(values, options): string {
  return values.map((value, i) =>
    printDescription(options, value, '  ', !i) + '  ' +
    value.name + printDeprecated(value)
  ).join('\n');
}

function printInputObject(type: GraphQLInputObjectType, options): string {
  const fieldMap = type.getFields();
  const fields = Object.keys(fieldMap).map(fieldName => fieldMap[fieldName]);
  return printDescription(options, type) +
    `input ${type.name} {\n` +
      fields.map((f, i) =>
        printDescription(options, f, '  ', !i) + '  ' + printInputValue(f)
      ).join('\n') + '\n' +
    '}';
}

function printFields(options, type) {
  const fieldMap = type.getFields();
  const fields = Object.keys(fieldMap).map(fieldName => fieldMap[fieldName]);
  return fields.map((f, i) =>
    printDescription(options, f, '  ', !i) + '  ' +
    f.name + printArgs(options, f.args, '  ') + ': ' +
    String(f.type) + printDeprecated(f)
  ).join('\n');
}

function printArgs(options, args, indentation = '') {
  if (args.length === 0) {
    return '';
  }

  // If every arg does not have a description, print them on one line.
  if (args.every(arg => !arg.description)) {
    return '(' + args.map(printInputValue).join(', ') + ')';
  }

  return '(\n' + args.map((arg, i) =>
    printDescription(options, arg, '  ' + indentation, !i) +
    '  ' + indentation +
    printInputValue(arg)
  ).join('\n') + '\n' + indentation + ')';
}

function printInputValue(arg) {
  let argDecl = arg.name + ': ' + String(arg.type);
  if (!isInvalid(arg.defaultValue)) {
    argDecl += ` = ${print(astFromValue(arg.defaultValue, arg.type))}`;
  }
  return argDecl;
}

function printDirective(directive, options) {
  return printDescription(options, directive) +
    'directive @' + directive.name + printArgs(options, directive.args) +
    ' on ' + directive.locations.join(' | ');
}

function printDeprecated(fieldOrEnumVal) {
  if (!fieldOrEnumVal.isDeprecated) {
    return '';
  }
  const reason = fieldOrEnumVal.deprecationReason;
  if (
    isNullish(reason) ||
    reason === '' ||
    reason === DEFAULT_DEPRECATION_REASON
  ) {
    return ' @deprecated';
  }
  return ' @deprecated(reason: ' +
    print(astFromValue(reason, GraphQLString)) + ')';
}

function printDescription(
  options,
  def,
  indentation = '',
  firstInBlock = true
): string {
  if (!def.description) {
    return '';
  }

  const lines = descriptionLines(def.description, 120 - indentation.length);
  if (options && options.commentDescriptions) {
    return printDescriptionWithComments(lines, indentation, firstInBlock);
  }

  let description = indentation && !firstInBlock ? '\n' : '';
  if (lines.length === 1 && lines[0].length < 70) {
    description += indentation + '"""' + escapeQuote(lines[0]) + '"""\n';
    return description;
  }

  description += indentation + '"""\n';
  for (let i = 0; i < lines.length; i++) {
    description += indentation + escapeQuote(lines[i]) + '\n';
  }
  description += indentation + '"""\n';
  return description;
}

function escapeQuote(line) {
  return line.replace(/"""/g, '\\"""');
}

function printDescriptionWithComments(lines, indentation, firstInBlock) {
  let description = indentation && !firstInBlock ? '\n' : '';
  for (let i = 0; i < lines.length; i++) {
    if (lines[i] === '') {
      description += indentation + '#\n';
    } else {
      description += indentation + '# ' + lines[i] + '\n';
    }
  }
  return description;
}

function descriptionLines(description: string, maxLen: number): Array<string> {
  const lines = [];
  const rawLines = description.split('\n');
  for (let i = 0; i < rawLines.length; i++) {
    if (rawLines[i] === '') {
      lines.push(rawLines[i]);
    } else {
      // For > 120 character long lines, cut at space boundaries into sublines
      // of ~80 chars.
      const sublines = breakLine(rawLines[i], maxLen);
      for (let j = 0; j < sublines.length; j++) {
        lines.push(sublines[j]);
      }
    }
  }
  return lines;
}

function breakLine(line: string, maxLen: number): Array<string> {
  if (line.length < maxLen + 5) {
    return [ line ];
  }
  const parts = line.split(new RegExp(`((?: |^).{15,${maxLen - 40}}(?= |$))`));
  if (parts.length < 4) {
    return [ line ];
  }
  const sublines = [ parts[0] + parts[1] + parts[2] ];
  for (let i = 3; i < parts.length; i += 2) {
    sublines.push(parts[i].slice(1) + parts[i + 1]);
  }
  return sublines;
}
