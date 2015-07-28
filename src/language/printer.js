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

export var printDocASTReducer = {
  Name: node => node.value,
  Variable: node => '$' + node.name,

  // Document

  Document: node => join(node.definitions, '\n\n') + '\n',

  OperationDefinition(node) {
    var op = node.operation;
    var name = node.name;
    var defs = wrap('(', join(node.variableDefinitions, ', '), ')');
    var directives = join(node.directives, ' ');
    var selectionSet = node.selectionSet;
    return !name ? selectionSet :
      join([op, join([name, defs]), directives, selectionSet], ' ');
  },

  VariableDefinition: ({variable, type, defaultValue}) =>
    variable + ': ' + type + wrap(' = ', defaultValue),

  SelectionSet: ({selections}) => block(selections),

  Field: ({alias, name, arguments: args, directives, selectionSet}) =>
    join([
      wrap('', alias, ': ') + name + wrap('(', join(args, ', '), ')'),
      join(directives, ' '),
      selectionSet
    ], ' '),

  Argument: ({name, value}) => name + ': ' + value,

  // Fragments

  FragmentSpread: ({name, directives}) =>
    '...' + name + wrap(' ', join(directives, ' ')),

  InlineFragment: ({typeCondition, directives, selectionSet}) =>
    `... on ${typeCondition} ` +
    wrap('', join(directives, ' '), ' ') +
    selectionSet,

  FragmentDefinition: ({name, typeCondition, directives, selectionSet}) =>
    `fragment ${name} on ${typeCondition} ` +
    wrap('', join(directives, ' '), ' ') +
    selectionSet,

  // Value

  IntValue: ({value}) => value,
  FloatValue: ({value}) => value,
  StringValue: ({value}) => JSON.stringify(value),
  BooleanValue: ({value}) => JSON.stringify(value),
  EnumValue: ({value}) => value,
  ListValue: ({values}) => '[' + join(values, ', ') + ']',
  ObjectValue: ({fields}) => '{' + join(fields, ', ') + '}',
  ObjectField: ({name, value}) => name + ': ' + value,

  // Directive

  Directive: ({name, arguments: args}) =>
    '@' + name + wrap('(', join(args, ', '), ')'),

  // Type

  NamedType: ({name}) => name,
  ListType: ({type}) => '[' + type + ']',
  NonNullType: ({type}) => type + '!',
};

/**
 * Given maybeArray, print an empty string if it is null or empty, otherwise
 * print all items together separated by separator if provided
 */
export function join(maybeArray, separator) {
  return maybeArray ? maybeArray.filter(x => !!x).join(separator || '') : '';
}

/**
 * Given maybeArray, print an empty string if it is null or empty, otherwise
 * print each item on it's own line, wrapped in an indented "{ }" block.
 */
export function block(maybeArray) {
  return length(maybeArray) ?
    indent('{\n' + join(maybeArray, '\n')) + '\n}' :
    '';
}

/**
 * If maybeString is not null or empty, then wrap with start and end, otherwise
 * print an empty string.
 */
export function wrap(start, maybeString, end) {
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
