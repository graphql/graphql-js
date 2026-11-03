/** @category Printing */

import type { Maybe } from '../jsutils/Maybe';

import type { ASTNode } from './ast';
import { printBlockString } from './blockString';
import { printString } from './printString';
import type { ASTReducer } from './reducer';
import { reduce } from './reducer';

interface PrintOptions {
  /** Maximum indentation depth. Defaults to Infinity. */
  maxIndentDepth?: number;
}

/**
 * Prints an AST with indentation and inserted newlines disabled at the given depth.
 * @param ast - The GraphQL AST node to print.
 * @param options - Output configuration.
 * Indentation depth defaults to `Infinity`.
 * @returns A string representation of the AST.
 * @example
 * ```ts
 * import { parse, print } from 'graphql/language';
 *
 * print(parse('{ a { b } }'), { maxIndentDepth: 0 }); // => '{ a { b } }'
 * ```
 */
export function print(
  ast: ASTNode,
  // eslint-disable-next-line @typescript-eslint/unified-signatures -- Keep callback compatibility.
  options: PrintOptions,
): string;

/**
 * Converts an AST into a string, using one set of reasonable
 * formatting rules.
 * @param ast - The GraphQL AST node to print.
 * @returns A stable string representation of the AST.
 * @example
 * ```ts
 * import { parse, print } from 'graphql';
 *
 * const ast = parse('{ hero { name } }');
 * const text = print(ast); // => '{\n  hero {\n    name\n  }\n}'
 * ```
 */
export function print(ast: ASTNode): string;
/** @internal */
export function print(ast: ASTNode, options?: PrintOptions): string {
  return render(
    reduce(ast, printDocASTReducer),
    options?.maxIndentDepth ?? Infinity,
  );
}

/** @internal */
export function printForError(ast: ASTNode): string {
  return print(ast, { maxIndentDepth: 100 });
}

// The wrapping limit applies to total string length, including newlines.
const MAX_LINE_LENGTH = 80;

class PrintBuffer {
  length: number;
  newlines: number;
  lines: string | ReadonlyArray<string>;
  next: PrintBuffer | undefined = undefined;
  tail: PrintBuffer = this;
  indentBefore = false;
  dedentAfter = false;
  isBlockString: boolean;

  constructor(value = '', isBlockString = false) {
    this.length = value.length;
    this.lines = value.includes('\n') ? value.split('\n') : value;
    this.newlines = typeof this.lines === 'string' ? 0 : this.lines.length - 1;
    this.isBlockString = isBlockString;
  }

  append(result: string | PrintBuffer): this {
    if (result.length === 0) {
      return this;
    }
    const next = typeof result === 'string' ? new PrintBuffer(result) : result;
    this.tail.next = next;
    this.tail = next.tail;
    this.length += next.length;
    this.newlines += next.newlines;
    return this;
  }

  indent(): this {
    if (this.length === 0) {
      return this;
    }
    this.indentBefore = true;
    this.tail.dedentAfter = true;
    this.length += 2 * (this.newlines + 1);
    return this;
  }
}

const EMPTY = new PrintBuffer();

function render(buffer: PrintBuffer, maxDepth: number): string {
  let output = '';
  let text = '';
  let depth = 0;
  let indentation = '';
  let part: PrintBuffer | undefined = buffer;
  while (part !== undefined) {
    const lines = part.lines;
    if (part.indentBefore) {
      if (depth < maxDepth) {
        indentation += '  ';
        text += '  ';
      }
      depth++;
    }
    if (typeof lines === 'string') {
      text += lines;
    } else {
      text += lines[0];
      const newline =
        !part.isBlockString && depth >= maxDepth ? ' ' : '\n' + indentation;
      for (let i = 1; i < lines.length; i++) {
        output += text;
        text = newline + lines[i];
      }
    }
    if (part.dedentAfter) {
      depth--;
      indentation = indentation.slice(0, depth * 2);
    }
    part = part.next;
  }
  return output + text;
}

const printDocASTReducer: Required<ASTReducer<PrintBuffer>> = {
  Name: (node) => new PrintBuffer(node.value),
  Variable: (node) => join(['$', node.name]),

  // Document

  Document: (node) => join(node.definitions, '\n\n'),

  OperationDefinition(node) {
    const varDefs = hasMultilineItems(node.variableDefinitions)
      ? wrap('(\n', join(node.variableDefinitions, '\n'), '\n)')
      : wrap('(', join(node.variableDefinitions, ', '), ')');
    const prefix = join([
      wrap('', node.description, '\n'),
      join(
        [
          node.operation,
          join([node.name, varDefs]),
          join(node.directives, ' '),
        ],
        ' ',
      ),
    ]);

    // Anonymous queries with no directives or variable definitions can use
    // the query short form.
    return join([
      node.operation === 'query' && prefix.length === node.operation.length
        ? ''
        : join([prefix, ' ']),
      node.selectionSet,
    ]);
  },

  VariableDefinition: ({
    variable,
    type,
    defaultValue,
    directives,
    description,
  }) =>
    join([
      wrap('', description, '\n'),
      variable,
      ': ',
      type,
      wrap(' = ', defaultValue),
      wrap(' ', join(directives, ' ')),
    ]),
  SelectionSet: ({ selections }) => block(selections),

  Field({ alias, name, arguments: args, directives, selectionSet }) {
    const prefix = join([wrap('', alias, ': '), name], '');

    return join([
      wrappedLineAndArgs(prefix, args),
      wrap(' ', join(directives, ' ')),
      wrap(' ', selectionSet),
    ]);
  },
  Argument: ({ name, value }) => join([name, ': ', value]),

  // Fragments

  FragmentSpread: ({ name, directives }) =>
    join(['...', name, wrap(' ', join(directives, ' '))]),

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
    description,
  }) =>
    join([
      wrap('', description, '\n'),
      // Note: fragment variable definitions are experimental and may be changed
      // or removed in the future.
      'fragment ',
      name,
      wrap('(', join(variableDefinitions, ', '), ')'),
      ' on ',
      typeCondition,
      ' ',
      wrap('', join(directives, ' '), ' '),
      selectionSet,
    ]),

  // Value

  IntValue: ({ value }) => new PrintBuffer(value),
  FloatValue: ({ value }) => new PrintBuffer(value),
  StringValue: ({ value, block: isBlockString }) =>
    new PrintBuffer(
      isBlockString === true ? printBlockString(value) : printString(value),
      isBlockString === true,
    ),
  BooleanValue: ({ value }) => new PrintBuffer(value ? 'true' : 'false'),
  NullValue: () => new PrintBuffer('null'),
  EnumValue: ({ value }) => new PrintBuffer(value),
  ListValue: ({ values }) => join(['[', join(values, ', '), ']']),
  ObjectValue: ({ fields }) => join(['{', join(fields, ', '), '}']),
  ObjectField: ({ name, value }) => join([name, ': ', value]),

  // Directive

  Directive: ({ name, arguments: args }) =>
    join(['@', name, wrap('(', join(args, ', '), ')')]),

  // Type

  NamedType: ({ name }) => name,
  ListType: ({ type }) => join(['[', type, ']']),
  NonNullType: ({ type }) => join([type, '!']),

  // Type System Definitions

  SchemaDefinition: ({ description, directives, operationTypes }) =>
    join([
      wrap('', description, '\n'),
      join(['schema', join(directives, ' '), block(operationTypes)], ' '),
    ]),

  OperationTypeDefinition: ({ operation, type }) =>
    join([operation, ': ', type]),

  ScalarTypeDefinition: ({ description, name, directives }) =>
    join([
      wrap('', description, '\n'),
      join(['scalar', name, join(directives, ' ')], ' '),
    ]),

  ObjectTypeDefinition: ({
    description,
    name,
    interfaces,
    directives,
    fields,
  }) =>
    join([
      wrap('', description, '\n'),
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
    ]),

  FieldDefinition: ({ description, name, arguments: args, type, directives }) =>
    join([
      wrap('', description, '\n'),
      name,
      hasMultilineItems(args)
        ? wrap('(\n', join(args, '\n').indent(), '\n)')
        : wrap('(', join(args, ', '), ')'),
      ': ',
      type,
      wrap(' ', join(directives, ' ')),
    ]),

  InputValueDefinition: ({
    description,
    name,
    type,
    defaultValue,
    directives,
  }) =>
    join([
      wrap('', description, '\n'),
      name,
      ': ',
      type,
      wrap(' = ', defaultValue),
      wrap(' ', join(directives, ' ')),
    ]),

  InterfaceTypeDefinition: ({
    description,
    name,
    interfaces,
    directives,
    fields,
  }) =>
    join([
      wrap('', description, '\n'),
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
    ]),

  UnionTypeDefinition: ({ description, name, directives, types }) =>
    join([
      wrap('', description, '\n'),
      join(
        ['union', name, join(directives, ' '), wrap('= ', join(types, ' | '))],
        ' ',
      ),
    ]),

  EnumTypeDefinition: ({ description, name, directives, values }) =>
    join([
      wrap('', description, '\n'),
      join(['enum', name, join(directives, ' '), block(values)], ' '),
    ]),

  EnumValueDefinition: ({ description, name, directives }) =>
    join([
      wrap('', description, '\n'),
      join([name, join(directives, ' ')], ' '),
    ]),

  InputObjectTypeDefinition: ({ description, name, directives, fields }) =>
    join([
      wrap('', description, '\n'),
      join(['input', name, join(directives, ' '), block(fields)], ' '),
    ]),

  DirectiveDefinition: ({
    description,
    name,
    arguments: args,
    directives,
    repeatable,
    locations,
  }) =>
    join([
      wrap('', description, '\n'),
      'directive @',
      name,
      hasMultilineItems(args)
        ? wrap('(\n', join(args, '\n').indent(), '\n)')
        : wrap('(', join(args, ', '), ')'),
      wrap(' ', join(directives, ' ')),
      repeatable ? ' repeatable' : '',
      ' on ',
      join(locations, ' | '),
    ]),

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
        wrap('= ', join(types, ' | ')),
      ],
      ' ',
    ),

  EnumTypeExtension: ({ name, directives, values }) =>
    join(['extend enum', name, join(directives, ' '), block(values)], ' '),

  InputObjectTypeExtension: ({ name, directives, fields }) =>
    join(['extend input', name, join(directives, ' '), block(fields)], ' '),

  DirectiveExtension: ({ name, directives }) =>
    join([join(['extend directive @', name]), join(directives, ' ')], ' '),

  // Schema Coordinates

  TypeCoordinate: ({ name }) => name,

  MemberCoordinate: ({ name, memberName }) =>
    join([name, wrap('.', memberName)]),

  ArgumentCoordinate: ({ name, fieldName, argumentName }) =>
    join([name, wrap('.', fieldName), wrap('(', argumentName, ':)')]),

  DirectiveCoordinate: ({ name }) => join(['@', name]),

  DirectiveArgumentCoordinate: ({ name, argumentName }) =>
    join(['@', name, wrap('(', argumentName, ':)')]),
};

/**
 * Given maybeArray, print an empty string if it is null or empty, otherwise
 * print all items together separated by separator if provided
 *
 * @internal
 */
function join(
  maybeArray: Maybe<ReadonlyArray<string | PrintBuffer | undefined>>,
  separator = '',
): PrintBuffer {
  if (maybeArray == null || maybeArray.length === 0) {
    return EMPTY;
  }
  let result = EMPTY;
  for (const item of maybeArray) {
    if (item === undefined || item.length === 0) {
      continue;
    }
    if (result.length === 0) {
      result = typeof item === 'string' ? new PrintBuffer(item) : item;
    } else {
      if (separator !== '') {
        result.append(separator);
      }
      result.append(item);
    }
  }
  return result;
}

function joinedLength(
  array: ReadonlyArray<PrintBuffer>,
  separator: string,
): number {
  let length = 0;
  for (const item of array) {
    if (item.length !== 0) {
      length += (length === 0 ? 0 : separator.length) + item.length;
    }
  }
  return length;
}

/**
 * Given array, print each item on its own line, wrapped in an indented `{ }` block.
 *
 * @internal
 */
function block(
  array: Maybe<ReadonlyArray<PrintBuffer | undefined>>,
): PrintBuffer {
  return wrap('{\n', join(array, '\n').indent(), '\n}');
}

/**
 * If maybeBuffer is not null or empty, then wrap with start and end, otherwise print an empty string.
 *
 * @internal
 */
function wrap(
  start: string,
  maybeBuffer: Maybe<PrintBuffer>,
  end = '',
): PrintBuffer {
  return maybeBuffer != null && maybeBuffer.length !== 0
    ? start === ''
      ? maybeBuffer.append(end)
      : new PrintBuffer(start).append(maybeBuffer).append(end)
    : EMPTY;
}

function hasMultilineItems(
  maybeArray: Maybe<ReadonlyArray<PrintBuffer>>,
): boolean {
  return maybeArray?.some((result) => result.newlines !== 0) ?? false;
}

function wrappedLineAndArgs(
  prefix: PrintBuffer,
  args: ReadonlyArray<PrintBuffer> | undefined,
): PrintBuffer {
  if (args == null || args.length === 0) {
    return prefix;
  }
  return join([
    prefix,
    prefix.length + joinedLength(args, ', ') + 2 > MAX_LINE_LENGTH
      ? wrap('(\n', join(args, '\n').indent(), '\n)')
      : wrap('(', join(args, ', '), ')'),
  ]);
}
