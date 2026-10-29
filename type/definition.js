"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GraphQLInputField = exports.GraphQLInputObjectType = exports.GraphQLEnumValue = exports.GraphQLEnumType = exports.GraphQLUnionType = exports.GraphQLInterfaceType = exports.GraphQLArgument = exports.GraphQLField = exports.GraphQLObjectType = exports.GraphQLScalarType = exports.GraphQLNonNull = exports.GraphQLList = void 0;
exports.isType = isType;
exports.assertType = assertType;
exports.isScalarType = isScalarType;
exports.assertScalarType = assertScalarType;
exports.isObjectType = isObjectType;
exports.assertObjectType = assertObjectType;
exports.isField = isField;
exports.assertField = assertField;
exports.isArgument = isArgument;
exports.assertArgument = assertArgument;
exports.isInterfaceType = isInterfaceType;
exports.assertInterfaceType = assertInterfaceType;
exports.isUnionType = isUnionType;
exports.assertUnionType = assertUnionType;
exports.isEnumType = isEnumType;
exports.assertEnumType = assertEnumType;
exports.isEnumValue = isEnumValue;
exports.assertEnumValue = assertEnumValue;
exports.isInputObjectType = isInputObjectType;
exports.assertInputObjectType = assertInputObjectType;
exports.isInputField = isInputField;
exports.assertInputField = assertInputField;
exports.isListType = isListType;
exports.assertListType = assertListType;
exports.isNonNullType = isNonNullType;
exports.assertNonNullType = assertNonNullType;
exports.isInputType = isInputType;
exports.assertInputType = assertInputType;
exports.isOutputType = isOutputType;
exports.assertOutputType = assertOutputType;
exports.isLeafType = isLeafType;
exports.assertLeafType = assertLeafType;
exports.isCompositeType = isCompositeType;
exports.assertCompositeType = assertCompositeType;
exports.isAbstractType = isAbstractType;
exports.assertAbstractType = assertAbstractType;
exports.isWrappingType = isWrappingType;
exports.assertWrappingType = assertWrappingType;
exports.isNullableType = isNullableType;
exports.assertNullableType = assertNullableType;
exports.getNullableType = getNullableType;
exports.isNamedType = isNamedType;
exports.assertNamedType = assertNamedType;
exports.getNamedType = getNamedType;
exports.resolveReadonlyArrayThunk = resolveReadonlyArrayThunk;
exports.resolveObjMapThunk = resolveObjMapThunk;
exports.isRequiredArgument = isRequiredArgument;
exports.isRequiredInputField = isRequiredInputField;
const devAssert_ts_1 = require("../jsutils/devAssert.js");
const didYouMean_ts_1 = require("../jsutils/didYouMean.js");
const identityFunc_ts_1 = require("../jsutils/identityFunc.js");
const inspect_ts_1 = require("../jsutils/inspect.js");
const instanceOf_ts_1 = require("../jsutils/instanceOf.js");
const keyMap_ts_1 = require("../jsutils/keyMap.js");
const keyValMap_ts_1 = require("../jsutils/keyValMap.js");
const mapValue_ts_1 = require("../jsutils/mapValue.js");
const suggestionList_ts_1 = require("../jsutils/suggestionList.js");
const toObjMap_ts_1 = require("../jsutils/toObjMap.js");
const GraphQLError_ts_1 = require("../error/GraphQLError.js");
const kinds_ts_1 = require("../language/kinds.js");
const printer_ts_1 = require("../language/printer.js");
const valueFromASTUntyped_ts_1 = require("../utilities/valueFromASTUntyped.js");
const assertName_ts_1 = require("./assertName.js");
function isType(type) {
    return (isScalarType(type) ||
        isObjectType(type) ||
        isInterfaceType(type) ||
        isUnionType(type) ||
        isEnumType(type) ||
        isInputObjectType(type) ||
        isListType(type) ||
        isNonNullType(type));
}
function assertType(type) {
    if (!isType(type)) {
        throw new Error(`Expected ${(0, inspect_ts_1.inspect)(type)} to be a GraphQL type.`);
    }
    return type;
}
const scalarSymbol = Symbol('Scalar');
function isScalarType(type) {
    return (0, instanceOf_ts_1.instanceOf)(type, scalarSymbol, GraphQLScalarType);
}
function assertScalarType(type) {
    if (!isScalarType(type)) {
        throw new Error(`Expected ${(0, inspect_ts_1.inspect)(type)} to be a GraphQL Scalar type.`);
    }
    return type;
}
const objectSymbol = Symbol('Object');
function isObjectType(type) {
    return (0, instanceOf_ts_1.instanceOf)(type, objectSymbol, GraphQLObjectType);
}
function assertObjectType(type) {
    if (!isObjectType(type)) {
        throw new Error(`Expected ${(0, inspect_ts_1.inspect)(type)} to be a GraphQL Object type.`);
    }
    return type;
}
const fieldSymbol = Symbol('Field');
function isField(field) {
    return (0, instanceOf_ts_1.instanceOf)(field, fieldSymbol, GraphQLField);
}
function assertField(field) {
    if (!isField(field)) {
        throw new Error(`Expected ${(0, inspect_ts_1.inspect)(field)} to be a GraphQL field.`);
    }
    return field;
}
const argumentSymbol = Symbol('Argument');
function isArgument(arg) {
    return (0, instanceOf_ts_1.instanceOf)(arg, argumentSymbol, GraphQLArgument);
}
function assertArgument(arg) {
    if (!isArgument(arg)) {
        throw new Error(`Expected ${(0, inspect_ts_1.inspect)(arg)} to be a GraphQL argument.`);
    }
    return arg;
}
const interfaceSymbol = Symbol('Interface');
function isInterfaceType(type) {
    return (0, instanceOf_ts_1.instanceOf)(type, interfaceSymbol, GraphQLInterfaceType);
}
function assertInterfaceType(type) {
    if (!isInterfaceType(type)) {
        throw new Error(`Expected ${(0, inspect_ts_1.inspect)(type)} to be a GraphQL Interface type.`);
    }
    return type;
}
const unionSymbol = Symbol('Union');
function isUnionType(type) {
    return (0, instanceOf_ts_1.instanceOf)(type, unionSymbol, GraphQLUnionType);
}
function assertUnionType(type) {
    if (!isUnionType(type)) {
        throw new Error(`Expected ${(0, inspect_ts_1.inspect)(type)} to be a GraphQL Union type.`);
    }
    return type;
}
const enumSymbol = Symbol('Enum');
function isEnumType(type) {
    return (0, instanceOf_ts_1.instanceOf)(type, enumSymbol, GraphQLEnumType);
}
function assertEnumType(type) {
    if (!isEnumType(type)) {
        throw new Error(`Expected ${(0, inspect_ts_1.inspect)(type)} to be a GraphQL Enum type.`);
    }
    return type;
}
const enumValueSymbol = Symbol('EnumValue');
function isEnumValue(value) {
    return (0, instanceOf_ts_1.instanceOf)(value, enumValueSymbol, GraphQLEnumValue);
}
function assertEnumValue(value) {
    if (!isEnumValue(value)) {
        throw new Error(`Expected ${(0, inspect_ts_1.inspect)(value)} to be a GraphQL Enum value.`);
    }
    return value;
}
const inputObjectSymbol = Symbol('InputObject');
function isInputObjectType(type) {
    return (0, instanceOf_ts_1.instanceOf)(type, inputObjectSymbol, GraphQLInputObjectType);
}
function assertInputObjectType(type) {
    if (!isInputObjectType(type)) {
        throw new Error(`Expected ${(0, inspect_ts_1.inspect)(type)} to be a GraphQL Input Object type.`);
    }
    return type;
}
const inputFieldSymbol = Symbol('InputField');
function isInputField(field) {
    return (0, instanceOf_ts_1.instanceOf)(field, inputFieldSymbol, GraphQLInputField);
}
function assertInputField(field) {
    if (!isInputField(field)) {
        throw new Error(`Expected ${(0, inspect_ts_1.inspect)(field)} to be a GraphQL input field.`);
    }
    return field;
}
const listSymbol = Symbol('List');
function isListType(type) {
    return (0, instanceOf_ts_1.instanceOf)(type, listSymbol, GraphQLList);
}
function assertListType(type) {
    if (!isListType(type)) {
        throw new Error(`Expected ${(0, inspect_ts_1.inspect)(type)} to be a GraphQL List type.`);
    }
    return type;
}
const nonNullSymbol = Symbol('NonNull');
function isNonNullType(type) {
    return (0, instanceOf_ts_1.instanceOf)(type, nonNullSymbol, GraphQLNonNull);
}
function assertNonNullType(type) {
    if (!isNonNullType(type)) {
        throw new Error(`Expected ${(0, inspect_ts_1.inspect)(type)} to be a GraphQL Non-Null type.`);
    }
    return type;
}
function isInputType(type) {
    return (isScalarType(type) ||
        isEnumType(type) ||
        isInputObjectType(type) ||
        (isWrappingType(type) && isInputType(type.ofType)));
}
function assertInputType(type) {
    if (!isInputType(type)) {
        throw new Error(`Expected ${(0, inspect_ts_1.inspect)(type)} to be a GraphQL input type.`);
    }
    return type;
}
function isOutputType(type) {
    return (isScalarType(type) ||
        isObjectType(type) ||
        isInterfaceType(type) ||
        isUnionType(type) ||
        isEnumType(type) ||
        (isWrappingType(type) && isOutputType(type.ofType)));
}
function assertOutputType(type) {
    if (!isOutputType(type)) {
        throw new Error(`Expected ${(0, inspect_ts_1.inspect)(type)} to be a GraphQL output type.`);
    }
    return type;
}
function isLeafType(type) {
    return isScalarType(type) || isEnumType(type);
}
function assertLeafType(type) {
    if (!isLeafType(type)) {
        throw new Error(`Expected ${(0, inspect_ts_1.inspect)(type)} to be a GraphQL leaf type.`);
    }
    return type;
}
function isCompositeType(type) {
    return isObjectType(type) || isInterfaceType(type) || isUnionType(type);
}
function assertCompositeType(type) {
    if (!isCompositeType(type)) {
        throw new Error(`Expected ${(0, inspect_ts_1.inspect)(type)} to be a GraphQL composite type.`);
    }
    return type;
}
function isAbstractType(type) {
    return isInterfaceType(type) || isUnionType(type);
}
function assertAbstractType(type) {
    if (!isAbstractType(type)) {
        throw new Error(`Expected ${(0, inspect_ts_1.inspect)(type)} to be a GraphQL abstract type.`);
    }
    return type;
}
class GraphQLList {
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
exports.GraphQLList = GraphQLList;
class GraphQLNonNull {
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
exports.GraphQLNonNull = GraphQLNonNull;
function isWrappingType(type) {
    return isListType(type) || isNonNullType(type);
}
function assertWrappingType(type) {
    if (!isWrappingType(type)) {
        throw new Error(`Expected ${(0, inspect_ts_1.inspect)(type)} to be a GraphQL wrapping type.`);
    }
    return type;
}
function isNullableType(type) {
    return isType(type) && !isNonNullType(type);
}
function assertNullableType(type) {
    if (!isNullableType(type)) {
        throw new Error(`Expected ${(0, inspect_ts_1.inspect)(type)} to be a GraphQL nullable type.`);
    }
    return type;
}
function getNullableType(type) {
    if (type) {
        return isNonNullType(type) ? type.ofType : type;
    }
}
function isNamedType(type) {
    return (isScalarType(type) ||
        isObjectType(type) ||
        isInterfaceType(type) ||
        isUnionType(type) ||
        isEnumType(type) ||
        isInputObjectType(type));
}
function assertNamedType(type) {
    if (!isNamedType(type)) {
        throw new Error(`Expected ${(0, inspect_ts_1.inspect)(type)} to be a GraphQL named type.`);
    }
    return type;
}
function getNamedType(type) {
    if (type) {
        let unwrappedType = type;
        while (isWrappingType(unwrappedType)) {
            unwrappedType = unwrappedType.ofType;
        }
        return unwrappedType;
    }
}
function resolveReadonlyArrayThunk(thunk) {
    return typeof thunk === 'function' ? thunk() : thunk;
}
function resolveObjMapThunk(thunk) {
    return typeof thunk === 'function' ? thunk() : thunk;
}
class GraphQLScalarType {
    constructor(config) {
        this.__kind = scalarSymbol;
        this.name = (0, assertName_ts_1.assertName)(config.name);
        this.description = config.description;
        this.specifiedByURL = config.specifiedByURL;
        this.serialize =
            config.serialize ??
                config.coerceOutputValue ??
                identityFunc_ts_1.identityFunc;
        this.parseValue =
            config.parseValue ??
                config.coerceInputValue ??
                identityFunc_ts_1.identityFunc;
        this.parseLiteral =
            config.parseLiteral ??
                ((node, variables) => this.coerceInputValue((0, valueFromASTUntyped_ts_1.valueFromASTUntyped)(node, variables)));
        this.coerceOutputValue = config.coerceOutputValue ?? this.serialize;
        this.coerceInputValue = config.coerceInputValue ?? this.parseValue;
        this.coerceInputLiteral = config.coerceInputLiteral;
        this.valueToLiteral = config.valueToLiteral;
        this.extensions = (0, toObjMap_ts_1.toObjMapWithSymbols)(config.extensions);
        this.astNode = config.astNode;
        this.extensionASTNodes = config.extensionASTNodes ?? [];
        if (config.parseLiteral) {
            if (!(typeof config.parseValue === 'function' &&
                typeof config.parseLiteral === 'function'))
                (0, devAssert_ts_1.devAssert)(false, `${this.name} must provide both "parseValue" and "parseLiteral" functions.`);
        }
        if (config.coerceInputLiteral) {
            if (!(typeof config.coerceInputValue === 'function' &&
                typeof config.coerceInputLiteral === 'function'))
                (0, devAssert_ts_1.devAssert)(false, `${this.name} must provide both "coerceInputValue" and "coerceInputLiteral" functions.`);
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
exports.GraphQLScalarType = GraphQLScalarType;
class GraphQLObjectType {
    constructor(config) {
        this.__kind = objectSymbol;
        this.__kind = objectSymbol;
        this.name = (0, assertName_ts_1.assertName)(config.name);
        this.description = config.description;
        this.isTypeOf = config.isTypeOf;
        this.extensions = (0, toObjMap_ts_1.toObjMapWithSymbols)(config.extensions);
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
            fields: (0, mapValue_ts_1.mapValue)(this.getFields(), (field) => field.toConfig()),
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
exports.GraphQLObjectType = GraphQLObjectType;
function defineInterfaces(interfaces) {
    return resolveReadonlyArrayThunk(interfaces ?? []);
}
function defineFieldMap(parentType, fields) {
    const fieldMap = resolveObjMapThunk(fields);
    return (0, mapValue_ts_1.mapValue)(fieldMap, (fieldConfig, fieldName) => new GraphQLField(parentType, fieldName, fieldConfig));
}
class GraphQLField {
    constructor(parentType, name, config) {
        this.__kind = fieldSymbol;
        this.parentType = parentType;
        this.name = (0, assertName_ts_1.assertName)(name);
        this.description = config.description;
        this.type = config.type;
        const argsConfig = config.args;
        this.args = argsConfig
            ? Object.entries(argsConfig).map(([argName, argConfig]) => new GraphQLArgument(this, argName, argConfig))
            : [];
        this.resolve = config.resolve;
        this.subscribe = config.subscribe;
        this.deprecationReason = config.deprecationReason;
        this.extensions = (0, toObjMap_ts_1.toObjMapWithSymbols)(config.extensions);
        this.astNode = config.astNode;
    }
    get [Symbol.toStringTag]() {
        return 'GraphQLField';
    }
    toConfig() {
        return {
            description: this.description,
            type: this.type,
            args: (0, keyValMap_ts_1.keyValMap)(this.args, (arg) => arg.name, (arg) => arg.toConfig()),
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
exports.GraphQLField = GraphQLField;
class GraphQLArgument {
    constructor(parent, name, config) {
        this.__kind = argumentSymbol;
        this.parent = parent;
        this.name = (0, assertName_ts_1.assertName)(name);
        this.description = config.description;
        this.type = config.type;
        this.defaultValue = config.defaultValue;
        this.default = config.default;
        this._memoizedCoercedDefaultValue = undefined;
        this.deprecationReason = config.deprecationReason;
        this.extensions = (0, toObjMap_ts_1.toObjMapWithSymbols)(config.extensions);
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
exports.GraphQLArgument = GraphQLArgument;
function isRequiredArgument(arg) {
    return (isNonNullType(arg.type) &&
        arg.default === undefined &&
        arg.defaultValue === undefined);
}
class GraphQLInterfaceType {
    constructor(config) {
        this.__kind = interfaceSymbol;
        this.name = (0, assertName_ts_1.assertName)(config.name);
        this.description = config.description;
        this.resolveType = config.resolveType;
        this.extensions = (0, toObjMap_ts_1.toObjMapWithSymbols)(config.extensions);
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
            fields: (0, mapValue_ts_1.mapValue)(this.getFields(), (field) => field.toConfig()),
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
exports.GraphQLInterfaceType = GraphQLInterfaceType;
class GraphQLUnionType {
    constructor(config) {
        this.__kind = unionSymbol;
        this.name = (0, assertName_ts_1.assertName)(config.name);
        this.description = config.description;
        this.resolveType = config.resolveType;
        this.extensions = (0, toObjMap_ts_1.toObjMapWithSymbols)(config.extensions);
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
exports.GraphQLUnionType = GraphQLUnionType;
function defineTypes(types) {
    return resolveReadonlyArrayThunk(types);
}
class GraphQLEnumType {
    constructor(config) {
        this.__kind = enumSymbol;
        this.name = (0, assertName_ts_1.assertName)(config.name);
        this.description = config.description;
        this.extensions = (0, toObjMap_ts_1.toObjMapWithSymbols)(config.extensions);
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
        this._nameLookup ??= (0, keyMap_ts_1.keyMap)(this.getValues(), (value) => value.name);
        return this._nameLookup[name];
    }
    serialize(outputValue) {
        return this.coerceOutputValue(outputValue);
    }
    coerceOutputValue(outputValue) {
        this._valueLookup ??= new Map(this.getValues().map((enumValue) => [enumValue.value, enumValue]));
        const enumValue = this._valueLookup.get(outputValue);
        if (enumValue === undefined) {
            throw new GraphQLError_ts_1.GraphQLError(`Enum "${this.name}" cannot represent value: ${(0, inspect_ts_1.inspect)(outputValue)}`);
        }
        return enumValue.name;
    }
    parseValue(inputValue, hideSuggestions) {
        return this.coerceInputValue(inputValue, hideSuggestions);
    }
    coerceInputValue(inputValue, hideSuggestions) {
        if (typeof inputValue !== 'string') {
            const valueStr = (0, inspect_ts_1.inspect)(inputValue);
            throw new GraphQLError_ts_1.GraphQLError(`Enum "${this.name}" cannot represent non-string value: ${valueStr}.` +
                (hideSuggestions ? '' : didYouMeanEnumValue(this, valueStr)));
        }
        const enumValue = this.getValue(inputValue);
        if (enumValue == null) {
            throw new GraphQLError_ts_1.GraphQLError(`Value "${inputValue}" does not exist in "${this.name}" enum.` +
                (hideSuggestions ? '' : didYouMeanEnumValue(this, inputValue)));
        }
        return enumValue.value;
    }
    parseLiteral(valueNode, _variables, hideSuggestions) {
        return this.coerceInputLiteral(valueNode, hideSuggestions);
    }
    coerceInputLiteral(valueNode, hideSuggestions) {
        if (valueNode.kind !== kinds_ts_1.Kind.ENUM) {
            const valueStr = (0, printer_ts_1.printForError)(valueNode);
            throw new GraphQLError_ts_1.GraphQLError(`Enum "${this.name}" cannot represent non-enum value: ${valueStr}.` +
                (hideSuggestions ? '' : didYouMeanEnumValue(this, valueStr)), { nodes: valueNode });
        }
        const enumValue = this.getValue(valueNode.value);
        if (enumValue == null) {
            const valueStr = (0, printer_ts_1.printForError)(valueNode);
            throw new GraphQLError_ts_1.GraphQLError(`Value "${valueStr}" does not exist in "${this.name}" enum.` +
                (hideSuggestions ? '' : didYouMeanEnumValue(this, valueStr)), { nodes: valueNode });
        }
        return enumValue.value;
    }
    valueToLiteral(value) {
        if (typeof value === 'string' && this.getValue(value)) {
            return { kind: kinds_ts_1.Kind.ENUM, value };
        }
    }
    toConfig() {
        return {
            name: this.name,
            description: this.description,
            values: (0, keyValMap_ts_1.keyValMap)(this.getValues(), (value) => value.name, (value) => value.toConfig()),
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
exports.GraphQLEnumType = GraphQLEnumType;
function defineEnumValues(parentEnum, values) {
    const valueMap = resolveObjMapThunk(values);
    return Object.entries(valueMap).map(([valueName, valueConfig]) => new GraphQLEnumValue(parentEnum, valueName, valueConfig));
}
function didYouMeanEnumValue(enumType, unknownValueStr) {
    const allNames = enumType.getValues().map((value) => value.name);
    const suggestedValues = (0, suggestionList_ts_1.suggestionList)(unknownValueStr, allNames);
    return (0, didYouMean_ts_1.didYouMean)('the enum value', suggestedValues);
}
class GraphQLEnumValue {
    constructor(parentEnum, name, config) {
        this.__kind = enumValueSymbol;
        this.parentEnum = parentEnum;
        this.name = (0, assertName_ts_1.assertEnumValueName)(name);
        this.description = config.description;
        this.value = config.value !== undefined ? config.value : name;
        this.deprecationReason = config.deprecationReason;
        this.extensions = (0, toObjMap_ts_1.toObjMapWithSymbols)(config.extensions);
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
exports.GraphQLEnumValue = GraphQLEnumValue;
class GraphQLInputObjectType {
    constructor(config) {
        this.__kind = inputObjectSymbol;
        this.name = (0, assertName_ts_1.assertName)(config.name);
        this.description = config.description;
        this.extensions = (0, toObjMap_ts_1.toObjMapWithSymbols)(config.extensions);
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
            fields: (0, mapValue_ts_1.mapValue)(this.getFields(), (field) => field.toConfig()),
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
exports.GraphQLInputObjectType = GraphQLInputObjectType;
function defineInputFieldMap(parentType, fields) {
    const fieldMap = resolveObjMapThunk(fields);
    return (0, mapValue_ts_1.mapValue)(fieldMap, (fieldConfig, fieldName) => new GraphQLInputField(parentType, fieldName, fieldConfig));
}
class GraphQLInputField {
    constructor(parentType, name, config) {
        if (!(!('resolve' in config)))
            (0, devAssert_ts_1.devAssert)(false, `${parentType}.${name} field has a resolve property, but Input Types cannot define resolvers.`);
        this.__kind = inputFieldSymbol;
        this.parentType = parentType;
        this.name = (0, assertName_ts_1.assertName)(name);
        this.description = config.description;
        this.type = config.type;
        this.defaultValue = config.defaultValue;
        this.default = config.default;
        this._memoizedCoercedDefaultValue = undefined;
        this.deprecationReason = config.deprecationReason;
        this.extensions = (0, toObjMap_ts_1.toObjMapWithSymbols)(config.extensions);
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
exports.GraphQLInputField = GraphQLInputField;
function isRequiredInputField(field) {
    return (isNonNullType(field.type) &&
        field.defaultValue === undefined &&
        field.default === undefined);
}
//# sourceMappingURL=definition.js.map