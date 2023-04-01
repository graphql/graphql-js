'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.visitWithTypeInfo = exports.TypeInfo = void 0;
const ast_js_1 = require('../language/ast.js');
const kinds_js_1 = require('../language/kinds.js');
const visitor_js_1 = require('../language/visitor.js');
const definition_js_1 = require('../type/definition.js');
const typeFromAST_js_1 = require('./typeFromAST.js');
/**
 * TypeInfo is a utility class which, given a GraphQL schema, can keep track
 * of the current field and type definitions at any point in a GraphQL document
 * AST during a recursive descent by calling `enter(node)` and `leave(node)`.
 */
class TypeInfo {
  constructor(
    schema,
    /**
     * Initial type may be provided in rare cases to facilitate traversals
     *  beginning somewhere other than documents.
     */
    initialType,
    /** @deprecated will be removed in 17.0.0 */
    getFieldDefFn,
  ) {
    this._schema = schema;
    this._typeStack = [];
    this._parentTypeStack = [];
    this._inputTypeStack = [];
    this._fieldDefStack = [];
    this._defaultValueStack = [];
    this._directive = null;
    this._argument = null;
    this._enumValue = null;
    this._getFieldDef = getFieldDefFn ?? getFieldDef;
    if (initialType) {
      if ((0, definition_js_1.isInputType)(initialType)) {
        this._inputTypeStack.push(initialType);
      }
      if ((0, definition_js_1.isCompositeType)(initialType)) {
        this._parentTypeStack.push(initialType);
      }
      if ((0, definition_js_1.isOutputType)(initialType)) {
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
      case kinds_js_1.Kind.SELECTION_SET: {
        const namedType = (0, definition_js_1.getNamedType)(this.getType());
        this._parentTypeStack.push(
          (0, definition_js_1.isCompositeType)(namedType)
            ? namedType
            : undefined,
        );
        break;
      }
      case kinds_js_1.Kind.FIELD: {
        const parentType = this.getParentType();
        let fieldDef;
        let fieldType;
        if (parentType) {
          fieldDef = this._getFieldDef(schema, parentType, node);
          if (fieldDef) {
            fieldType = fieldDef.type;
          }
        }
        this._fieldDefStack.push(fieldDef);
        this._typeStack.push(
          (0, definition_js_1.isOutputType)(fieldType) ? fieldType : undefined,
        );
        break;
      }
      case kinds_js_1.Kind.DIRECTIVE:
        this._directive = schema.getDirective(node.name.value);
        break;
      case kinds_js_1.Kind.OPERATION_DEFINITION: {
        const rootType = schema.getRootType(node.operation);
        this._typeStack.push(
          (0, definition_js_1.isObjectType)(rootType) ? rootType : undefined,
        );
        break;
      }
      case kinds_js_1.Kind.INLINE_FRAGMENT:
      case kinds_js_1.Kind.FRAGMENT_DEFINITION: {
        const typeConditionAST = node.typeCondition;
        const outputType = typeConditionAST
          ? (0, typeFromAST_js_1.typeFromAST)(schema, typeConditionAST)
          : (0, definition_js_1.getNamedType)(this.getType());
        this._typeStack.push(
          (0, definition_js_1.isOutputType)(outputType)
            ? outputType
            : undefined,
        );
        break;
      }
      case kinds_js_1.Kind.VARIABLE_DEFINITION: {
        const inputType = (0, typeFromAST_js_1.typeFromAST)(schema, node.type);
        this._inputTypeStack.push(
          (0, definition_js_1.isInputType)(inputType) ? inputType : undefined,
        );
        break;
      }
      case kinds_js_1.Kind.ARGUMENT: {
        let argDef;
        let argType;
        const fieldOrDirective = this.getDirective() ?? this.getFieldDef();
        if (fieldOrDirective) {
          argDef = fieldOrDirective.args.find(
            (arg) => arg.name === node.name.value,
          );
          if (argDef) {
            argType = argDef.type;
          }
        }
        this._argument = argDef;
        this._defaultValueStack.push(argDef ? argDef.defaultValue : undefined);
        this._inputTypeStack.push(
          (0, definition_js_1.isInputType)(argType) ? argType : undefined,
        );
        break;
      }
      case kinds_js_1.Kind.LIST: {
        const listType = (0, definition_js_1.getNullableType)(
          this.getInputType(),
        );
        const itemType = (0, definition_js_1.isListType)(listType)
          ? listType.ofType
          : listType;
        // List positions never have a default value.
        this._defaultValueStack.push(undefined);
        this._inputTypeStack.push(
          (0, definition_js_1.isInputType)(itemType) ? itemType : undefined,
        );
        break;
      }
      case kinds_js_1.Kind.OBJECT_FIELD: {
        const objectType = (0, definition_js_1.getNamedType)(
          this.getInputType(),
        );
        let inputFieldType;
        let inputField;
        if ((0, definition_js_1.isInputObjectType)(objectType)) {
          inputField = objectType.getFields()[node.name.value];
          if (inputField != null) {
            inputFieldType = inputField.type;
          }
        }
        this._defaultValueStack.push(
          inputField ? inputField.defaultValue : undefined,
        );
        this._inputTypeStack.push(
          (0, definition_js_1.isInputType)(inputFieldType)
            ? inputFieldType
            : undefined,
        );
        break;
      }
      case kinds_js_1.Kind.ENUM: {
        const enumType = (0, definition_js_1.getNamedType)(this.getInputType());
        let enumValue;
        if ((0, definition_js_1.isEnumType)(enumType)) {
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
      case kinds_js_1.Kind.SELECTION_SET:
        this._parentTypeStack.pop();
        break;
      case kinds_js_1.Kind.FIELD:
        this._fieldDefStack.pop();
        this._typeStack.pop();
        break;
      case kinds_js_1.Kind.DIRECTIVE:
        this._directive = null;
        break;
      case kinds_js_1.Kind.OPERATION_DEFINITION:
      case kinds_js_1.Kind.INLINE_FRAGMENT:
      case kinds_js_1.Kind.FRAGMENT_DEFINITION:
        this._typeStack.pop();
        break;
      case kinds_js_1.Kind.VARIABLE_DEFINITION:
        this._inputTypeStack.pop();
        break;
      case kinds_js_1.Kind.ARGUMENT:
        this._argument = null;
        this._defaultValueStack.pop();
        this._inputTypeStack.pop();
        break;
      case kinds_js_1.Kind.LIST:
      case kinds_js_1.Kind.OBJECT_FIELD:
        this._defaultValueStack.pop();
        this._inputTypeStack.pop();
        break;
      case kinds_js_1.Kind.ENUM:
        this._enumValue = null;
        break;
      default:
      // Ignore other nodes
    }
  }
}
exports.TypeInfo = TypeInfo;
function getFieldDef(schema, parentType, fieldNode) {
  return schema.getField(parentType, fieldNode.name.value);
}
/**
 * Creates a new visitor instance which maintains a provided TypeInfo instance
 * along with visiting visitor.
 */
function visitWithTypeInfo(typeInfo, visitor) {
  return {
    enter(...args) {
      const node = args[0];
      typeInfo.enter(node);
      const fn = (0, visitor_js_1.getEnterLeaveForKind)(
        visitor,
        node.kind,
      ).enter;
      if (fn) {
        const result = fn.apply(visitor, args);
        if (result !== undefined) {
          typeInfo.leave(node);
          if ((0, ast_js_1.isNode)(result)) {
            typeInfo.enter(result);
          }
        }
        return result;
      }
    },
    leave(...args) {
      const node = args[0];
      const fn = (0, visitor_js_1.getEnterLeaveForKind)(
        visitor,
        node.kind,
      ).leave;
      let result;
      if (fn) {
        result = fn.apply(visitor, args);
      }
      typeInfo.leave(node);
      return result;
    },
  };
}
exports.visitWithTypeInfo = visitWithTypeInfo;
