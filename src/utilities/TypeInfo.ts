import type { Visitor } from '../language/visitor';
import type { ASTNode, ASTKindToNode, FieldNode } from '../language/ast';
import { Kind } from '../language/kinds';
import { isNode } from '../language/ast';
import { getVisitFn } from '../language/visitor';

import type { GraphQLSchema } from '../type/schema';
import type { GraphQLDirective } from '../type/directives';
import type {
  GraphQLType,
  GraphQLInputType,
  GraphQLOutputType,
  GraphQLCompositeType,
  GraphQLField,
  GraphQLArgument,
  GraphQLInputField,
  GraphQLEnumValue,
} from '../type/definition';
import {
  isObjectType,
  isInterfaceType,
  isEnumType,
  isInputObjectType,
  isListType,
  isCompositeType,
  isInputType,
  isOutputType,
  getNullableType,
  getNamedType,
} from '../type/definition';
import {
  SchemaMetaFieldDef,
  TypeMetaFieldDef,
  TypeNameMetaFieldDef,
} from '../type/introspection';

import type { Maybe } from '../jsutils/Maybe';

import { typeFromAST } from './typeFromAST';

/**
 * TypeInfo is a utility class which, given a GraphQL schema, can keep track
 * of the current field and type definitions at any point in a GraphQL document
 * AST during a recursive descent by calling `enter(node)` and `leave(node)`.
 */
export class TypeInfo {
  _schema: GraphQLSchema;
  _typeStack: Array<Maybe<GraphQLOutputType>>;
  _parentTypeStack: Array<Maybe<GraphQLCompositeType>>;
  _inputTypeStack: Array<Maybe<GraphQLInputType>>;
  _fieldDefStack: Array<Maybe<GraphQLField<unknown, unknown>>>;
  _defaultValueStack: Array<Maybe<unknown>>;
  _directive: Maybe<GraphQLDirective>;
  _argument: Maybe<GraphQLArgument>;
  _enumValue: Maybe<GraphQLEnumValue>;
  _getFieldDef: typeof getFieldDef;

  constructor(
    schema: GraphQLSchema,
    // NOTE: this experimental optional second parameter is only needed in order
    // to support non-spec-compliant code bases. You should never need to use it.
    // It may disappear in the future.
    getFieldDefFn?: typeof getFieldDef,
    // Initial type may be provided in rare cases to facilitate traversals
    // beginning somewhere other than documents.
    initialType?: GraphQLType,
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

  getType(): Maybe<GraphQLOutputType> {
    if (this._typeStack.length > 0) {
      return this._typeStack[this._typeStack.length - 1];
    }
  }

  getParentType(): Maybe<GraphQLCompositeType> {
    if (this._parentTypeStack.length > 0) {
      return this._parentTypeStack[this._parentTypeStack.length - 1];
    }
  }

  getInputType(): Maybe<GraphQLInputType> {
    if (this._inputTypeStack.length > 0) {
      return this._inputTypeStack[this._inputTypeStack.length - 1];
    }
  }

  getParentInputType(): Maybe<GraphQLInputType> {
    if (this._inputTypeStack.length > 1) {
      return this._inputTypeStack[this._inputTypeStack.length - 2];
    }
  }

  getFieldDef(): Maybe<GraphQLField<unknown, unknown>> {
    if (this._fieldDefStack.length > 0) {
      return this._fieldDefStack[this._fieldDefStack.length - 1];
    }
  }

  getDefaultValue(): Maybe<unknown> {
    if (this._defaultValueStack.length > 0) {
      return this._defaultValueStack[this._defaultValueStack.length - 1];
    }
  }

  getDirective(): Maybe<GraphQLDirective> {
    return this._directive;
  }

  getArgument(): Maybe<GraphQLArgument> {
    return this._argument;
  }

  getEnumValue(): Maybe<GraphQLEnumValue> {
    return this._enumValue;
  }

  enter(node: ASTNode) {
    const schema = this._schema;
    // Note: many of the types below are explicitly typed as "unknown" to drop
    // any assumptions of a valid schema to ensure runtime types are properly
    // checked before continuing since TypeInfo is used as part of validation
    // which occurs before guarantees of schema and document validity.
    switch (node.kind) {
      case Kind.SELECTION_SET: {
        const namedType: unknown = getNamedType(this.getType());
        this._parentTypeStack.push(
          isCompositeType(namedType) ? namedType : undefined,
        );
        break;
      }
      case Kind.FIELD: {
        const parentType = this.getParentType();
        let fieldDef;
        let fieldType: unknown;
        if (parentType) {
          fieldDef = this._getFieldDef(schema, parentType, node);
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
        let type: unknown;
        switch (node.operation) {
          case 'query':
            type = schema.getQueryType();
            break;
          case 'mutation':
            type = schema.getMutationType();
            break;
          case 'subscription':
            type = schema.getSubscriptionType();
            break;
        }
        this._typeStack.push(isObjectType(type) ? type : undefined);
        break;
      }
      case Kind.INLINE_FRAGMENT:
      case Kind.FRAGMENT_DEFINITION: {
        const typeConditionAST = node.typeCondition;
        const outputType: unknown = typeConditionAST
          ? typeFromAST(schema, typeConditionAST)
          : getNamedType(this.getType());
        this._typeStack.push(isOutputType(outputType) ? outputType : undefined);
        break;
      }
      case Kind.VARIABLE_DEFINITION: {
        const inputType: unknown = typeFromAST(schema, node.type);
        this._inputTypeStack.push(
          isInputType(inputType) ? inputType : undefined,
        );
        break;
      }
      case Kind.ARGUMENT: {
        let argDef;
        let argType: unknown;
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
        this._inputTypeStack.push(isInputType(argType) ? argType : undefined);
        break;
      }
      case Kind.LIST: {
        const listType: unknown = getNullableType(this.getInputType());
        const itemType: unknown = isListType(listType)
          ? listType.ofType
          : listType;
        // List positions never have a default value.
        this._defaultValueStack.push(undefined);
        this._inputTypeStack.push(isInputType(itemType) ? itemType : undefined);
        break;
      }
      case Kind.OBJECT_FIELD: {
        const objectType: unknown = getNamedType(this.getInputType());
        let inputFieldType: GraphQLInputType | undefined | null;
        let inputField: GraphQLInputField | undefined | null;
        if (isInputObjectType(objectType)) {
          inputField = objectType.getFields()[node.name.value];
          if (inputField) {
            inputFieldType = inputField.type;
          }
        }
        this._defaultValueStack.push(
          inputField ? inputField.defaultValue : undefined,
        );
        this._inputTypeStack.push(
          isInputType(inputFieldType) ? inputFieldType : undefined,
        );
        break;
      }
      case Kind.ENUM: {
        const enumType: unknown = getNamedType(this.getInputType());
        let enumValue;
        if (isEnumType(enumType)) {
          enumValue = enumType.getValue(node.value);
        }
        this._enumValue = enumValue;
        break;
      }
    }
  }

  leave(node: ASTNode) {
    switch (node.kind) {
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
      case Kind.LIST:
      case Kind.OBJECT_FIELD:
        this._defaultValueStack.pop();
        this._inputTypeStack.pop();
        break;
      case Kind.ENUM:
        this._enumValue = null;
        break;
    }
  }
}

/**
 * Not exactly the same as the executor's definition of getFieldDef, in this
 * statically evaluated environment we do not always have an Object type,
 * and need to handle Interface and Union types.
 */
function getFieldDef(
  schema: GraphQLSchema,
  parentType: GraphQLType,
  fieldNode: FieldNode,
): Maybe<GraphQLField<unknown, unknown>> {
  const name = fieldNode.name.value;
  if (
    name === SchemaMetaFieldDef.name &&
    schema.getQueryType() === parentType
  ) {
    return SchemaMetaFieldDef;
  }
  if (name === TypeMetaFieldDef.name && schema.getQueryType() === parentType) {
    return TypeMetaFieldDef;
  }
  if (name === TypeNameMetaFieldDef.name && isCompositeType(parentType)) {
    return TypeNameMetaFieldDef;
  }
  if (isObjectType(parentType) || isInterfaceType(parentType)) {
    return parentType.getFields()[name];
  }
}

/**
 * Creates a new visitor instance which maintains a provided TypeInfo instance
 * along with visiting visitor.
 */
export function visitWithTypeInfo(
  typeInfo: TypeInfo,
  visitor: Visitor<ASTKindToNode>,
): Visitor<ASTKindToNode> {
  return {
    enter(node) {
      typeInfo.enter(node);
      const fn = getVisitFn(visitor, node.kind, /* isLeaving */ false);
      if (fn) {
        const result = fn.apply(visitor, arguments as any);
        if (result !== undefined) {
          typeInfo.leave(node);
          if (isNode(result)) {
            typeInfo.enter(result);
          }
        }
        return result;
      }
    },
    leave(node) {
      const fn = getVisitFn(visitor, node.kind, /* isLeaving */ true);
      let result;
      if (fn) {
        result = fn.apply(visitor, arguments as any);
      }
      typeInfo.leave(node);
      return result;
    },
  };
}
