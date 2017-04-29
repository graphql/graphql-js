/* @flow */
/**
 *  Copyright (c) 2015, Facebook, Inc.
 *  All rights reserved.
 *
 *  This source code is licensed under the BSD-style license found in the
 *  LICENSE file in the root directory of this source tree. An additional grant
 *  of patent rights can be found in the PATENTS file in the same directory.
 */

import * as Kind from '../language/kinds';
import {
  isCompositeType,
  isInputType,
  isOutputType,
  getNullableType,
  getNamedType,
  GraphQLObjectType,
  GraphQLInterfaceType,
  GraphQLInputObjectType,
  GraphQLEnumType,
  GraphQLList,
} from '../type/definition';
import type {
  GraphQLType,
  GraphQLInputType,
  GraphQLOutputType,
  GraphQLCompositeType,
  GraphQLField,
  GraphQLArgument,
  GraphQLEnumValue,
} from '../type/definition';
import type { GraphQLDirective } from '../type/directives';
import {
  SchemaMetaFieldDef,
  TypeMetaFieldDef,
  TypeNameMetaFieldDef
} from '../type/introspection';
import type { GraphQLSchema } from '../type/schema';
import type { ASTNode, FieldNode } from '../language/ast';
import { typeFromAST } from './typeFromAST';
import find from '../jsutils/find';


/**
 * TypeInfo is a utility class which, given a GraphQL schema, can keep track
 * of the current field and type definitions at any point in a GraphQL document
 * AST during a recursive descent by calling `enter(node)` and `leave(node)`.
 */
export class TypeInfo {
  _schema: GraphQLSchema;
  _typeStack: Array<?GraphQLOutputType>;
  _parentTypeStack: Array<?GraphQLCompositeType>;
  _inputTypeStack: Array<?GraphQLInputType>;
  _fieldDefStack: Array<?GraphQLField<*, *>>;
  _directive: ?GraphQLDirective;
  _argument: ?GraphQLArgument;
  _enumValue: ?GraphQLEnumValue;
  _getFieldDef: typeof getFieldDef;

  constructor(
    schema: GraphQLSchema,
    // NOTE: this experimental optional second parameter is only needed in order
    // to support non-spec-compliant codebases. You should never need to use it.
    // It may disappear in the future.
    getFieldDefFn?: typeof getFieldDef
  ) {
    this._schema = schema;
    this._typeStack = [];
    this._parentTypeStack = [];
    this._inputTypeStack = [];
    this._fieldDefStack = [];
    this._directive = null;
    this._argument = null;
    this._enumValue = null;
    this._getFieldDef = getFieldDefFn || getFieldDef;
  }

  getType(): ?GraphQLOutputType {
    if (this._typeStack.length > 0) {
      return this._typeStack[this._typeStack.length - 1];
    }
  }

  getParentType(): ?GraphQLCompositeType {
    if (this._parentTypeStack.length > 0) {
      return this._parentTypeStack[this._parentTypeStack.length - 1];
    }
  }

  getInputType(): ?GraphQLInputType {
    if (this._inputTypeStack.length > 0) {
      return this._inputTypeStack[this._inputTypeStack.length - 1];
    }
  }

  getFieldDef(): ?GraphQLField<*, *> {
    if (this._fieldDefStack.length > 0) {
      return this._fieldDefStack[this._fieldDefStack.length - 1];
    }
  }

  getDirective(): ?GraphQLDirective {
    return this._directive;
  }

  getArgument(): ?GraphQLArgument {
    return this._argument;
  }

  getEnumValue(): ?GraphQLEnumValue {
    return this._enumValue;
  }

  // Flow does not yet handle this case.
  enter(node: any/* ASTNode */) {
    const schema = this._schema;
    switch (node.kind) {
      case Kind.SELECTION_SET:
        const namedType = getNamedType(this.getType());
        this._parentTypeStack.push(
          isCompositeType(namedType) ? namedType : undefined
        );
        break;
      case Kind.FIELD:
        const parentType = this.getParentType();
        let fieldDef;
        if (parentType) {
          fieldDef = this._getFieldDef(schema, parentType, node);
        }
        this._fieldDefStack.push(fieldDef);
        this._typeStack.push(fieldDef && fieldDef.type);
        break;
      case Kind.DIRECTIVE:
        this._directive = schema.getDirective(node.name.value);
        break;
      case Kind.OPERATION_DEFINITION:
        let type;
        if (node.operation === 'query') {
          type = schema.getQueryType();
        } else if (node.operation === 'mutation') {
          type = schema.getMutationType();
        } else if (node.operation === 'subscription') {
          type = schema.getSubscriptionType();
        }
        this._typeStack.push(type);
        break;
      case Kind.INLINE_FRAGMENT:
      case Kind.FRAGMENT_DEFINITION:
        const typeConditionAST = node.typeCondition;
        const outputType = typeConditionAST ?
          typeFromAST(schema, typeConditionAST) :
          this.getType();
        this._typeStack.push(
          isOutputType(outputType) ? outputType : undefined
        );
        break;
      case Kind.VARIABLE_DEFINITION:
        const inputType = typeFromAST(schema, node.type);
        this._inputTypeStack.push(
          isInputType(inputType) ? inputType : undefined
        );
        break;
      case Kind.ARGUMENT:
        let argDef;
        let argType;
        const fieldOrDirective = this.getDirective() || this.getFieldDef();
        if (fieldOrDirective) {
          argDef = find(
            fieldOrDirective.args,
            arg => arg.name === node.name.value
          );
          if (argDef) {
            argType = argDef.type;
          }
        }
        this._argument = argDef;
        this._inputTypeStack.push(argType);
        break;
      case Kind.LIST:
        const listType = getNullableType(this.getInputType());
        this._inputTypeStack.push(
          listType instanceof GraphQLList ? listType.ofType : undefined
        );
        break;
      case Kind.OBJECT_FIELD:
        const objectType = getNamedType(this.getInputType());
        let fieldType;
        if (objectType instanceof GraphQLInputObjectType) {
          const inputField = objectType.getFields()[node.name.value];
          fieldType = inputField ? inputField.type : undefined;
        }
        this._inputTypeStack.push(fieldType);
        break;
      case Kind.ENUM:
        const enumType = getNamedType(this.getInputType());
        let enumValue;
        if (enumType instanceof GraphQLEnumType) {
          enumValue = enumType.getValue(node.value);
        }
        this._enumValue = enumValue;
        break;
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
        this._inputTypeStack.pop();
        break;
      case Kind.LIST:
      case Kind.OBJECT_FIELD:
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
  fieldNode: FieldNode
): ?GraphQLField<*, *> {
  const name = fieldNode.name.value;
  if (name === SchemaMetaFieldDef.name &&
      schema.getQueryType() === parentType) {
    return SchemaMetaFieldDef;
  }
  if (name === TypeMetaFieldDef.name &&
      schema.getQueryType() === parentType) {
    return TypeMetaFieldDef;
  }
  if (name === TypeNameMetaFieldDef.name && isCompositeType(parentType)) {
    return TypeNameMetaFieldDef;
  }
  if (parentType instanceof GraphQLObjectType ||
      parentType instanceof GraphQLInterfaceType) {
    return parentType.getFields()[name];
  }
}
