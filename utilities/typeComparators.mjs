import { isAbstractType, isInterfaceType, isListType, isNonNullType, isObjectType, } from "../type/definition.mjs";
export function isEqualType(typeA, typeB) {
    if (typeA === typeB) {
        return true;
    }
    if (isNonNullType(typeA) && isNonNullType(typeB)) {
        return isEqualType(typeA.ofType, typeB.ofType);
    }
    if (isListType(typeA) && isListType(typeB)) {
        return isEqualType(typeA.ofType, typeB.ofType);
    }
    return false;
}
export function isTypeSubTypeOf(schema, maybeSubType, superType) {
    if (maybeSubType === superType) {
        return true;
    }
    if (isNonNullType(superType)) {
        if (isNonNullType(maybeSubType)) {
            return isTypeSubTypeOf(schema, maybeSubType.ofType, superType.ofType);
        }
        return false;
    }
    if (isNonNullType(maybeSubType)) {
        return isTypeSubTypeOf(schema, maybeSubType.ofType, superType);
    }
    if (isListType(superType)) {
        if (isListType(maybeSubType)) {
            return isTypeSubTypeOf(schema, maybeSubType.ofType, superType.ofType);
        }
        return false;
    }
    if (isListType(maybeSubType)) {
        return false;
    }
    return (isAbstractType(superType) &&
        (isInterfaceType(maybeSubType) || isObjectType(maybeSubType)) &&
        schema.isSubType(superType, maybeSubType));
}
export function doTypesOverlap(schema, typeA, typeB) {
    if (typeA === typeB) {
        return true;
    }
    if (isAbstractType(typeA)) {
        if (isAbstractType(typeB)) {
            return schema
                .getPossibleTypes(typeA)
                .some((type) => schema.isSubType(typeB, type));
        }
        return schema.isSubType(typeA, typeB);
    }
    if (isAbstractType(typeB)) {
        return schema.isSubType(typeB, typeA);
    }
    return false;
}
//# sourceMappingURL=typeComparators.mjs.map