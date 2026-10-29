import { devAssert } from "../jsutils/devAssert.mjs";
import { didYouMean } from "../jsutils/didYouMean.mjs";
import { identityFunc } from "../jsutils/identityFunc.mjs";
import { inspect } from "../jsutils/inspect.mjs";
import { instanceOf } from "../jsutils/instanceOf.mjs";
import { keyMap } from "../jsutils/keyMap.mjs";
import { keyValMap } from "../jsutils/keyValMap.mjs";
import { mapValue } from "../jsutils/mapValue.mjs";
import { suggestionList } from "../jsutils/suggestionList.mjs";
import { toObjMapWithSymbols } from "../jsutils/toObjMap.mjs";
import { GraphQLError } from "../error/GraphQLError.mjs";
import { Kind } from "../language/kinds.mjs";
import { printForError as print } from "../language/printer.mjs";
import { valueFromASTUntyped } from "../utilities/valueFromASTUntyped.mjs";
import { assertEnumValueName, assertName } from "./assertName.mjs";
export function isType(type) {
    return (isScalarType(type) ||
        isObjectType(type) ||
        isInterfaceType(type) ||
        isUnionType(type) ||
        isEnumType(type) ||
        isInputObjectType(type) ||
        isListType(type) ||
        isNonNullType(type));
}
export function assertType(type) {
    if (!isType(type)) {
        throw new Error(`Expected ${inspect(type)} to be a GraphQL type.`);
    }
    return type;
}
const scalarSymbol = Symbol('Scalar');
export function isScalarType(type) {
    return instanceOf(type, scalarSymbol, GraphQLScalarType);
}
export function assertScalarType(type) {
    if (!isScalarType(type)) {
        throw new Error(`Expected ${inspect(type)} to be a GraphQL Scalar type.`);
    }
    return type;
}
const objectSymbol = Symbol('Object');
export function isObjectType(type) {
    return instanceOf(type, objectSymbol, GraphQLObjectType);
}
export function assertObjectType(type) {
    if (!isObjectType(type)) {
        throw new Error(`Expected ${inspect(type)} to be a GraphQL Object type.`);
    }
    return type;
}
const fieldSymbol = Symbol('Field');
export function isField(field) {
    return instanceOf(field, fieldSymbol, GraphQLField);
}
export function assertField(field) {
    if (!isField(field)) {
        throw new Error(`Expected ${inspect(field)} to be a GraphQL field.`);
    }
    return field;
}
const argumentSymbol = Symbol('Argument');
export function isArgument(arg) {
    return instanceOf(arg, argumentSymbol, GraphQLArgument);
}
export function assertArgument(arg) {
    if (!isArgument(arg)) {
        throw new Error(`Expected ${inspect(arg)} to be a GraphQL argument.`);
    }
    return arg;
}
const interfaceSymbol = Symbol('Interface');
export function isInterfaceType(type) {
    return instanceOf(type, interfaceSymbol, GraphQLInterfaceType);
}
export function assertInterfaceType(type) {
    if (!isInterfaceType(type)) {
        throw new Error(`Expected ${inspect(type)} to be a GraphQL Interface type.`);
    }
    return type;
}
const unionSymbol = Symbol('Union');
export function isUnionType(type) {
    return instanceOf(type, unionSymbol, GraphQLUnionType);
}
export function assertUnionType(type) {
    if (!isUnionType(type)) {
        throw new Error(`Expected ${inspect(type)} to be a GraphQL Union type.`);
    }
    return type;
}
const enumSymbol = Symbol('Enum');
export function isEnumType(type) {
    return instanceOf(type, enumSymbol, GraphQLEnumType);
}
export function assertEnumType(type) {
    if (!isEnumType(type)) {
        throw new Error(`Expected ${inspect(type)} to be a GraphQL Enum type.`);
    }
    return type;
}
const enumValueSymbol = Symbol('EnumValue');
export function isEnumValue(value) {
    return instanceOf(value, enumValueSymbol, GraphQLEnumValue);
}
export function assertEnumValue(value) {
    if (!isEnumValue(value)) {
        throw new Error(`Expected ${inspect(value)} to be a GraphQL Enum value.`);
    }
    return value;
}
const inputObjectSymbol = Symbol('InputObject');
export function isInputObjectType(type) {
    return instanceOf(type, inputObjectSymbol, GraphQLInputObjectType);
}
export function assertInputObjectType(type) {
    if (!isInputObjectType(type)) {
        throw new Error(`Expected ${inspect(type)} to be a GraphQL Input Object type.`);
    }
    return type;
}
const inputFieldSymbol = Symbol('InputField');
export function isInputField(field) {
    return instanceOf(field, inputFieldSymbol, GraphQLInputField);
}
export function assertInputField(field) {
    if (!isInputField(field)) {
        throw new Error(`Expected ${inspect(field)} to be a GraphQL input field.`);
    }
    return field;
}
const listSymbol = Symbol('List');
export function isListType(type) {
    return instanceOf(type, listSymbol, GraphQLList);
}
export function assertListType(type) {
    if (!isListType(type)) {
        throw new Error(`Expected ${inspect(type)} to be a GraphQL List type.`);
    }
    return type;
}
const nonNullSymbol = Symbol('NonNull');
export function isNonNullType(type) {
    return instanceOf(type, nonNullSymbol, GraphQLNonNull);
}
export function assertNonNullType(type) {
    if (!isNonNullType(type)) {
        throw new Error(`Expected ${inspect(type)} to be a GraphQL Non-Null type.`);
    }
    return type;
}
export function isInputType(type) {
    return (isScalarType(type) ||
        isEnumType(type) ||
        isInputObjectType(type) ||
        (isWrappingType(type) && isInputType(type.ofType)));
}
export function assertInputType(type) {
    if (!isInputType(type)) {
        throw new Error(`Expected ${inspect(type)} to be a GraphQL input type.`);
    }
    return type;
}
export function isOutputType(type) {
    return (isScalarType(type) ||
        isObjectType(type) ||
        isInterfaceType(type) ||
        isUnionType(type) ||
        isEnumType(type) ||
        (isWrappingType(type) && isOutputType(type.ofType)));
}
export function assertOutputType(type) {
    if (!isOutputType(type)) {
        throw new Error(`Expected ${inspect(type)} to be a GraphQL output type.`);
    }
    return type;
}
export function isLeafType(type) {
    return isScalarType(type) || isEnumType(type);
}
export function assertLeafType(type) {
    if (!isLeafType(type)) {
        throw new Error(`Expected ${inspect(type)} to be a GraphQL leaf type.`);
    }
    return type;
}
export function isCompositeType(type) {
    return isObjectType(type) || isInterfaceType(type) || isUnionType(type);
}
export function assertCompositeType(type) {
    if (!isCompositeType(type)) {
        throw new Error(`Expected ${inspect(type)} to be a GraphQL composite type.`);
    }
    return type;
}
export function isAbstractType(type) {
    return isInterfaceType(type) || isUnionType(type);
}
export function assertAbstractType(type) {
    if (!isAbstractType(type)) {
        throw new Error(`Expected ${inspect(type)} to be a GraphQL abstract type.`);
    }
    return type;
}
export class GraphQLList {
    constructor(ofType) {
        this.__kind = listSymbol;
        this.ofType = ofType;
    }
    get [Symbol.toStringTag]() {
        return 'GraphQLList';
    }
    toString() {
        return '[' + String(this.ofType) + ']';
    }
    toJSON() {
        return this.toString();
    }
}
export class GraphQLNonNull {
    constructor(ofType) {
        this.__kind = nonNullSymbol;
        this.ofType = ofType;
    }
    get [Symbol.toStringTag]() {
        return 'GraphQLNonNull';
    }
    toString() {
        return String(this.ofType) + '!';
    }
    toJSON() {
        return this.toString();
    }
}
export function isWrappingType(type) {
    return isListType(type) || isNonNullType(type);
}
export function assertWrappingType(type) {
    if (!isWrappingType(type)) {
        throw new Error(`Expected ${inspect(type)} to be a GraphQL wrapping type.`);
    }
    return type;
}
export function isNullableType(type) {
    return isType(type) && !isNonNullType(type);
}
export function assertNullableType(type) {
    if (!isNullableType(type)) {
        throw new Error(`Expected ${inspect(type)} to be a GraphQL nullable type.`);
    }
    return type;
}
export function getNullableType(type) {
    if (type) {
        return isNonNullType(type) ? type.ofType : type;
    }
}
export function isNamedType(type) {
    return (isScalarType(type) ||
        isObjectType(type) ||
        isInterfaceType(type) ||
        isUnionType(type) ||
        isEnumType(type) ||
        isInputObjectType(type));
}
export function assertNamedType(type) {
    if (!isNamedType(type)) {
        throw new Error(`Expected ${inspect(type)} to be a GraphQL named type.`);
    }
    return type;
}
export function getNamedType(type) {
    if (type) {
        let unwrappedType = type;
        while (isWrappingType(unwrappedType)) {
            unwrappedType = unwrappedType.ofType;
        }
        return unwrappedType;
    }
}
export function resolveReadonlyArrayThunk(thunk) {
    return typeof thunk === 'function' ? thunk() : thunk;
}
export function resolveObjMapThunk(thunk) {
    return typeof thunk === 'function' ? thunk() : thunk;
}
export class GraphQLScalarType {
    constructor(config) {
        this.__kind = scalarSymbol;
        this.name = assertName(config.name);
        this.description = config.description;
        this.specifiedByURL = config.specifiedByURL;
        this.serialize =
            config.serialize ??
                config.coerceOutputValue ??
                identityFunc;
        this.parseValue =
            config.parseValue ??
                config.coerceInputValue ??
                identityFunc;
        this.parseLiteral =
            config.parseLiteral ??
                ((node, variables) => this.coerceInputValue(valueFromASTUntyped(node, variables)));
        this.coerceOutputValue = config.coerceOutputValue ?? this.serialize;
        this.coerceInputValue = config.coerceInputValue ?? this.parseValue;
        this.coerceInputLiteral = config.coerceInputLiteral;
        this.valueToLiteral = config.valueToLiteral;
        this.extensions = toObjMapWithSymbols(config.extensions);
        this.astNode = config.astNode;
        this.extensionASTNodes = config.extensionASTNodes ?? [];
        if (config.parseLiteral) {
            if (!(typeof config.parseValue === 'function' &&
                typeof config.parseLiteral === 'function'))
                devAssert(false, `${this.name} must provide both "parseValue" and "parseLiteral" functions.`);
        }
        if (config.coerceInputLiteral) {
            if (!(typeof config.coerceInputValue === 'function' &&
                typeof config.coerceInputLiteral === 'function'))
                devAssert(false, `${this.name} must provide both "coerceInputValue" and "coerceInputLiteral" functions.`);
        }
    }
    get [Symbol.toStringTag]() {
        return 'GraphQLScalarType';
    }
    toConfig() {
        return {
            name: this.name,
            description: this.description,
            specifiedByURL: this.specifiedByURL,
            serialize: this.serialize,
            parseValue: this.parseValue,
            parseLiteral: this.parseLiteral,
            coerceOutputValue: this.coerceOutputValue,
            coerceInputValue: this.coerceInputValue,
            coerceInputLiteral: this.coerceInputLiteral,
            valueToLiteral: this.valueToLiteral,
            extensions: this.extensions,
            astNode: this.astNode,
            extensionASTNodes: this.extensionASTNodes,
        };
    }
    toString() {
        return this.name;
    }
    toJSON() {
        return this.toString();
    }
}
export class GraphQLObjectType {
    constructor(config) {
        this.__kind = objectSymbol;
        this.__kind = objectSymbol;
        this.name = assertName(config.name);
        this.description = config.description;
        this.isTypeOf = config.isTypeOf;
        this.extensions = toObjMapWithSymbols(config.extensions);
        this.astNode = config.astNode;
        this.extensionASTNodes = config.extensionASTNodes ?? [];
        this._fields = (defineFieldMap).bind(undefined, this, config.fields);
        this._interfaces = defineInterfaces.bind(undefined, config.interfaces);
    }
    get [Symbol.toStringTag]() {
        return 'GraphQLObjectType';
    }
    getFields() {
        if (typeof this._fields === 'function') {
            this._fields = this._fields();
        }
        return this._fields;
    }
    getInterfaces() {
        if (typeof this._interfaces === 'function') {
            this._interfaces = this._interfaces();
        }
        return this._interfaces;
    }
    toConfig() {
        return {
            name: this.name,
            description: this.description,
            interfaces: this.getInterfaces(),
            fields: mapValue(this.getFields(), (field) => field.toConfig()),
            isTypeOf: this.isTypeOf,
            extensions: this.extensions,
            astNode: this.astNode,
            extensionASTNodes: this.extensionASTNodes,
        };
    }
    toString() {
        return this.name;
    }
    toJSON() {
        return this.toString();
    }
}
function defineInterfaces(interfaces) {
    return resolveReadonlyArrayThunk(interfaces ?? []);
}
function defineFieldMap(parentType, fields) {
    const fieldMap = resolveObjMapThunk(fields);
    return mapValue(fieldMap, (fieldConfig, fieldName) => new GraphQLField(parentType, fieldName, fieldConfig));
}
export class GraphQLField {
    constructor(parentType, name, config) {
        this.__kind = fieldSymbol;
        this.parentType = parentType;
        this.name = assertName(name);
        this.description = config.description;
        this.type = config.type;
        const argsConfig = config.args;
        this.args = argsConfig
            ? Object.entries(argsConfig).map(([argName, argConfig]) => new GraphQLArgument(this, argName, argConfig))
            : [];
        this.resolve = config.resolve;
        this.subscribe = config.subscribe;
        this.deprecationReason = config.deprecationReason;
        this.extensions = toObjMapWithSymbols(config.extensions);
        this.astNode = config.astNode;
    }
    get [Symbol.toStringTag]() {
        return 'GraphQLField';
    }
    toConfig() {
        return {
            description: this.description,
            type: this.type,
            args: keyValMap(this.args, (arg) => arg.name, (arg) => arg.toConfig()),
            resolve: this.resolve,
            subscribe: this.subscribe,
            deprecationReason: this.deprecationReason,
            extensions: this.extensions,
            astNode: this.astNode,
        };
    }
    toString() {
        return `${this.parentType ?? '<meta>'}.${this.name}`;
    }
    toJSON() {
        return this.toString();
    }
}
export class GraphQLArgument {
    constructor(parent, name, config) {
        this.__kind = argumentSymbol;
        this.parent = parent;
        this.name = assertName(name);
        this.description = config.description;
        this.type = config.type;
        this.defaultValue = config.defaultValue;
        this.default = config.default;
        this._memoizedCoercedDefaultValue = undefined;
        this.deprecationReason = config.deprecationReason;
        this.extensions = toObjMapWithSymbols(config.extensions);
        this.astNode = config.astNode;
    }
    get [Symbol.toStringTag]() {
        return 'GraphQLArgument';
    }
    toConfig() {
        return {
            description: this.description,
            type: this.type,
            defaultValue: this.defaultValue,
            default: this.default,
            deprecationReason: this.deprecationReason,
            extensions: this.extensions,
            astNode: this.astNode,
        };
    }
    toString() {
        return `${this.parent}(${this.name}:)`;
    }
    toJSON() {
        return this.toString();
    }
}
export function isRequiredArgument(arg) {
    return (isNonNullType(arg.type) &&
        arg.default === undefined &&
        arg.defaultValue === undefined);
}
export class GraphQLInterfaceType {
    constructor(config) {
        this.__kind = interfaceSymbol;
        this.name = assertName(config.name);
        this.description = config.description;
        this.resolveType = config.resolveType;
        this.extensions = toObjMapWithSymbols(config.extensions);
        this.astNode = config.astNode;
        this.extensionASTNodes = config.extensionASTNodes ?? [];
        this._fields = (defineFieldMap).bind(undefined, this, config.fields);
        this._interfaces = defineInterfaces.bind(undefined, config.interfaces);
    }
    get [Symbol.toStringTag]() {
        return 'GraphQLInterfaceType';
    }
    getFields() {
        if (typeof this._fields === 'function') {
            this._fields = this._fields();
        }
        return this._fields;
    }
    getInterfaces() {
        if (typeof this._interfaces === 'function') {
            this._interfaces = this._interfaces();
        }
        return this._interfaces;
    }
    toConfig() {
        return {
            name: this.name,
            description: this.description,
            interfaces: this.getInterfaces(),
            fields: mapValue(this.getFields(), (field) => field.toConfig()),
            resolveType: this.resolveType,
            extensions: this.extensions,
            astNode: this.astNode,
            extensionASTNodes: this.extensionASTNodes,
        };
    }
    toString() {
        return this.name;
    }
    toJSON() {
        return this.toString();
    }
}
export class GraphQLUnionType {
    constructor(config) {
        this.__kind = unionSymbol;
        this.name = assertName(config.name);
        this.description = config.description;
        this.resolveType = config.resolveType;
        this.extensions = toObjMapWithSymbols(config.extensions);
        this.astNode = config.astNode;
        this.extensionASTNodes = config.extensionASTNodes ?? [];
        this._types = defineTypes.bind(undefined, config.types);
    }
    get [Symbol.toStringTag]() {
        return 'GraphQLUnionType';
    }
    getTypes() {
        if (typeof this._types === 'function') {
            this._types = this._types();
        }
        return this._types;
    }
    toConfig() {
        return {
            name: this.name,
            description: this.description,
            types: this.getTypes(),
            resolveType: this.resolveType,
            extensions: this.extensions,
            astNode: this.astNode,
            extensionASTNodes: this.extensionASTNodes,
        };
    }
    toString() {
        return this.name;
    }
    toJSON() {
        return this.toString();
    }
}
function defineTypes(types) {
    return resolveReadonlyArrayThunk(types);
}
export class GraphQLEnumType {
    constructor(config) {
        this.__kind = enumSymbol;
        this.name = assertName(config.name);
        this.description = config.description;
        this.extensions = toObjMapWithSymbols(config.extensions);
        this.astNode = config.astNode;
        this.extensionASTNodes = config.extensionASTNodes ?? [];
        this._values = defineEnumValues.bind(undefined, this, config.values);
        this._valueLookup = null;
        this._nameLookup = null;
    }
    get [Symbol.toStringTag]() {
        return 'GraphQLEnumType';
    }
    getValues() {
        if (typeof this._values === 'function') {
            this._values = this._values();
        }
        return this._values;
    }
    getValue(name) {
        this._nameLookup ??= keyMap(this.getValues(), (value) => value.name);
        return this._nameLookup[name];
    }
    serialize(outputValue) {
        return this.coerceOutputValue(outputValue);
    }
    coerceOutputValue(outputValue) {
        this._valueLookup ??= new Map(this.getValues().map((enumValue) => [enumValue.value, enumValue]));
        const enumValue = this._valueLookup.get(outputValue);
        if (enumValue === undefined) {
            throw new GraphQLError(`Enum "${this.name}" cannot represent value: ${inspect(outputValue)}`);
        }
        return enumValue.name;
    }
    parseValue(inputValue, hideSuggestions) {
        return this.coerceInputValue(inputValue, hideSuggestions);
    }
    coerceInputValue(inputValue, hideSuggestions) {
        if (typeof inputValue !== 'string') {
            const valueStr = inspect(inputValue);
            throw new GraphQLError(`Enum "${this.name}" cannot represent non-string value: ${valueStr}.` +
                (hideSuggestions ? '' : didYouMeanEnumValue(this, valueStr)));
        }
        const enumValue = this.getValue(inputValue);
        if (enumValue == null) {
            throw new GraphQLError(`Value "${inputValue}" does not exist in "${this.name}" enum.` +
                (hideSuggestions ? '' : didYouMeanEnumValue(this, inputValue)));
        }
        return enumValue.value;
    }
    parseLiteral(valueNode, _variables, hideSuggestions) {
        return this.coerceInputLiteral(valueNode, hideSuggestions);
    }
    coerceInputLiteral(valueNode, hideSuggestions) {
        if (valueNode.kind !== Kind.ENUM) {
            const valueStr = print(valueNode);
            throw new GraphQLError(`Enum "${this.name}" cannot represent non-enum value: ${valueStr}.` +
                (hideSuggestions ? '' : didYouMeanEnumValue(this, valueStr)), { nodes: valueNode });
        }
        const enumValue = this.getValue(valueNode.value);
        if (enumValue == null) {
            const valueStr = print(valueNode);
            throw new GraphQLError(`Value "${valueStr}" does not exist in "${this.name}" enum.` +
                (hideSuggestions ? '' : didYouMeanEnumValue(this, valueStr)), { nodes: valueNode });
        }
        return enumValue.value;
    }
    valueToLiteral(value) {
        if (typeof value === 'string' && this.getValue(value)) {
            return { kind: Kind.ENUM, value };
        }
    }
    toConfig() {
        return {
            name: this.name,
            description: this.description,
            values: keyValMap(this.getValues(), (value) => value.name, (value) => value.toConfig()),
            extensions: this.extensions,
            astNode: this.astNode,
            extensionASTNodes: this.extensionASTNodes,
        };
    }
    toString() {
        return this.name;
    }
    toJSON() {
        return this.toString();
    }
}
function defineEnumValues(parentEnum, values) {
    const valueMap = resolveObjMapThunk(values);
    return Object.entries(valueMap).map(([valueName, valueConfig]) => new GraphQLEnumValue(parentEnum, valueName, valueConfig));
}
function didYouMeanEnumValue(enumType, unknownValueStr) {
    const allNames = enumType.getValues().map((value) => value.name);
    const suggestedValues = suggestionList(unknownValueStr, allNames);
    return didYouMean('the enum value', suggestedValues);
}
export class GraphQLEnumValue {
    constructor(parentEnum, name, config) {
        this.__kind = enumValueSymbol;
        this.parentEnum = parentEnum;
        this.name = assertEnumValueName(name);
        this.description = config.description;
        this.value = config.value !== undefined ? config.value : name;
        this.deprecationReason = config.deprecationReason;
        this.extensions = toObjMapWithSymbols(config.extensions);
        this.astNode = config.astNode;
    }
    get [Symbol.toStringTag]() {
        return 'GraphQLEnumValue';
    }
    toConfig() {
        return {
            description: this.description,
            value: this.value,
            deprecationReason: this.deprecationReason,
            extensions: this.extensions,
            astNode: this.astNode,
        };
    }
    toString() {
        return `${this.parentEnum.name}.${this.name}`;
    }
    toJSON() {
        return this.toString();
    }
}
export class GraphQLInputObjectType {
    constructor(config) {
        this.__kind = inputObjectSymbol;
        this.name = assertName(config.name);
        this.description = config.description;
        this.extensions = toObjMapWithSymbols(config.extensions);
        this.astNode = config.astNode;
        this.extensionASTNodes = config.extensionASTNodes ?? [];
        this.isOneOf = config.isOneOf ?? false;
        this._fields = defineInputFieldMap.bind(undefined, this, config.fields);
    }
    get [Symbol.toStringTag]() {
        return 'GraphQLInputObjectType';
    }
    getFields() {
        if (typeof this._fields === 'function') {
            this._fields = this._fields();
        }
        return this._fields;
    }
    toConfig() {
        return {
            name: this.name,
            description: this.description,
            fields: mapValue(this.getFields(), (field) => field.toConfig()),
            extensions: this.extensions,
            astNode: this.astNode,
            extensionASTNodes: this.extensionASTNodes,
            isOneOf: this.isOneOf,
        };
    }
    toString() {
        return this.name;
    }
    toJSON() {
        return this.toString();
    }
}
function defineInputFieldMap(parentType, fields) {
    const fieldMap = resolveObjMapThunk(fields);
    return mapValue(fieldMap, (fieldConfig, fieldName) => new GraphQLInputField(parentType, fieldName, fieldConfig));
}
export class GraphQLInputField {
    constructor(parentType, name, config) {
        if (!(!('resolve' in config)))
            devAssert(false, `${parentType}.${name} field has a resolve property, but Input Types cannot define resolvers.`);
        this.__kind = inputFieldSymbol;
        this.parentType = parentType;
        this.name = assertName(name);
        this.description = config.description;
        this.type = config.type;
        this.defaultValue = config.defaultValue;
        this.default = config.default;
        this._memoizedCoercedDefaultValue = undefined;
        this.deprecationReason = config.deprecationReason;
        this.extensions = toObjMapWithSymbols(config.extensions);
        this.astNode = config.astNode;
    }
    get [Symbol.toStringTag]() {
        return 'GraphQLInputField';
    }
    toConfig() {
        return {
            description: this.description,
            type: this.type,
            defaultValue: this.defaultValue,
            default: this.default,
            deprecationReason: this.deprecationReason,
            extensions: this.extensions,
            astNode: this.astNode,
        };
    }
    toString() {
        return `${this.parentType}.${this.name}`;
    }
    toJSON() {
        return this.toString();
    }
}
export function isRequiredInputField(field) {
    return (isNonNullType(field.type) &&
        field.defaultValue === undefined &&
        field.default === undefined);
}
//# sourceMappingURL=definition.js.map