/** @category Validation */

import type {
  ASTNode,
  InputValueDefinitionNode,
  OperationTypeNode,
  TypeNode,
  VariableDefinitionNode,
} from '../language/ast.ts';
import { isNode } from '../language/ast.ts';
import { DirectiveLocation } from '../language/directiveLocation.ts';
import { Kind } from '../language/kinds.ts';
import type { ASTVisitor } from '../language/visitor.ts';
import { getEnterLeaveForKind } from '../language/visitor.ts';

import type { GraphQLEnumValue } from '../type/definition.ts';
import { isEnumType } from '../type/definition.ts';
import type { GraphQLDirective } from '../type/directives.ts';

import type {
  ArgumentReference,
  CompositeTypeReference,
  FieldReference,
  FragmentSignature,
  InputFieldReference,
  InputTypeReference,
  OutputTypeReference,
  TypeSystemValidationIndex,
} from './TypeSystemValidationIndex.ts';

/** @internal */
export const InputValueDefinitionParentKind = {
  ARGUMENT: 'Argument',
  INPUT_FIELD: 'InputField',
} as const;

/** @internal */
export type InputValueDefinitionParentKindName =
  (typeof InputValueDefinitionParentKind)[keyof typeof InputValueDefinitionParentKind];

/** @internal */
export interface InputValueDefinitionRecord {
  readonly kind: InputValueDefinitionParentKindName;
  readonly inputValueStr: string;
}

interface InputValueDefinitionParentRecord {
  readonly kind: InputValueDefinitionParentKindName;
  readonly parentName: string;
}

/** @internal */
export class IndexCursor {
  readonly index: TypeSystemValidationIndex;

  private _typeStack: Array<OutputTypeReference | undefined>;
  private _parentTypeStack: Array<CompositeTypeReference | undefined>;
  private _inputTypeStack: Array<InputTypeReference | undefined>;
  private _fieldDefStack: Array<FieldReference | undefined>;
  private _defaultValueStack: Array<unknown>;
  private _directiveLocationStack: Array<DirectiveLocation | undefined>;
  private _inputValueDefinitionParentStack: Array<
    InputValueDefinitionParentRecord | undefined
  >;
  private _inputValueDefinitionRecordStack: Array<
    InputValueDefinitionRecord | undefined
  >;
  private _fieldDefinitionParentTypeNameStack: Array<string | undefined>;
  private _directive: GraphQLDirective | undefined;
  private _directiveName: string | undefined;
  private _directiveLocation: DirectiveLocation | undefined;
  private _inputValueDefinitionParent:
    | InputValueDefinitionParentRecord
    | undefined;
  private _inputValueDefinitionRecord: InputValueDefinitionRecord | undefined;
  private _fieldDefinitionParentTypeName: string | undefined;
  private _fragmentDefinitionDepth: number;
  private _argument: ArgumentReference | undefined;
  private _enumValue: GraphQLEnumValue | undefined;
  private _fragmentSignature: FragmentSignature | undefined;
  private _fragmentArgument: VariableDefinitionNode | undefined;

  constructor(index: TypeSystemValidationIndex) {
    this.index = index;
    this._typeStack = [];
    this._parentTypeStack = [];
    this._inputTypeStack = [];
    this._fieldDefStack = [];
    this._defaultValueStack = [];
    this._directiveLocationStack = [];
    this._inputValueDefinitionParentStack = [];
    this._inputValueDefinitionRecordStack = [];
    this._fieldDefinitionParentTypeNameStack = [];
    this._directive = undefined;
    this._directiveName = undefined;
    this._directiveLocation = undefined;
    this._inputValueDefinitionParent = undefined;
    this._inputValueDefinitionRecord = undefined;
    this._fieldDefinitionParentTypeName = undefined;
    this._fragmentDefinitionDepth = 0;
    this._argument = undefined;
    this._enumValue = undefined;
    this._fragmentSignature = undefined;
    this._fragmentArgument = undefined;
  }

  enter(node: ASTNode): void {
    switch (node.kind) {
      case Kind.SELECTION_SET: {
        const namedType = this.index.getNamedOutputType(this.getCurrentType());
        this._parentTypeStack.push(
          namedType != null && this.index.isCompositeType(namedType)
            ? namedType
            : undefined,
        );
        break;
      }
      case Kind.FIELD: {
        this.pushDirectiveLocationForNode(DirectiveLocation.FIELD, node);
        const parentType = this.getCurrentParentType();
        let fieldDef: FieldReference | undefined;
        let fieldType: OutputTypeReference | undefined;
        if (parentType != null) {
          fieldDef = this.index.getFieldDef(parentType, node.name.value);
          if (fieldDef != null) {
            fieldType = this.index.getFieldType(fieldDef);
          }
        }
        this._fieldDefStack.push(fieldDef);
        this._typeStack.push(fieldType);
        break;
      }
      case Kind.DIRECTIVE:
        this._directive =
          this.index.schema?.getDirective(node.name.value) ?? undefined;
        this._directiveName = node.name.value;
        break;
      case Kind.OPERATION_DEFINITION: {
        this.pushDirectiveLocationForNode(
          getDirectiveLocationForOperation(node.operation),
          node,
        );
        const rootType = this.index.getRootType(node.operation);
        this._typeStack.push(
          rootType != null && this.index.isObjectType(rootType)
            ? rootType
            : undefined,
        );
        break;
      }
      case Kind.FRAGMENT_SPREAD:
        this.pushDirectiveLocationForNode(
          DirectiveLocation.FRAGMENT_SPREAD,
          node,
        );
        this._fragmentSignature =
          this.index.documentIndex.getFragmentSignatureByName()(
            node.name.value,
          );
        break;
      case Kind.INLINE_FRAGMENT: {
        this.pushDirectiveLocationForNode(
          DirectiveLocation.INLINE_FRAGMENT,
          node,
        );
        const typeConditionAST = node.typeCondition;
        const outputType =
          typeConditionAST != null
            ? this.index.getOutputTypeReference(typeConditionAST)
            : this.index.getNamedOutputType(this.getCurrentType());
        this._typeStack.push(outputType);
        break;
      }
      case Kind.FRAGMENT_DEFINITION: {
        this._fragmentDefinitionDepth += 1;
        this.pushDirectiveLocationForNode(
          DirectiveLocation.FRAGMENT_DEFINITION,
          node,
        );
        this._typeStack.push(
          this.index.getOutputTypeReference(node.typeCondition),
        );
        break;
      }
      case Kind.VARIABLE_DEFINITION: {
        this.pushDirectiveLocationForNode(
          this._fragmentDefinitionDepth === 0
            ? DirectiveLocation.VARIABLE_DEFINITION
            : DirectiveLocation.FRAGMENT_VARIABLE_DEFINITION,
          node,
        );
        this._inputTypeStack.push(this.index.getInputTypeReference(node.type));
        break;
      }
      case Kind.ARGUMENT: {
        const argDef = this.getArgumentDef(node.name.value);
        let argType;
        if (argDef != null) {
          argType = this.index.getArgumentType(argDef);
        }
        this._argument = argDef;
        this._defaultValueStack.push(
          this.index.getArgumentDefaultValue(argDef),
        );
        this._inputTypeStack.push(argType);
        break;
      }
      case Kind.FRAGMENT_ARGUMENT: {
        const fragmentSignature = this.getCurrentFragmentSignature();
        const argDef = fragmentSignature?.variableDefinitions.get(
          node.name.value,
        );
        this._fragmentArgument = argDef;

        this._defaultValueStack.push(undefined);
        this._inputTypeStack.push(
          argDef == null
            ? undefined
            : this.index.getInputTypeReference(argDef.type),
        );
        break;
      }
      case Kind.LIST: {
        const listType = this.index.getNullableInputType(
          this.getCurrentInputType(),
        );
        const itemType =
          listType != null && this.index.isListType(listType)
            ? this.index.getListItemType(listType)
            : undefined;
        this._defaultValueStack.push(undefined);
        this._inputTypeStack.push(itemType);
        break;
      }
      case Kind.OBJECT_FIELD: {
        const objectType = this.index.getNamedInputType(
          this.getCurrentInputType(),
        );
        let inputFieldType: InputTypeReference | undefined;
        let inputField: InputFieldReference | undefined;
        if (objectType != null && this.index.isInputObjectType(objectType)) {
          inputField = this.index.getInputFieldDef(objectType, node.name.value);
          if (inputField != null) {
            inputFieldType = this.index.getInputFieldType(inputField);
          }
        }
        this._defaultValueStack.push(
          this.index.getInputFieldDefaultValue(inputField),
        );
        this._inputTypeStack.push(inputFieldType);
        break;
      }
      case Kind.SCHEMA_DEFINITION:
      case Kind.SCHEMA_EXTENSION:
        this.pushDirectiveLocationForNode(DirectiveLocation.SCHEMA, node);
        break;
      case Kind.SCALAR_TYPE_DEFINITION:
      case Kind.SCALAR_TYPE_EXTENSION:
        this.pushDirectiveLocationForNode(DirectiveLocation.SCALAR, node);
        break;
      case Kind.OBJECT_TYPE_DEFINITION:
      case Kind.OBJECT_TYPE_EXTENSION:
        this.pushDirectiveLocationForNode(DirectiveLocation.OBJECT, node);
        this.pushFieldDefinitionParentTypeName(node.name.value);
        break;
      case Kind.INTERFACE_TYPE_DEFINITION:
      case Kind.INTERFACE_TYPE_EXTENSION:
        this.pushDirectiveLocationForNode(DirectiveLocation.INTERFACE, node);
        this.pushFieldDefinitionParentTypeName(node.name.value);
        break;
      case Kind.FIELD_DEFINITION: {
        this.pushDirectiveLocationForNode(
          DirectiveLocation.FIELD_DEFINITION,
          node,
        );
        const parentTypeName = this.getCurrentFieldDefinitionParentTypeName();
        this.pushInputValueDefinitionParent(
          parentTypeName == null
            ? undefined
            : {
                kind: InputValueDefinitionParentKind.ARGUMENT,
                parentName: `${parentTypeName}.${node.name.value}`,
              },
        );
        break;
      }
      case Kind.UNION_TYPE_DEFINITION:
      case Kind.UNION_TYPE_EXTENSION:
        this.pushDirectiveLocationForNode(DirectiveLocation.UNION, node);
        break;
      case Kind.ENUM_TYPE_DEFINITION:
      case Kind.ENUM_TYPE_EXTENSION:
        this.pushDirectiveLocationForNode(DirectiveLocation.ENUM, node);
        break;
      case Kind.ENUM_VALUE_DEFINITION:
        this.pushDirectiveLocationForNode(DirectiveLocation.ENUM_VALUE, node);
        break;
      case Kind.INPUT_OBJECT_TYPE_DEFINITION:
      case Kind.INPUT_OBJECT_TYPE_EXTENSION:
        this.pushDirectiveLocationForNode(DirectiveLocation.INPUT_OBJECT, node);
        this.pushInputValueDefinitionParent({
          kind: InputValueDefinitionParentKind.INPUT_FIELD,
          parentName: node.name.value,
        });
        break;
      case Kind.INPUT_VALUE_DEFINITION: {
        const inputValueRecord = this.getInputValueDefinitionRecord(node);
        this.pushInputValueDefinitionRecord(inputValueRecord);
        this.pushDirectiveLocationForNode(
          inputValueRecord?.kind === InputValueDefinitionParentKind.INPUT_FIELD
            ? DirectiveLocation.INPUT_FIELD_DEFINITION
            : DirectiveLocation.ARGUMENT_DEFINITION,
          node,
        );
        break;
      }
      case Kind.DIRECTIVE_DEFINITION:
        this.pushDirectiveLocationForNode(
          DirectiveLocation.DIRECTIVE_DEFINITION,
          node,
        );
        this.pushInputValueDefinitionParent({
          kind: InputValueDefinitionParentKind.ARGUMENT,
          parentName: `@${node.name.value}`,
        });
        break;
      case Kind.DIRECTIVE_EXTENSION:
        this.pushDirectiveLocationForNode(
          DirectiveLocation.DIRECTIVE_DEFINITION,
          node,
        );
        break;
      case Kind.ENUM: {
        const enumType = this.index.getNamedInputType(
          this.getCurrentInputType(),
        );
        this._enumValue = isEnumType(enumType)
          ? (enumType.getValue(node.value) ?? undefined)
          : undefined;
        break;
      }
      default:
        break;
    }
  }

  leave(node: ASTNode): void {
    switch (node.kind) {
      case Kind.SELECTION_SET:
        this._parentTypeStack.pop();
        break;
      case Kind.FIELD:
        this.popDirectiveLocationForNode(node);
        this._fieldDefStack.pop();
        this._typeStack.pop();
        break;
      case Kind.DIRECTIVE:
        this._directive = undefined;
        this._directiveName = undefined;
        break;
      case Kind.FRAGMENT_SPREAD:
        this.popDirectiveLocationForNode(node);
        this._fragmentSignature = undefined;
        break;
      case Kind.OPERATION_DEFINITION:
        this.popDirectiveLocationForNode(node);
        this._typeStack.pop();
        break;
      case Kind.INLINE_FRAGMENT:
        this.popDirectiveLocationForNode(node);
        this._typeStack.pop();
        break;
      case Kind.FRAGMENT_DEFINITION:
        this._fragmentDefinitionDepth -= 1;
        this.popDirectiveLocationForNode(node);
        this._typeStack.pop();
        break;
      case Kind.VARIABLE_DEFINITION:
        this.popDirectiveLocationForNode(node);
        this._inputTypeStack.pop();
        break;
      case Kind.ARGUMENT:
        this._argument = undefined;
        this._defaultValueStack.pop();
        this._inputTypeStack.pop();
        break;
      case Kind.FRAGMENT_ARGUMENT:
        this._fragmentArgument = undefined;
        this._defaultValueStack.pop();
        this._inputTypeStack.pop();
        break;
      case Kind.LIST:
      case Kind.OBJECT_FIELD:
        this._defaultValueStack.pop();
        this._inputTypeStack.pop();
        break;
      case Kind.SCHEMA_DEFINITION:
      case Kind.SCHEMA_EXTENSION:
      case Kind.SCALAR_TYPE_DEFINITION:
      case Kind.SCALAR_TYPE_EXTENSION:
      case Kind.UNION_TYPE_DEFINITION:
      case Kind.UNION_TYPE_EXTENSION:
      case Kind.ENUM_TYPE_DEFINITION:
      case Kind.ENUM_TYPE_EXTENSION:
      case Kind.ENUM_VALUE_DEFINITION:
      case Kind.DIRECTIVE_EXTENSION:
        this.popDirectiveLocationForNode(node);
        break;
      case Kind.OBJECT_TYPE_DEFINITION:
      case Kind.OBJECT_TYPE_EXTENSION:
      case Kind.INTERFACE_TYPE_DEFINITION:
      case Kind.INTERFACE_TYPE_EXTENSION:
        this.popFieldDefinitionParentTypeName();
        this.popDirectiveLocationForNode(node);
        break;
      case Kind.FIELD_DEFINITION:
        this.popInputValueDefinitionParent();
        this.popDirectiveLocationForNode(node);
        break;
      case Kind.INPUT_OBJECT_TYPE_DEFINITION:
      case Kind.INPUT_OBJECT_TYPE_EXTENSION:
        this.popInputValueDefinitionParent();
        this.popDirectiveLocationForNode(node);
        break;
      case Kind.INPUT_VALUE_DEFINITION:
        this.popDirectiveLocationForNode(node);
        this.popInputValueDefinitionRecord();
        break;
      case Kind.DIRECTIVE_DEFINITION:
        this.popInputValueDefinitionParent();
        this.popDirectiveLocationForNode(node);
        break;
      case Kind.ENUM:
        this._enumValue = undefined;
        break;
      default:
        break;
    }
  }

  getCurrentType(): OutputTypeReference | undefined {
    return this._typeStack[this._typeStack.length - 1];
  }

  getCurrentParentType(): CompositeTypeReference | undefined {
    return this._parentTypeStack[this._parentTypeStack.length - 1];
  }

  getCurrentInputType(): InputTypeReference | undefined {
    return this._inputTypeStack[this._inputTypeStack.length - 1];
  }

  getCurrentParentInputType(): InputTypeReference | undefined {
    return this._inputTypeStack[this._inputTypeStack.length - 2];
  }

  getCurrentFieldDef(): FieldReference | undefined {
    return this._fieldDefStack[this._fieldDefStack.length - 1];
  }

  getCurrentDefaultValue(): unknown {
    return this._defaultValueStack[this._defaultValueStack.length - 1];
  }

  getCurrentDirective(): GraphQLDirective | undefined {
    return this._directive;
  }

  getCurrentDirectiveLocation(): DirectiveLocation | undefined {
    return this._directiveLocation;
  }

  getCurrentArgument(): ArgumentReference | undefined {
    return this._argument;
  }

  getCurrentInputValueDefinitionRecord():
    | InputValueDefinitionRecord
    | undefined {
    return this._inputValueDefinitionRecord;
  }

  getCurrentFieldDefinitionParentTypeName(): string | undefined {
    return this._fieldDefinitionParentTypeName;
  }

  getCurrentFragmentSignature(): FragmentSignature | undefined {
    return this._fragmentSignature;
  }

  getCurrentFragmentArgument(): VariableDefinitionNode | undefined {
    return this._fragmentArgument;
  }

  getCurrentEnumValue(): GraphQLEnumValue | undefined {
    return this._enumValue;
  }

  private pushDirectiveLocation(location: DirectiveLocation | undefined): void {
    this._directiveLocationStack.push(this._directiveLocation);
    this._directiveLocation = location;
  }

  private popDirectiveLocation(): void {
    this._directiveLocation = this._directiveLocationStack.pop();
  }

  private pushDirectiveLocationForNode(
    location: DirectiveLocation | undefined,
    node: ASTNode,
  ): void {
    if (hasDirectives(node)) {
      this.pushDirectiveLocation(location);
    }
  }

  private popDirectiveLocationForNode(node: ASTNode): void {
    if (hasDirectives(node)) {
      this.popDirectiveLocation();
    }
  }

  private pushInputValueDefinitionParent(
    parent: InputValueDefinitionParentRecord | undefined,
  ): void {
    this._inputValueDefinitionParentStack.push(
      this._inputValueDefinitionParent,
    );
    this._inputValueDefinitionParent = parent;
  }

  private popInputValueDefinitionParent(): void {
    this._inputValueDefinitionParent =
      this._inputValueDefinitionParentStack.pop();
  }

  private pushInputValueDefinitionRecord(
    record: InputValueDefinitionRecord | undefined,
  ): void {
    this._inputValueDefinitionRecordStack.push(
      this._inputValueDefinitionRecord,
    );
    this._inputValueDefinitionRecord = record;
  }

  private popInputValueDefinitionRecord(): void {
    this._inputValueDefinitionRecord =
      this._inputValueDefinitionRecordStack.pop();
  }

  private pushFieldDefinitionParentTypeName(typeName: string): void {
    this._fieldDefinitionParentTypeNameStack.push(
      this._fieldDefinitionParentTypeName,
    );
    this._fieldDefinitionParentTypeName = typeName;
  }

  private popFieldDefinitionParentTypeName(): void {
    this._fieldDefinitionParentTypeName =
      this._fieldDefinitionParentTypeNameStack.pop();
  }

  private getArgumentDef(argName: string): ArgumentReference | undefined {
    const directiveName = this._directiveName;
    if (directiveName != null) {
      return this.index.getDirectiveArgumentMap(directiveName)?.get(argName);
    }

    const fieldDef = this.getCurrentFieldDef();
    if (fieldDef != null) {
      const fieldArgs = this.index.getFieldArguments(fieldDef);
      if (fieldArgs == null) {
        return;
      }
      return fieldArgs.find(
        (arg) => this.index.getArgumentName(arg) === argName,
      );
    }
  }

  private getInputValueDefinitionRecord(
    inputValue: InputValueDefinitionNode,
  ): InputValueDefinitionRecord | undefined {
    const parent = this._inputValueDefinitionParent;
    if (parent == null) {
      return;
    }

    const inputValueName = inputValue.name.value;
    return {
      kind: parent.kind,
      inputValueStr:
        parent.kind === InputValueDefinitionParentKind.ARGUMENT
          ? `${parent.parentName}(${inputValueName}:)`
          : `${parent.parentName}.${inputValueName}`,
    };
  }
}

/** @internal */
export function visitWithIndexCursor(
  indexCursor: IndexCursor,
  visitor: ASTVisitor,
): ASTVisitor {
  return {
    enter(...args) {
      const node = args[0];
      indexCursor.enter(node);

      const fn = getEnterLeaveForKind(visitor, node.kind).enter;
      if (fn != null) {
        const result = fn.apply(visitor, args);
        if (result !== undefined) {
          indexCursor.leave(node);
          if (isNode(result)) {
            indexCursor.enter(result);
          }
        }
        return result;
      }
    },
    leave(...args) {
      const node = args[0];
      const fn = getEnterLeaveForKind(visitor, node.kind).leave;
      let result;
      if (fn != null) {
        result = fn.apply(visitor, args);
      }
      indexCursor.leave(node);
      return result;
    },
  };
}

function hasDirectives(node: ASTNode): boolean {
  return (
    'directives' in node &&
    node.directives != null &&
    node.directives.length !== 0
  );
}

function getDirectiveLocationForOperation(
  operation: OperationTypeNode,
): DirectiveLocation {
  switch (operation) {
    case 'query':
      return DirectiveLocation.QUERY;
    case 'mutation':
      return DirectiveLocation.MUTATION;
    case 'subscription':
      return DirectiveLocation.SUBSCRIPTION;
  }
}

/** @internal */
export function getNamedTypeName(typeNode: TypeNode): string {
  let namedType = typeNode;
  while (
    namedType.kind === Kind.LIST_TYPE ||
    namedType.kind === Kind.NON_NULL_TYPE
  ) {
    namedType = namedType.type;
  }
  return namedType.name.value;
}
