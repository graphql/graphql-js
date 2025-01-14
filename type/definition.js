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
function assertType(type) {
    if (!isType(type)) {
        throw new Error(`Expected ${(0, inspect_js_1.inspect)(type)} to be a GraphQL type.`);
    }
    return type;
}
/**
 * There are predicates for each GraphQL schema element.
 */
function isScalarType(type) {
    return (0, instanceOf_js_1.instanceOf)(type, GraphQLScalarType);
}
function assertScalarType(type) {
    if (!isScalarType(type)) {
        throw new Error(`Expected ${(0, inspect_js_1.inspect)(type)} to be a GraphQL Scalar type.`);
    }
    return type;
}
function isObjectType(type) {
    return (0, instanceOf_js_1.instanceOf)(type, GraphQLObjectType);
}
function assertObjectType(type) {
    if (!isObjectType(type)) {
        throw new Error(`Expected ${(0, inspect_js_1.inspect)(type)} to be a GraphQL Object type.`);
    }
    return type;
}
function isField(field) {
    return (0, instanceOf_js_1.instanceOf)(field, GraphQLField);
}
function assertField(field) {
    if (!isField(field)) {
        throw new Error(`Expected ${(0, inspect_js_1.inspect)(field)} to be a GraphQL field.`);
    }
    return field;
}
function isArgument(arg) {
    return (0, instanceOf_js_1.instanceOf)(arg, GraphQLArgument);
}
function assertArgument(arg) {
    if (!isArgument(arg)) {
        throw new Error(`Expected ${(0, inspect_js_1.inspect)(arg)} to be a GraphQL argument.`);
    }
    return arg;
}
function isInterfaceType(type) {
    return (0, instanceOf_js_1.instanceOf)(type, GraphQLInterfaceType);
}
function assertInterfaceType(type) {
    if (!isInterfaceType(type)) {
        throw new Error(`Expected ${(0, inspect_js_1.inspect)(type)} to be a GraphQL Interface type.`);
    }
    return type;
}
function isUnionType(type) {
    return (0, instanceOf_js_1.instanceOf)(type, GraphQLUnionType);
}
function assertUnionType(type) {
    if (!isUnionType(type)) {
        throw new Error(`Expected ${(0, inspect_js_1.inspect)(type)} to be a GraphQL Union type.`);
    }
    return type;
}
function isEnumType(type) {
    return (0, instanceOf_js_1.instanceOf)(type, GraphQLEnumType);
}
function assertEnumType(type) {
    if (!isEnumType(type)) {
        throw new Error(`Expected ${(0, inspect_js_1.inspect)(type)} to be a GraphQL Enum type.`);
    }
    return type;
}
function isEnumValue(value) {
    return (0, instanceOf_js_1.instanceOf)(value, GraphQLEnumValue);
}
function assertEnumValue(value) {
    if (!isEnumValue(value)) {
        throw new Error(`Expected ${(0, inspect_js_1.inspect)(value)} to be a GraphQL Enum value.`);
    }
    return value;
}
function isInputObjectType(type) {
    return (0, instanceOf_js_1.instanceOf)(type, GraphQLInputObjectType);
}
function assertInputObjectType(type) {
    if (!isInputObjectType(type)) {
        throw new Error(`Expected ${(0, inspect_js_1.inspect)(type)} to be a GraphQL Input Object type.`);
    }
    return type;
}
function isInputField(field) {
    return (0, instanceOf_js_1.instanceOf)(field, GraphQLInputField);
}
function assertInputField(field) {
    if (!isInputField(field)) {
        throw new Error(`Expected ${(0, inspect_js_1.inspect)(field)} to be a GraphQL input field.`);
    }
    return field;
}
function isListType(type) {
    return (0, instanceOf_js_1.instanceOf)(type, GraphQLList);
}
function assertListType(type) {
    if (!isListType(type)) {
        throw new Error(`Expected ${(0, inspect_js_1.inspect)(type)} to be a GraphQL List type.`);
    }
    return type;
}
function isNonNullType(type) {
    return (0, instanceOf_js_1.instanceOf)(type, GraphQLNonNull);
}
function assertNonNullType(type) {
    if (!isNonNullType(type)) {
        throw new Error(`Expected ${(0, inspect_js_1.inspect)(type)} to be a GraphQL Non-Null type.`);
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
        throw new Error(`Expected ${(0, inspect_js_1.inspect)(type)} to be a GraphQL input type.`);
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
        throw new Error(`Expected ${(0, inspect_js_1.inspect)(type)} to be a GraphQL output type.`);
    }
    return type;
}
function isLeafType(type) {
    return isScalarType(type) || isEnumType(type);
}
function assertLeafType(type) {
    if (!isLeafType(type)) {
        throw new Error(`Expected ${(0, inspect_js_1.inspect)(type)} to be a GraphQL leaf type.`);
    }
    return type;
}
function isCompositeType(type) {
    return isObjectType(type) || isInterfaceType(type) || isUnionType(type);
}
function assertCompositeType(type) {
    if (!isCompositeType(type)) {
        throw new Error(`Expected ${(0, inspect_js_1.inspect)(type)} to be a GraphQL composite type.`);
    }
    return type;
}
function isAbstractType(type) {
    return isInterfaceType(type) || isUnionType(type);
}
function assertAbstractType(type) {
    if (!isAbstractType(type)) {
        throw new Error(`Expected ${(0, inspect_js_1.inspect)(type)} to be a GraphQL abstract type.`);
    }
    return type;
}
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
function assertWrappingType(type) {
    if (!isWrappingType(type)) {
        throw new Error(`Expected ${(0, inspect_js_1.inspect)(type)} to be a GraphQL wrapping type.`);
    }
    return type;
}
function isNullableType(type) {
    return isType(type) && !isNonNullType(type);
}
function assertNullableType(type) {
    if (!isNullableType(type)) {
        throw new Error(`Expected ${(0, inspect_js_1.inspect)(type)} to be a GraphQL nullable type.`);
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
        throw new Error(`Expected ${(0, inspect_js_1.inspect)(type)} to be a GraphQL named type.`);
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
/**
 * Scalar Type Definition
 *
 * The leaf values of any request and input values to arguments are
 * Scalars (or Enums) and are defined with a name and a series of functions
 * used to parse input from ast or variables and to ensure validity.
 *
 * If a type's coerceOutputValue function returns `null` or does not return a
 * value (i.e. it returns `undefined`) then an error will be raised and a
 * `null` value will be returned in the response. It is always better to
 * validate.
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
 *   coerceOutputValue(value) {
 *     return ensureOdd(value);
 *   },
 *   coerceInputValue(value) {
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
 *  - coerceOutputValue(value): Implements "Result Coercion". Given an internal value,
 *    produces an external value valid for this type. Returns undefined or
 *    throws an error to indicate invalid values.
 *
 *  - coerceInputValue(value): Implements "Input Coercion" for values. Given an
 *    external value (for example, variable values), produces an internal value
 *    valid for this type. Returns undefined or throws an error to indicate
 *    invalid values.
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
 *  Deprecated, to be removed in v18:
 *
 *  - serialize(value): Implements "Result Coercion". Renamed to
 *    `coerceOutputValue()`.
 *
 *  - parseValue(value): Implements "Input Coercion" for values. Renamed to
 *    `coerceInputValue()`.
 *
 *  - parseLiteral(ast): Implements "Input Coercion" for literals including
 *    non-specified replacement of variables embedded within complex scalars.
 *    Replaced by the combination of the `replaceVariables()` utility and the
 *    `coerceInputLiteral()` method.
 *
 */
class GraphQLScalarType {
    constructor(config) {
        this.name = (0, assertName_js_1.assertName)(config.name);
        this.description = config.description;
        this.specifiedByURL = config.specifiedByURL;
        this.serialize =
            config.serialize ??
                config.coerceOutputValue ??
                identityFunc_js_1.identityFunc;
        this.parseValue =
            config.parseValue ??
                config.coerceInputValue ??
                identityFunc_js_1.identityFunc;
        this.parseLiteral =
            config.parseLiteral ??
                ((node, variables) => this.coerceInputValue((0, valueFromASTUntyped_js_1.valueFromASTUntyped)(node, variables)));
        this.coerceOutputValue = config.coerceOutputValue ?? this.serialize;
        this.coerceInputValue = config.coerceInputValue ?? this.parseValue;
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
            (typeof config.coerceInputValue === 'function' &&
                typeof config.coerceInputLiteral === 'function') || (0, devAssert_js_1.devAssert)(false, `${this.name} must provide both "coerceInputValue" and "coerceInputLiteral" functions.`);
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
            fields: (0, mapValue_js_1.mapValue)(this.getFields(), (field) => field.toConfig()),
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
    return (0, mapValue_js_1.mapValue)(fieldMap, (fieldConfig, fieldName) => new GraphQLField(parentType, fieldName, fieldConfig));
}
class GraphQLField {
    constructor(parentType, name, config) {
        this.parentType = parentType;
        this.name = (0, assertName_js_1.assertName)(name);
        this.description = config.description;
        this.type = config.type;
        const argsConfig = config.args;
        this.args = argsConfig
            ? Object.entries(argsConfig).map(([argName, argConfig]) => new GraphQLArgument(this, argName, argConfig))
            : [];
        this.resolve = config.resolve;
        this.subscribe = config.subscribe;
        this.deprecationReason = config.deprecationReason;
        this.extensions = (0, toObjMap_js_1.toObjMapWithSymbols)(config.extensions);
        this.astNode = config.astNode;
    }
    get [Symbol.toStringTag]() {
        return 'GraphQLField';
    }
    toConfig() {
        return {
            description: this.description,
            type: this.type,
            args: (0, keyValMap_js_1.keyValMap)(this.args, (arg) => arg.name, (arg) => arg.toConfig()),
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
        this.parent = parent;
        this.name = (0, assertName_js_1.assertName)(name);
        this.description = config.description;
        this.type = config.type;
        this.defaultValue = config.defaultValue;
        this.default = config.default;
        this.deprecationReason = config.deprecationReason;
        this.extensions = (0, toObjMap_js_1.toObjMapWithSymbols)(config.extensions);
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
            fields: (0, mapValue_js_1.mapValue)(this.getFields(), (field) => field.toConfig()),
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
/**
 * Enum Type Definition
 *
 * Some leaf values of requests and input values are Enums. GraphQL coerces
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
                : Object.entries(config.values).map(([valueName, valueConfig]) => new GraphQLEnumValue(this, valueName, valueConfig));
        this._valueLookup = null;
        this._nameLookup = null;
    }
    get [Symbol.toStringTag]() {
        return 'GraphQLEnumType';
    }
    getValues() {
        if (typeof this._values === 'function') {
            this._values = Object.entries(this._values()).map(([valueName, valueConfig]) => new GraphQLEnumValue(this, valueName, valueConfig));
        }
        return this._values;
    }
    getValue(name) {
        if (this._nameLookup === null) {
            this._nameLookup = (0, keyMap_js_1.keyMap)(this.getValues(), (value) => value.name);
        }
        return this._nameLookup[name];
    }
    /** @deprecated use `coerceOutputValue()` instead, `serialize()` will be removed in v18 */
    serialize(outputValue /* T */) {
        return this.coerceOutputValue(outputValue);
    }
    coerceOutputValue(outputValue /* T */) {
        if (this._valueLookup === null) {
            this._valueLookup = new Map(this.getValues().map((enumValue) => [enumValue.value, enumValue]));
        }
        const enumValue = this._valueLookup.get(outputValue);
        if (enumValue === undefined) {
            throw new GraphQLError_js_1.GraphQLError(`Enum "${this.name}" cannot represent value: ${(0, inspect_js_1.inspect)(outputValue)}`);
        }
        return enumValue.name;
    }
    /** @deprecated use `coerceInputValue()` instead, `parseValue()` will be removed in v18 */
    parseValue(inputValue, hideSuggestions) {
        return this.coerceInputValue(inputValue, hideSuggestions);
    }
    coerceInputValue(inputValue, hideSuggestions) {
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
    /** @deprecated use `coerceInputLiteral()` instead, `parseLiteral()` will be removed in v18 */
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
        return {
            name: this.name,
            description: this.description,
            values: (0, keyValMap_js_1.keyValMap)(this.getValues(), (value) => value.name, (value) => value.toConfig()),
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
class GraphQLEnumValue {
    constructor(parentEnum, name, config) {
        this.parentEnum = parentEnum;
        this.name = (0, assertName_js_1.assertEnumValueName)(name);
        this.description = config.description;
        this.value = config.value !== undefined ? config.value : name;
        this.deprecationReason = config.deprecationReason;
        this.extensions = (0, toObjMap_js_1.toObjMapWithSymbols)(config.extensions);
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
            fields: (0, mapValue_js_1.mapValue)(this.getFields(), (field) => field.toConfig()),
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
    return (0, mapValue_js_1.mapValue)(fieldMap, (fieldConfig, fieldName) => new GraphQLInputField(parentType, fieldName, fieldConfig));
}
class GraphQLInputField {
    constructor(parentType, name, config) {
        (!('resolve' in config)) || (0, devAssert_js_1.devAssert)(false, `${parentType}.${name} field has a resolve property, but Input Types cannot define resolvers.`);
        this.parentType = parentType;
        this.name = (0, assertName_js_1.assertName)(name);
        this.description = config.description;
        this.type = config.type;
        this.defaultValue = config.defaultValue;
        this.default = config.default;
        this.deprecationReason = config.deprecationReason;
        this.extensions = (0, toObjMap_js_1.toObjMapWithSymbols)(config.extensions);
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