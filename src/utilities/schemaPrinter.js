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


export function printSchema(schema: GraphQLSchema): string {
  return printFilteredSchema(schema, n => !isSpecDirective(n), isDefinedType);
}

export function printIntrospectionSchema(schema: GraphQLSchema): string {
  return printFilteredSchema(schema, isSpecDirective, isIntrospectionType);
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
  typeFilter: (type: string) => boolean
): string {
  const directives = schema.getDirectives()
    .filter(directive => directiveFilter(directive.name));
  const typeMap = schema.getTypeMap();
  const types = Object.keys(typeMap)
    .filter(typeFilter)
    .sort((name1, name2) => name1.localeCompare(name2))
    .map(typeName => typeMap[typeName]);

  return [ printSchemaDefinition(schema) ].concat(
    directives.map(printDirective),
    types.map(printType)
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

export function printType(type: GraphQLType): string {
  if (type instanceof GraphQLScalarType) {
    return printScalar(type);
  } else if (type instanceof GraphQLObjectType) {
    return printObject(type);
  } else if (type instanceof GraphQLInterfaceType) {
    return printInterface(type);
  } else if (type instanceof GraphQLUnionType) {
    return printUnion(type);
  } else if (type instanceof GraphQLEnumType) {
    return printEnum(type);
  }
  invariant(type instanceof GraphQLInputObjectType);
  return printInputObject(type);
}

function printScalar(type: GraphQLScalarType): string {
  return printDescription(type) +
    `scalar ${type.name}`;
}

function printObject(type: GraphQLObjectType): string {
  const interfaces = type.getInterfaces();
  const implementedInterfaces = interfaces.length ?
    ' implements ' + interfaces.map(i => i.name).join(', ') : '';
  return printDescription(type) +
    `type ${type.name}${implementedInterfaces} {\n` +
      printFields(type) + '\n' +
    '}';
}

function printInterface(type: GraphQLInterfaceType): string {
  return printDescription(type) +
    `interface ${type.name} {\n` +
      printFields(type) + '\n' +
    '}';
}

function printUnion(type: GraphQLUnionType): string {
  return printDescription(type) +
    `union ${type.name} = ${type.getTypes().join(' | ')}`;
}

function printEnum(type: GraphQLEnumType): string {
  return printDescription(type) +
    `enum ${type.name} {\n` +
      printEnumValues(type.getValues()) + '\n' +
    '}';
}

function printEnumValues(values): string {
  return values.map((value, i) =>
    printDescription(value, '  ', !i) + '  ' +
    value.name + printDeprecated(value)
  ).join('\n');
}

function printInputObject(type: GraphQLInputObjectType): string {
  const fieldMap = type.getFields();
  const fields = Object.keys(fieldMap).map(fieldName => fieldMap[fieldName]);
  return printDescription(type) +
    `input ${type.name} {\n` +
      fields.map((f, i) =>
        printDescription(f, '  ', !i) + '  ' + printInputValue(f)
      ).join('\n') + '\n' +
    '}';
}

function printFields(type) {
  const fieldMap = type.getFields();
  const fields = Object.keys(fieldMap).map(fieldName => fieldMap[fieldName]);
  return fields.map((f, i) =>
    printDescription(f, '  ', !i) + '  ' +
    f.name + printArgs(f.args, '  ') + ': ' +
    String(f.type) + printDeprecated(f)
  ).join('\n');
}

function printArgs(args, indentation = '') {
  if (args.length === 0) {
    return '';
  }

  // If every arg does not have a description, print them on one line.
  if (args.every(arg => !arg.description)) {
    return '(' + args.map(printInputValue).join(', ') + ')';
  }

  return '(\n' + args.map((arg, i) =>
    printDescription(arg, '  ' + indentation, !i) + '  ' + indentation +
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

function printDirective(directive) {
  return printDescription(directive) +
    'directive @' + directive.name + printArgs(directive.args) +
    ' on ' + directive.locations.join(' | ');
}

function printDeprecated(fieldOrEnumVal) {
  const reason = fieldOrEnumVal.deprecationReason;
  if (isNullish(reason)) {
    return '';
  }
  if (
    reason === '' ||
    reason === DEFAULT_DEPRECATION_REASON
  ) {
    return ' @deprecated';
  }
  return ' @deprecated(reason: ' +
    print(astFromValue(reason, GraphQLString)) + ')';
}

function printDescription(def, indentation = '', firstInBlock = true): string {
  if (!def.description) {
    return '';
  }
  const lines = def.description.split('\n');
  let description = indentation && !firstInBlock ? '\n' : '';
  for (let i = 0; i < lines.length; i++) {
    if (lines[i] === '') {
      description += indentation + '#\n';
    } else {
      // For > 120 character long lines, cut at space boundaries into sublines
      // of ~80 chars.
      const sublines = breakLine(lines[i], 120 - indentation.length);
      for (let j = 0; j < sublines.length; j++) {
        description += indentation + '# ' + sublines[j] + '\n';
      }
    }
  }
  return description;
}

function breakLine(line: string, len: number): Array<string> {
  if (line.length < len + 5) {
    return [ line ];
  }
  const parts = line.split(new RegExp(`((?: |^).{15,${len - 40}}(?= |$))`));
  if (parts.length < 4) {
    return [ line ];
  }
  const sublines = [ parts[0] + parts[1] + parts[2] ];
  for (let i = 3; i < parts.length; i += 2) {
    sublines.push(parts[i].slice(1) + parts[i + 1]);
  }
  return sublines;
}
