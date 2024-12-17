import { isNode } from "../language/ast.mjs";
import { Kind } from "../language/kinds.mjs";
import { getEnterLeaveForKind } from "../language/visitor.mjs";
import { getNamedType, getNullableType, isCompositeType, isEnumType, isInputObjectType, isInputType, isListType, isObjectType, isOutputType, } from "../type/definition.mjs";
import { typeFromAST } from "./typeFromAST.mjs";
/**
 * TypeInfo is a utility class which, given a GraphQL schema, can keep track
 * of the current field and type definitions at any point in a GraphQL document
 * AST during a recursive descent by calling `enter(node)` and `leave(node)`.
 */
export class TypeInfo {
    constructor(schema, 
    /**
     * Initial type may be provided in rare cases to facilitate traversals
     *  beginning somewhere other than documents.
     */
    initialType, fragmentSignatures) {
        this._schema = schema;
        this._typeStack = [];
        this._parentTypeStack = [];
        this._inputTypeStack = [];
        this._fieldDefStack = [];
        this._defaultValueStack = [];
        this._directive = null;
        this._argument = null;
        this._enumValue = null;
        this._fragmentSignaturesByName = fragmentSignatures ?? (() => null);
        this._fragmentSignature = null;
        this._fragmentArgument = null;
        if (initialType) {
            if (isInputType(initialType)) {
                this._inputTypeStack.push(initialType);
            }
            if (isCompositeType(initialType)) {
                this._parentTypeStack.push(initialType);
            }
            if (isOutputType(initialType)) {
                this._typeStack.push(initialType);
            }
        }
    }
    get [Symbol.toStringTag]() {
        return 'TypeInfo';
    }
    getType() {
        return this._typeStack.at(-1);
    }
    getParentType() {
        return this._parentTypeStack.at(-1);
    }
    getInputType() {
        return this._inputTypeStack.at(-1);
    }
    getParentInputType() {
        return this._inputTypeStack.at(-2);
    }
    getFieldDef() {
        return this._fieldDefStack.at(-1);
    }
    getDefaultValue() {
        return this._defaultValueStack.at(-1);
    }
    getDirective() {
        return this._directive;
    }
    getArgument() {
        return this._argument;
    }
    getFragmentSignature() {
        return this._fragmentSignature;
    }
    getFragmentSignatureByName() {
        return this._fragmentSignaturesByName;
    }
    getFragmentArgument() {
        return this._fragmentArgument;
    }
    getEnumValue() {
        return this._enumValue;
    }
    enter(node) {
        const schema = this._schema;
        // Note: many of the types below are explicitly typed as "unknown" to drop
        // any assumptions of a valid schema to ensure runtime types are properly
        // checked before continuing since TypeInfo is used as part of validation
        // which occurs before guarantees of schema and document validity.
        switch (node.kind) {
            case Kind.DOCUMENT: {
                const fragmentSignatures = getFragmentSignatures(node);
                this._fragmentSignaturesByName = (fragmentName) => fragmentSignatures.get(fragmentName);
                break;
            }
            case Kind.SELECTION_SET: {
                const namedType = getNamedType(this.getType());
                this._parentTypeStack.push(isCompositeType(namedType) ? namedType : undefined);
                break;
            }
            case Kind.FIELD: {
                const parentType = this.getParentType();
                let fieldDef;
                let fieldType;
                if (parentType) {
                    fieldDef = schema.getField(parentType, node.name.value);
                    if (fieldDef) {
                        fieldType = fieldDef.type;
                    }
                }
                this._fieldDefStack.push(fieldDef);
                this._typeStack.push(isOutputType(fieldType) ? fieldType : undefined);
                break;
            }
            case Kind.DIRECTIVE:
                this._directive = schema.getDirective(node.name.value);
                break;
            case Kind.OPERATION_DEFINITION: {
                const rootType = schema.getRootType(node.operation);
                this._typeStack.push(isObjectType(rootType) ? rootType : undefined);
                break;
            }
            case Kind.FRAGMENT_SPREAD: {
                this._fragmentSignature = this.getFragmentSignatureByName()(node.name.value);
                break;
            }
            case Kind.INLINE_FRAGMENT:
            case Kind.FRAGMENT_DEFINITION: {
                const typeConditionAST = node.typeCondition;
                const outputType = typeConditionAST
                    ? typeFromAST(schema, typeConditionAST)
                    : getNamedType(this.getType());
                this._typeStack.push(isOutputType(outputType) ? outputType : undefined);
                break;
            }
            case Kind.VARIABLE_DEFINITION: {
                const inputType = typeFromAST(schema, node.type);
                this._inputTypeStack.push(isInputType(inputType) ? inputType : undefined);
                break;
            }
            case Kind.ARGUMENT: {
                let argDef;
                let argType;
                const fieldOrDirective = this.getDirective() ?? this.getFieldDef();
                if (fieldOrDirective) {
                    argDef = fieldOrDirective.args.find((arg) => arg.name === node.name.value);
                    if (argDef) {
                        argType = argDef.type;
                    }
                }
                this._argument = argDef;
                this._defaultValueStack.push(argDef?.default ?? argDef?.defaultValue ?? undefined);
                this._inputTypeStack.push(isInputType(argType) ? argType : undefined);
                break;
            }
            case Kind.FRAGMENT_ARGUMENT: {
                const fragmentSignature = this.getFragmentSignature();
                const argDef = fragmentSignature?.variableDefinitions.get(node.name.value);
                this._fragmentArgument = argDef;
                let argType;
                if (argDef) {
                    argType = typeFromAST(this._schema, argDef.type);
                }
                this._inputTypeStack.push(isInputType(argType) ? argType : undefined);
                break;
            }
            case Kind.LIST: {
                const listType = getNullableType(this.getInputType());
                const itemType = isListType(listType)
                    ? listType.ofType
                    : listType;
                // List positions never have a default value.
                this._defaultValueStack.push(undefined);
                this._inputTypeStack.push(isInputType(itemType) ? itemType : undefined);
                break;
            }
            case Kind.OBJECT_FIELD: {
                const objectType = getNamedType(this.getInputType());
                let inputFieldType;
                let inputField;
                if (isInputObjectType(objectType)) {
                    inputField = objectType.getFields()[node.name.value];
                    if (inputField != null) {
                        inputFieldType = inputField.type;
                    }
                }
                this._defaultValueStack.push(inputField?.default ?? inputField?.defaultValue ?? undefined);
                this._inputTypeStack.push(isInputType(inputFieldType) ? inputFieldType : undefined);
                break;
            }
            case Kind.ENUM: {
                const enumType = getNamedType(this.getInputType());
                let enumValue;
                if (isEnumType(enumType)) {
                    enumValue = enumType.getValue(node.value);
                }
                this._enumValue = enumValue;
                break;
            }
            default:
            // Ignore other nodes
        }
    }
    leave(node) {
        switch (node.kind) {
            case Kind.DOCUMENT:
                this._fragmentSignaturesByName = /* c8 ignore start */ () => null /* c8 ignore end */;
                break;
            case Kind.SELECTION_SET:
                this._parentTypeStack.pop();
                break;
            case Kind.FIELD:
                this._fieldDefStack.pop();
                this._typeStack.pop();
                break;
            case Kind.DIRECTIVE:
                this._directive = null;
                break;
            case Kind.FRAGMENT_SPREAD:
                this._fragmentSignature = null;
                break;
            case Kind.OPERATION_DEFINITION:
            case Kind.INLINE_FRAGMENT:
            case Kind.FRAGMENT_DEFINITION:
                this._typeStack.pop();
                break;
            case Kind.VARIABLE_DEFINITION:
                this._inputTypeStack.pop();
                break;
            case Kind.ARGUMENT:
                this._argument = null;
                this._defaultValueStack.pop();
                this._inputTypeStack.pop();
                break;
            case Kind.FRAGMENT_ARGUMENT: {
                this._fragmentArgument = null;
                this._defaultValueStack.pop();
                this._inputTypeStack.pop();
                break;
            }
            case Kind.LIST:
            case Kind.OBJECT_FIELD:
                this._defaultValueStack.pop();
                this._inputTypeStack.pop();
                break;
            case Kind.ENUM:
                this._enumValue = null;
                break;
            default:
            // Ignore other nodes
        }
    }
}
function getFragmentSignatures(document) {
    const fragmentSignatures = new Map();
    for (const definition of document.definitions) {
        if (definition.kind === Kind.FRAGMENT_DEFINITION) {
            const variableDefinitions = new Map();
            if (definition.variableDefinitions) {
                for (const varDef of definition.variableDefinitions) {
                    variableDefinitions.set(varDef.variable.name.value, varDef);
                }
            }
            const signature = { definition, variableDefinitions };
            fragmentSignatures.set(definition.name.value, signature);
        }
    }
    return fragmentSignatures;
}
/**
 * Creates a new visitor instance which maintains a provided TypeInfo instance
 * along with visiting visitor.
 */
export function visitWithTypeInfo(typeInfo, visitor) {
    return {
        enter(...args) {
            const node = args[0];
            typeInfo.enter(node);
            const fn = getEnterLeaveForKind(visitor, node.kind).enter;
            if (fn) {
                const result = fn.apply(visitor, args);
                if (result !== undefined) {
                    typeInfo.leave(node);
                    if (isNode(result)) {
                        typeInfo.enter(result);
                    }
                }
                return result;
            }
        },
        leave(...args) {
            const node = args[0];
            const fn = getEnterLeaveForKind(visitor, node.kind).leave;
            let result;
            if (fn) {
                result = fn.apply(visitor, args);
            }
            typeInfo.leave(node);
            return result;
        },
    };
}
//# sourceMappingURL=TypeInfo.js.map