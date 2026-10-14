import { printBlockString } from "./blockString.mjs";
import { printString } from "./printString.mjs";
import { visit } from "./visitor.mjs";
export function print(ast) {
    return visit(ast, printDocASTReducer);
}
const MAX_LINE_LENGTH = 80;
const printDocASTReducer = {
    Name: { leave: (node) => node.value },
    Variable: { leave: (node) => '$' + node.name },
    Document: {
        leave: (node) => join(node.definitions, '\n\n'),
    },
    OperationDefinition: {
        leave(node) {
            const varDefs = hasMultilineItems(node.variableDefinitions)
                ? wrap('(\n', join(node.variableDefinitions, '\n'), '\n)')
                : wrap('(', join(node.variableDefinitions, ', '), ')');
            const prefix = wrap('', node.description, '\n') +
                join([
                    node.operation,
                    join([node.name, varDefs]),
                    join(node.directives, ' '),
                ], ' ');
            return (prefix === 'query' ? '' : prefix + ' ') + node.selectionSet;
        },
    },
    VariableDefinition: {
        leave: ({ variable, type, defaultValue, directives, description }) => wrap('', description, '\n') +
            variable +
            ': ' +
            type +
            wrap(' = ', defaultValue) +
            wrap(' ', join(directives, ' ')),
    },
    SelectionSet: {
        leave: ({ selections }) => selections.length === 0 ? '{}' : block(selections),
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
    Argument: { leave: ({ name, value }) => name + ': ' + value },
    FragmentArgument: { leave: ({ name, value }) => name + ': ' + value },
    FragmentSpread: {
        leave: ({ name, arguments: args, directives }) => {
            const prefix = '...' + name;
            return (wrappedLineAndArgs(prefix, args) + wrap(' ', join(directives, ' ')));
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
        leave: ({ name, typeCondition, variableDefinitions, directives, selectionSet, description, }) => wrap('', description, '\n') +
            `fragment ${name}${wrap('(', join(variableDefinitions, ', '), ')')} ` +
            `on ${typeCondition} ${wrap('', join(directives, ' '), ' ')}` +
            selectionSet,
    },
    IntValue: { leave: ({ value }) => value },
    FloatValue: { leave: ({ value }) => value },
    StringValue: {
        leave: ({ value, block: isBlockString }) => isBlockString === true ? printBlockString(value) : printString(value),
    },
    BooleanValue: { leave: ({ value }) => (value ? 'true' : 'false') },
    NullValue: { leave: () => 'null' },
    EnumValue: { leave: ({ value }) => value },
    ListValue: {
        leave: ({ values }) => {
            const valuesLine = '[' + join(values, ', ') + ']';
            if (valuesLine.length > MAX_LINE_LENGTH) {
                return '[\n' + indent(join(values, '\n')) + '\n]';
            }
            return valuesLine;
        },
    },
    ObjectValue: {
        leave: ({ fields }) => {
            const fieldsLine = '{ ' + join(fields, ', ') + ' }';
            return fieldsLine.length > MAX_LINE_LENGTH ? block(fields) : fieldsLine;
        },
    },
    ObjectField: { leave: ({ name, value }) => name + ': ' + value },
    Directive: {
        leave: ({ name, arguments: args }) => '@' + name + wrap('(', join(args, ', '), ')'),
    },
    NamedType: { leave: ({ name }) => name },
    ListType: { leave: ({ type }) => '[' + type + ']' },
    NonNullType: { leave: ({ type }) => type + '!' },
    SchemaDefinition: {
        leave: ({ description, directives, operationTypes }) => wrap('', description, '\n') +
            join(['schema', join(directives, ' '), block(operationTypes)], ' '),
    },
    OperationTypeDefinition: {
        leave: ({ operation, type }) => operation + ': ' + type,
    },
    ScalarTypeDefinition: {
        leave: ({ description, name, directives }) => wrap('', description, '\n') +
            join(['scalar', name, join(directives, ' ')], ' '),
    },
    ObjectTypeDefinition: {
        leave: ({ description, name, interfaces, directives, fields }) => wrap('', description, '\n') +
            join([
                'type',
                name,
                wrap('implements ', join(interfaces, ' & ')),
                join(directives, ' '),
                block(fields),
            ], ' '),
    },
    FieldDefinition: {
        leave: ({ description, name, arguments: args, type, directives }) => wrap('', description, '\n') +
            name +
            (hasMultilineItems(args)
                ? wrap('(\n', indent(join(args, '\n')), '\n)')
                : wrap('(', join(args, ', '), ')')) +
            ': ' +
            type +
            wrap(' ', join(directives, ' ')),
    },
    InputValueDefinition: {
        leave: ({ description, name, type, defaultValue, directives }) => wrap('', description, '\n') +
            join([name + ': ' + type, wrap('= ', defaultValue), join(directives, ' ')], ' '),
    },
    InterfaceTypeDefinition: {
        leave: ({ description, name, interfaces, directives, fields }) => wrap('', description, '\n') +
            join([
                'interface',
                name,
                wrap('implements ', join(interfaces, ' & ')),
                join(directives, ' '),
                block(fields),
            ], ' '),
    },
    UnionTypeDefinition: {
        leave: ({ description, name, directives, types }) => wrap('', description, '\n') +
            join(['union', name, join(directives, ' '), wrap('= ', join(types, ' | '))], ' '),
    },
    EnumTypeDefinition: {
        leave: ({ description, name, directives, values }) => wrap('', description, '\n') +
            join(['enum', name, join(directives, ' '), block(values)], ' '),
    },
    EnumValueDefinition: {
        leave: ({ description, name, directives }) => wrap('', description, '\n') + join([name, join(directives, ' ')], ' '),
    },
    InputObjectTypeDefinition: {
        leave: ({ description, name, directives, fields }) => wrap('', description, '\n') +
            join(['input', name, join(directives, ' '), block(fields)], ' '),
    },
    DirectiveDefinition: {
        leave: ({ description, name, arguments: args, directives, repeatable, locations, }) => wrap('', description, '\n') +
            'directive @' +
            name +
            (hasMultilineItems(args)
                ? wrap('(\n', indent(join(args, '\n')), '\n)')
                : wrap('(', join(args, ', '), ')')) +
            wrap(' ', join(directives, ' ')) +
            (repeatable ? ' repeatable' : '') +
            ' on ' +
            join(locations, ' | '),
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
        leave: ({ name, directives }) => join(['extend directive @' + name, join(directives, ' ')], ' '),
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
    return (maybeArray?.filter((x) => x !== undefined && x !== '').join(separator) ?? '');
}
function block(array) {
    return wrap('{\n', indent(join(array, '\n')), '\n}');
}
function wrap(start, maybeString, end = '') {
    return maybeString != null && maybeString !== ''
        ? start + maybeString + end
        : '';
}
function indent(str) {
    return wrap('  ', str.replaceAll('\n', '\n  '));
}
function hasMultilineItems(maybeArray) {
    return maybeArray?.some((str) => str.includes('\n')) ?? false;
}
function wrappedLineAndArgs(prefix, args) {
    let argsLine = prefix + wrap('(', join(args, ', '), ')');
    if (argsLine.length > MAX_LINE_LENGTH) {
        argsLine = prefix + wrap('(\n', indent(join(args, '\n')), '\n)');
    }
    return argsLine;
}
//# sourceMappingURL=printer.js.map