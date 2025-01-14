"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.specifiedScalarTypes = exports.GraphQLID = exports.GraphQLBoolean = exports.GraphQLString = exports.GraphQLFloat = exports.GraphQLInt = exports.GRAPHQL_MIN_INT = exports.GRAPHQL_MAX_INT = void 0;
exports.isSpecifiedScalarType = isSpecifiedScalarType;
const inspect_js_1 = require("../jsutils/inspect.js");
const isObjectLike_js_1 = require("../jsutils/isObjectLike.js");
const GraphQLError_js_1 = require("../error/GraphQLError.js");
const kinds_js_1 = require("../language/kinds.js");
const printer_js_1 = require("../language/printer.js");
const valueToLiteral_js_1 = require("../utilities/valueToLiteral.js");
const definition_js_1 = require("./definition.js");
/**
 * Maximum possible Int value as per GraphQL Spec (32-bit signed integer).
 * n.b. This differs from JavaScript's numbers that are IEEE 754 doubles safe up-to 2^53 - 1
 * */
exports.GRAPHQL_MAX_INT = 2147483647;
/**
 * Minimum possible Int value as per GraphQL Spec (32-bit signed integer).
 * n.b. This differs from JavaScript's numbers that are IEEE 754 doubles safe starting at -(2^53 - 1)
 * */
exports.GRAPHQL_MIN_INT = -2147483648;
exports.GraphQLInt = new definition_js_1.GraphQLScalarType({
    name: 'Int',
    description: 'The `Int` scalar type represents non-fractional signed whole numeric values. Int can represent values between -(2^31) and 2^31 - 1.',
    coerceOutputValue(outputValue) {
        const coercedValue = coerceOutputValueObject(outputValue);
        if (typeof coercedValue === 'boolean') {
            return coercedValue ? 1 : 0;
        }
        let num = coercedValue;
        if (typeof coercedValue === 'string' && coercedValue !== '') {
            num = Number(coercedValue);
        }
        if (typeof num !== 'number' || !Number.isInteger(num)) {
            throw new GraphQLError_js_1.GraphQLError(`Int cannot represent non-integer value: ${(0, inspect_js_1.inspect)(coercedValue)}`);
        }
        if (num > exports.GRAPHQL_MAX_INT || num < exports.GRAPHQL_MIN_INT) {
            throw new GraphQLError_js_1.GraphQLError('Int cannot represent non 32-bit signed integer value: ' +
                (0, inspect_js_1.inspect)(coercedValue));
        }
        return num;
    },
    coerceInputValue(inputValue) {
        if (typeof inputValue !== 'number' || !Number.isInteger(inputValue)) {
            throw new GraphQLError_js_1.GraphQLError(`Int cannot represent non-integer value: ${(0, inspect_js_1.inspect)(inputValue)}`);
        }
        if (inputValue > exports.GRAPHQL_MAX_INT || inputValue < exports.GRAPHQL_MIN_INT) {
            throw new GraphQLError_js_1.GraphQLError(`Int cannot represent non 32-bit signed integer value: ${inputValue}`);
        }
        return inputValue;
    },
    coerceInputLiteral(valueNode) {
        if (valueNode.kind !== kinds_js_1.Kind.INT) {
            throw new GraphQLError_js_1.GraphQLError(`Int cannot represent non-integer value: ${(0, printer_js_1.print)(valueNode)}`, { nodes: valueNode });
        }
        const num = parseInt(valueNode.value, 10);
        if (num > exports.GRAPHQL_MAX_INT || num < exports.GRAPHQL_MIN_INT) {
            throw new GraphQLError_js_1.GraphQLError(`Int cannot represent non 32-bit signed integer value: ${valueNode.value}`, { nodes: valueNode });
        }
        return num;
    },
    valueToLiteral(value) {
        if (typeof value === 'number' &&
            Number.isInteger(value) &&
            value <= exports.GRAPHQL_MAX_INT &&
            value >= exports.GRAPHQL_MIN_INT) {
            return { kind: kinds_js_1.Kind.INT, value: String(value) };
        }
    },
});
exports.GraphQLFloat = new definition_js_1.GraphQLScalarType({
    name: 'Float',
    description: 'The `Float` scalar type represents signed double-precision fractional values as specified by [IEEE 754](https://en.wikipedia.org/wiki/IEEE_floating_point).',
    coerceOutputValue(outputValue) {
        const coercedValue = coerceOutputValueObject(outputValue);
        if (typeof coercedValue === 'boolean') {
            return coercedValue ? 1 : 0;
        }
        let num = coercedValue;
        if (typeof coercedValue === 'string' && coercedValue !== '') {
            num = Number(coercedValue);
        }
        if (typeof num !== 'number' || !Number.isFinite(num)) {
            throw new GraphQLError_js_1.GraphQLError(`Float cannot represent non numeric value: ${(0, inspect_js_1.inspect)(coercedValue)}`);
        }
        return num;
    },
    coerceInputValue(inputValue) {
        if (typeof inputValue !== 'number' || !Number.isFinite(inputValue)) {
            throw new GraphQLError_js_1.GraphQLError(`Float cannot represent non numeric value: ${(0, inspect_js_1.inspect)(inputValue)}`);
        }
        return inputValue;
    },
    coerceInputLiteral(valueNode) {
        if (valueNode.kind !== kinds_js_1.Kind.FLOAT && valueNode.kind !== kinds_js_1.Kind.INT) {
            throw new GraphQLError_js_1.GraphQLError(`Float cannot represent non numeric value: ${(0, printer_js_1.print)(valueNode)}`, { nodes: valueNode });
        }
        return parseFloat(valueNode.value);
    },
    valueToLiteral(value) {
        const literal = (0, valueToLiteral_js_1.defaultScalarValueToLiteral)(value);
        if (literal.kind === kinds_js_1.Kind.FLOAT || literal.kind === kinds_js_1.Kind.INT) {
            return literal;
        }
    },
});
exports.GraphQLString = new definition_js_1.GraphQLScalarType({
    name: 'String',
    description: 'The `String` scalar type represents textual data, represented as UTF-8 character sequences. The String type is most often used by GraphQL to represent free-form human-readable text.',
    coerceOutputValue(outputValue) {
        const coercedValue = coerceOutputValueObject(outputValue);
        // Coerces string, boolean and number values to a string, but do not
        // attempt to coerce object, function, symbol, or other types as strings.
        if (typeof coercedValue === 'string') {
            return coercedValue;
        }
        if (typeof coercedValue === 'boolean') {
            return coercedValue ? 'true' : 'false';
        }
        if (typeof coercedValue === 'number' && Number.isFinite(coercedValue)) {
            return coercedValue.toString();
        }
        throw new GraphQLError_js_1.GraphQLError(`String cannot represent value: ${(0, inspect_js_1.inspect)(outputValue)}`);
    },
    coerceInputValue(inputValue) {
        if (typeof inputValue !== 'string') {
            throw new GraphQLError_js_1.GraphQLError(`String cannot represent a non string value: ${(0, inspect_js_1.inspect)(inputValue)}`);
        }
        return inputValue;
    },
    coerceInputLiteral(valueNode) {
        if (valueNode.kind !== kinds_js_1.Kind.STRING) {
            throw new GraphQLError_js_1.GraphQLError(`String cannot represent a non string value: ${(0, printer_js_1.print)(valueNode)}`, { nodes: valueNode });
        }
        return valueNode.value;
    },
    valueToLiteral(value) {
        const literal = (0, valueToLiteral_js_1.defaultScalarValueToLiteral)(value);
        if (literal.kind === kinds_js_1.Kind.STRING) {
            return literal;
        }
    },
});
exports.GraphQLBoolean = new definition_js_1.GraphQLScalarType({
    name: 'Boolean',
    description: 'The `Boolean` scalar type represents `true` or `false`.',
    coerceOutputValue(outputValue) {
        const coercedValue = coerceOutputValueObject(outputValue);
        if (typeof coercedValue === 'boolean') {
            return coercedValue;
        }
        if (Number.isFinite(coercedValue)) {
            return coercedValue !== 0;
        }
        throw new GraphQLError_js_1.GraphQLError(`Boolean cannot represent a non boolean value: ${(0, inspect_js_1.inspect)(coercedValue)}`);
    },
    coerceInputValue(inputValue) {
        if (typeof inputValue !== 'boolean') {
            throw new GraphQLError_js_1.GraphQLError(`Boolean cannot represent a non boolean value: ${(0, inspect_js_1.inspect)(inputValue)}`);
        }
        return inputValue;
    },
    coerceInputLiteral(valueNode) {
        if (valueNode.kind !== kinds_js_1.Kind.BOOLEAN) {
            throw new GraphQLError_js_1.GraphQLError(`Boolean cannot represent a non boolean value: ${(0, printer_js_1.print)(valueNode)}`, { nodes: valueNode });
        }
        return valueNode.value;
    },
    valueToLiteral(value) {
        const literal = (0, valueToLiteral_js_1.defaultScalarValueToLiteral)(value);
        if (literal.kind === kinds_js_1.Kind.BOOLEAN) {
            return literal;
        }
    },
});
exports.GraphQLID = new definition_js_1.GraphQLScalarType({
    name: 'ID',
    description: 'The `ID` scalar type represents a unique identifier, often used to refetch an object or as key for a cache. The ID type appears in a JSON response as a String; however, it is not intended to be human-readable. When expected as an input type, any string (such as `"4"`) or integer (such as `4`) input value will be accepted as an ID.',
    coerceOutputValue(outputValue) {
        const coercedValue = coerceOutputValueObject(outputValue);
        if (typeof coercedValue === 'string') {
            return coercedValue;
        }
        if (Number.isInteger(coercedValue)) {
            return String(coercedValue);
        }
        throw new GraphQLError_js_1.GraphQLError(`ID cannot represent value: ${(0, inspect_js_1.inspect)(outputValue)}`);
    },
    coerceInputValue(inputValue) {
        if (typeof inputValue === 'string') {
            return inputValue;
        }
        if (typeof inputValue === 'number' && Number.isInteger(inputValue)) {
            return inputValue.toString();
        }
        throw new GraphQLError_js_1.GraphQLError(`ID cannot represent value: ${(0, inspect_js_1.inspect)(inputValue)}`);
    },
    coerceInputLiteral(valueNode) {
        if (valueNode.kind !== kinds_js_1.Kind.STRING && valueNode.kind !== kinds_js_1.Kind.INT) {
            throw new GraphQLError_js_1.GraphQLError('ID cannot represent a non-string and non-integer value: ' +
                (0, printer_js_1.print)(valueNode), { nodes: valueNode });
        }
        return valueNode.value;
    },
    valueToLiteral(value) {
        // ID types can use number values and Int literals.
        const stringValue = Number.isInteger(value) ? String(value) : value;
        if (typeof stringValue === 'string') {
            // Will parse as an IntValue.
            return /^-?(?:0|[1-9][0-9]*)$/.test(stringValue)
                ? { kind: kinds_js_1.Kind.INT, value: stringValue }
                : { kind: kinds_js_1.Kind.STRING, value: stringValue, block: false };
        }
    },
});
exports.specifiedScalarTypes = Object.freeze([
    exports.GraphQLString,
    exports.GraphQLInt,
    exports.GraphQLFloat,
    exports.GraphQLBoolean,
    exports.GraphQLID,
]);
function isSpecifiedScalarType(type) {
    return exports.specifiedScalarTypes.some(({ name }) => type.name === name);
}
// Support coercing objects with custom valueOf() or toJSON() functions -
// a common way to represent a complex value which can be represented as
// a string (ex: MongoDB id objects).
function coerceOutputValueObject(outputValue) {
    if ((0, isObjectLike_js_1.isObjectLike)(outputValue)) {
        if (typeof outputValue.valueOf === 'function') {
            const valueOfResult = outputValue.valueOf();
            if (!(0, isObjectLike_js_1.isObjectLike)(valueOfResult)) {
                return valueOfResult;
            }
        }
        if (typeof outputValue.toJSON === 'function') {
            return outputValue.toJSON();
        }
    }
    return outputValue;
}
//# sourceMappingURL=scalars.js.map