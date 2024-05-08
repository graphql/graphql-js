import { inspect } from '../jsutils/inspect.js';
import type { Maybe } from '../jsutils/Maybe.js';

import type { ConstObjectFieldNode, ConstValueNode } from '../language/ast.js';
import { Kind } from '../language/kinds.js';

/**
 * Produces a GraphQL Value AST given a JavaScript object.
 * Function will match JavaScript/JSON values to GraphQL AST schema format
 * by using the following mapping.
 *
 * | JSON Value    | GraphQL Value        |
 * | ------------- | -------------------- |
 * | Object        | Input Object         |
 * | Array         | List                 |
 * | Boolean       | Boolean              |
 * | String        | String               |
 * | Number        | Int / Float          |
 * | null          | NullValue            |
 *
 */
export function astFromValueUntyped(value: any): Maybe<ConstValueNode> {
    // only explicit null, not undefined, NaN
    if (value === null) {
        return { kind: Kind.NULL };
    }

    // undefined
    if (value === undefined) {
        return null;
    }

    // Convert JavaScript array to GraphQL list. If the GraphQLType is a list, but
    // the value is not an array, convert the value using the list's item type.
    if (Array.isArray(value)) {
        const valuesNodes: Array<ConstValueNode> = [];
        for (const item of value) {
            const itemNode = astFromValueUntyped(item);
            if (itemNode != null) {
                valuesNodes.push(itemNode);
            }
        }
        return { kind: Kind.LIST, values: valuesNodes };
    }

    if (typeof value === 'object') {
        const fieldNodes: Array<ConstObjectFieldNode> = [];
        for (const fieldName of Object.getOwnPropertyNames(value)) {
            const fieldValue = value[fieldName];
            const ast = astFromValueUntyped(fieldValue);
            if (ast) {
                fieldNodes.push({
                    kind: Kind.OBJECT_FIELD,
                    name: { kind: Kind.NAME, value: fieldName },
                    value: ast,
                });
            }
        }
        return { kind: Kind.OBJECT, fields: fieldNodes };
    }

    // Others serialize based on their corresponding JavaScript scalar types.
    if (typeof value === 'boolean') {
        return { kind: Kind.BOOLEAN, value };
    }

    // JavaScript numbers can be Int or Float values.
    if (typeof value === 'number' && isFinite(value)) {
        const stringNum = String(value);
        return integerStringRegExp.test(stringNum)
            ? { kind: Kind.INT, value: stringNum }
            : { kind: Kind.FLOAT, value: stringNum };
    }

    if (typeof value === 'string') {
        return { kind: Kind.STRING, value };
    }


    throw new TypeError(`Cannot convert value to AST: ${inspect(value)}.`);
}

/**
 * IntValue:
 *   - NegativeSign? 0
 *   - NegativeSign? NonZeroDigit ( Digit+ )?
 */
export const integerStringRegExp = /^-?(?:0|[1-9][0-9]*)$/;
