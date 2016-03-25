/**
 *  Copyright (c) 2015, Facebook, Inc.
 *  All rights reserved.
 *
 *  This source code is licensed under the BSD-style license found in the
 *  LICENSE file in the root directory of this source tree. An additional grant
 *  of patent rights can be found in the PATENTS file in the same directory.
 */

import { visit } from './visitor';

/**
 * Converts an AST into a string, using one set of reasonable
 * formatting rules.
 */
export function print(ast) {
  return visit(ast, { leave: printDocASTReducer });
}

const printDocASTReducer = {
  Name: node => node.value,
  Variable: node => '$' + node.name,

  // Document

  Document: node => join(node.definitions, '\n\n') + '\n',

  OperationDefinition(node) {
    const op = node.operation;
    const name = node.name;
    const varDefs = wrap('(', join(node.variableDefinitions, ', '), ')');
    const directives = join(node.directives, ' ');
    const selectionSet = node.selectionSet;
    // Anonymous queries with no directives or variable definitions can use
    // the query short form.
    return !name && !directives && !varDefs && op === 'query' ?
      selectionSet :
      join([ op, join([ name, varDefs ]), directives, selectionSet ], ' ');
  },

  VariableDefinition: ({ variable, type, defaultValue }) =>
    variable + ': ' + type + wrap(' = ', defaultValue),

  SelectionSet: ({ selections }) => block(selections),

  Field: ({ alias, name, arguments: args, directives, selectionSet }) =>
    join([
      wrap('', alias, ': ') + name + wrap('(', join(args, ', '), ')'),
      join(directives, ' '),
      selectionSet
    ], ' '),

  Argument: ({ name, value }) => name + ': ' + value,

  // Fragments

  FragmentSpread: ({ name, directives }) =>
    '...' + name + wrap(' ', join(directives, ' ')),

  InlineFragment: ({ typeCondition, directives, selectionSet }) =>
    join([
      '...',
      wrap('on ', typeCondition),
      join(directives, ' '),
      selectionSet
    ], ' '),

  FragmentDefinition: ({ name, typeCondition, directives, selectionSet }) =>
    `fragment ${name} on ${typeCondition} ` +
    wrap('', join(directives, ' '), ' ') +
    selectionSet,

  // Value

  IntValue: ({ value }) => value,
  FloatValue: ({ value }) => value,
  StringValue: ({ value }) => JSON.stringify(value),
  BooleanValue: ({ value }) => JSON.stringify(value),
  EnumValue: ({ value }) => value,
  ListValue: ({ values }) => '[' + join(values, ', ') + ']',
  ObjectValue: ({ fields }) => '{' + join(fields, ', ') + '}',
  ObjectField: ({ name, value }) => name + ': ' + value,

  // Directive

  Directive: ({ name, arguments: args }) =>
    '@' + name + wrap('(', join(args, ', '), ')'),

  // Type

  NamedType: ({ name }) => name,
  ListType: ({ type }) => '[' + type + ']',
  NonNullType: ({ type }) => type + '!',

  // Type System Definitions

  SchemaDefinition: ({ operationTypes }) =>
    'schema ' + block(operationTypes),

  OperationTypeDefinition: ({ operation, type }) =>
    operation + ': ' + type,

  ScalarTypeDefinition: ({ name }) =>
    `scalar ${name}`,

  ObjectTypeDefinition: ({ name, interfaces, fields }) =>
    'type ' + name + ' ' +
    wrap('implements ', join(interfaces, ', '), ' ') +
    block(fields),

  FieldDefinition: ({ name, arguments: args, type }) =>
    name + wrap('(', join(args, ', '), ')') + ': ' + type,

  InputValueDefinition: ({ name, type, defaultValue }) =>
    name + ': ' + type + wrap(' = ', defaultValue),

  InterfaceTypeDefinition: ({ name, fields }) =>
    `interface ${name} ${block(fields)}`,

  UnionTypeDefinition: ({ name, types }) =>
    `union ${name} = ${join(types, ' | ')}`,

  EnumTypeDefinition: ({ name, values }) =>
    `enum ${name} ${block(values)}`,

  EnumValueDefinition: ({ name }) => name,

  InputObjectTypeDefinition: ({ name, fields }) =>
    `input ${name} ${block(fields)}`,

  TypeExtensionDefinition: ({ definition }) => `extend ${definition}`,

  DirectiveDefinition: ({ name, arguments: args, locations }) =>
    'directive @' + name + wrap('(', join(args, ', '), ')') +
    ' on ' + join(locations, ' | '),
};

/**
 * Given maybeArray, print an empty string if it is null or empty, otherwise
 * print all items together separated by separator if provided
 */
function join(maybeArray, separator) {
  return maybeArray ? maybeArray.filter(x => x).join(separator || '') : '';
}

/**
 * Given maybeArray, print an empty string if it is null or empty, otherwise
 * print each item on its own line, wrapped in an indented "{ }" block.
 */
function block(maybeArray) {
  return length(maybeArray) ?
    indent('{\n' + join(maybeArray, '\n')) + '\n}' :
    '';
}

/**
 * If maybeString is not null or empty, then wrap with start and end, otherwise
 * print an empty string.
 */
function wrap(start, maybeString, end) {
  return maybeString ?
    start + maybeString + (end || '') :
    '';
}

function indent(maybeString) {
  return maybeString && maybeString.replace(/\n/g, '\n  ');
}

function length(maybeArray) {
  return maybeArray ? maybeArray.length : 0;
}
