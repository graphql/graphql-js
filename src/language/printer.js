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
  return visit(ast, {
    leave: {
      Name: node => node.value,
      Variable: node => '$' + node.name,

      // Document

      Document: node => join(node.definitions, '\n\n') + '\n',
      OperationDefinition(node) {
        var op = node.operation;
        var name = node.name;
        var defs = manyList('(', node.variableDefinitions, ', ', ')');
        var directives = join(node.directives, ' ');
        var selectionSet = node.selectionSet;
        return !name ? selectionSet :
          join([op, join([name, defs]), directives, selectionSet], ' ');
      },
      VariableDefinition: node =>
        join([node.variable + ': ' + node.type, node.defaultValue], ' = '),
      SelectionSet: node => blockList(node.selections, ',\n'),
      Field: node =>
        join([
          join([
            join([
              node.alias,
              node.name
            ], ': '),
            manyList('(', node.arguments, ', ', ')')
          ]),
          join(node.directives, ' '),
          node.selectionSet
        ], ' '),
      Argument: node => node.name + ': ' + node.value,

      // Fragments

      FragmentSpread: node =>
        join(['...' + node.name, join(node.directives, ' ')], ' '),
      InlineFragment: node =>
        join([
          '... on',
          node.typeCondition,
          join(node.directives, ' '),
          node.selectionSet
        ], ' '),
      FragmentDefinition: node =>
        join([
          'fragment',
          node.name,
          'on',
          node.typeCondition,
          join(node.directives, ' '),
          node.selectionSet
        ], ' '),


      // Value

      IntValue: node => node.value,
      FloatValue: node => node.value,
      StringValue: node => JSON.stringify(node.value),
      BooleanValue: node => node.value ? 'true' : 'false',
      EnumValue: node => node.value,
      ArrayValue: node => '[' + join(node.values, ', ') + ']',
      ObjectValue: node => '{' + join(node.fields, ', ') + '}',
      ObjectField: node => node.name + ': ' + node.value,

      // Directive

      Directive: node => join(['@' + node.name, node.value], ': '),

      // Type

      ListType: node => '[' + node.type + ']',
      NonNullType: node => node.type + '!',
    }
  });
}

function blockList(list, separator) {
  return length(list) === 0 ? null :
    indent('{\n' + join(list, separator)) + '\n}';
}

function indent(maybeString) {
  return maybeString && maybeString.replace(/\n/g, '\n  ');
}

function manyList(start, list, separator, end) {
  return length(list) === 0 ? null : start + join(list, separator) + end;
}

function length(maybeArray) {
  return maybeArray ? maybeArray.length : 0;
}

function join(maybeArray, separator) {
  return maybeArray ? maybeArray.filter(x => !!x).join(separator || '') : '';
}
