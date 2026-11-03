import { devAssert } from "../jsutils/devAssert.mjs";
import { inspect } from "../jsutils/inspect.mjs";
import { isObjectLike } from "../jsutils/isObjectLike.mjs";
import { keyValMap } from "../jsutils/keyValMap.mjs";
import { parseConstValue } from "../language/parser.mjs";
import { assertInterfaceType, assertNullableType, assertObjectType, GraphQLEnumType, GraphQLInputObjectType, GraphQLInterfaceType, GraphQLList, GraphQLNonNull, GraphQLObjectType, GraphQLScalarType, GraphQLUnionType, isInputType, isOutputType, } from "../type/definition.mjs";
import { GraphQLDirective } from "../type/directives.mjs";
import { introspectionTypes, TypeKind } from "../type/introspection.mjs";
import { specifiedScalarTypes } from "../type/scalars.mjs";
import { GraphQLSchema } from "../type/schema.mjs";
export function buildClientSchema(introspection, options) {
    if (!(isObjectLike(introspection) && isObjectLike(introspection.__schema)))
        devAssert(false, `Invalid or incomplete introspection result. Ensure that you are passing "data" property of introspection response and no "errors" was returned alongside: ${inspect(introspection)}.`);
    const schemaIntrospection = introspection.__schema;
    const typeMap = new Map(schemaIntrospection.types.map((typeIntrospection) => [
        typeIntrospection.name,
        buildType(typeIntrospection),
    ]));
    for (const stdType of [...specifiedScalarTypes, ...introspectionTypes]) {
        if (typeMap.has(stdType.name)) {
            typeMap.set(stdType.name, stdType);
        }
    }
    const queryType = schemaIntrospection.queryType != null
        ? getObjectType(schemaIntrospection.queryType)
        : null;
    const mutationType = schemaIntrospection.mutationType != null
        ? getObjectType(schemaIntrospection.mutationType)
        : null;
    const subscriptionType = schemaIntrospection.subscriptionType != null
        ? getObjectType(schemaIntrospection.subscriptionType)
        : null;
    const directives = schemaIntrospection.directives != null
        ? schemaIntrospection.directives.map(buildDirective)
        : [];
    return new GraphQLSchema({
        description: schemaIntrospection.description,
        query: queryType,
        mutation: mutationType,
        subscription: subscriptionType,
        types: [...typeMap.values()],
        directives,
        assumeValid: options?.assumeValid,
    });
    function getType(typeRef) {
        if (typeRef.kind === TypeKind.LIST) {
            const itemRef = typeRef.ofType;
            if (itemRef == null) {
                throw new Error('Decorated type deeper than introspection query.');
            }
            return new GraphQLList(getType(itemRef));
        }
        if (typeRef.kind === TypeKind.NON_NULL) {
            const nullableRef = typeRef.ofType;
            if (nullableRef == null) {
                throw new Error('Decorated type deeper than introspection query.');
            }
            const nullableType = getType(nullableRef);
            return new GraphQLNonNull(assertNullableType(nullableType));
        }
        return getNamedType(typeRef);
    }
    function getNamedType(typeRef) {
        const typeName = typeRef.name;
        if (!typeName) {
            throw new Error(`Unknown type reference: ${inspect(typeRef)}.`);
        }
        const type = typeMap.get(typeName);
        if (type == null) {
            throw new Error(`Invalid or incomplete schema, unknown type: ${typeName}. Ensure that a full introspection query is used in order to build a client schema.`);
        }
        return type;
    }
    function getObjectType(typeRef) {
        return assertObjectType(getNamedType(typeRef));
    }
    function getInterfaceType(typeRef) {
        return assertInterfaceType(getNamedType(typeRef));
    }
    function buildType(type) {
        switch (type.kind) {
            case TypeKind.SCALAR:
                return buildScalarDef(type);
            case TypeKind.OBJECT:
                return buildObjectDef(type);
            case TypeKind.INTERFACE:
                return buildInterfaceDef(type);
            case TypeKind.UNION:
                return buildUnionDef(type);
            case TypeKind.ENUM:
                return buildEnumDef(type);
            case TypeKind.INPUT_OBJECT:
                return buildInputObjectDef(type);
            default:
                throw new Error(`Invalid or incomplete introspection result. Ensure that a full introspection query is used in order to build a client schema: ${inspect(type)}.`);
        }
    }
    function buildScalarDef(scalarIntrospection) {
        return new GraphQLScalarType({
            name: scalarIntrospection.name,
            description: scalarIntrospection.description,
            specifiedByURL: scalarIntrospection.specifiedByURL,
        });
    }
    function buildImplementationsList(implementingIntrospection) {
        if (implementingIntrospection.interfaces === null &&
            implementingIntrospection.kind === TypeKind.INTERFACE) {
            return [];
        }
        if (implementingIntrospection.interfaces == null) {
            const implementingIntrospectionStr = inspect(implementingIntrospection);
            throw new Error(`Introspection result missing interfaces: ${implementingIntrospectionStr}.`);
        }
        return implementingIntrospection.interfaces.map(getInterfaceType);
    }
    function buildObjectDef(objectIntrospection) {
        return new GraphQLObjectType({
            name: objectIntrospection.name,
            description: objectIntrospection.description,
            interfaces: () => buildImplementationsList(objectIntrospection),
            fields: () => buildFieldDefMap(objectIntrospection),
        });
    }
    function buildInterfaceDef(interfaceIntrospection) {
        return new GraphQLInterfaceType({
            name: interfaceIntrospection.name,
            description: interfaceIntrospection.description,
            interfaces: () => buildImplementationsList(interfaceIntrospection),
            fields: () => buildFieldDefMap(interfaceIntrospection),
        });
    }
    function buildUnionDef(unionIntrospection) {
        if (unionIntrospection.possibleTypes == null) {
            const unionIntrospectionStr = inspect(unionIntrospection);
            throw new Error(`Introspection result missing possibleTypes: ${unionIntrospectionStr}.`);
        }
        return new GraphQLUnionType({
            name: unionIntrospection.name,
            description: unionIntrospection.description,
            types: () => unionIntrospection.possibleTypes.map(getObjectType),
        });
    }
    function buildEnumDef(enumIntrospection) {
        if (enumIntrospection.enumValues == null) {
            const enumIntrospectionStr = inspect(enumIntrospection);
            throw new Error(`Introspection result missing enumValues: ${enumIntrospectionStr}.`);
        }
        return new GraphQLEnumType({
            name: enumIntrospection.name,
            description: enumIntrospection.description,
            values: keyValMap(enumIntrospection.enumValues, (valueIntrospection) => valueIntrospection.name, (valueIntrospection) => ({
                description: valueIntrospection.description,
                deprecationReason: valueIntrospection.deprecationReason,
            })),
        });
    }
    function buildInputObjectDef(inputObjectIntrospection) {
        if (inputObjectIntrospection.inputFields == null) {
            const inputObjectIntrospectionStr = inspect(inputObjectIntrospection);
            throw new Error(`Introspection result missing inputFields: ${inputObjectIntrospectionStr}.`);
        }
        return new GraphQLInputObjectType({
            name: inputObjectIntrospection.name,
            description: inputObjectIntrospection.description,
            fields: () => buildInputValueDefMap(inputObjectIntrospection.inputFields),
            isOneOf: inputObjectIntrospection.isOneOf,
        });
    }
    function buildFieldDefMap(typeIntrospection) {
        if (typeIntrospection.fields == null) {
            throw new Error(`Introspection result missing fields: ${inspect(typeIntrospection)}.`);
        }
        return keyValMap(typeIntrospection.fields, (fieldIntrospection) => fieldIntrospection.name, buildField);
    }
    function buildField(fieldIntrospection) {
        const type = getType(fieldIntrospection.type);
        if (!isOutputType(type)) {
            const typeStr = inspect(type);
            throw new Error(`Introspection must provide output type for fields, but received: ${typeStr}.`);
        }
        if (fieldIntrospection.args == null) {
            const fieldIntrospectionStr = inspect(fieldIntrospection);
            throw new Error(`Introspection result missing field args: ${fieldIntrospectionStr}.`);
        }
        return {
            description: fieldIntrospection.description,
            deprecationReason: fieldIntrospection.deprecationReason,
            type,
            args: buildInputValueDefMap(fieldIntrospection.args),
        };
    }
    function buildInputValueDefMap(inputValueIntrospections) {
        return keyValMap(inputValueIntrospections, (inputValue) => inputValue.name, buildInputValue);
    }
    function buildInputValue(inputValueIntrospection) {
        const type = getType(inputValueIntrospection.type);
        if (!isInputType(type)) {
            const typeStr = inspect(type);
            throw new Error(`Introspection must provide input type for arguments, but received: ${typeStr}.`);
        }
        return {
            description: inputValueIntrospection.description,
            type,
            default: inputValueIntrospection.defaultValue != null
                ? { literal: parseConstValue(inputValueIntrospection.defaultValue) }
                : undefined,
            deprecationReason: inputValueIntrospection.deprecationReason,
        };
    }
    function buildDirective(directiveIntrospection) {
        if (directiveIntrospection.args == null) {
            const directiveIntrospectionStr = inspect(directiveIntrospection);
            throw new Error(`Introspection result missing directive args: ${directiveIntrospectionStr}.`);
        }
        if (directiveIntrospection.locations == null) {
            const directiveIntrospectionStr = inspect(directiveIntrospection);
            throw new Error(`Introspection result missing directive locations: ${directiveIntrospectionStr}.`);
        }
        return new GraphQLDirective({
            name: directiveIntrospection.name,
            description: directiveIntrospection.description,
            isRepeatable: directiveIntrospection.isRepeatable,
            deprecationReason: directiveIntrospection.deprecationReason,
            locations: directiveIntrospection.locations.slice(),
            args: buildInputValueDefMap(directiveIntrospection.args),
        });
    }
}
//# sourceMappingURL=buildClientSchema.mjs.map