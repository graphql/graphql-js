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
import { print } from "../language/printer.mjs";
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
/**
 * There are predicates for each GraphQL schema element.
 */
export function isScalarType(type) {
    return instanceOf(type, GraphQLScalarType);
}
export function assertScalarType(type) {
    if (!isScalarType(type)) {
        throw new Error(`Expected ${inspect(type)} to be a GraphQL Scalar type.`);
    }
    return type;
}
export function isObjectType(type) {
    return instanceOf(type, GraphQLObjectType);
}
export function assertObjectType(type) {
    if (!isObjectType(type)) {
        throw new Error(`Expected ${inspect(type)} to be a GraphQL Object type.`);
    }
    return type;
}
export function isField(field) {
    return instanceOf(field, GraphQLField);
}
export function assertField(field) {
    if (!isField(field)) {
        throw new Error(`Expected ${inspect(field)} to be a GraphQL field.`);
    }
    return field;
}
export function isArgument(arg) {
    return instanceOf(arg, GraphQLArgument);
}
export function assertArgument(arg) {
    if (!isArgument(arg)) {
        throw new Error(`Expected ${inspect(arg)} to be a GraphQL argument.`);
    }
    return arg;
}
export function isInterfaceType(type) {
    return instanceOf(type, GraphQLInterfaceType);
}
export function assertInterfaceType(type) {
    if (!isInterfaceType(type)) {
        throw new Error(`Expected ${inspect(type)} to be a GraphQL Interface type.`);
    }
    return type;
}
export function isUnionType(type) {
    return instanceOf(type, GraphQLUnionType);
}
export function assertUnionType(type) {
    if (!isUnionType(type)) {
        throw new Error(`Expected ${inspect(type)} to be a GraphQL Union type.`);
    }
    return type;
}
export function isEnumType(type) {
    return instanceOf(type, GraphQLEnumType);
}
export function assertEnumType(type) {
    if (!isEnumType(type)) {
        throw new Error(`Expected ${inspect(type)} to be a GraphQL Enum type.`);
    }
    return type;
}
export function isEnumValue(value) {
    return instanceOf(value, GraphQLEnumValue);
}
export function assertEnumValue(value) {
    if (!isEnumValue(value)) {
        throw new Error(`Expected ${inspect(value)} to be a GraphQL Enum value.`);
    }
    return value;
}
export function isInputObjectType(type) {
    return instanceOf(type, GraphQLInputObjectType);
}
export function assertInputObjectType(type) {
    if (!isInputObjectType(type)) {
        throw new Error(`Expected ${inspect(type)} to be a GraphQL Input Object type.`);
    }
    return type;
}
export function isInputField(field) {
    return instanceOf(field, GraphQLInputField);
}
export function assertInputField(field) {
    if (!isInputField(field)) {
        throw new Error(`Expected ${inspect(field)} to be a GraphQL input field.`);
    }
    return field;
}
export function isListType(type) {
    return instanceOf(type, GraphQLList);
}
export function assertListType(type) {
    if (!isListType(type)) {
        throw new Error(`Expected ${inspect(type)} to be a GraphQL List type.`);
    }
    return type;
}
export function isNonNullType(type) {
    return instanceOf(type, GraphQLNonNull);
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
export class GraphQLList {
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
export class GraphQLNonNull {
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
export class GraphQLScalarType {
    constructor(config) {
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
            (typeof config.parseValue === 'function' &&
                typeof config.parseLiteral === 'function') || devAssert(false, `${this.name} must provide both "parseValue" and "parseLiteral" functions.`);
        }
        if (config.coerceInputLiteral) {
            (typeof config.coerceInputValue === 'function' &&
                typeof config.coerceInputLiteral === 'function') || devAssert(false, `${this.name} must provide both "coerceInputValue" and "coerceInputLiteral" functions.`);
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
export class GraphQLObjectType {
    constructor(config) {
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
        this.parent = parent;
        this.name = assertName(name);
        this.description = config.description;
        this.type = config.type;
        this.defaultValue = defineDefaultValue(name, config);
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
            defaultValue: this.defaultValue?.value,
            defaultValueLiteral: this.defaultValue?.literal,
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
    return isNonNullType(arg.type) && arg.defaultValue === undefined;
}
export function defineDefaultValue(argName, config) {
    if (config.defaultValue === undefined && !config.defaultValueLiteral) {
        return;
    }
    (!(config.defaultValue !== undefined && config.defaultValueLiteral)) || devAssert(false, `Argument "${argName}" has both a defaultValue and a defaultValueLiteral property, but only one must be provided.`);
    return config.defaultValueLiteral
        ? { literal: config.defaultValueLiteral }
        : { value: config.defaultValue };
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
export class GraphQLInterfaceType {
    constructor(config) {
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
export class GraphQLUnionType {
    constructor(config) {
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
export class GraphQLEnumType /* <T> */ {
    constructor(config) {
        this.name = assertName(config.name);
        this.description = config.description;
        this.extensions = toObjMapWithSymbols(config.extensions);
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
            this._nameLookup = keyMap(this.getValues(), (value) => value.name);
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
            throw new GraphQLError(`Enum "${this.name}" cannot represent value: ${inspect(outputValue)}`);
        }
        return enumValue.name;
    }
    /** @deprecated use `coerceInputValue()` instead, `parseValue()` will be removed in v18 */
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
    /** @deprecated use `coerceInputLiteral()` instead, `parseLiteral()` will be removed in v18 */
    parseLiteral(valueNode, _variables, hideSuggestions) {
        // Note: variables will be resolved to a value before calling this function.
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
function didYouMeanEnumValue(enumType, unknownValueStr) {
    const allNames = enumType.getValues().map((value) => value.name);
    const suggestedValues = suggestionList(unknownValueStr, allNames);
    return didYouMean('the enum value', suggestedValues);
}
export class GraphQLEnumValue {
    constructor(parentEnum, name, config) {
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
export class GraphQLInputObjectType {
    constructor(config) {
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
        (!('resolve' in config)) || devAssert(false, `${parentType}.${name} field has a resolve property, but Input Types cannot define resolvers.`);
        this.parentType = parentType;
        this.name = assertName(name);
        this.description = config.description;
        this.type = config.type;
        this.defaultValue = defineDefaultValue(name, config);
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
            defaultValue: this.defaultValue?.value,
            defaultValueLiteral: this.defaultValue?.literal,
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
    return isNonNullType(field.type) && field.defaultValue === undefined;
}
//# sourceMappingURL=definition.js.map