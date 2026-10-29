"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.specifiedScalarTypes = exports.GraphQLID = exports.GraphQLBoolean = exports.GraphQLString = exports.GraphQLFloat = exports.GraphQLInt = exports.GRAPHQL_MIN_INT = exports.GRAPHQL_MAX_INT = void 0;
exports.isSpecifiedScalarType = isSpecifiedScalarType;
const inspect_ts_1 = require("../jsutils/inspect.js");
const isObjectLike_ts_1 = require("../jsutils/isObjectLike.js");
const GraphQLError_ts_1 = require("../error/GraphQLError.js");
const kinds_ts_1 = require("../language/kinds.js");
const printer_ts_1 = require("../language/printer.js");
const valueToLiteral_ts_1 = require("../utilities/valueToLiteral.js");
const definition_ts_1 = require("./definition.js");
exports.GRAPHQL_MAX_INT = 2147483647;
exports.GRAPHQL_MIN_INT = -2147483648;
exports.GraphQLInt = new definition_ts_1.GraphQLScalarType({
    name: 'Int',
    description: 'The `Int` scalar type represents non-fractional signed whole numeric values. Int can represent values between -(2^31) and 2^31 - 1.',
    coerceOutputValue(outputValue) {
        const coercedValue = coerceOutputValueObject(outputValue);
        if (typeof coercedValue === 'number') {
            return coerceIntFromNumber(coercedValue);
        }
        if (typeof coercedValue === 'boolean') {
            return coercedValue ? 1 : 0;
        }
        if (typeof coercedValue === 'string') {
            return coerceIntFromString(coercedValue);
        }
        if (typeof coercedValue === 'bigint') {
            return coerceIntFromBigInt(coercedValue);
        }
        throw new GraphQLError_ts_1.GraphQLError(`Int cannot represent non-integer value: ${(0, inspect_ts_1.inspect)(coercedValue)}`);
    },
    coerceInputValue(inputValue) {
        if (typeof inputValue === 'number') {
            return coerceIntFromNumber(inputValue);
        }
        if (typeof inputValue === 'bigint') {
            return coerceIntFromBigInt(inputValue);
        }
        throw new GraphQLError_ts_1.GraphQLError(`Int cannot represent non-integer value: ${(0, inspect_ts_1.inspect)(inputValue)}`);
    },
    coerceInputLiteral(valueNode) {
        if (valueNode.kind !== kinds_ts_1.Kind.INT) {
            throw new GraphQLError_ts_1.GraphQLError(`Int cannot represent non-integer value: ${(0, printer_ts_1.printForError)(valueNode)}`, { nodes: valueNode });
        }
        const num = parseInt(valueNode.value, 10);
        if (num > exports.GRAPHQL_MAX_INT || num < exports.GRAPHQL_MIN_INT) {
            throw new GraphQLError_ts_1.GraphQLError(`Int cannot represent non 32-bit signed integer value: ${valueNode.value}`, { nodes: valueNode });
        }
        return num;
    },
    valueToLiteral(value) {
        if (((typeof value === 'number' && Number.isInteger(value)) ||
            typeof value === 'bigint') &&
            value <= exports.GRAPHQL_MAX_INT &&
            value >= exports.GRAPHQL_MIN_INT) {
            return { kind: kinds_ts_1.Kind.INT, value: String(value) };
        }
    },
});
exports.GraphQLFloat = new definition_ts_1.GraphQLScalarType({
    name: 'Float',
    description: 'The `Float` scalar type represents signed double-precision fractional values as specified by [IEEE 754](https://en.wikipedia.org/wiki/IEEE_floating_point).',
    coerceOutputValue(outputValue) {
        const coercedValue = coerceOutputValueObject(outputValue);
        if (typeof coercedValue === 'number') {
            return coerceFloatFromNumber(coercedValue);
        }
        if (typeof coercedValue === 'boolean') {
            return coercedValue ? 1 : 0;
        }
        if (typeof coercedValue === 'string') {
            return coerceFloatFromString(coercedValue);
        }
        if (typeof coercedValue === 'bigint') {
            return coerceFloatFromBigInt(coercedValue);
        }
        throw new GraphQLError_ts_1.GraphQLError(`Float cannot represent non numeric value: ${(0, inspect_ts_1.inspect)(coercedValue)}`);
    },
    coerceInputValue(inputValue) {
        if (typeof inputValue === 'number') {
            return coerceFloatFromNumber(inputValue);
        }
        if (typeof inputValue === 'bigint') {
            return coerceFloatFromBigInt(inputValue);
        }
        throw new GraphQLError_ts_1.GraphQLError(`Float cannot represent non numeric value: ${(0, inspect_ts_1.inspect)(inputValue)}`);
    },
    coerceInputLiteral(valueNode) {
        if (valueNode.kind !== kinds_ts_1.Kind.FLOAT && valueNode.kind !== kinds_ts_1.Kind.INT) {
            throw new GraphQLError_ts_1.GraphQLError(`Float cannot represent non numeric value: ${(0, printer_ts_1.printForError)(valueNode)}`, { nodes: valueNode });
        }
        return parseFloat(valueNode.value);
    },
    valueToLiteral(value) {
        const literal = (0, valueToLiteral_ts_1.defaultScalarValueToLiteral)(value);
        if (literal.kind === kinds_ts_1.Kind.FLOAT || literal.kind === kinds_ts_1.Kind.INT) {
            return literal;
        }
    },
});
exports.GraphQLString = new definition_ts_1.GraphQLScalarType({
    name: 'String',
    description: 'The `String` scalar type represents textual data, represented as UTF-8 character sequences. The String type is most often used by GraphQL to represent free-form human-readable text.',
    coerceOutputValue(outputValue) {
        const coercedValue = coerceOutputValueObject(outputValue);
        if (typeof coercedValue === 'string') {
            return coercedValue;
        }
        if (typeof coercedValue === 'boolean') {
            return coercedValue ? 'true' : 'false';
        }
        if (typeof coercedValue === 'number') {
            return coerceStringFromNumber(coercedValue);
        }
        if (typeof coercedValue === 'bigint') {
            return String(coercedValue);
        }
        throw new GraphQLError_ts_1.GraphQLError(`String cannot represent value: ${(0, inspect_ts_1.inspect)(outputValue)}`);
    },
    coerceInputValue(inputValue) {
        if (typeof inputValue !== 'string') {
            throw new GraphQLError_ts_1.GraphQLError(`String cannot represent a non string value: ${(0, inspect_ts_1.inspect)(inputValue)}`);
        }
        return inputValue;
    },
    coerceInputLiteral(valueNode) {
        if (valueNode.kind !== kinds_ts_1.Kind.STRING) {
            throw new GraphQLError_ts_1.GraphQLError(`String cannot represent a non string value: ${(0, printer_ts_1.printForError)(valueNode)}`, { nodes: valueNode });
        }
        return valueNode.value;
    },
    valueToLiteral(value) {
        const literal = (0, valueToLiteral_ts_1.defaultScalarValueToLiteral)(value);
        if (literal.kind === kinds_ts_1.Kind.STRING) {
            return literal;
        }
    },
});
exports.GraphQLBoolean = new definition_ts_1.GraphQLScalarType({
    name: 'Boolean',
    description: 'The `Boolean` scalar type represents `true` or `false`.',
    coerceOutputValue(outputValue) {
        const coercedValue = coerceOutputValueObject(outputValue);
        if (typeof coercedValue === 'boolean') {
            return coercedValue;
        }
        if (typeof coercedValue === 'number') {
            return coerceBooleanFromNumber(coercedValue);
        }
        if (typeof coercedValue === 'bigint') {
            return coercedValue !== 0n;
        }
        throw new GraphQLError_ts_1.GraphQLError(`Boolean cannot represent a non boolean value: ${(0, inspect_ts_1.inspect)(coercedValue)}`);
    },
    coerceInputValue(inputValue) {
        if (typeof inputValue !== 'boolean') {
            throw new GraphQLError_ts_1.GraphQLError(`Boolean cannot represent a non boolean value: ${(0, inspect_ts_1.inspect)(inputValue)}`);
        }
        return inputValue;
    },
    coerceInputLiteral(valueNode) {
        if (valueNode.kind !== kinds_ts_1.Kind.BOOLEAN) {
            throw new GraphQLError_ts_1.GraphQLError(`Boolean cannot represent a non boolean value: ${(0, printer_ts_1.printForError)(valueNode)}`, { nodes: valueNode });
        }
        return valueNode.value;
    },
    valueToLiteral(value) {
        const literal = (0, valueToLiteral_ts_1.defaultScalarValueToLiteral)(value);
        if (literal.kind === kinds_ts_1.Kind.BOOLEAN) {
            return literal;
        }
    },
});
exports.GraphQLID = new definition_ts_1.GraphQLScalarType({
    name: 'ID',
    description: 'The `ID` scalar type represents a unique identifier, often used to refetch an object or as key for a cache. The ID type appears in a JSON response as a String; however, it is not intended to be human-readable. When expected as an input type, any string (such as `"4"`) or integer (such as `4`) input value will be accepted as an ID.',
    coerceOutputValue(outputValue) {
        const coercedValue = coerceOutputValueObject(outputValue);
        if (typeof coercedValue === 'string') {
            return coercedValue;
        }
        if (typeof coercedValue === 'number') {
            return coerceIDFromNumber(coercedValue);
        }
        if (typeof coercedValue === 'bigint') {
            return String(coercedValue);
        }
        throw new GraphQLError_ts_1.GraphQLError(`ID cannot represent value: ${(0, inspect_ts_1.inspect)(outputValue)}`);
    },
    coerceInputValue(inputValue) {
        if (typeof inputValue === 'string') {
            return inputValue;
        }
        if (typeof inputValue === 'number') {
            return coerceIDFromNumber(inputValue);
        }
        if (typeof inputValue === 'bigint') {
            return String(inputValue);
        }
        throw new GraphQLError_ts_1.GraphQLError(`ID cannot represent value: ${(0, inspect_ts_1.inspect)(inputValue)}`);
    },
    coerceInputLiteral(valueNode) {
        if (valueNode.kind !== kinds_ts_1.Kind.STRING && valueNode.kind !== kinds_ts_1.Kind.INT) {
            throw new GraphQLError_ts_1.GraphQLError('ID cannot represent a non-string and non-integer value: ' +
                (0, printer_ts_1.printForError)(valueNode), { nodes: valueNode });
        }
        return valueNode.value;
    },
    valueToLiteral(value) {
        if (typeof value === 'string') {
            return /^-?(?:0|[1-9][0-9]*)$/.test(value)
                ? { kind: kinds_ts_1.Kind.INT, value }
                : { kind: kinds_ts_1.Kind.STRING, value, block: false };
        }
        if (typeof value === 'number') {
            return { kind: kinds_ts_1.Kind.INT, value: coerceIDFromNumber(value) };
        }
        if (typeof value === 'bigint') {
            return { kind: kinds_ts_1.Kind.INT, value: String(value) };
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
function coerceOutputValueObject(outputValue) {
    if ((0, isObjectLike_ts_1.isObjectLike)(outputValue)) {
        if (typeof outputValue.valueOf === 'function') {
            const valueOfResult = outputValue.valueOf();
            if (!(0, isObjectLike_ts_1.isObjectLike)(valueOfResult)) {
                return valueOfResult;
            }
        }
        if (typeof outputValue.toJSON === 'function') {
            return outputValue.toJSON();
        }
    }
    return outputValue;
}
function coerceIntFromNumber(value) {
    if (!Number.isInteger(value)) {
        throw new GraphQLError_ts_1.GraphQLError(`Int cannot represent non-integer value: ${(0, inspect_ts_1.inspect)(value)}`);
    }
    if (value > exports.GRAPHQL_MAX_INT || value < exports.GRAPHQL_MIN_INT) {
        throw new GraphQLError_ts_1.GraphQLError(`Int cannot represent non 32-bit signed integer value: ${(0, inspect_ts_1.inspect)(value)}`);
    }
    return value;
}
function coerceIntFromString(value) {
    if (value === '') {
        throw new GraphQLError_ts_1.GraphQLError(`Int cannot represent non-integer value: ${(0, inspect_ts_1.inspect)(value)}`);
    }
    const num = Number(value);
    if (!Number.isInteger(num)) {
        throw new GraphQLError_ts_1.GraphQLError(`Int cannot represent non-integer value: ${(0, inspect_ts_1.inspect)(value)}`);
    }
    if (num > exports.GRAPHQL_MAX_INT || num < exports.GRAPHQL_MIN_INT) {
        throw new GraphQLError_ts_1.GraphQLError(`Int cannot represent non 32-bit signed integer value: ${(0, inspect_ts_1.inspect)(value)}`);
    }
    return num;
}
function coerceIntFromBigInt(value) {
    if (value > exports.GRAPHQL_MAX_INT || value < exports.GRAPHQL_MIN_INT) {
        throw new GraphQLError_ts_1.GraphQLError(`Int cannot represent non 32-bit signed integer value: ${String(value)}`);
    }
    return Number(value);
}
function coerceFloatFromNumber(value) {
    if (!Number.isFinite(value)) {
        throw new GraphQLError_ts_1.GraphQLError(`Float cannot represent non numeric value: ${(0, inspect_ts_1.inspect)(value)}`);
    }
    return value;
}
function coerceFloatFromString(value) {
    if (value === '') {
        throw new GraphQLError_ts_1.GraphQLError(`Float cannot represent non numeric value: ${(0, inspect_ts_1.inspect)(value)}`);
    }
    const num = Number(value);
    if (!Number.isFinite(num)) {
        throw new GraphQLError_ts_1.GraphQLError(`Float cannot represent non numeric value: ${(0, inspect_ts_1.inspect)(value)}`);
    }
    return num;
}
function coerceFloatFromBigInt(coercedValue) {
    const num = Number(coercedValue);
    if (!Number.isFinite(num)) {
        throw new GraphQLError_ts_1.GraphQLError(`Float cannot represent non numeric value: ${(0, inspect_ts_1.inspect)(coercedValue)} (value is too large)`);
    }
    if (BigInt(num) !== coercedValue) {
        throw new GraphQLError_ts_1.GraphQLError(`Float cannot represent non numeric value: ${(0, inspect_ts_1.inspect)(coercedValue)} (value would lose precision)`);
    }
    return num;
}
function coerceStringFromNumber(value) {
    if (!Number.isFinite(value)) {
        throw new GraphQLError_ts_1.GraphQLError(`String cannot represent value: ${(0, inspect_ts_1.inspect)(value)}`);
    }
    return String(value);
}
function coerceBooleanFromNumber(value) {
    if (!Number.isFinite(value)) {
        throw new GraphQLError_ts_1.GraphQLError(`Boolean cannot represent a non boolean value: ${(0, inspect_ts_1.inspect)(value)}`);
    }
    return value !== 0;
}
function coerceIDFromNumber(value) {
    if (!Number.isInteger(value)) {
        throw new GraphQLError_ts_1.GraphQLError(`ID cannot represent value: ${(0, inspect_ts_1.inspect)(value)}`);
    }
    return String(value);
}
//# sourceMappingURL=scalars.js.map