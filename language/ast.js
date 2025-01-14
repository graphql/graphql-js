"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OperationTypeNode = exports.QueryDocumentKeys = exports.Token = exports.Location = void 0;
exports.isNode = isNode;
/**
 * Contains a range of UTF-8 character offsets and token references that
 * identify the region of the source from which the AST derived.
 */
class Location {
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
exports.Location = Location;
/**
 * Represents a range of characters represented by a lexical token
 * within a Source.
 */
class Token {
    // eslint-disable-next-line @typescript-eslint/max-params
    constructor(kind, start, end, line, column, value) {
        this.kind = kind;
        this.start = start;
        this.end = end;
        this.line = line;
        this.column = column;
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
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
exports.Token = Token;
/**
 * @internal
 */
exports.QueryDocumentKeys = {
    Name: [],
    Document: ['definitions'],
    OperationDefinition: [
        'name',
        'variableDefinitions',
        'directives',
        'selectionSet',
    ],
    VariableDefinition: ['variable', 'type', 'defaultValue', 'directives'],
    Variable: ['name'],
    SelectionSet: ['selections'],
    Field: ['alias', 'name', 'arguments', 'directives', 'selectionSet'],
    Argument: ['name', 'value'],
    FragmentArgument: ['name', 'value'],
    FragmentSpread: [
        'name',
        // Note: Fragment arguments are experimental and may be changed or removed
        // in the future.
        'arguments',
        'directives',
    ],
    InlineFragment: ['typeCondition', 'directives', 'selectionSet'],
    FragmentDefinition: [
        'name',
        // Note: Fragment variables are experimental and may be changed or removed
        // in the future.
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
    DirectiveDefinition: ['description', 'name', 'arguments', 'locations'],
    SchemaExtension: ['directives', 'operationTypes'],
    ScalarTypeExtension: ['name', 'directives'],
    ObjectTypeExtension: ['name', 'interfaces', 'directives', 'fields'],
    InterfaceTypeExtension: ['name', 'interfaces', 'directives', 'fields'],
    UnionTypeExtension: ['name', 'directives', 'types'],
    EnumTypeExtension: ['name', 'directives', 'values'],
    InputObjectTypeExtension: ['name', 'directives', 'fields'],
};
const kindValues = new Set(Object.keys(exports.QueryDocumentKeys));
/**
 * @internal
 */
function isNode(maybeNode) {
    const maybeKind = maybeNode?.kind;
    return typeof maybeKind === 'string' && kindValues.has(maybeKind);
}
exports.OperationTypeNode = {
    QUERY: 'query',
    MUTATION: 'mutation',
    SUBSCRIPTION: 'subscription',
};
//# sourceMappingURL=ast.js.map