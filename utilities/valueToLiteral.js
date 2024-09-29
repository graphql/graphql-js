"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.defaultScalarValueToLiteral = exports.valueToLiteral = void 0;
const inspect_js_1 = require("../jsutils/inspect.js");
const isIterableObject_js_1 = require("../jsutils/isIterableObject.js");
const isObjectLike_js_1 = require("../jsutils/isObjectLike.js");
const kinds_js_1 = require("../language/kinds.js");
const definition_js_1 = require("../type/definition.js");
/**
 * Produces a GraphQL Value AST given a JavaScript value and a GraphQL type.
 *
 * Scalar types are converted by calling the `valueToLiteral` method on that
 * type, otherwise the default scalar `valueToLiteral` method is used, defined
 * below.
 *
 * The provided value is an non-coerced "input" value. This function does not
 * perform any coercion, however it does perform validation. Provided values
 * which are invalid for the given type will result in an `undefined` return
 * value.
 */
function valueToLiteral(value, type) {
    if ((0, definition_js_1.isNonNullType)(type)) {
        if (value == null) {
            return; // Invalid: intentionally return no value.
        }
        return valueToLiteral(value, type.ofType);
    }
    // Like JSON, a null literal is produced for both null and undefined.
    if (value == null) {
        return { kind: kinds_js_1.Kind.NULL };
    }
    if ((0, definition_js_1.isListType)(type)) {
        if (!(0, isIterableObject_js_1.isIterableObject)(value)) {
            return valueToLiteral(value, type.ofType);
        }
        const values = [];
        for (const itemValue of value) {
            const itemNode = valueToLiteral(itemValue, type.ofType);
            if (!itemNode) {
                return; // Invalid: intentionally return no value.
            }
            values.push(itemNode);
        }
        return { kind: kinds_js_1.Kind.LIST, values };
    }
    if ((0, definition_js_1.isInputObjectType)(type)) {
        if (!(0, isObjectLike_js_1.isObjectLike)(value)) {
            return; // Invalid: intentionally return no value.
        }
        const fields = [];
        const fieldDefs = type.getFields();
        const hasUndefinedField = Object.keys(value).some((name) => !Object.hasOwn(fieldDefs, name));
        if (hasUndefinedField) {
            return; // Invalid: intentionally return no value.
        }
        for (const field of Object.values(type.getFields())) {
            const fieldValue = value[field.name];
            if (fieldValue === undefined) {
                if ((0, definition_js_1.isRequiredInputField)(field)) {
                    return; // Invalid: intentionally return no value.
                }
            }
            else {
                const fieldNode = valueToLiteral(value[field.name], field.type);
                if (!fieldNode) {
                    return; // Invalid: intentionally return no value.
                }
                fields.push({
                    kind: kinds_js_1.Kind.OBJECT_FIELD,
                    name: { kind: kinds_js_1.Kind.NAME, value: field.name },
                    value: fieldNode,
                });
            }
        }
        return { kind: kinds_js_1.Kind.OBJECT, fields };
    }
    const leafType = (0, definition_js_1.assertLeafType)(type);
    if (leafType.valueToLiteral) {
        try {
            return leafType.valueToLiteral(value);
        }
        catch (_error) {
            return; // Invalid: intentionally ignore error and return no value.
        }
    }
    return defaultScalarValueToLiteral(value);
}
exports.valueToLiteral = valueToLiteral;
/**
 * The default implementation to convert scalar values to literals.
 *
 * | JavaScript Value  | GraphQL Value        |
 * | ----------------- | -------------------- |
 * | Object            | Input Object         |
 * | Array             | List                 |
 * | Boolean           | Boolean              |
 * | String            | String               |
 * | Number            | Int / Float          |
 * | null / undefined  | Null                 |
 *
 * @internal
 */
function defaultScalarValueToLiteral(value) {
    // Like JSON, a null literal is produced for both null and undefined.
    if (value == null) {
        return { kind: kinds_js_1.Kind.NULL };
    }
    // eslint-disable-next-line @typescript-eslint/switch-exhaustiveness-check
    switch (typeof value) {
        case 'boolean':
            return { kind: kinds_js_1.Kind.BOOLEAN, value };
        case 'string':
            return { kind: kinds_js_1.Kind.STRING, value, block: false };
        case 'number': {
            if (!Number.isFinite(value)) {
                // Like JSON, a null literal is produced for non-finite values.
                return { kind: kinds_js_1.Kind.NULL };
            }
            const stringValue = String(value);
            // Will parse as an IntValue.
            return /^-?(?:0|[1-9][0-9]*)$/.test(stringValue)
                ? { kind: kinds_js_1.Kind.INT, value: stringValue }
                : { kind: kinds_js_1.Kind.FLOAT, value: stringValue };
        }
        case 'object': {
            if ((0, isIterableObject_js_1.isIterableObject)(value)) {
                return {
                    kind: kinds_js_1.Kind.LIST,
                    values: Array.from(value, defaultScalarValueToLiteral),
                };
            }
            const objValue = value;
            const fields = [];
            for (const fieldName of Object.keys(objValue)) {
                const fieldValue = objValue[fieldName];
                // Like JSON, undefined fields are not included in the literal result.
                if (fieldValue !== undefined) {
                    fields.push({
                        kind: kinds_js_1.Kind.OBJECT_FIELD,
                        name: { kind: kinds_js_1.Kind.NAME, value: fieldName },
                        value: defaultScalarValueToLiteral(fieldValue),
                    });
                }
            }
            return { kind: kinds_js_1.Kind.OBJECT, fields };
        }
    }
    throw new TypeError(`Cannot convert value to AST: ${(0, inspect_js_1.inspect)(value)}.`);
}
exports.defaultScalarValueToLiteral = defaultScalarValueToLiteral;
