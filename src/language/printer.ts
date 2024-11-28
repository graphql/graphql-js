import type { Maybe } from '../jsutils/Maybe';

import type { ASTNode } from './ast';
import { printBlockString } from './blockString';
import { printString } from './printString';
import type { ASTReducer } from './visitor';
import { visit } from './visitor';

/**
 * Converts an AST into a string, using one set of reasonable
 * formatting rules.
 */
export function print(ast: ASTNode): string {
  return visit(ast, printDocASTReducer);
}

const MAX_LINE_LENGTH = 80;

const printDocASTReducer: ASTReducer<string> = {
  Name: { leave: (node) => node.value },
  Variable: { leave: (node) => '$' + node.name },

  // Document

  Document: {
    leave: (node) => truthyJoin(node.definitions, '\n\n'),
  },

  OperationDefinition: {
    leave(node) {
      const varDefs = wrap('(', truthyJoin(node.variableDefinitions, ', '), ')');
      const prefix = join(
        [
          node.operation,
          // TODO: optimize
          join([node.name, varDefs]),
          truthyJoin(node.directives, ' '),
        ],
        ' ',
      );

      // Anonymous queries with no directives or variable definitions can use
      // the query short form.
      return (prefix === 'query' ? '' : prefix + ' ') + node.selectionSet;
    },
  },

  VariableDefinition: {
    leave: ({ variable, type, defaultValue, directives }) =>
      variable +
      ': ' +
      type +
      wrap(' = ', defaultValue) +
      wrap(' ', truthyJoin(directives, ' ')),
  },
  SelectionSet: { leave: ({ selections }) => block(selections) },

  Field: {
    leave({ alias, name, arguments: args, directives, selectionSet }) {
      const prefix = wrap('', alias, ': ') + name;
      let argsLine = prefix + wrap('(', truthyJoin(args, ', '), ')');

      if (argsLine.length > MAX_LINE_LENGTH) {
        argsLine = prefix + wrap('(\n', indent(truthyJoin(args, '\n')), '\n)');
      }

      return join([argsLine, truthyJoin(directives, ' '), selectionSet], ' ');
    },
  },

  Argument: { leave: ({ name, value }) => name + ': ' + value },

  // Fragments

  FragmentSpread: {
    leave: ({ name, directives }) =>
      '...' + name + wrap(' ', truthyJoin(directives, ' ')),
  },

  InlineFragment: {
    leave: ({ typeCondition, directives, selectionSet }) =>
      join(
        [
          '...',
          wrap('on ', typeCondition),
          truthyJoin(directives, ' '),
          selectionSet,
        ],
        ' ',
      ),
  },

  FragmentDefinition: {
    leave: ({
      name,
      typeCondition,
      variableDefinitions,
      directives,
      selectionSet,
    }) =>
      // Note: fragment variable definitions are experimental and may be changed
      // or removed in the future.
      `fragment ${name}${wrap('(', truthyJoin(variableDefinitions, ', '), ')')} ` +
      `on ${typeCondition} ${wrap('', truthyJoin(directives, ' '), ' ')}` +
      selectionSet,
  },

  // Value

  IntValue: { leave: ({ value }) => value },
  FloatValue: { leave: ({ value }) => value },
  StringValue: {
    leave: ({ value, block: isBlockString }) =>
      isBlockString ? printBlockString(value) : printString(value),
  },
  BooleanValue: { leave: ({ value }) => (value ? 'true' : 'false') },
  NullValue: { leave: () => 'null' },
  EnumValue: { leave: ({ value }) => value },
  ListValue: { leave: ({ values }) => '[' + truthyJoin(values, ', ') + ']' },
  ObjectValue: { leave: ({ fields }) => '{' + truthyJoin(fields, ', ') + '}' },
  ObjectField: { leave: ({ name, value }) => name + ': ' + value },

  // Directive

  Directive: {
    leave: ({ name, arguments: args }) =>
      '@' + name + wrap('(', truthyJoin(args, ', '), ')'),
  },

  // Type

  NamedType: { leave: ({ name }) => name },
  ListType: { leave: ({ type }) => '[' + type + ']' },
  NonNullType: { leave: ({ type }) => type + '!' },

  // Type System Definitions

  SchemaDefinition: {
    leave: ({ description, directives, operationTypes }) =>
      wrap('', description, '\n') +
      join(['schema', join(directives, ' '), block(operationTypes)], ' '),
  },

  OperationTypeDefinition: {
    leave: ({ operation, type }) => operation + ': ' + type,
  },

  ScalarTypeDefinition: {
    leave: ({ description, name, directives }) =>
      wrap('', description, '\n') +
      join(['scalar', name, truthyJoin(directives, ' ')], ' '),
  },

  ObjectTypeDefinition: {
    leave: ({ description, name, interfaces, directives, fields }) =>
      wrap('', description, '\n') +
      join(
        [
          'type',
          name,
          wrap('implements ', truthyJoin(interfaces, ' & ')),
          truthyJoin(directives, ' '),
          block(fields),
        ],
        ' ',
      ),
  },

  FieldDefinition: {
    leave: ({ description, name, arguments: args, type, directives }) =>
      wrap('', description, '\n') +
      name +
      (hasMultilineItems(args)
        ? wrap('(\n', indent(truthyJoin(args, '\n')), '\n)')
        : wrap('(', truthyJoin(args, ', '), ')')) +
      ': ' +
      type +
      wrap(' ', truthyJoin(directives, ' ')),
  },

  InputValueDefinition: {
    leave: ({ description, name, type, defaultValue, directives }) =>
      wrap('', description, '\n') +
      join(
        [name + ': ' + type, wrap('= ', defaultValue), truthyJoin(directives, ' ')],
        ' ',
      ),
  },

  InterfaceTypeDefinition: {
    leave: ({ description, name, interfaces, directives, fields }) =>
      wrap('', description, '\n') +
      join(
        [
          'interface',
          name,
          wrap('implements ', truthyJoin(interfaces, ' & ')),
          truthyJoin(directives, ' '),
          block(fields),
        ],
        ' ',
      ),
  },

  UnionTypeDefinition: {
    leave: ({ description, name, directives, types }) =>
      wrap('', description, '\n') +
      join(
        ['union', name, truthyJoin(directives, ' '), wrap('= ', truthyJoin(types, ' | '))],
        ' ',
      ),
  },

  EnumTypeDefinition: {
    leave: ({ description, name, directives, values }) =>
      wrap('', description, '\n') +
      join(['enum', name, truthyJoin(directives, ' '), block(values)], ' '),
  },

  EnumValueDefinition: {
    leave: ({ description, name, directives }) =>
      wrap('', description, '\n') + join([name, truthyJoin(directives, ' ')], ' '),
  },

  InputObjectTypeDefinition: {
    leave: ({ description, name, directives, fields }) =>
      wrap('', description, '\n') +
      join(['input', name, truthyJoin(directives, ' '), block(fields)], ' '),
  },

  DirectiveDefinition: {
    leave: ({ description, name, arguments: args, repeatable, locations }) =>
      wrap('', description, '\n') +
      'directive @' +
      name +
      (hasMultilineItems(args)
        ? wrap('(\n', indent(truthyJoin(args, '\n')), '\n)')
        : wrap('(', truthyJoin(args, ', '), ')')) +
      (repeatable ? ' repeatable' : '') +
      ' on ' +
      truthyJoin(locations, ' | '),
  },

  SchemaExtension: {
    leave: ({ directives, operationTypes }) =>
      join(
        ['extend schema', truthyJoin(directives, ' '), block(operationTypes)],
        ' ',
      ),
  },

  ScalarTypeExtension: {
    leave: ({ name, directives }) =>
      join(['extend scalar', name, truthyJoin(directives, ' ')], ' '),
  },

  ObjectTypeExtension: {
    leave: ({ name, interfaces, directives, fields }) =>
      join(
        [
          'extend type',
          name,
          wrap('implements ', truthyJoin(interfaces, ' & ')),
          truthyJoin(directives, ' '),
          block(fields),
        ],
        ' ',
      ),
  },

  InterfaceTypeExtension: {
    leave: ({ name, interfaces, directives, fields }) =>
      join(
        [
          'extend interface',
          name,
          wrap('implements ', truthyJoin(interfaces, ' & ')),
          truthyJoin(directives, ' '),
          block(fields),
        ],
        ' ',
      ),
  },

  UnionTypeExtension: {
    leave: ({ name, directives, types }) =>
      join(
        [
          'extend union',
          name,
          truthyJoin(directives, ' '),
          wrap('= ', truthyJoin(types, ' | ')),
        ],
        ' ',
      ),
  },

  EnumTypeExtension: {
    leave: ({ name, directives, values }) =>
      join(['extend enum', name, truthyJoin(directives, ' '), block(values)], ' '),
  },

  InputObjectTypeExtension: {
    leave: ({ name, directives, fields }) =>
      join(['extend input', name, truthyJoin(directives, ' '), block(fields)], ' '),
  },
};

/**
 * Given maybeArray, print an empty string if it is null or empty, otherwise
 * print all items together separated by separator if provided
 */
function join(
  maybeArray: Maybe<ReadonlyArray<string | undefined>>,
  separator = '',
): string {
  if (!maybeArray) return ''

  const list = maybeArray.filter((x) => x);
  const listLength = list.length;
  let result = '';
  for (let i = 0; i < listLength; i++) {
    if (i === listLength - 1) return result + list[i];
    else result += list[i] + separator;
  }
  return result
}

function truthyJoin(
  list: ReadonlyArray<string> | undefined,
  separator: string,
): string {
  if (!list) return ''
  const listLength = list.length;
  let result = '';
  for (let i = 0; i < listLength; i++) {
    if (i === listLength - 1) return result + list[i];
    else result += list[i] + separator;
  }
  return result
}

/**
 * Given array, print each item on its own line, wrapped in an indented `{ }` block.
 */
function block(array: Maybe<ReadonlyArray<string | undefined>>): string {
  return wrap('{\n', indent(join(array, '\n')), '\n}');
}

/**
 * If maybeString is not null or empty, then wrap with start and end, otherwise print an empty string.
 */
function wrap(
  start: string,
  maybeString: Maybe<string>,
  end: string = '',
): string {
  return maybeString != null && maybeString !== ''
    ? start + maybeString + end
    : '';
}

function indent(str: string): string {
  return wrap('  ', str.replace(/\n/g, '\n  '));
}

function hasMultilineItems(maybeArray: Maybe<ReadonlyArray<string>>): boolean {
  // FIXME: https://github.com/graphql/graphql-js/issues/2203
  /* c8 ignore next */
  return maybeArray?.some((str) => str.includes('\n')) ?? false;
}
