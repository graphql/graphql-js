import { inspect } from "../jsutils/inspect.mjs";
import { invariant } from "../jsutils/invariant.mjs";
import { isIterableObject } from "../jsutils/isIterableObject.mjs";
import { isObjectLike } from "../jsutils/isObjectLike.mjs";
import { Kind } from "../language/kinds.mjs";
import { isEnumType, isInputObjectType, isLeafType, isListType, isNonNullType, } from "../type/definition.mjs";
import { GraphQLID } from "../type/scalars.mjs";
export function astFromValue(value, type) {
    if (isNonNullType(type)) {
        const astValue = astFromValue(value, type.ofType);
        if (astValue?.kind === Kind.NULL) {
            return null;
        }
        return astValue;
    }
    if (value === null) {
        return { kind: Kind.NULL };
    }
    if (value === undefined) {
        return null;
    }
    if (isListType(type)) {
        const itemType = type.ofType;
        if (isIterableObject(value)) {
            const valuesNodes = [];
            for (const item of value) {
                const itemNode = astFromValue(item, itemType);
                if (itemNode != null) {
                    valuesNodes.push(itemNode);
                }
            }
            return { kind: Kind.LIST, values: valuesNodes };
        }
        return astFromValue(value, itemType);
    }
    if (isInputObjectType(type)) {
        if (!isObjectLike(value)) {
            return null;
        }
        const fieldNodes = [];
        for (const field of Object.values(type.getFields())) {
            const fieldValue = astFromValue(value[field.name], field.type);
            if (fieldValue) {
                fieldNodes.push({
                    kind: Kind.OBJECT_FIELD,
                    name: { kind: Kind.NAME, value: field.name },
                    value: fieldValue,
                });
            }
        }
        return { kind: Kind.OBJECT, fields: fieldNodes };
    }
    if (isLeafType(type)) {
        const coerced = type.coerceOutputValue(value);
        if (coerced == null) {
            return null;
        }
        if (typeof coerced === 'boolean') {
            return { kind: Kind.BOOLEAN, value: coerced };
        }
        if (typeof coerced === 'number' && Number.isFinite(coerced)) {
            const stringNum = String(coerced);
            return integerStringRegExp.test(stringNum)
                ? { kind: Kind.INT, value: stringNum }
                : { kind: Kind.FLOAT, value: stringNum };
        }
        if (typeof coerced === 'bigint') {
            return { kind: Kind.INT, value: String(coerced) };
        }
        if (typeof coerced === 'string') {
            if (isEnumType(type)) {
                return { kind: Kind.ENUM, value: coerced };
            }
            if (type === GraphQLID && integerStringRegExp.test(coerced)) {
                return { kind: Kind.INT, value: coerced };
            }
            return {
                kind: Kind.STRING,
                value: coerced,
            };
        }
        throw new TypeError(`Cannot convert value to AST: ${inspect(coerced)}.`);
    }
    invariant(false, 'Unexpected input type: ' + inspect(type));
}
const integerStringRegExp = /^-?(?:0|[1-9][0-9]*)$/;
//# sourceMappingURL=astFromValue.mjs.map