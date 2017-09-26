/**
 * Copyright (c) 2015-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
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
  NullValue: () => 'null',
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

  SchemaDefinition: ({ directives, operationTypes }) =>
    join([
      'schema',
      join(directives, ' '),
      block(operationTypes),
    ], ' '),

  OperationTypeDefinition: ({ operation, type }) =>
    operation + ': ' + type,

  ScalarTypeDefinition: ({ name, directives }) =>
    join([ 'scalar', name, join(directives, ' ') ], ' '),

  ObjectTypeDefinition: ({ name, interfaces, directives, fields }) =>
    join([
      'type',
      name,
      wrap('implements ', join(interfaces, ', ')),
      join(directives, ' '),
      block(fields)
    ], ' '),

  FieldDefinition: ({ name, arguments: args, type, directives }) =>
    name +
    wrap('(', join(args, ', '), ')') +
    ': ' + type +
    wrap(' ', join(directives, ' ')),

  InputValueDefinition: ({ name, type, defaultValue, directives }) =>
    join([
      name + ': ' + type,
      wrap('= ', defaultValue),
      join(directives, ' ')
    ], ' '),

  InterfaceTypeDefinition: ({ name, directives, fields }) =>
    join([
      'interface',
      name,
      join(directives, ' '),
      block(fields)
    ], ' '),

  UnionTypeDefinition: ({ name, directives, types }) =>
    join([
      'union',
      name,
      join(directives, ' '),
      '= ' + join(types, ' | ')
    ], ' '),

  EnumTypeDefinition: ({ name, directives, values }) =>
    join([
      'enum',
      name,
      join(directives, ' '),
      block(values)
    ], ' '),

  EnumValueDefinition: ({ name, directives }) =>
    join([ name, join(directives, ' ') ], ' '),

  InputObjectTypeDefinition: ({ name, directives, fields }) =>
    join([
      'input',
      name,
      join(directives, ' '),
      block(fields)
    ], ' '),

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
 * Given array, print each item on its own line, wrapped in an
 * indented "{ }" block.
 */
function block(array) {
  return array && array.length !== 0 ?
    indent('{\n' + join(array, '\n')) + '\n}' :
    '{}';
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
