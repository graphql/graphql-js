import type { ASTNode } from './ast';

import { visit } from './visitor';
import { printBlockString } from './blockString';

/**
 * Converts an AST into a string, using one set of reasonable
 * formatting rules.
 */
export function print(ast: ASTNode): string {
  return visit(ast, { leave: printDocASTReducer });
}

const MAX_LINE_LENGTH = 80;

// TODO: provide better type coverage in future
const printDocASTReducer: any = {
  Name: (node) => node.value,
  Variable: (node) => '$' + node.name,

  // Document

  Document: (node) => join(node.definitions, '\n\n') + '\n',

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

  VariableDefinition: ({ variable, type, defaultValue, directives }) =>
    variable +
    ': ' +
    type +
    wrap(' = ', defaultValue) +
    wrap(' ', join(directives, ' ')),
  SelectionSet: ({ selections }) => block(selections),

  Field: ({ alias, name, arguments: args, directives, selectionSet }) => {
    const prefix = wrap('', alias, ': ') + name;
    let argsLine = prefix + wrap('(', join(args, ', '), ')');

    if (argsLine.length > MAX_LINE_LENGTH) {
      argsLine = prefix + wrap('(\n', indent(join(args, '\n')), '\n)');
    }

    return join([argsLine, join(directives, ' '), selectionSet], ' ');
  },

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
  StringValue: ({ value, block: isBlockString }) =>
    isBlockString ? printBlockString(value) : JSON.stringify(value),
  BooleanValue: ({ value }) => (value ? 'true' : 'false'),
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

  SchemaDefinition: ({ description, directives, operationTypes }) =>
    wrap('', description, '\n') +
    join(['schema', join(directives, ' '), block(operationTypes)], ' '),

  OperationTypeDefinition: ({ operation, type }) => operation + ': ' + type,

  ScalarTypeDefinition: ({ description, name, directives }) =>
    wrap('', description, '\n') +
    join(['scalar', name, join(directives, ' ')], ' '),

  ObjectTypeDefinition: ({
    description,
    name,
    interfaces,
    directives,
    fields,
  }) =>
    wrap('', description, '\n') +
    join(
      [
        'type',
        name,
        wrap('implements ', join(interfaces, ' & ')),
        join(directives, ' '),
        block(fields),
      ],
      ' ',
    ),

  FieldDefinition: ({ description, name, arguments: args, type, directives }) =>
    wrap('', description, '\n') +
    name +
    (hasMultilineItems(args)
      ? wrap('(\n', indent(join(args, '\n')), '\n)')
      : wrap('(', join(args, ', '), ')')) +
    ': ' +
    type +
    wrap(' ', join(directives, ' ')),

  InputValueDefinition: ({
    description,
    name,
    type,
    defaultValue,
    directives,
  }) =>
    wrap('', description, '\n') +
    join(
      [name + ': ' + type, wrap('= ', defaultValue), join(directives, ' ')],
      ' ',
    ),

  InterfaceTypeDefinition: ({
    description,
    name,
    interfaces,
    directives,
    fields,
  }) =>
    wrap('', description, '\n') +
    join(
      [
        'interface',
        name,
        wrap('implements ', join(interfaces, ' & ')),
        join(directives, ' '),
        block(fields),
      ],
      ' ',
    ),

  UnionTypeDefinition: ({ description, name, directives, types }) =>
    wrap('', description, '\n') +
    join(
      [
        'union',
        name,
        join(directives, ' '),
        types && types.length !== 0 ? '= ' + join(types, ' | ') : '',
      ],
      ' ',
    ),

  EnumTypeDefinition: ({ description, name, directives, values }) =>
    wrap('', description, '\n') +
    join(['enum', name, join(directives, ' '), block(values)], ' '),

  EnumValueDefinition: ({ description, name, directives }) =>
    wrap('', description, '\n') + join([name, join(directives, ' ')], ' '),

  InputObjectTypeDefinition: ({ description, name, directives, fields }) =>
    wrap('', description, '\n') +
    join(['input', name, join(directives, ' '), block(fields)], ' '),

  DirectiveDefinition: ({
    description,
    name,
    arguments: args,
    repeatable,
    locations,
  }) =>
    wrap('', description, '\n') +
    'directive @' +
    name +
    (hasMultilineItems(args)
      ? wrap('(\n', indent(join(args, '\n')), '\n)')
      : wrap('(', join(args, ', '), ')')) +
    (repeatable ? ' repeatable' : '') +
    ' on ' +
    join(locations, ' | '),

  SchemaExtension: ({ directives, operationTypes }) =>
    join(['extend schema', join(directives, ' '), block(operationTypes)], ' '),

  ScalarTypeExtension: ({ name, directives }) =>
    join(['extend scalar', name, join(directives, ' ')], ' '),

  ObjectTypeExtension: ({ name, interfaces, directives, fields }) =>
    join(
      [
        'extend type',
        name,
        wrap('implements ', join(interfaces, ' & ')),
        join(directives, ' '),
        block(fields),
      ],
      ' ',
    ),

  InterfaceTypeExtension: ({ name, interfaces, directives, fields }) =>
    join(
      [
        'extend interface',
        name,
        wrap('implements ', join(interfaces, ' & ')),
        join(directives, ' '),
        block(fields),
      ],
      ' ',
    ),

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
};

/**
 * Given maybeArray, print an empty string if it is null or empty, otherwise
 * print all items together separated by separator if provided
 */
function join(maybeArray: ?Array<string>, separator = ''): string {
  return maybeArray?.filter((x) => x).join(separator) ?? '';
}

/**
 * Given array, print each item on its own line, wrapped in an
 * indented "{ }" block.
 */
function block(array: ?Array<string>): string {
  return wrap('{\n', indent(join(array, '\n')), '\n}');
}

/**
 * If maybeString is not null or empty, then wrap with start and end, otherwise print an empty string.
 */
function wrap(start: string, maybeString: ?string, end: string = ''): string {
  return maybeString != null && maybeString !== ''
    ? start + maybeString + end
    : '';
}

function indent(str: string): string {
  return wrap('  ', str.replace(/\n/g, '\n  '));
}

function isMultiline(str: string): boolean {
  return str.indexOf('\n') !== -1;
}

function hasMultilineItems(maybeArray: ?Array<string>): boolean {
  return maybeArray != null && maybeArray.some(isMultiline);
}
