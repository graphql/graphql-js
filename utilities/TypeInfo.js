"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TypeInfo = void 0;
exports.visitWithTypeInfo = visitWithTypeInfo;
const ast_ts_1 = require("../language/ast.js");
const kinds_ts_1 = require("../language/kinds.js");
const visitor_ts_1 = require("../language/visitor.js");
const definition_ts_1 = require("../type/definition.js");
const typeFromAST_ts_1 = require("./typeFromAST.js");
class TypeInfo {
    constructor(schema, initialType, fragmentSignatures) {
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
            if ((0, definition_ts_1.isInputType)(initialType)) {
                this._inputTypeStack.push(initialType);
            }
            if ((0, definition_ts_1.isCompositeType)(initialType)) {
                this._parentTypeStack.push(initialType);
            }
            if ((0, definition_ts_1.isOutputType)(initialType)) {
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
        switch (node.kind) {
            case kinds_ts_1.Kind.DOCUMENT: {
                const fragmentSignatures = getFragmentSignatures(node);
                this._fragmentSignaturesByName = (fragmentName) => fragmentSignatures.get(fragmentName);
                break;
            }
            case kinds_ts_1.Kind.SELECTION_SET: {
                const namedType = (0, definition_ts_1.getNamedType)(this.getType());
                this._parentTypeStack.push((0, definition_ts_1.isCompositeType)(namedType) ? namedType : undefined);
                break;
            }
            case kinds_ts_1.Kind.FIELD: {
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
                this._typeStack.push((0, definition_ts_1.isOutputType)(fieldType) ? fieldType : undefined);
                break;
            }
            case kinds_ts_1.Kind.DIRECTIVE:
                this._directive = schema.getDirective(node.name.value);
                break;
            case kinds_ts_1.Kind.OPERATION_DEFINITION: {
                const rootType = schema.getRootType(node.operation);
                this._typeStack.push((0, definition_ts_1.isObjectType)(rootType) ? rootType : undefined);
                break;
            }
            case kinds_ts_1.Kind.FRAGMENT_SPREAD: {
                this._fragmentSignature = this.getFragmentSignatureByName()(node.name.value);
                break;
            }
            case kinds_ts_1.Kind.INLINE_FRAGMENT:
            case kinds_ts_1.Kind.FRAGMENT_DEFINITION: {
                const typeConditionAST = node.typeCondition;
                const outputType = typeConditionAST
                    ? (0, typeFromAST_ts_1.typeFromAST)(schema, typeConditionAST)
                    : (0, definition_ts_1.getNamedType)(this.getType());
                this._typeStack.push((0, definition_ts_1.isOutputType)(outputType) ? outputType : undefined);
                break;
            }
            case kinds_ts_1.Kind.VARIABLE_DEFINITION: {
                const inputType = (0, typeFromAST_ts_1.typeFromAST)(schema, node.type);
                this._inputTypeStack.push((0, definition_ts_1.isInputType)(inputType) ? inputType : undefined);
                break;
            }
            case kinds_ts_1.Kind.ARGUMENT: {
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
                this._inputTypeStack.push((0, definition_ts_1.isInputType)(argType) ? argType : undefined);
                break;
            }
            case kinds_ts_1.Kind.FRAGMENT_ARGUMENT: {
                const fragmentSignature = this.getFragmentSignature();
                const argDef = fragmentSignature?.variableDefinitions.get(node.name.value);
                this._fragmentArgument = argDef;
                let argType;
                if (argDef) {
                    argType = (0, typeFromAST_ts_1.typeFromAST)(this._schema, argDef.type);
                }
                this._inputTypeStack.push((0, definition_ts_1.isInputType)(argType) ? argType : undefined);
                break;
            }
            case kinds_ts_1.Kind.LIST: {
                const inputType = this.getInputType();
                const listType = inputType && (0, definition_ts_1.getNullableType)(inputType);
                this._defaultValueStack.push(undefined);
                this._inputTypeStack.push(listType && (0, definition_ts_1.isListType)(listType) ? listType.ofType : undefined);
                break;
            }
            case kinds_ts_1.Kind.OBJECT_FIELD: {
                const objectType = (0, definition_ts_1.getNamedType)(this.getInputType());
                let inputFieldType;
                let inputField;
                if ((0, definition_ts_1.isInputObjectType)(objectType)) {
                    inputField = objectType.getFields()[node.name.value];
                    if (inputField != null) {
                        inputFieldType = inputField.type;
                    }
                }
                this._defaultValueStack.push(inputField?.default ?? inputField?.defaultValue ?? undefined);
                this._inputTypeStack.push((0, definition_ts_1.isInputType)(inputFieldType) ? inputFieldType : undefined);
                break;
            }
            case kinds_ts_1.Kind.ENUM: {
                const enumType = (0, definition_ts_1.getNamedType)(this.getInputType());
                let enumValue;
                if ((0, definition_ts_1.isEnumType)(enumType)) {
                    enumValue = enumType.getValue(node.value);
                }
                this._enumValue = enumValue;
                break;
            }
            default:
        }
    }
    leave(node) {
        switch (node.kind) {
            case kinds_ts_1.Kind.DOCUMENT:
                this._fragmentSignaturesByName = () => null;
                break;
            case kinds_ts_1.Kind.SELECTION_SET:
                this._parentTypeStack.pop();
                break;
            case kinds_ts_1.Kind.FIELD:
                this._fieldDefStack.pop();
                this._typeStack.pop();
                break;
            case kinds_ts_1.Kind.DIRECTIVE:
                this._directive = null;
                break;
            case kinds_ts_1.Kind.FRAGMENT_SPREAD:
                this._fragmentSignature = null;
                break;
            case kinds_ts_1.Kind.OPERATION_DEFINITION:
            case kinds_ts_1.Kind.INLINE_FRAGMENT:
            case kinds_ts_1.Kind.FRAGMENT_DEFINITION:
                this._typeStack.pop();
                break;
            case kinds_ts_1.Kind.VARIABLE_DEFINITION:
                this._inputTypeStack.pop();
                break;
            case kinds_ts_1.Kind.ARGUMENT:
                this._argument = null;
                this._defaultValueStack.pop();
                this._inputTypeStack.pop();
                break;
            case kinds_ts_1.Kind.FRAGMENT_ARGUMENT: {
                this._fragmentArgument = null;
                this._defaultValueStack.pop();
                this._inputTypeStack.pop();
                break;
            }
            case kinds_ts_1.Kind.LIST:
            case kinds_ts_1.Kind.OBJECT_FIELD:
                this._defaultValueStack.pop();
                this._inputTypeStack.pop();
                break;
            case kinds_ts_1.Kind.ENUM:
                this._enumValue = null;
                break;
            default:
        }
    }
}
exports.TypeInfo = TypeInfo;
function getFragmentSignatures(document) {
    const fragmentSignatures = new Map();
    for (const definition of document.definitions) {
        if (definition.kind === kinds_ts_1.Kind.FRAGMENT_DEFINITION) {
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
function visitWithTypeInfo(typeInfo, visitor) {
    return {
        enter(...args) {
            const node = args[0];
            typeInfo.enter(node);
            const fn = (0, visitor_ts_1.getEnterLeaveForKind)(visitor, node.kind).enter;
            if (fn) {
                const result = fn.apply(visitor, args);
                if (result !== undefined) {
                    typeInfo.leave(node);
                    if ((0, ast_ts_1.isNode)(result)) {
                        typeInfo.enter(result);
                    }
                }
                return result;
            }
        },
        leave(...args) {
            const node = args[0];
            const fn = (0, visitor_ts_1.getEnterLeaveForKind)(visitor, node.kind).leave;
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