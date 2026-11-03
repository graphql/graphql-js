import { inspect } from "../jsutils/inspect.mjs";
import { instanceOf } from "../jsutils/instanceOf.mjs";
import { toObjMapWithSymbols } from "../jsutils/toObjMap.mjs";
import { OperationTypeNode } from "../language/ast.mjs";
import { getNamedType, isInputObjectType, isInterfaceType, isObjectType, isUnionType, } from "./definition.mjs";
import { isDirective, specifiedDirectives } from "./directives.mjs";
import { __Schema, SchemaMetaFieldDef, TypeMetaFieldDef, TypeNameMetaFieldDef, } from "./introspection.mjs";
export function isSchema(schema) {
    return instanceOf(schema, schemaSymbol, GraphQLSchema);
}
export function assertSchema(schema) {
    if (!isSchema(schema)) {
        throw new Error(`Expected ${inspect(schema)} to be a GraphQL schema.`);
    }
    return schema;
}
const schemaSymbol = Symbol('Schema');
export class GraphQLSchema {
    constructor(config) {
        this.__kind = schemaSymbol;
        this.assumeValid = config.assumeValid ?? false;
        this.__validationErrors = config.assumeValid === true ? [] : undefined;
        this.description = config.description;
        this.extensions = toObjMapWithSymbols(config.extensions);
        this.astNode = config.astNode;
        this.extensionASTNodes = config.extensionASTNodes ?? [];
        this._queryType = config.query;
        this._mutationType = config.mutation;
        this._subscriptionType = config.subscription;
        this._directives = config.directives ?? specifiedDirectives;
        const allReferencedTypes = new Set(config.types);
        if (config.types != null) {
            for (const type of config.types) {
                allReferencedTypes.delete(type);
                collectReferencedTypes(type, allReferencedTypes);
            }
        }
        if (this._queryType != null) {
            collectReferencedTypes(this._queryType, allReferencedTypes);
        }
        if (this._mutationType != null) {
            collectReferencedTypes(this._mutationType, allReferencedTypes);
        }
        if (this._subscriptionType != null) {
            collectReferencedTypes(this._subscriptionType, allReferencedTypes);
        }
        for (const directive of this._directives) {
            if (isDirective(directive)) {
                for (const arg of directive.args) {
                    collectReferencedTypes(arg.type, allReferencedTypes);
                }
            }
        }
        collectReferencedTypes(__Schema, allReferencedTypes);
        this._typeMap = Object.create(null);
        this._subTypeMap = new Map();
        this._implementationsMap = Object.create(null);
        for (const namedType of allReferencedTypes) {
            if (namedType == null) {
                continue;
            }
            const typeName = namedType.name;
            if (this._typeMap[typeName] !== undefined) {
                throw new Error(`Schema must contain uniquely named types but contains multiple types named "${typeName}".`);
            }
            this._typeMap[typeName] = namedType;
            if (isInterfaceType(namedType)) {
                for (const iface of namedType.getInterfaces()) {
                    if (isInterfaceType(iface)) {
                        let implementations = this._implementationsMap[iface.name];
                        implementations ??= this._implementationsMap[iface.name] = {
                            objects: [],
                            interfaces: [],
                        };
                        implementations.interfaces.push(namedType);
                    }
                }
            }
            else if (isObjectType(namedType)) {
                for (const iface of namedType.getInterfaces()) {
                    if (isInterfaceType(iface)) {
                        let implementations = this._implementationsMap[iface.name];
                        implementations ??= this._implementationsMap[iface.name] = {
                            objects: [],
                            interfaces: [],
                        };
                        implementations.objects.push(namedType);
                    }
                }
            }
        }
    }
    get [Symbol.toStringTag]() {
        return 'GraphQLSchema';
    }
    getQueryType() {
        return this._queryType;
    }
    getMutationType() {
        return this._mutationType;
    }
    getSubscriptionType() {
        return this._subscriptionType;
    }
    getRootType(operation) {
        switch (operation) {
            case OperationTypeNode.QUERY:
                return this.getQueryType();
            case OperationTypeNode.MUTATION:
                return this.getMutationType();
            case OperationTypeNode.SUBSCRIPTION:
                return this.getSubscriptionType();
        }
    }
    getTypeMap() {
        return this._typeMap;
    }
    getType(name) {
        return this.getTypeMap()[name];
    }
    getPossibleTypes(abstractType) {
        return isUnionType(abstractType)
            ? abstractType.getTypes()
            : this.getImplementations(abstractType).objects;
    }
    getImplementations(interfaceType) {
        const implementations = this._implementationsMap[interfaceType.name];
        return implementations ?? { objects: [], interfaces: [] };
    }
    isSubType(abstractType, maybeSubType) {
        let set = this._subTypeMap.get(abstractType);
        if (set === undefined) {
            if (isUnionType(abstractType)) {
                set = new Set(abstractType.getTypes());
            }
            else {
                const implementations = this.getImplementations(abstractType);
                set = new Set([
                    ...implementations.objects,
                    ...implementations.interfaces,
                ]);
            }
            this._subTypeMap.set(abstractType, set);
        }
        return set.has(maybeSubType);
    }
    getDirectives() {
        return this._directives;
    }
    getDirective(name) {
        return this.getDirectives().find((directive) => directive.name === name);
    }
    getField(parentType, fieldName) {
        switch (fieldName) {
            case SchemaMetaFieldDef.name:
                return this.getQueryType() === parentType
                    ? SchemaMetaFieldDef
                    : undefined;
            case TypeMetaFieldDef.name:
                return this.getQueryType() === parentType
                    ? TypeMetaFieldDef
                    : undefined;
            case TypeNameMetaFieldDef.name:
                return TypeNameMetaFieldDef;
        }
        if ('getFields' in parentType) {
            return parentType.getFields()[fieldName];
        }
        return undefined;
    }
    toConfig() {
        return {
            description: this.description,
            query: this.getQueryType(),
            mutation: this.getMutationType(),
            subscription: this.getSubscriptionType(),
            types: Object.values(this.getTypeMap()),
            directives: this.getDirectives(),
            extensions: this.extensions,
            astNode: this.astNode,
            extensionASTNodes: this.extensionASTNodes,
            assumeValid: this.assumeValid,
        };
    }
}
function collectReferencedTypes(type, typeSet) {
    const namedType = getNamedType(type);
    if (!typeSet.has(namedType)) {
        typeSet.add(namedType);
        if (isUnionType(namedType)) {
            for (const memberType of namedType.getTypes()) {
                collectReferencedTypes(memberType, typeSet);
            }
        }
        else if (isObjectType(namedType) || isInterfaceType(namedType)) {
            for (const interfaceType of namedType.getInterfaces()) {
                collectReferencedTypes(interfaceType, typeSet);
            }
            for (const field of Object.values(namedType.getFields())) {
                collectReferencedTypes(field.type, typeSet);
                for (const arg of field.args) {
                    collectReferencedTypes(arg.type, typeSet);
                }
            }
        }
        else if (isInputObjectType(namedType)) {
            for (const field of Object.values(namedType.getFields())) {
                collectReferencedTypes(field.type, typeSet);
            }
        }
    }
    return typeSet;
}
//# sourceMappingURL=schema.mjs.map