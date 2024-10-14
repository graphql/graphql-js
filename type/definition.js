"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GraphQLInputObjectType = exports.GraphQLEnumType = exports.GraphQLUnionType = exports.GraphQLInterfaceType = exports.defineDefaultValue = exports.isRequiredArgument = exports.argsToArgsConfig = exports.defineArguments = exports.GraphQLObjectType = exports.GraphQLScalarType = exports.resolveObjMapThunk = exports.resolveReadonlyArrayThunk = exports.getNamedType = exports.assertNamedType = exports.isNamedType = exports.getNullableType = exports.assertNullableType = exports.isNullableType = exports.assertWrappingType = exports.isWrappingType = exports.GraphQLNonNull = exports.GraphQLList = exports.assertAbstractType = exports.isAbstractType = exports.assertCompositeType = exports.isCompositeType = exports.assertLeafType = exports.isLeafType = exports.assertOutputType = exports.isOutputType = exports.assertInputType = exports.isInputType = exports.assertNonNullType = exports.isNonNullType = exports.assertListType = exports.isListType = exports.assertInputObjectType = exports.isInputObjectType = exports.assertEnumType = exports.isEnumType = exports.assertUnionType = exports.isUnionType = exports.assertInterfaceType = exports.isInterfaceType = exports.assertObjectType = exports.isObjectType = exports.assertScalarType = exports.isScalarType = exports.assertType = exports.isType = void 0;
exports.isRequiredInputField = void 0;
const devAssert_js_1 = require("../jsutils/devAssert.js");
const didYouMean_js_1 = require("../jsutils/didYouMean.js");
const identityFunc_js_1 = require("../jsutils/identityFunc.js");
const inspect_js_1 = require("../jsutils/inspect.js");
const instanceOf_js_1 = require("../jsutils/instanceOf.js");
const keyMap_js_1 = require("../jsutils/keyMap.js");
const keyValMap_js_1 = require("../jsutils/keyValMap.js");
const mapValue_js_1 = require("../jsutils/mapValue.js");
const suggestionList_js_1 = require("../jsutils/suggestionList.js");
const toObjMap_js_1 = require("../jsutils/toObjMap.js");
const GraphQLError_js_1 = require("../error/GraphQLError.js");
const kinds_js_1 = require("../language/kinds.js");
const printer_js_1 = require("../language/printer.js");
const valueFromASTUntyped_js_1 = require("../utilities/valueFromASTUntyped.js");
const assertName_js_1 = require("./assertName.js");
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
exports.isType = isType;
function assertType(type) {
    if (!isType(type)) {
        throw new Error(`Expected ${(0, inspect_js_1.inspect)(type)} to be a GraphQL type.`);
    }
    return type;
}
exports.assertType = assertType;
/**
 * There are predicates for each kind of GraphQL type.
 */
function isScalarType(type) {
    return (0, instanceOf_js_1.instanceOf)(type, GraphQLScalarType);
}
exports.isScalarType = isScalarType;
function assertScalarType(type) {
    if (!isScalarType(type)) {
        throw new Error(`Expected ${(0, inspect_js_1.inspect)(type)} to be a GraphQL Scalar type.`);
    }
    return type;
}
exports.assertScalarType = assertScalarType;
function isObjectType(type) {
    return (0, instanceOf_js_1.instanceOf)(type, GraphQLObjectType);
}
exports.isObjectType = isObjectType;
function assertObjectType(type) {
    if (!isObjectType(type)) {
        throw new Error(`Expected ${(0, inspect_js_1.inspect)(type)} to be a GraphQL Object type.`);
    }
    return type;
}
exports.assertObjectType = assertObjectType;
function isInterfaceType(type) {
    return (0, instanceOf_js_1.instanceOf)(type, GraphQLInterfaceType);
}
exports.isInterfaceType = isInterfaceType;
function assertInterfaceType(type) {
    if (!isInterfaceType(type)) {
        throw new Error(`Expected ${(0, inspect_js_1.inspect)(type)} to be a GraphQL Interface type.`);
    }
    return type;
}
exports.assertInterfaceType = assertInterfaceType;
function isUnionType(type) {
    return (0, instanceOf_js_1.instanceOf)(type, GraphQLUnionType);
}
exports.isUnionType = isUnionType;
function assertUnionType(type) {
    if (!isUnionType(type)) {
        throw new Error(`Expected ${(0, inspect_js_1.inspect)(type)} to be a GraphQL Union type.`);
    }
    return type;
}
exports.assertUnionType = assertUnionType;
function isEnumType(type) {
    return (0, instanceOf_js_1.instanceOf)(type, GraphQLEnumType);
}
exports.isEnumType = isEnumType;
function assertEnumType(type) {
    if (!isEnumType(type)) {
        throw new Error(`Expected ${(0, inspect_js_1.inspect)(type)} to be a GraphQL Enum type.`);
    }
    return type;
}
exports.assertEnumType = assertEnumType;
function isInputObjectType(type) {
    return (0, instanceOf_js_1.instanceOf)(type, GraphQLInputObjectType);
}
exports.isInputObjectType = isInputObjectType;
function assertInputObjectType(type) {
    if (!isInputObjectType(type)) {
        throw new Error(`Expected ${(0, inspect_js_1.inspect)(type)} to be a GraphQL Input Object type.`);
    }
    return type;
}
exports.assertInputObjectType = assertInputObjectType;
function isListType(type) {
    return (0, instanceOf_js_1.instanceOf)(type, GraphQLList);
}
exports.isListType = isListType;
function assertListType(type) {
    if (!isListType(type)) {
        throw new Error(`Expected ${(0, inspect_js_1.inspect)(type)} to be a GraphQL List type.`);
    }
    return type;
}
exports.assertListType = assertListType;
function isNonNullType(type) {
    return (0, instanceOf_js_1.instanceOf)(type, GraphQLNonNull);
}
exports.isNonNullType = isNonNullType;
function assertNonNullType(type) {
    if (!isNonNullType(type)) {
        throw new Error(`Expected ${(0, inspect_js_1.inspect)(type)} to be a GraphQL Non-Null type.`);
    }
    return type;
}
exports.assertNonNullType = assertNonNullType;
function isInputType(type) {
    return (isScalarType(type) ||
        isEnumType(type) ||
        isInputObjectType(type) ||
        (isWrappingType(type) && isInputType(type.ofType)));
}
exports.isInputType = isInputType;
function assertInputType(type) {
    if (!isInputType(type)) {
        throw new Error(`Expected ${(0, inspect_js_1.inspect)(type)} to be a GraphQL input type.`);
    }
    return type;
}
exports.assertInputType = assertInputType;
function isOutputType(type) {
    return (isScalarType(type) ||
        isObjectType(type) ||
        isInterfaceType(type) ||
        isUnionType(type) ||
        isEnumType(type) ||
        (isWrappingType(type) && isOutputType(type.ofType)));
}
exports.isOutputType = isOutputType;
function assertOutputType(type) {
    if (!isOutputType(type)) {
        throw new Error(`Expected ${(0, inspect_js_1.inspect)(type)} to be a GraphQL output type.`);
    }
    return type;
}
exports.assertOutputType = assertOutputType;
function isLeafType(type) {
    return isScalarType(type) || isEnumType(type);
}
exports.isLeafType = isLeafType;
function assertLeafType(type) {
    if (!isLeafType(type)) {
        throw new Error(`Expected ${(0, inspect_js_1.inspect)(type)} to be a GraphQL leaf type.`);
    }
    return type;
}
exports.assertLeafType = assertLeafType;
function isCompositeType(type) {
    return isObjectType(type) || isInterfaceType(type) || isUnionType(type);
}
exports.isCompositeType = isCompositeType;
function assertCompositeType(type) {
    if (!isCompositeType(type)) {
        throw new Error(`Expected ${(0, inspect_js_1.inspect)(type)} to be a GraphQL composite type.`);
    }
    return type;
}
exports.assertCompositeType = assertCompositeType;
function isAbstractType(type) {
    return isInterfaceType(type) || isUnionType(type);
}
exports.isAbstractType = isAbstractType;
function assertAbstractType(type) {
    if (!isAbstractType(type)) {
        throw new Error(`Expected ${(0, inspect_js_1.inspect)(type)} to be a GraphQL abstract type.`);
    }
    return type;
}
exports.assertAbstractType = assertAbstractType;
/**
 * List Type Wrapper
 *
 * A list is a wrapping type which points to another type.
 * Lists are often created within the context of defining the fields of
 * an object type.
 *
 * Example:
 *
 * ```ts
 * const PersonType = new GraphQLObjectType({
 *   name: 'Person',
 *   fields: () => ({
 *     parents: { type: new GraphQLList(PersonType) },
 *     children: { type: new GraphQLList(PersonType) },
 *   })
 * })
 * ```
 */
class GraphQLList {
    constructor(ofType) {
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
/**
 * Non-Null Type Wrapper
 *
 * A non-null is a wrapping type which points to another type.
 * Non-null types enforce that their values are never null and can ensure
 * an error is raised if this ever occurs during a request. It is useful for
 * fields which you can make a strong guarantee on non-nullability, for example
 * usually the id field of a database row will never be null.
 *
 * Example:
 *
 * ```ts
 * const RowType = new GraphQLObjectType({
 *   name: 'Row',
 *   fields: () => ({
 *     id: { type: new GraphQLNonNull(GraphQLString) },
 *   })
 * })
 * ```
 * Note: the enforcement of non-nullability occurs within the executor.
 */
class GraphQLNonNull {
    constructor(ofType) {
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
exports.isWrappingType = isWrappingType;
function assertWrappingType(type) {
    if (!isWrappingType(type)) {
        throw new Error(`Expected ${(0, inspect_js_1.inspect)(type)} to be a GraphQL wrapping type.`);
    }
    return type;
}
exports.assertWrappingType = assertWrappingType;
function isNullableType(type) {
    return isType(type) && !isNonNullType(type);
}
exports.isNullableType = isNullableType;
function assertNullableType(type) {
    if (!isNullableType(type)) {
        throw new Error(`Expected ${(0, inspect_js_1.inspect)(type)} to be a GraphQL nullable type.`);
    }
    return type;
}
exports.assertNullableType = assertNullableType;
function getNullableType(type) {
    if (type) {
        return isNonNullType(type) ? type.ofType : type;
    }
}
exports.getNullableType = getNullableType;
function isNamedType(type) {
    return (isScalarType(type) ||
        isObjectType(type) ||
        isInterfaceType(type) ||
        isUnionType(type) ||
        isEnumType(type) ||
        isInputObjectType(type));
}
exports.isNamedType = isNamedType;
function assertNamedType(type) {
    if (!isNamedType(type)) {
        throw new Error(`Expected ${(0, inspect_js_1.inspect)(type)} to be a GraphQL named type.`);
    }
    return type;
}
exports.assertNamedType = assertNamedType;
function getNamedType(type) {
    if (type) {
        let unwrappedType = type;
        while (isWrappingType(unwrappedType)) {
            unwrappedType = unwrappedType.ofType;
        }
        return unwrappedType;
    }
}
exports.getNamedType = getNamedType;
function resolveReadonlyArrayThunk(thunk) {
    return typeof thunk === 'function' ? thunk() : thunk;
}
exports.resolveReadonlyArrayThunk = resolveReadonlyArrayThunk;
function resolveObjMapThunk(thunk) {
    return typeof thunk === 'function' ? thunk() : thunk;
}
exports.resolveObjMapThunk = resolveObjMapThunk;
/**
 * Scalar Type Definition
 *
 * The leaf values of any request and input values to arguments are
 * Scalars (or Enums) and are defined with a name and a series of functions
 * used to parse input from ast or variables and to ensure validity.
 *
 * If a type's serialize function returns `null` or does not return a value
 * (i.e. it returns `undefined`) then an error will be raised and a `null`
 * value will be returned in the response. It is always better to validate
 *
 * Example:
 *
 * ```ts
 * function ensureOdd(value) {
 *   if (!Number.isFinite(value)) {
 *     throw new Error(
 *       `Scalar "Odd" cannot represent "${value}" since it is not a finite number.`,
 *     );
 *   }
 *
 *   if (value % 2 === 0) {
 *     throw new Error(`Scalar "Odd" cannot represent "${value}" since it is even.`);
 *   }
 * }
 *
 * const OddType = new GraphQLScalarType({
 *   name: 'Odd',
 *   serialize(value) {
 *     return ensureOdd(value);
 *   },
 *   parseValue(value) {
 *     return ensureOdd(value);
 *   }
 *   valueToLiteral(value) {
 *    return parse(`${ensureOdd(value)`);
 *   }
 * });
 * ```
 *
 * Custom scalars behavior is defined via the following functions:
 *
 *  - serialize(value): Implements "Result Coercion". Given an internal value,
 *    produces an external value valid for this type. Returns undefined or
 *    throws an error to indicate invalid values.
 *
 *  - parseValue(value): Implements "Input Coercion" for values. Given an
 *    external value (for example, variable values), produces an internal value
 *    valid for this type. Returns undefined or throws an error to indicate
 *    invalid values.
 *
 *  - parseLiteral(ast): Implements "Input Coercion" for literals including
 *    non-specified replacement of variables embedded within complex scalars.
 *    This method will be removed in v18 favor of the combination of the
 *    `replaceVariables()` utility and the `coerceInputLiteral()` method.
 *
 *  - coerceInputLiteral(ast): Implements "Input Coercion" for constant literals.
 *    Given an GraphQL literal (AST) (for example, an argument value), produces
 *    an internal value valid for this type. Returns undefined or throws an
 *    error to indicate invalid values.
 *
 *  - valueToLiteral(value): Converts an external value to a GraphQL
 *    literal (AST). Returns undefined or throws an error to indicate
 *    invalid values.
 *
 */
class GraphQLScalarType {
    constructor(config) {
        const parseValue = config.parseValue ??
            identityFunc_js_1.identityFunc;
        this.name = (0, assertName_js_1.assertName)(config.name);
        this.description = config.description;
        this.specifiedByURL = config.specifiedByURL;
        this.serialize =
            config.serialize ?? identityFunc_js_1.identityFunc;
        this.parseValue = parseValue;
        this.parseLiteral =
            config.parseLiteral ??
                ((node, variables) => parseValue((0, valueFromASTUntyped_js_1.valueFromASTUntyped)(node, variables)));
        this.coerceInputLiteral = config.coerceInputLiteral;
        this.valueToLiteral = config.valueToLiteral;
        this.extensions = (0, toObjMap_js_1.toObjMapWithSymbols)(config.extensions);
        this.astNode = config.astNode;
        this.extensionASTNodes = config.extensionASTNodes ?? [];
        if (config.parseLiteral) {
            (typeof config.parseValue === 'function' &&
                typeof config.parseLiteral === 'function') || (0, devAssert_js_1.devAssert)(false, `${this.name} must provide both "parseValue" and "parseLiteral" functions.`);
        }
        if (config.coerceInputLiteral) {
            (typeof config.parseValue === 'function' &&
                typeof config.coerceInputLiteral === 'function') || (0, devAssert_js_1.devAssert)(false, `${this.name} must provide both "parseValue" and "coerceInputLiteral" functions.`);
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
/**
 * Object Type Definition
 *
 * Almost all of the GraphQL types you define will be object types. Object types
 * have a name, but most importantly describe their fields.
 *
 * Example:
 *
 * ```ts
 * const AddressType = new GraphQLObjectType({
 *   name: 'Address',
 *   fields: {
 *     street: { type: GraphQLString },
 *     number: { type: GraphQLInt },
 *     formatted: {
 *       type: GraphQLString,
 *       resolve(obj) {
 *         return obj.number + ' ' + obj.street
 *       }
 *     }
 *   }
 * });
 * ```
 *
 * When two types need to refer to each other, or a type needs to refer to
 * itself in a field, you can use a function expression (aka a closure or a
 * thunk) to supply the fields lazily.
 *
 * Example:
 *
 * ```ts
 * const PersonType = new GraphQLObjectType({
 *   name: 'Person',
 *   fields: () => ({
 *     name: { type: GraphQLString },
 *     bestFriend: { type: PersonType },
 *   })
 * });
 * ```
 */
class GraphQLObjectType {
    constructor(config) {
        this.name = (0, assertName_js_1.assertName)(config.name);
        this.description = config.description;
        this.isTypeOf = config.isTypeOf;
        this.extensions = (0, toObjMap_js_1.toObjMapWithSymbols)(config.extensions);
        this.astNode = config.astNode;
        this.extensionASTNodes = config.extensionASTNodes ?? [];
        this._fields = (defineFieldMap).bind(undefined, config.fields);
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
            fields: fieldsToFieldsConfig(this.getFields()),
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
function defineFieldMap(fields) {
    const fieldMap = resolveObjMapThunk(fields);
    return (0, mapValue_js_1.mapValue)(fieldMap, (fieldConfig, fieldName) => {
        const argsConfig = fieldConfig.args ?? {};
        return {
            name: (0, assertName_js_1.assertName)(fieldName),
            description: fieldConfig.description,
            type: fieldConfig.type,
            args: defineArguments(argsConfig),
            resolve: fieldConfig.resolve,
            subscribe: fieldConfig.subscribe,
            deprecationReason: fieldConfig.deprecationReason,
            extensions: (0, toObjMap_js_1.toObjMapWithSymbols)(fieldConfig.extensions),
            astNode: fieldConfig.astNode,
        };
    });
}
function defineArguments(args) {
    return Object.entries(args).map(([argName, argConfig]) => ({
        name: (0, assertName_js_1.assertName)(argName),
        description: argConfig.description,
        type: argConfig.type,
        defaultValue: defineDefaultValue(argName, argConfig),
        deprecationReason: argConfig.deprecationReason,
        extensions: (0, toObjMap_js_1.toObjMapWithSymbols)(argConfig.extensions),
        astNode: argConfig.astNode,
    }));
}
exports.defineArguments = defineArguments;
function fieldsToFieldsConfig(fields) {
    return (0, mapValue_js_1.mapValue)(fields, (field) => ({
        description: field.description,
        type: field.type,
        args: argsToArgsConfig(field.args),
        resolve: field.resolve,
        subscribe: field.subscribe,
        deprecationReason: field.deprecationReason,
        extensions: field.extensions,
        astNode: field.astNode,
    }));
}
/**
 * @internal
 */
function argsToArgsConfig(args) {
    return (0, keyValMap_js_1.keyValMap)(args, (arg) => arg.name, (arg) => ({
        description: arg.description,
        type: arg.type,
        defaultValue: arg.defaultValue?.value,
        defaultValueLiteral: arg.defaultValue?.literal,
        deprecationReason: arg.deprecationReason,
        extensions: arg.extensions,
        astNode: arg.astNode,
    }));
}
exports.argsToArgsConfig = argsToArgsConfig;
function isRequiredArgument(arg) {
    return isNonNullType(arg.type) && arg.defaultValue === undefined;
}
exports.isRequiredArgument = isRequiredArgument;
function defineDefaultValue(argName, config) {
    if (config.defaultValue === undefined && !config.defaultValueLiteral) {
        return;
    }
    (!(config.defaultValue !== undefined && config.defaultValueLiteral)) || (0, devAssert_js_1.devAssert)(false, `Argument "${argName}" has both a defaultValue and a defaultValueLiteral property, but only one must be provided.`);
    return config.defaultValueLiteral
        ? { literal: config.defaultValueLiteral }
        : { value: config.defaultValue };
}
exports.defineDefaultValue = defineDefaultValue;
/**
 * Interface Type Definition
 *
 * When a field can return one of a heterogeneous set of types, a Interface type
 * is used to describe what types are possible, what fields are in common across
 * all types, as well as a function to determine which type is actually used
 * when the field is resolved.
 *
 * Example:
 *
 * ```ts
 * const EntityType = new GraphQLInterfaceType({
 *   name: 'Entity',
 *   fields: {
 *     name: { type: GraphQLString }
 *   }
 * });
 * ```
 */
class GraphQLInterfaceType {
    constructor(config) {
        this.name = (0, assertName_js_1.assertName)(config.name);
        this.description = config.description;
        this.resolveType = config.resolveType;
        this.extensions = (0, toObjMap_js_1.toObjMapWithSymbols)(config.extensions);
        this.astNode = config.astNode;
        this.extensionASTNodes = config.extensionASTNodes ?? [];
        this._fields = (defineFieldMap).bind(undefined, config.fields);
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
            fields: fieldsToFieldsConfig(this.getFields()),
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
/**
 * Union Type Definition
 *
 * When a field can return one of a heterogeneous set of types, a Union type
 * is used to describe what types are possible as well as providing a function
 * to determine which type is actually used when the field is resolved.
 *
 * Example:
 *
 * ```ts
 * const PetType = new GraphQLUnionType({
 *   name: 'Pet',
 *   types: [ DogType, CatType ],
 *   resolveType(value) {
 *     if (value instanceof Dog) {
 *       return DogType;
 *     }
 *     if (value instanceof Cat) {
 *       return CatType;
 *     }
 *   }
 * });
 * ```
 */
class GraphQLUnionType {
    constructor(config) {
        this.name = (0, assertName_js_1.assertName)(config.name);
        this.description = config.description;
        this.resolveType = config.resolveType;
        this.extensions = (0, toObjMap_js_1.toObjMapWithSymbols)(config.extensions);
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
function enumValuesFromConfig(values) {
    return Object.entries(values).map(([valueName, valueConfig]) => ({
        name: (0, assertName_js_1.assertEnumValueName)(valueName),
        description: valueConfig.description,
        value: valueConfig.value !== undefined ? valueConfig.value : valueName,
        deprecationReason: valueConfig.deprecationReason,
        extensions: (0, toObjMap_js_1.toObjMapWithSymbols)(valueConfig.extensions),
        astNode: valueConfig.astNode,
    }));
}
/**
 * Enum Type Definition
 *
 * Some leaf values of requests and input values are Enums. GraphQL serializes
 * Enum values as strings, however internally Enums can be represented by any
 * kind of type, often integers.
 *
 * Example:
 *
 * ```ts
 * const RGBType = new GraphQLEnumType({
 *   name: 'RGB',
 *   values: {
 *     RED: { value: 0 },
 *     GREEN: { value: 1 },
 *     BLUE: { value: 2 }
 *   }
 * });
 * ```
 *
 * Note: If a value is not provided in a definition, the name of the enum value
 * will be used as its internal value.
 */
class GraphQLEnumType /* <T> */ {
    constructor(config) {
        this.name = (0, assertName_js_1.assertName)(config.name);
        this.description = config.description;
        this.extensions = (0, toObjMap_js_1.toObjMapWithSymbols)(config.extensions);
        this.astNode = config.astNode;
        this.extensionASTNodes = config.extensionASTNodes ?? [];
        this._values =
            typeof config.values === 'function'
                ? config.values
                : enumValuesFromConfig(config.values);
        this._valueLookup = null;
        this._nameLookup = null;
    }
    get [Symbol.toStringTag]() {
        return 'GraphQLEnumType';
    }
    getValues() {
        if (typeof this._values === 'function') {
            this._values = enumValuesFromConfig(this._values());
        }
        return this._values;
    }
    getValue(name) {
        if (this._nameLookup === null) {
            this._nameLookup = (0, keyMap_js_1.keyMap)(this.getValues(), (value) => value.name);
        }
        return this._nameLookup[name];
    }
    serialize(outputValue /* T */) {
        if (this._valueLookup === null) {
            this._valueLookup = new Map(this.getValues().map((enumValue) => [enumValue.value, enumValue]));
        }
        const enumValue = this._valueLookup.get(outputValue);
        if (enumValue === undefined) {
            throw new GraphQLError_js_1.GraphQLError(`Enum "${this.name}" cannot represent value: ${(0, inspect_js_1.inspect)(outputValue)}`);
        }
        return enumValue.name;
    }
    parseValue(inputValue, hideSuggestions) {
        if (typeof inputValue !== 'string') {
            const valueStr = (0, inspect_js_1.inspect)(inputValue);
            throw new GraphQLError_js_1.GraphQLError(`Enum "${this.name}" cannot represent non-string value: ${valueStr}.` +
                (hideSuggestions ? '' : didYouMeanEnumValue(this, valueStr)));
        }
        const enumValue = this.getValue(inputValue);
        if (enumValue == null) {
            throw new GraphQLError_js_1.GraphQLError(`Value "${inputValue}" does not exist in "${this.name}" enum.` +
                (hideSuggestions ? '' : didYouMeanEnumValue(this, inputValue)));
        }
        return enumValue.value;
    }
    /** @deprecated use `coerceInputLiteral()` instead, `parseLiteral()` will be deprecated in v18 */
    parseLiteral(valueNode, _variables, hideSuggestions) {
        // Note: variables will be resolved to a value before calling this function.
        return this.coerceInputLiteral(valueNode, hideSuggestions);
    }
    coerceInputLiteral(valueNode, hideSuggestions) {
        if (valueNode.kind !== kinds_js_1.Kind.ENUM) {
            const valueStr = (0, printer_js_1.print)(valueNode);
            throw new GraphQLError_js_1.GraphQLError(`Enum "${this.name}" cannot represent non-enum value: ${valueStr}.` +
                (hideSuggestions ? '' : didYouMeanEnumValue(this, valueStr)), { nodes: valueNode });
        }
        const enumValue = this.getValue(valueNode.value);
        if (enumValue == null) {
            const valueStr = (0, printer_js_1.print)(valueNode);
            throw new GraphQLError_js_1.GraphQLError(`Value "${valueStr}" does not exist in "${this.name}" enum.` +
                (hideSuggestions ? '' : didYouMeanEnumValue(this, valueStr)), { nodes: valueNode });
        }
        return enumValue.value;
    }
    valueToLiteral(value) {
        if (typeof value === 'string' && this.getValue(value)) {
            return { kind: kinds_js_1.Kind.ENUM, value };
        }
    }
    toConfig() {
        const values = (0, keyValMap_js_1.keyValMap)(this.getValues(), (value) => value.name, (value) => ({
            description: value.description,
            value: value.value,
            deprecationReason: value.deprecationReason,
            extensions: value.extensions,
            astNode: value.astNode,
        }));
        return {
            name: this.name,
            description: this.description,
            values,
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
function didYouMeanEnumValue(enumType, unknownValueStr) {
    const allNames = enumType.getValues().map((value) => value.name);
    const suggestedValues = (0, suggestionList_js_1.suggestionList)(unknownValueStr, allNames);
    return (0, didYouMean_js_1.didYouMean)('the enum value', suggestedValues);
}
/**
 * Input Object Type Definition
 *
 * An input object defines a structured collection of fields which may be
 * supplied to a field argument.
 *
 * Using `NonNull` will ensure that a value must be provided by the query
 *
 * Example:
 *
 * ```ts
 * const GeoPoint = new GraphQLInputObjectType({
 *   name: 'GeoPoint',
 *   fields: {
 *     lat: { type: new GraphQLNonNull(GraphQLFloat) },
 *     lon: { type: new GraphQLNonNull(GraphQLFloat) },
 *     alt: { type: GraphQLFloat, defaultValue: 0 },
 *   }
 * });
 * ```
 */
class GraphQLInputObjectType {
    constructor(config) {
        this.name = (0, assertName_js_1.assertName)(config.name);
        this.description = config.description;
        this.extensions = (0, toObjMap_js_1.toObjMapWithSymbols)(config.extensions);
        this.astNode = config.astNode;
        this.extensionASTNodes = config.extensionASTNodes ?? [];
        this.isOneOf = config.isOneOf ?? false;
        this._fields = defineInputFieldMap.bind(undefined, config.fields);
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
        const fields = (0, mapValue_js_1.mapValue)(this.getFields(), (field) => ({
            description: field.description,
            type: field.type,
            defaultValue: field.defaultValue?.value,
            defaultValueLiteral: field.defaultValue?.literal,
            deprecationReason: field.deprecationReason,
            extensions: field.extensions,
            astNode: field.astNode,
        }));
        return {
            name: this.name,
            description: this.description,
            fields,
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
function defineInputFieldMap(fields) {
    const fieldMap = resolveObjMapThunk(fields);
    return (0, mapValue_js_1.mapValue)(fieldMap, (fieldConfig, fieldName) => ({
        name: (0, assertName_js_1.assertName)(fieldName),
        description: fieldConfig.description,
        type: fieldConfig.type,
        defaultValue: defineDefaultValue(fieldName, fieldConfig),
        deprecationReason: fieldConfig.deprecationReason,
        extensions: (0, toObjMap_js_1.toObjMapWithSymbols)(fieldConfig.extensions),
        astNode: fieldConfig.astNode,
    }));
}
function isRequiredInputField(field) {
    return isNonNullType(field.type) && field.defaultValue === undefined;
}
exports.isRequiredInputField = isRequiredInputField;
//# sourceMappingURL=definition.js.map