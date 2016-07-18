/* @flow */
/**
 *  Copyright (c) 2015, Facebook, Inc.
 *  All rights reserved.
 *
 *  This source code is licensed under the BSD-style license found in the
 *  LICENSE file in the root directory of this source tree. An additional grant
 *  of patent rights can be found in the PATENTS file in the same directory.
 */

import invariant from '../jsutils/invariant';
import isNullish from '../jsutils/isNullish';
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
  ).join('\n\n') + '\n';
}

function printSchemaDefinition(schema: GraphQLSchema): string {
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

function printType(type: GraphQLType): string {
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
  return `scalar ${type.name}`;
}

function printObject(type: GraphQLObjectType): string {
  const interfaces = type.getInterfaces();
  const implementedInterfaces = interfaces.length ?
    ' implements ' + interfaces.map(i => i.name).join(', ') : '';
  return `type ${type.name}${implementedInterfaces} {\n` +
    printFields(type) + '\n' +
  '}';
}

function printInterface(type: GraphQLInterfaceType): string {
  return `interface ${type.name} {\n` +
    printFields(type) + '\n' +
  '}';
}

function printUnion(type: GraphQLUnionType): string {
  return `union ${type.name} = ${type.getTypes().join(' | ')}`;
}

function printEnum(type: GraphQLEnumType): string {
  const values = type.getValues();
  return `enum ${type.name} {\n` +
    values.map(v => '  ' + v.name + printDeprecated(v)).join('\n') + '\n' +
  '}';
}

function printInputObject(type: GraphQLInputObjectType): string {
  const fieldMap = type.getFields();
  const fields = Object.keys(fieldMap).map(fieldName => fieldMap[fieldName]);
  return `input ${type.name} {\n` +
    fields.map(f => '  ' + printInputValue(f)).join('\n') + '\n' +
  '}';
}

function printFields(type) {
  const fieldMap = type.getFields();
  const fields = Object.keys(fieldMap).map(fieldName => fieldMap[fieldName]);
  return fields.map(
    f => '  ' + f.name + printArgs(f) + ': ' +
      String(f.type) + printDeprecated(f)
  ).join('\n');
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
  return ' @deprecated(reason: ' + print(astFromValue(reason)) + ')';
}

function printArgs(fieldOrDirectives) {
  if (fieldOrDirectives.args.length === 0) {
    return '';
  }
  return '(' + fieldOrDirectives.args.map(printInputValue).join(', ') + ')';
}

function printInputValue(arg) {
  let argDecl = arg.name + ': ' + String(arg.type);
  if (!isNullish(arg.defaultValue)) {
    argDecl += ` = ${print(astFromValue(arg.defaultValue, arg.type))}`;
  }
  return argDecl;
}

function printDirective(directive) {
  return 'directive @' + directive.name + printArgs(directive) +
    ' on ' + directive.locations.join(' | ');
}
