export class Location {
    constructor(startToken, endToken, source) {
        this.start = startToken.start;
        this.end = endToken.end;
        this.startToken = startToken;
        this.endToken = endToken;
        this.source = source;
    }
    get [Symbol.toStringTag]() {
        return 'Location';
    }
    toJSON() {
        return { start: this.start, end: this.end };
    }
}
export class Token {
    constructor(kind, start, end, line, column, value) {
        this.kind = kind;
        this.start = start;
        this.end = end;
        this.line = line;
        this.column = column;
        this.value = value;
        this.prev = null;
        this.next = null;
    }
    get [Symbol.toStringTag]() {
        return 'Token';
    }
    toJSON() {
        return {
            kind: this.kind,
            value: this.value,
            line: this.line,
            column: this.column,
        };
    }
}
export const QueryDocumentKeys = {
    Name: [],
    Document: ['definitions'],
    OperationDefinition: [
        'description',
        'name',
        'variableDefinitions',
        'directives',
        'selectionSet',
    ],
    VariableDefinition: [
        'description',
        'variable',
        'type',
        'defaultValue',
        'directives',
    ],
    Variable: ['name'],
    SelectionSet: ['selections'],
    Field: ['alias', 'name', 'arguments', 'directives', 'selectionSet'],
    Argument: ['name', 'value'],
    FragmentArgument: ['name', 'value'],
    FragmentSpread: [
        'name',
        'arguments',
        'directives',
    ],
    InlineFragment: ['typeCondition', 'directives', 'selectionSet'],
    FragmentDefinition: [
        'description',
        'name',
        'variableDefinitions',
        'typeCondition',
        'directives',
        'selectionSet',
    ],
    IntValue: [],
    FloatValue: [],
    StringValue: [],
    BooleanValue: [],
    NullValue: [],
    EnumValue: [],
    ListValue: ['values'],
    ObjectValue: ['fields'],
    ObjectField: ['name', 'value'],
    Directive: ['name', 'arguments'],
    NamedType: ['name'],
    ListType: ['type'],
    NonNullType: ['type'],
    SchemaDefinition: ['description', 'directives', 'operationTypes'],
    OperationTypeDefinition: ['type'],
    ScalarTypeDefinition: ['description', 'name', 'directives'],
    ObjectTypeDefinition: [
        'description',
        'name',
        'interfaces',
        'directives',
        'fields',
    ],
    FieldDefinition: ['description', 'name', 'arguments', 'type', 'directives'],
    InputValueDefinition: [
        'description',
        'name',
        'type',
        'defaultValue',
        'directives',
    ],
    InterfaceTypeDefinition: [
        'description',
        'name',
        'interfaces',
        'directives',
        'fields',
    ],
    UnionTypeDefinition: ['description', 'name', 'directives', 'types'],
    EnumTypeDefinition: ['description', 'name', 'directives', 'values'],
    EnumValueDefinition: ['description', 'name', 'directives'],
    InputObjectTypeDefinition: ['description', 'name', 'directives', 'fields'],
    DirectiveDefinition: [
        'description',
        'name',
        'arguments',
        'directives',
        'locations',
    ],
    SchemaExtension: ['directives', 'operationTypes'],
    DirectiveExtension: ['name', 'directives'],
    ScalarTypeExtension: ['name', 'directives'],
    ObjectTypeExtension: ['name', 'interfaces', 'directives', 'fields'],
    InterfaceTypeExtension: ['name', 'interfaces', 'directives', 'fields'],
    UnionTypeExtension: ['name', 'directives', 'types'],
    EnumTypeExtension: ['name', 'directives', 'values'],
    InputObjectTypeExtension: ['name', 'directives', 'fields'],
    TypeCoordinate: ['name'],
    MemberCoordinate: ['name', 'memberName'],
    ArgumentCoordinate: ['name', 'fieldName', 'argumentName'],
    DirectiveCoordinate: ['name'],
    DirectiveArgumentCoordinate: ['name', 'argumentName'],
};
const kindValues = new Set(Object.keys(QueryDocumentKeys));
export function isNode(maybeNode) {
    const maybeKind = maybeNode?.kind;
    return typeof maybeKind === 'string' && kindValues.has(maybeKind);
}
export const OperationTypeNode = {
    QUERY: 'query',
    MUTATION: 'mutation',
    SUBSCRIPTION: 'subscription',
};
//# sourceMappingURL=ast.mjs.map