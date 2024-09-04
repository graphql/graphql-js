import type { Maybe } from '../jsutils/Maybe.js';

import type {
  ASTNode,
  DocumentNode,
  FieldNode,
  FragmentDefinitionNode,
  VariableDefinitionNode,
} from '../language/ast.js';
import { isNode } from '../language/ast.js';
import { Kind } from '../language/kinds.js';
import type { ASTVisitor } from '../language/visitor.js';
import { getEnterLeaveForKind } from '../language/visitor.js';

import type {
  GraphQLArgument,
  GraphQLCompositeType,
  GraphQLEnumValue,
  GraphQLField,
  GraphQLInputField,
  GraphQLInputType,
  GraphQLOutputType,
  GraphQLType,
} from '../type/definition.js';
import {
  getNamedType,
  getNullableType,
  isCompositeType,
  isEnumType,
  isInputObjectType,
  isInputType,
  isListType,
  isObjectType,
  isOutputType,
} from '../type/definition.js';
import type { GraphQLDirective } from '../type/directives.js';
import type { GraphQLSchema } from '../type/schema.js';

import { typeFromAST } from './typeFromAST.js';

export interface FragmentSignature {
  readonly definition: FragmentDefinitionNode;
  readonly variableDefinitions: Map<string, VariableDefinitionNode>;
}

/**
 * TypeInfo is a utility class which, given a GraphQL schema, can keep track
 * of the current field and type definitions at any point in a GraphQL document
 * AST during a recursive descent by calling `enter(node)` and `leave(node)`.
 */
export class TypeInfo {
  private _schema: GraphQLSchema;
  private _typeStack: Array<Maybe<GraphQLOutputType>>;
  private _parentTypeStack: Array<Maybe<GraphQLCompositeType>>;
  private _inputTypeStack: Array<Maybe<GraphQLInputType>>;
  private _fieldDefStack: Array<Maybe<GraphQLField<unknown, unknown>>>;
  private _defaultValueStack: Array<Maybe<unknown>>;
  private _directive: Maybe<GraphQLDirective>;
  private _argument: Maybe<GraphQLArgument>;
  private _enumValue: Maybe<GraphQLEnumValue>;
  private _fragmentSignaturesByName: (
    fragmentName: string,
  ) => Maybe<FragmentSignature>;

  private _fragmentSignature: Maybe<FragmentSignature>;
  private _fragmentArgument: Maybe<VariableDefinitionNode>;
  private _getFieldDef: GetFieldDefFn;

  constructor(
    schema: GraphQLSchema,
    /**
     * Initial type may be provided in rare cases to facilitate traversals
     *  beginning somewhere other than documents.
     */
    initialType?: Maybe<GraphQLType>,

    /** @deprecated will be removed in 17.0.0 */
    getFieldDefFn?: Maybe<GetFieldDefFn>,
    fragmentSignatures?: Maybe<
      (fragmentName: string) => Maybe<FragmentSignature>
    >,
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
    this._fragmentSignaturesByName = fragmentSignatures ?? (() => null);
    this._fragmentSignature = null;
    this._fragmentArgument = null;
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

  get [Symbol.toStringTag]() {
    return 'TypeInfo';
  }

  getType(): Maybe<GraphQLOutputType> {
    return this._typeStack.at(-1);
  }

  getParentType(): Maybe<GraphQLCompositeType> {
    return this._parentTypeStack.at(-1);
  }

  getInputType(): Maybe<GraphQLInputType> {
    return this._inputTypeStack.at(-1);
  }

  getParentInputType(): Maybe<GraphQLInputType> {
    return this._inputTypeStack.at(-2);
  }

  getFieldDef(): Maybe<GraphQLField<unknown, unknown>> {
    return this._fieldDefStack.at(-1);
  }

  getDefaultValue(): Maybe<unknown> {
    return this._defaultValueStack.at(-1);
  }

  getDirective(): Maybe<GraphQLDirective> {
    return this._directive;
  }

  getArgument(): Maybe<GraphQLArgument> {
    return this._argument;
  }

  getFragmentSignature(): Maybe<FragmentSignature> {
    return this._fragmentSignature;
  }

  getFragmentSignatureByName(): (
    fragmentName: string,
  ) => Maybe<FragmentSignature> {
    return this._fragmentSignaturesByName;
  }

  getFragmentArgument(): Maybe<VariableDefinitionNode> {
    return this._fragmentArgument;
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
      case Kind.DOCUMENT: {
        const fragmentSignatures = getFragmentSignatures(node);
        this._fragmentSignaturesByName = (fragmentName: string) =>
          fragmentSignatures.get(fragmentName);
        break;
      }
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
        const rootType = schema.getRootType(node.operation);
        this._typeStack.push(isObjectType(rootType) ? rootType : undefined);
        break;
      }
      case Kind.FRAGMENT_SPREAD: {
        this._fragmentSignature = this.getFragmentSignatureByName()(
          node.name.value,
        );
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
      case Kind.FRAGMENT_ARGUMENT: {
        const fragmentSignature = this.getFragmentSignature();
        const argDef = fragmentSignature?.variableDefinitions.get(
          node.name.value,
        );
        this._fragmentArgument = argDef;
        let argType: unknown;
        if (argDef) {
          argType = typeFromAST(this._schema, argDef.type);
        }
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
        let inputFieldType: GraphQLInputType | undefined;
        let inputField: GraphQLInputField | undefined;
        if (isInputObjectType(objectType)) {
          inputField = objectType.getFields()[node.name.value];
          if (inputField != null) {
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
      default:
      // Ignore other nodes
    }
  }

  leave(node: ASTNode) {
    switch (node.kind) {
      case Kind.DOCUMENT:
        this._fragmentSignaturesByName = /* c8 ignore start */ () =>
          null /* c8 ignore end */;
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

type GetFieldDefFn = (
  schema: GraphQLSchema,
  parentType: GraphQLCompositeType,
  fieldNode: FieldNode,
) => Maybe<GraphQLField<unknown, unknown>>;

function getFieldDef(
  schema: GraphQLSchema,
  parentType: GraphQLCompositeType,
  fieldNode: FieldNode,
) {
  return schema.getField(parentType, fieldNode.name.value);
}

function getFragmentSignatures(
  document: DocumentNode,
): Map<string, FragmentSignature> {
  const fragmentSignatures = new Map<string, FragmentSignature>();
  for (const definition of document.definitions) {
    if (definition.kind === Kind.FRAGMENT_DEFINITION) {
      const variableDefinitions = new Map<string, VariableDefinitionNode>();
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
export function visitWithTypeInfo(
  typeInfo: TypeInfo,
  visitor: ASTVisitor,
): ASTVisitor {
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
