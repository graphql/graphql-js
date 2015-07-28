/**
 *  Copyright (c) 2015, Facebook, Inc.
 *  All rights reserved.
 *
 *  This source code is licensed under the BSD-style license found in the
 *  LICENSE file in the root directory of this source tree. An additional grant
 *  of patent rights can be found in the PATENTS file in the same directory.
 */

import { visitSchema } from './visitor';
import { printDocASTReducer, join, block, wrap } from '../printer';

/**
 * Converts a Schema AST into a string, using one set of reasonable
 * formatting rules.
 */
export function printSchema(ast) {
  return visitSchema(ast, { leave: printSchemaASTReducer });
}

export var printSchemaASTReducer = {
  Name: printDocASTReducer.Name,

  // Document

  SchemaDocument: ({definitions}) =>
    join(definitions, '\n\n') + '\n',

  TypeDefinition: ({name, interfaces, fields}) =>
    'type ' + name + ' ' +
    wrap('implements ', join(interfaces, ', '), ' ') +
    block(fields),

  FieldDefinition: ({name, arguments: args, type}) =>
    name + wrap('(', join(args, ', '), ')') + ': ' + type,

  ArgumentDefinition: ({name, type, defaultValue}) =>
    name + ': ' + type + wrap(' = ', defaultValue),

  InterfaceDefinition: ({name, fields}) => `interface ${name} ${block(fields)}`,
  UnionDefinition: ({name, types}) => `union ${name} = ${join(types, ' | ')}`,
  ScalarDefinition: ({name}) => `scalar ${name}`,
  EnumDefinition: ({name, values}) => `enum ${name} ${block(values)}`,
  EnumValueDefinition: ({name}) => name,
  InputObjectDefinition: ({name, fields}) => `input ${name} ${block(fields)}`,
  InputFieldDefinition: ({name, type}) => `${name}: ${type}`,

  // Value

  IntValue: printDocASTReducer.IntValue,
  FloatValue: printDocASTReducer.FloatValue,
  StringValue: printDocASTReducer.StringValue,
  BooleanValue: printDocASTReducer.BooleanValue,
  EnumValue: printDocASTReducer.EnumValue,
  ListValue: printDocASTReducer.ListValue,
  ObjectValue: printDocASTReducer.ObjectValue,
  ObjectField: printDocASTReducer.ObjectField,

  // Type

  NamedType: printDocASTReducer.NamedType,
  ListType: printDocASTReducer.ListType,
  NonNullType: printDocASTReducer.NonNullType,
};
