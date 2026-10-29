import { printBlockString } from "./blockString.mjs";
import { printString } from "./printString.mjs";
import { visit } from "./visitor.mjs";
export function print(ast, options) {
    return render(visit(ast, printDocASTReducer), options?.maxIndentDepth ?? Infinity);
}
export function printForError(ast) {
    return print(ast, { maxIndentDepth: 100 });
}
const MAX_LINE_LENGTH = 80;
class PrintBuffer {
    constructor(value = '', isBlockString = false) {
        this.next = undefined;
        this.tail = this;
        this.indentBefore = false;
        this.dedentAfter = false;
        this.length = value.length;
        this.lines = value.includes('\n') ? value.split('\n') : [value];
        this.newlines = this.lines.length - 1;
        this.isBlockString = isBlockString;
    }
    append(result) {
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
    indent() {
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
function render(buffer, maxDepth) {
    const output = [];
    let text = '';
    let depth = 0;
    let indentation = '';
    let part = buffer;
    while (part !== undefined) {
        const lines = part.lines;
        if (part.indentBefore) {
            if (depth < maxDepth) {
                indentation += '  ';
                text += '  ';
            }
            depth++;
        }
        text += lines[0];
        if (lines.length > 1) {
            const newline = !part.isBlockString && depth >= maxDepth ? ' ' : '\n' + indentation;
            for (let i = 1; i < lines.length; i++) {
                output.push(text);
                text = newline + lines[i];
            }
        }
        if (part.dedentAfter) {
            depth--;
            indentation = indentation.slice(0, depth * 2);
        }
        part = part.next;
    }
    output.push(text);
    return output.join('');
}
const printDocASTReducer = {
    Name: { leave: (node) => new PrintBuffer(node.value) },
    Variable: { leave: (node) => join(['$', node.name]) },
    Document: {
        leave: (node) => join(node.definitions, '\n\n'),
    },
    OperationDefinition: {
        leave(node) {
            const varDefs = hasMultilineItems(node.variableDefinitions)
                ? wrap('(\n', join(node.variableDefinitions, '\n'), '\n)')
                : wrap('(', join(node.variableDefinitions, ', '), ')');
            const prefix = join([
                wrap('', node.description, '\n'),
                join([
                    node.operation,
                    join([node.name, varDefs]),
                    join(node.directives, ' '),
                ], ' '),
            ]);
            return join([
                node.operation === 'query' && prefix.length === node.operation.length
                    ? ''
                    : join([prefix, ' ']),
                node.selectionSet,
            ]);
        },
    },
    VariableDefinition: {
        leave: ({ variable, type, defaultValue, directives, description }) => join([
            wrap('', description, '\n'),
            variable,
            ': ',
            type,
            wrap(' = ', defaultValue),
            wrap(' ', join(directives, ' ')),
        ]),
    },
    SelectionSet: {
        leave: ({ selections }) => selections.length === 0 ? new PrintBuffer('{}') : block(selections),
    },
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
    FragmentArgument: { leave: ({ name, value }) => join([name, ': ', value]) },
    FragmentSpread: {
        leave: ({ name, arguments: args, directives }) => {
            const prefix = join(['...', name]);
            return join([
                wrappedLineAndArgs(prefix, args),
                wrap(' ', join(directives, ' ')),
            ]);
        },
    },
    InlineFragment: {
        leave: ({ typeCondition, directives, selectionSet }) => join([
            '...',
            wrap('on ', typeCondition),
            join(directives, ' '),
            selectionSet,
        ], ' '),
    },
    FragmentDefinition: {
        leave: ({ name, typeCondition, variableDefinitions, directives, selectionSet, description, }) => join([
            wrap('', description, '\n'),
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
        leave: ({ value, block: isBlockString }) => new PrintBuffer(isBlockString === true ? printBlockString(value) : printString(value), isBlockString === true),
    },
    BooleanValue: {
        leave: ({ value }) => new PrintBuffer(value ? 'true' : 'false'),
    },
    NullValue: { leave: () => new PrintBuffer('null') },
    EnumValue: { leave: ({ value }) => new PrintBuffer(value) },
    ListValue: {
        leave: ({ values }) => {
            if (2 + joinedLength(values, ', ') > MAX_LINE_LENGTH) {
                return wrap('[\n', join(values, '\n').indent(), '\n]');
            }
            return join(['[', join(values, ', '), ']']);
        },
    },
    ObjectValue: {
        leave: ({ fields }) => 4 + joinedLength(fields, ', ') > MAX_LINE_LENGTH
            ? block(fields)
            : join(['{ ', join(fields, ', '), ' }']),
    },
    ObjectField: { leave: ({ name, value }) => join([name, ': ', value]) },
    Directive: {
        leave: ({ name, arguments: args }) => join(['@', name, wrap('(', join(args, ', '), ')')]),
    },
    NamedType: { leave: ({ name }) => name },
    ListType: { leave: ({ type }) => join(['[', type, ']']) },
    NonNullType: { leave: ({ type }) => join([type, '!']) },
    SchemaDefinition: {
        leave: ({ description, directives, operationTypes }) => join([
            wrap('', description, '\n'),
            join(['schema', join(directives, ' '), block(operationTypes)], ' '),
        ]),
    },
    OperationTypeDefinition: {
        leave: ({ operation, type }) => join([operation, ': ', type]),
    },
    ScalarTypeDefinition: {
        leave: ({ description, name, directives }) => join([
            wrap('', description, '\n'),
            join(['scalar', name, join(directives, ' ')], ' '),
        ]),
    },
    ObjectTypeDefinition: {
        leave: ({ description, name, interfaces, directives, fields }) => join([
            wrap('', description, '\n'),
            join([
                'type',
                name,
                wrap('implements ', join(interfaces, ' & ')),
                join(directives, ' '),
                block(fields),
            ], ' '),
        ]),
    },
    FieldDefinition: {
        leave: ({ description, name, arguments: args, type, directives }) => join([
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
        leave: ({ description, name, type, defaultValue, directives }) => join([
            wrap('', description, '\n'),
            join([
                join([name, ': ', type]),
                wrap('= ', defaultValue),
                join(directives, ' '),
            ], ' '),
        ]),
    },
    InterfaceTypeDefinition: {
        leave: ({ description, name, interfaces, directives, fields }) => join([
            wrap('', description, '\n'),
            join([
                'interface',
                name,
                wrap('implements ', join(interfaces, ' & ')),
                join(directives, ' '),
                block(fields),
            ], ' '),
        ]),
    },
    UnionTypeDefinition: {
        leave: ({ description, name, directives, types }) => join([
            wrap('', description, '\n'),
            join([
                'union',
                name,
                join(directives, ' '),
                wrap('= ', join(types, ' | ')),
            ], ' '),
        ]),
    },
    EnumTypeDefinition: {
        leave: ({ description, name, directives, values }) => join([
            wrap('', description, '\n'),
            join(['enum', name, join(directives, ' '), block(values)], ' '),
        ]),
    },
    EnumValueDefinition: {
        leave: ({ description, name, directives }) => join([
            wrap('', description, '\n'),
            join([name, join(directives, ' ')], ' '),
        ]),
    },
    InputObjectTypeDefinition: {
        leave: ({ description, name, directives, fields }) => join([
            wrap('', description, '\n'),
            join(['input', name, join(directives, ' '), block(fields)], ' '),
        ]),
    },
    DirectiveDefinition: {
        leave: ({ description, name, arguments: args, directives, repeatable, locations, }) => join([
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
    },
    SchemaExtension: {
        leave: ({ directives, operationTypes }) => join(['extend schema', join(directives, ' '), block(operationTypes)], ' '),
    },
    ScalarTypeExtension: {
        leave: ({ name, directives }) => join(['extend scalar', name, join(directives, ' ')], ' '),
    },
    ObjectTypeExtension: {
        leave: ({ name, interfaces, directives, fields }) => join([
            'extend type',
            name,
            wrap('implements ', join(interfaces, ' & ')),
            join(directives, ' '),
            block(fields),
        ], ' '),
    },
    InterfaceTypeExtension: {
        leave: ({ name, interfaces, directives, fields }) => join([
            'extend interface',
            name,
            wrap('implements ', join(interfaces, ' & ')),
            join(directives, ' '),
            block(fields),
        ], ' '),
    },
    UnionTypeExtension: {
        leave: ({ name, directives, types }) => join([
            'extend union',
            name,
            join(directives, ' '),
            wrap('= ', join(types, ' | ')),
        ], ' '),
    },
    EnumTypeExtension: {
        leave: ({ name, directives, values }) => join(['extend enum', name, join(directives, ' '), block(values)], ' '),
    },
    InputObjectTypeExtension: {
        leave: ({ name, directives, fields }) => join(['extend input', name, join(directives, ' '), block(fields)], ' '),
    },
    DirectiveExtension: {
        leave: ({ name, directives }) => join([join(['extend directive @', name]), join(directives, ' ')], ' '),
    },
    TypeCoordinate: { leave: ({ name }) => name },
    MemberCoordinate: {
        leave: ({ name, memberName }) => join([name, wrap('.', memberName)]),
    },
    ArgumentCoordinate: {
        leave: ({ name, fieldName, argumentName }) => join([name, wrap('.', fieldName), wrap('(', argumentName, ':)')]),
    },
    DirectiveCoordinate: { leave: ({ name }) => join(['@', name]) },
    DirectiveArgumentCoordinate: {
        leave: ({ name, argumentName }) => join(['@', name, wrap('(', argumentName, ':)')]),
    },
};
function join(maybeArray, separator = '') {
    let result = EMPTY;
    for (const item of maybeArray ?? []) {
        if (item === undefined || item.length === 0) {
            continue;
        }
        if (result.length === 0) {
            result = typeof item === 'string' ? new PrintBuffer(item) : item;
        }
        else {
            result.append(separator).append(item);
        }
    }
    return result;
}
function joinedLength(maybeArray, separator) {
    let length = 0;
    for (const item of maybeArray ?? []) {
        if (item.length !== 0) {
            length += (length === 0 ? 0 : separator.length) + item.length;
        }
    }
    return length;
}
function block(array) {
    return wrap('{\n', join(array, '\n').indent(), '\n}');
}
function wrap(start, maybeBuffer, end = '') {
    return maybeBuffer != null && maybeBuffer.length !== 0
        ? new PrintBuffer(start).append(maybeBuffer).append(end)
        : EMPTY;
}
function hasMultilineItems(maybeArray) {
    return maybeArray?.some((result) => result.newlines !== 0) ?? false;
}
function wrappedLineAndArgs(prefix, args) {
    return join([
        prefix,
        prefix.length + joinedLength(args, ', ') + 2 > MAX_LINE_LENGTH
            ? wrap('(\n', join(args, '\n').indent(), '\n)')
            : wrap('(', join(args, ', '), ')'),
    ]);
}
//# sourceMappingURL=printer.js.map