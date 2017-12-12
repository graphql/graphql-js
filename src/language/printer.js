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
    return !name && !directives && !varDefs && op === 'query'
      ? selectionSet
      : join([op, join([name, varDefs]), directives, selectionSet], ' ');
  },

  VariableDefinition: ({ variable, type, defaultValue }) =>
    variable + ': ' + type + wrap(' = ', defaultValue),

  SelectionSet: ({ selections }) => block(selections),

  Field: ({ alias, name, arguments: args, directives, selectionSet }) =>
    join(
      [
        wrap('', alias, ': ') + name + wrap('(', join(args, ', '), ')'),
        join(directives, ' '),
        selectionSet,
      ],
      ' ',
    ),

  Argument: ({ name, value }) => name + ': ' + value,

  // Fragments

  FragmentSpread: ({ name, directives }) =>
    '...' + name + wrap(' ', join(directives, ' ')),

  InlineFragment: ({ typeCondition, directives, selectionSet }) =>
    join(
      ['...', wrap('on ', typeCondition), join(directives, ' '), selectionSet],
      ' ',
    ),

  FragmentDefinition: ({
    name,
    typeCondition,
    variableDefinitions,
    directives,
    selectionSet,
  }) =>
    // Note: fragment variable definitions are experimental and may be changed
    // or removed in the future.
    `fragment ${name}${wrap('(', join(variableDefinitions, ', '), ')')} ` +
    `on ${typeCondition} ${wrap('', join(directives, ' '), ' ')}` +
    selectionSet,

  // Value

  IntValue: ({ value }) => value,
  FloatValue: ({ value }) => value,
  StringValue: ({ value, block: isBlockString }, key) =>
    isBlockString
      ? printBlockString(value, key === 'description')
      : JSON.stringify(value),
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
    join(['schema', join(directives, ' '), block(operationTypes)], ' '),

  OperationTypeDefinition: ({ operation, type }) => operation + ': ' + type,

  ScalarTypeDefinition: ({ description, name, directives }) =>
    join(
      [description, join(['scalar', name, join(directives, ' ')], ' ')],
      '\n',
    ),

  ObjectTypeDefinition: ({
    description,
    name,
    interfaces,
    directives,
    fields,
  }) =>
    join(
      [
        description,
        join(
          [
            'type',
            name,
            wrap('implements ', join(interfaces, ', ')),
            join(directives, ' '),
            block(fields),
          ],
          ' ',
        ),
      ],
      '\n',
    ),

  FieldDefinition: ({ description, name, arguments: args, type, directives }) =>
    join(
      [
        description,
        name +
          wrap('(', join(args, ', '), ')') +
          ': ' +
          type +
          wrap(' ', join(directives, ' ')),
      ],
      '\n',
    ),

  InputValueDefinition: ({
    description,
    name,
    type,
    defaultValue,
    directives,
  }) =>
    join(
      [
        description,
        join(
          [name + ': ' + type, wrap('= ', defaultValue), join(directives, ' ')],
          ' ',
        ),
      ],
      '\n',
    ),

  InterfaceTypeDefinition: ({ description, name, directives, fields }) =>
    join(
      [
        description,
        join(['interface', name, join(directives, ' '), block(fields)], ' '),
      ],
      '\n',
    ),

  UnionTypeDefinition: ({ description, name, directives, types }) =>
    join(
      [
        description,
        join(
          [
            'union',
            name,
            join(directives, ' '),
            types && types.length !== 0 ? '= ' + join(types, ' | ') : '',
          ],
          ' ',
        ),
      ],
      '\n',
    ),

  EnumTypeDefinition: ({ description, name, directives, values }) =>
    join(
      [
        description,
        join(['enum', name, join(directives, ' '), block(values)], ' '),
      ],
      '\n',
    ),

  EnumValueDefinition: ({ description, name, directives }) =>
    join([description, join([name, join(directives, ' ')], ' ')], '\n'),

  InputObjectTypeDefinition: ({ description, name, directives, fields }) =>
    join(
      [
        description,
        join(['input', name, join(directives, ' '), block(fields)], ' '),
      ],
      '\n',
    ),

  ScalarTypeExtension: ({ name, directives }) =>
    join(['extend scalar', name, join(directives, ' ')], ' '),

  ObjectTypeExtension: ({ name, interfaces, directives, fields }) =>
    join(
      [
        'extend type',
        name,
        wrap('implements ', join(interfaces, ', ')),
        join(directives, ' '),
        block(fields),
      ],
      ' ',
    ),

  InterfaceTypeExtension: ({ name, directives, fields }) =>
    join(['extend interface', name, join(directives, ' '), block(fields)], ' '),

  UnionTypeExtension: ({ name, directives, types }) =>
    join(
      [
        'extend union',
        name,
        join(directives, ' '),
        types && types.length !== 0 ? '= ' + join(types, ' | ') : '',
      ],
      ' ',
    ),

  EnumTypeExtension: ({ name, directives, values }) =>
    join(['extend enum', name, join(directives, ' '), block(values)], ' '),

  InputObjectTypeExtension: ({ name, directives, fields }) =>
    join(['extend input', name, join(directives, ' '), block(fields)], ' '),

  DirectiveDefinition: ({ description, name, arguments: args, locations }) =>
    join(
      [
        description,
        'directive @' +
          name +
          wrap('(', join(args, ', '), ')') +
          ' on ' +
          join(locations, ' | '),
      ],
      '\n',
    ),
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
  return array && array.length !== 0
    ? indent('{\n' + join(array, '\n')) + '\n}'
    : '';
}

/**
 * If maybeString is not null or empty, then wrap with start and end, otherwise
 * print an empty string.
 */
function wrap(start, maybeString, end) {
  return maybeString ? start + maybeString + (end || '') : '';
}

function indent(maybeString) {
  return maybeString && maybeString.replace(/\n/g, '\n  ');
}

/**
 * Print a block string in the indented block form by adding a leading and
 * trailing blank line. However, if a block string starts with whitespace and is
 * a single-line, adding a leading blank line would strip that whitespace.
 */
function printBlockString(value, isDescription) {
  return (value[0] === ' ' || value[0] === '\t') && value.indexOf('\n') === -1
    ? `"""${value.replace(/"""/g, '\\"""')}"""`
    : isDescription
      ? '"""\n' + value.replace(/"""/g, '\\"""') + '\n"""'
      : indent('"""\n' + value.replace(/"""/g, '\\"""')) + '\n"""';
}
