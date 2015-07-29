/* @flow */
/**
 *  Copyright (c) 2015, Facebook, Inc.
 *  All rights reserved.
 *
 *  This source code is licensed under the BSD-style license found in the
 *  LICENSE file in the root directory of this source tree. An additional grant
 *  of patent rights can be found in the PATENTS file in the same directory.
 */

import { introspectionQuery } from './introspectionQuery';
import { graphql } from '../';

import type {
  IntrospectionQuery,
  IntrospectionType,
  IntrospectionScalarType,
  IntrospectionObjectType,
  IntrospectionInterfaceType,
  IntrospectionUnionType,
  IntrospectionEnumType,
  IntrospectionInputObjectType,
  IntrospectionTypeRef,
  IntrospectionListTypeRef,
  IntrospectionNonNullTypeRef,
  IntrospectionField,
  IntrospectionInputValue,
  IntrospectionEnumValue,
} from './introspectionQuery';

import type { GraphQLSchema } from './schema';

var TypeKind = {
  SCALAR: 'SCALAR',
  OBJECT: 'OBJECT',
  INTERFACE: 'INTERFACE',
  UNION: 'UNION',
  ENUM: 'ENUM',
  INPUT_OBJECT: 'INPUT_OBJECT',
  LIST: 'LIST',
  NON_NULL: 'NON_NULL',
};

// e.g Int, Int!, [Int!]!
function printTypeDecl(type: IntrospectionTypeRef): string {
  if (type.kind === TypeKind.LIST) {
    var itemTypeRef = ((type: any): IntrospectionListTypeRef).ofType;
    if (!itemTypeRef) {
      throw new Error('Decorated type deeper than introspection query.');
    }
    return '[' + printTypeDecl(itemTypeRef) + ']';
  } else if (type.kind === TypeKind.NON_NULL) {
    var nullableTypeRef = ((type: any): IntrospectionNonNullTypeRef).ofType;
    if (!nullableTypeRef) {
      throw new Error('Decorated type deeper than introspection query.');
    }
    return printTypeDecl(nullableTypeRef) + '!';
  } else {
    return type.name;
  }
}

function printField(field: IntrospectionField): string {
  return `${field.name}${printArgs(field)}: ${printTypeDecl(field.type)}`;
}

function printArg(arg: IntrospectionInputValue): string {
  var argDecl = `${arg.name}: ${printTypeDecl(arg.type)}`;
  if (arg.defaultValue !== null) {
    argDecl += ` = ${arg.defaultValue}`;
  }
  return argDecl;
}

function printArgs(field: IntrospectionField): string {
  if (field.args.length === 0) {
    return '';
  }
  return '(' + field.args.map(printArg).join(', ') + ')';
}

function printImplementedInterfaces(type: IntrospectionObjectType) {
  if (type.interfaces.length === 0) {
    return '';
  }
  return ' implements ' + type.interfaces.map(i => i.name).join(', ');
}

function printObject(type: IntrospectionObjectType) {
  return `type ${type.name}${printImplementedInterfaces(type)} {` + '\n' +
    printFields(type.fields) + '\n' +
  '}';
}

function printInterface(type: IntrospectionInterfaceType) {
  return `interface ${type.name} {` + '\n' +
    printFields(type.fields) + '\n' +
  '}';
}

function printInputObject(type: IntrospectionInputObjectType) {
  return `input ${type.name} {` + '\n' +
    printInputFields(type.inputFields) + '\n' +
  '}';
}

function printFields(fields: Array<IntrospectionField>) {
  return fields.map(f => '  ' + printField(f)).join('\n');
}

function printInputFields(fields: Array<IntrospectionInputValue>) {
  return fields.map(f => '  ' + printInputField(f)).join('\n');
}

function printInputField(field: IntrospectionInputValue) {
  return `${field.name}: ${printTypeDecl(field.type)}`;
}

function printUnion(type: IntrospectionUnionType) {
  var typeList = type.possibleTypes.map(t => t.name).join(' | ');
  return `union ${type.name} = ${typeList}`;
}

function printScalar(type: IntrospectionScalarType) {
  return `scalar ${type.name}`;
}

function printEnumValues(values: Array<IntrospectionEnumValue>) {
  return values.map(v => '  ' + v.name).join('\n');
}

function printEnum(type: IntrospectionEnumType) {
  return `enum ${type.name} {
${printEnumValues(type.enumValues)}
}`;
}

function printType(type: IntrospectionType) {
  switch (type.kind) {
    case TypeKind.OBJECT:
      return printObject(type);
    case TypeKind.UNION:
      return printUnion(type);
    case TypeKind.INTERFACE:
      return printInterface(type);
    case TypeKind.INPUT_OBJECT:
      return printInputObject(type);
    case TypeKind.SCALAR:
      return printScalar(type);
    case TypeKind.ENUM:
      return printEnum(type);
    default:
      throw new Error('Invalid kind: ' + type.kind);
  }
}

function isBuiltInScalar(type: IntrospectionScalarType): boolean {
  return type.name === 'String' ||
    type.name === 'Boolean' ||
    type.name === 'Int' ||
    type.name === 'Float' ||
    type.name === 'ID';
}

function isIntrospectionType(type: IntrospectionType): boolean {
  return type.name.startsWith('__');
}

function isBuiltIn(type: IntrospectionType): boolean {
  return isIntrospectionType(type) || isBuiltInScalar(type);
}

export async function printSchema(schema: GraphQLSchema): Promise<string> {
  return await printFilteredSchema(schema, t => !isBuiltIn(t));
}

export async function printIntrospectionSchema(
  schema: GraphQLSchema
): Promise<string> {
  return await printFilteredSchema(schema, isIntrospectionType);
}

export function printSchemaFromResult(
  result: IntrospectionQuery
): string {
  return printFilteredSchemaFromResult(result, t => !isBuiltIn(t));
}

function printFilteredSchemaFromResult(
  result: IntrospectionQuery,
  typeFilter: (type: IntrospectionType) => boolean
): string {
  var schemaResult = result.__schema;
  var types = schemaResult.types.filter(typeFilter);
  types = types.sort((t1, t2) => t1.name.localeCompare(t2.name));
  return types.map(printType).join('\n\n');
}

async function printFilteredSchema(
  schema: GraphQLSchema,
  typeFilter: (type: IntrospectionType) => boolean
): Promise<string> {
  var result = await graphql(schema, introspectionQuery);
  return printFilteredSchemaFromResult(result.data, typeFilter);
}
