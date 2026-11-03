/** @category Printing */

import type { ASTNode } from './ast';
import { printBlockString } from './blockString';
import { visit } from './visitor';

type Maybe<+T> = ?T;

/**
 * Converts an AST into a string. Indentation and inserted newlines can be
 * limited with maxIndentDepth; the default is unlimited.
 */
declare function print(
  ast: ASTNode,
  options: { maxIndentDepth?: number, ... },
): string;
// eslint-disable-next-line no-redeclare
declare function print(ast: ASTNode): string;
// eslint-disable-next-line no-redeclare
export function print(ast, options) {
  return render(
    visit(ast, printDocASTReducer),
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
  lines: string | $ReadOnlyArray<string>;
  next: PrintBuffer | void;
  tail: PrintBuffer | void;
  indentBefore: boolean;
  dedentAfter: boolean;
  isBlockString: boolean;

  constructor(value = '', isBlockString = false) {
    this.next = undefined;
    this.tail = undefined;
    this.indentBefore = false;
    this.dedentAfter = false;
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
    (this.tail ?? this).next = next;
    this.tail = next.tail ?? next;
    this.length += next.length;
    this.newlines += next.newlines;
    return this;
  }

  indent(): this {
    if (this.length === 0) {
      return this;
    }
    this.indentBefore = true;
    (this.tail ?? this).dedentAfter = true;
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
  let part: PrintBuffer | void = buffer;
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

const printDocASTReducer: any = {
  Name: { leave: (node) => new PrintBuffer(node.value) },
  Variable: { leave: (node) => join(['$', node.name]) },
  Document: { leave: (node) => join([join(node.definitions, '\n\n'), '\n']) },
  OperationDefinition: {
    leave(node) {
      const varDefs = wrap('(', join(node.variableDefinitions, ', '), ')');
      const directives = join(node.directives, ' ');
      return !node.name &&
        directives.length === 0 &&
        varDefs.length === 0 &&
        node.operation === 'query'
        ? node.selectionSet
        : join(
            [
              node.operation,
              join([node.name, varDefs]),
              directives,
              node.selectionSet,
            ],
            ' ',
          );
    },
  },
  VariableDefinition: {
    leave: ({ variable, type, defaultValue, directives }) =>
      join([
        variable,
        ': ',
        type,
        wrap(' = ', defaultValue),
        wrap(' ', join(directives, ' ')),
      ]),
  },
  SelectionSet: { leave: ({ selections }) => block(selections) },
  Field: {
    leave({ alias, name, arguments: args, directives, selectionSet }) {
      const prefix = join([wrap('', alias, ': '), name], '');

      return join([
        wrappedLineAndArgs(prefix, args),
        wrap(' ', join(directives, ' ')),
        wrap(' ', selectionSet),
      ]);
    },
  },
  Argument: { leave: ({ name, value }) => join([name, ': ', value]) },
  FragmentSpread: {
    leave: ({ name, directives }) =>
      join(['...', name, wrap(' ', join(directives, ' '))]),
  },
  InlineFragment: {
    leave: ({ typeCondition, directives, selectionSet }) =>
      join(
        [
          '...',
          wrap('on ', typeCondition),
          join(directives, ' '),
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
      join([
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
  },
  IntValue: { leave: ({ value }) => new PrintBuffer(value) },
  FloatValue: { leave: ({ value }) => new PrintBuffer(value) },
  StringValue: {
    leave: ({ value, block: isBlockString }, key) =>
      new PrintBuffer(
        isBlockString === true
          ? printBlockString(value, key === 'description' ? '' : '  ')
          : JSON.stringify(value),
        isBlockString === true,
      ),
  },
  BooleanValue: {
    leave: ({ value }) => new PrintBuffer(value ? 'true' : 'false'),
  },
  NullValue: { leave: () => new PrintBuffer('null') },
  EnumValue: { leave: ({ value }) => new PrintBuffer(value) },
  ListValue: { leave: ({ values }) => join(['[', join(values, ', '), ']']) },
  ObjectValue: { leave: ({ fields }) => join(['{', join(fields, ', '), '}']) },
  ObjectField: { leave: ({ name, value }) => join([name, ': ', value]) },
  Directive: {
    leave: ({ name, arguments: args }) =>
      join(['@', name, wrap('(', join(args, ', '), ')')]),
  },
  NamedType: { leave: ({ name }) => name },
  ListType: { leave: ({ type }) => join(['[', type, ']']) },
  NonNullType: { leave: ({ type }) => join([type, '!']) },
  SchemaDefinition: {
    leave: ({ description, directives, operationTypes }) =>
      join([
        wrap('', description, '\n'),
        join(['schema', join(directives, ' '), block(operationTypes)], ' '),
      ]),
  },
  OperationTypeDefinition: {
    leave: ({ operation, type }) => join([operation, ': ', type]),
  },
  ScalarTypeDefinition: {
    leave: ({ description, name, directives }) =>
      join([
        wrap('', description, '\n'),
        join(['scalar', name, join(directives, ' ')], ' '),
      ]),
  },
  ObjectTypeDefinition: {
    leave: ({ description, name, interfaces, directives, fields }) =>
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
  },
  FieldDefinition: {
    leave: ({ description, name, arguments: args, type, directives }) =>
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
  },
  InputValueDefinition: {
    leave: ({ description, name, type, defaultValue, directives }) =>
      join([
        wrap('', description, '\n'),
        name,
        ': ',
        type,
        wrap(' = ', defaultValue),
        wrap(' ', join(directives, ' ')),
      ]),
  },
  InterfaceTypeDefinition: {
    leave: ({ description, name, interfaces, directives, fields }) =>
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
  },
  UnionTypeDefinition: {
    leave: ({ description, name, directives, types }) =>
      join([
        wrap('', description, '\n'),
        join(
          [
            'union',
            name,
            join(directives, ' '),
            wrap('= ', join(types, ' | ')),
          ],
          ' ',
        ),
      ]),
  },
  EnumTypeDefinition: {
    leave: ({ description, name, directives, values }) =>
      join([
        wrap('', description, '\n'),
        join(['enum', name, join(directives, ' '), block(values)], ' '),
      ]),
  },
  EnumValueDefinition: {
    leave: ({ description, name, directives }) =>
      join([
        wrap('', description, '\n'),
        join([name, join(directives, ' ')], ' '),
      ]),
  },
  InputObjectTypeDefinition: {
    leave: ({ description, name, directives, fields }) =>
      join([
        wrap('', description, '\n'),
        join(['input', name, join(directives, ' '), block(fields)], ' '),
      ]),
  },
  DirectiveDefinition: {
    leave: ({ description, name, arguments: args, repeatable, locations }) =>
      join([
        wrap('', description, '\n'),
        'directive @',
        name,
        hasMultilineItems(args)
          ? wrap('(\n', join(args, '\n').indent(), '\n)')
          : wrap('(', join(args, ', '), ')'),
        repeatable ? ' repeatable' : '',
        ' on ',
        join(locations, ' | '),
      ]),
  },
  SchemaExtension: {
    leave: ({ directives, operationTypes }) =>
      join(
        ['extend schema', join(directives, ' '), block(operationTypes)],
        ' ',
      ),
  },
  ScalarTypeExtension: {
    leave: ({ name, directives }) =>
      join(['extend scalar', name, join(directives, ' ')], ' '),
  },
  ObjectTypeExtension: {
    leave: ({ name, interfaces, directives, fields }) =>
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
  },
  InterfaceTypeExtension: {
    leave: ({ name, interfaces, directives, fields }) =>
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
  },
  UnionTypeExtension: {
    leave: ({ name, directives, types }) =>
      join(
        [
          'extend union',
          name,
          join(directives, ' '),
          wrap('= ', join(types, ' | ')),
        ],
        ' ',
      ),
  },
  EnumTypeExtension: {
    leave: ({ name, directives, values }) =>
      join(['extend enum', name, join(directives, ' '), block(values)], ' '),
  },
  InputObjectTypeExtension: {
    leave: ({ name, directives, fields }) =>
      join(['extend input', name, join(directives, ' '), block(fields)], ' '),
  },
};
/**
 * Given maybeArray, print an empty string if it is null or empty, otherwise
 * print all items together separated by separator if provided
 *
 * @internal
 */
function join(
  maybeArray: Maybe<$ReadOnlyArray<string | PrintBuffer | void>>,
  separator = '',
): PrintBuffer {
  let result = EMPTY;
  for (const item of maybeArray ?? []) {
    if (item === undefined || item.length === 0) {
      continue;
    }
    if (result.length === 0) {
      result = typeof item === 'string' ? new PrintBuffer(item) : item;
    } else {
      result.append(separator).append(item);
    }
  }
  return result;
}

function joinedLength(
  maybeArray: Maybe<$ReadOnlyArray<PrintBuffer>>,
  separator: string,
): number {
  let length = 0;
  for (const item of maybeArray ?? []) {
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
function block(array: Maybe<$ReadOnlyArray<PrintBuffer | void>>): PrintBuffer {
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
    ? new PrintBuffer(start).append(maybeBuffer).append(end)
    : EMPTY;
}

function hasMultilineItems(
  maybeArray: Maybe<$ReadOnlyArray<PrintBuffer>>,
): boolean {
  return (
    maybeArray != null && maybeArray.some((result) => result.newlines !== 0)
  );
}

function wrappedLineAndArgs(
  prefix: PrintBuffer,
  args: $ReadOnlyArray<PrintBuffer> | void,
): PrintBuffer {
  return join([
    prefix,
    prefix.length + joinedLength(args, ', ') + 2 > MAX_LINE_LENGTH
      ? wrap('(\n', join(args, '\n').indent(), '\n)')
      : wrap('(', join(args, ', '), ')'),
  ]);
}
