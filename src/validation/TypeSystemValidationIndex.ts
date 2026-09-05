/** @category Validation */

import { didYouMean } from '../jsutils/didYouMean.ts';
import { invariant } from '../jsutils/invariant.ts';
import type { Maybe } from '../jsutils/Maybe.ts';
import { naturalCompare } from '../jsutils/naturalCompare.ts';
import { suggestionList } from '../jsutils/suggestionList.ts';

import { GraphQLError } from '../error/GraphQLError.ts';

import type {
  ASTNode,
  DocumentNode,
  FieldDefinitionNode,
  ListTypeNode,
  NamedTypeNode,
  NonNullTypeNode,
  OperationTypeNode,
  TypeNode,
  ValueNode,
} from '../language/ast.ts';
import { OperationTypeNode as OperationType } from '../language/ast.ts';
import { Kind } from '../language/kinds.ts';
import { isTypeDefinitionNode } from '../language/predicates.ts';
import { print } from '../language/printer.ts';

import type {
  GraphQLArgument,
  GraphQLCompositeType,
  GraphQLDefaultInput,
  GraphQLEnumType,
  GraphQLEnumValue,
  GraphQLField,
  GraphQLInputField,
  GraphQLInputObjectType,
  GraphQLInputType,
  GraphQLInterfaceType,
  GraphQLLeafType,
  GraphQLList,
  GraphQLNamedType,
  GraphQLNonNull,
  GraphQLNullableInputType,
  GraphQLObjectType,
  GraphQLOutputType,
  GraphQLScalarType,
  GraphQLSchemaElement,
  GraphQLType,
  GraphQLUnionType,
} from '../type/definition.ts';
import {
  getNamedType,
  isAbstractType as isGraphQLAbstractType,
  isCompositeType as isGraphQLCompositeType,
  isEnumType,
  isInputField,
  isInputObjectType as isGraphQLInputObjectType,
  isInputType,
  isInterfaceType,
  isLeafType,
  isListType as isGraphQLListType,
  isNamedType,
  isNonNullType as isGraphQLNonNullType,
  isObjectType,
  isOutputType,
  isRequiredInputField,
  isScalarType,
  isUnionType,
} from '../type/definition.ts';
import type { GraphQLDirective } from '../type/directives.ts';
import {
  GraphQLDeprecatedDirective,
  GraphQLOneOfDirective,
  GraphQLSpecifiedByDirective,
  isDirective,
  specifiedDirectives,
} from '../type/directives.ts';
import {
  introspectionTypes,
  SchemaMetaFieldDef,
  TypeMetaFieldDef,
  TypeNameMetaFieldDef,
} from '../type/introspection.ts';
import { specifiedScalarTypes } from '../type/scalars.ts';
import type { GraphQLSchema } from '../type/schema.ts';

import type { FragmentVariableValues } from '../execution/collectFields.ts';
import type { VariableValues } from '../execution/values.ts';

import { replaceVariables } from '../utilities/replaceVariables.ts';
import { doTypesOverlap as doGraphQLTypesOverlap } from '../utilities/typeComparators.ts';
import { typeFromAST } from '../utilities/typeFromAST.ts';
import type {
  ConstInputSchema,
  InputFieldRecord,
  InputTypeRecord,
} from '../utilities/validateInputLiteralWithConstInputSchema.ts';
import { validateInputLiteralWithConstInputSchema } from '../utilities/validateInputLiteralWithConstInputSchema.ts';

import type {
  ArgumentReference,
  DirectiveArgumentReferenceMap,
  DocumentIndex,
  DocumentTypeKindName,
  FieldReference,
  InputFieldReference,
  RootOperationTypeRecord,
  TypeElementKindName,
  TypeSystemValidationErrorRecord,
} from './DocumentIndex.ts';
import { DocumentTypeKind, TypeElementKind } from './DocumentIndex.ts';

export {
  DocumentTypeKind,
  DocumentIndex,
  TypeElementKind,
} from './DocumentIndex.ts';
export type {
  ArgumentReference,
  DirectiveArgumentReferenceMap,
  DocumentImplementedTypeRecord,
  DocumentInputObjectTypeNodeRecord,
  DocumentTypeKindName,
  FieldReference,
  FragmentSignature,
  InputFieldReference,
  RootOperationTypeRecord,
  TypeElementKindName,
  TypeSystemValidationErrorRecord,
} from './DocumentIndex.ts';

/** @internal */
export type TypeReference = GraphQLType | TypeNode;
/** @internal */
export type InputTypeReference = GraphQLInputType | TypeNode;
/** @internal */
export type OutputTypeReference = GraphQLOutputType | TypeNode;
/** @internal */
export type CompositeTypeReference = GraphQLCompositeType | NamedTypeNode;

type NonNullInputTypeReference =
  | GraphQLNonNull<GraphQLNullableInputType>
  | NonNullTypeNode;
type ListInputTypeReference = GraphQLList<GraphQLInputType> | ListTypeNode;
type InputObjectTypeReference = GraphQLInputObjectType | NamedTypeNode;
type LeafInputTypeReference = GraphQLLeafType | NamedTypeNode;
type InputTypeReferenceRecord = InputTypeRecord<
  InputTypeReference,
  InputFieldReference,
  NonNullInputTypeReference,
  ListInputTypeReference,
  InputObjectTypeReference,
  LeafInputTypeReference
>;
type InputFieldReferenceRecord = InputFieldRecord<InputTypeReference>;

const builtInTypeMap = new Map(
  [...specifiedScalarTypes, ...introspectionTypes].map((type) => [
    type.name,
    type,
  ]),
);
const specifiedScalarTypeNames = new Set(
  specifiedScalarTypes.map((type) => type.name),
);
/** @internal */
export interface SchemaRootTypeRecord {
  readonly rootType: unknown;
  readonly operation: OperationTypeNode;
}

/** @internal */
export interface SchemaObjectTypeRecord {
  readonly type: GraphQLObjectType;
  readonly fields: ReadonlyArray<GraphQLField<unknown, unknown>>;
}

/** @internal */
export interface SchemaInterfaceTypeRecord {
  readonly type: GraphQLInterfaceType;
  readonly fields: ReadonlyArray<GraphQLField<unknown, unknown>>;
}

/** @internal */
export interface SchemaUnionTypeRecord {
  readonly type: GraphQLUnionType;
  readonly memberTypes: ReadonlyArray<unknown>;
}

/** @internal */
export interface SchemaEnumTypeRecord {
  readonly type: GraphQLEnumType;
  readonly values: ReadonlyArray<GraphQLEnumValue>;
}

/** @internal */
export interface SchemaInputObjectTypeRecord {
  readonly type: GraphQLInputObjectType;
  readonly fields: ReadonlyArray<GraphQLInputField>;
}

/** @internal */
export interface SchemaFieldRecord {
  readonly field: GraphQLField<unknown, unknown>;
  readonly parentType: GraphQLObjectType | GraphQLInterfaceType;
}

/** @internal */
export interface SchemaOutputTypeRecord extends SchemaFieldRecord {
  readonly outputType: GraphQLOutputType;
}

/** @internal */
export interface SchemaInputValueRecord {
  readonly inputType: GraphQLInputType;
  readonly inputValue: SchemaInputValue;
  readonly parentElement:
    | GraphQLField<unknown, unknown>
    | GraphQLDirective
    | GraphQLInputObjectType;
  readonly parentType: GraphQLObjectType | GraphQLInterfaceType | undefined;
}

/** @internal */
export interface SchemaDefaultValueRecord extends Omit<
  SchemaInputValueRecord,
  'inputType'
> {
  readonly defaultInput: GraphQLDefaultInput;
}

/** @internal */
export interface SchemaDeprecationRecord {
  readonly element: SchemaInputValue | GraphQLField<unknown, unknown>;
  readonly parentElement:
    | GraphQLDirective
    | GraphQLField<unknown, unknown>
    | GraphQLInputObjectType
    | GraphQLObjectType
    | GraphQLInterfaceType;
}

/** @internal */
export interface SchemaUnionMemberRecord {
  readonly memberType: unknown;
  readonly union: GraphQLUnionType;
}

/** @internal */
export interface SchemaDirectiveLocationsRecord {
  readonly locations: ReadonlyArray<string>;
  readonly directive: GraphQLDirective;
}

/** @internal */
export interface SchemaDirectiveUsageRecord {
  readonly name: string;
  readonly element: GraphQLSchema | GraphQLSchemaElement;
}

/** @internal */
export interface SchemaInvalidNamedTypeRecord {
  readonly type: unknown;
}

/** @internal */
export interface SchemaInvalidDirectiveRecord {
  readonly directive: unknown;
}

/** @internal */
export interface SchemaValidationElements {
  readonly rootTypes: ReadonlyArray<SchemaRootTypeRecord>;
  readonly scalarTypes: ReadonlyArray<GraphQLScalarType>;
  readonly objectTypes: ReadonlyArray<SchemaObjectTypeRecord>;
  readonly interfaceTypes: ReadonlyArray<SchemaInterfaceTypeRecord>;
  readonly unionTypes: ReadonlyArray<SchemaUnionTypeRecord>;
  readonly enumTypes: ReadonlyArray<SchemaEnumTypeRecord>;
  readonly inputObjectTypes: ReadonlyArray<SchemaInputObjectTypeRecord>;
  readonly directives: ReadonlyArray<GraphQLDirective>;
  readonly directiveLocations: ReadonlyArray<SchemaDirectiveLocationsRecord>;
  readonly namedElements: ReadonlyArray<SchemaNamedElement>;
  readonly outputTypes: ReadonlyArray<SchemaOutputTypeRecord>;
  readonly inputValues: ReadonlyArray<SchemaInputValueRecord>;
  readonly defaultValues: ReadonlyArray<SchemaDefaultValueRecord>;
  readonly deprecations: ReadonlyArray<SchemaDeprecationRecord>;
  readonly unionMembers: ReadonlyArray<SchemaUnionMemberRecord>;
  readonly directiveUsages: ReadonlyArray<SchemaDirectiveUsageRecord>;
  readonly invalidNamedTypes: ReadonlyArray<SchemaInvalidNamedTypeRecord>;
  readonly invalidDirectives: ReadonlyArray<SchemaInvalidDirectiveRecord>;
}

/** @internal */
export type SchemaNamedElement =
  | GraphQLNamedType
  | GraphQLDirective
  | GraphQLField<unknown, unknown>
  | GraphQLArgument
  | GraphQLEnumValue
  | GraphQLInputField;

/** @internal */
export type SchemaInputValue = GraphQLArgument | GraphQLInputField;

const emptySchemaValidationElements: SchemaValidationElements = {
  rootTypes: [],
  scalarTypes: [],
  objectTypes: [],
  interfaceTypes: [],
  unionTypes: [],
  enumTypes: [],
  inputObjectTypes: [],
  directives: [],
  directiveLocations: [],
  namedElements: [],
  outputTypes: [],
  inputValues: [],
  defaultValues: [],
  deprecations: [],
  unionMembers: [],
  directiveUsages: [],
  invalidNamedTypes: [],
  invalidDirectives: [],
};

const operationTypes = Object.values(OperationType);

/** @internal */
export class TypeSystemValidationIndex implements ConstInputSchema<
  InputTypeReference,
  InputFieldReference,
  NonNullInputTypeReference,
  ListInputTypeReference,
  InputObjectTypeReference,
  LeafInputTypeReference
> {
  readonly document: DocumentNode;
  readonly schema: GraphQLSchema | undefined;
  readonly documentIndex: DocumentIndex;
  readonly hasDocumentTypeSystemDefinitions: boolean;
  readonly hasDocumentRootOperationTypeDefinitions: boolean;
  _typeNameList: ReadonlyArray<string> | undefined;
  _objectTypeNameList: ReadonlyArray<string> | undefined;
  _implementedInterfaceNamesByTypeName: Map<string, ReadonlySet<string>> =
    new Map<string, ReadonlySet<string>>();
  readonly hideSuggestions: Maybe<boolean>;
  readonly includeExistingSchemaErrors: boolean;
  readonly hasDocumentDefinitions: boolean;
  private _schemaValidationElements: SchemaValidationElements | undefined;
  private _inputTypeReferenceCache:
    | Map<InputTypeReference, InputTypeReferenceRecord>
    | undefined;
  private _inputFieldReferenceCache:
    | Map<InputFieldReference, InputFieldReferenceRecord>
    | undefined;
  private _schemaTypeReferenceCache:
    | Map<TypeNode, GraphQLType | undefined>
    | undefined;
  private _rootOperationTypes:
    | Map<OperationTypeNode, RootOperationTypeRecord>
    | undefined;
  private _directiveLocationMap: Map<string, Set<string>> | undefined;
  private _directiveNameList: ReadonlyArray<string> | undefined;
  private _directiveRepeatableMap: Map<string, boolean> | undefined;
  private _directiveArgumentMap:
    | Map<string, DirectiveArgumentReferenceMap>
    | undefined;
  private _uniqueTypeDefinitionErrors:
    | ReadonlyArray<TypeSystemValidationErrorRecord>
    | undefined;
  private _uniqueFieldDefinitionErrors:
    | ReadonlyArray<TypeSystemValidationErrorRecord>
    | undefined;
  private _uniqueEnumValueDefinitionErrors:
    | ReadonlyArray<TypeSystemValidationErrorRecord>
    | undefined;
  private _uniqueUnionMemberTypeErrors:
    | ReadonlyArray<TypeSystemValidationErrorRecord>
    | undefined;
  private _uniqueDirectiveDefinitionErrors:
    | ReadonlyArray<TypeSystemValidationErrorRecord>
    | undefined;
  private readonly _onError: ((error: GraphQLError) => void) | undefined;

  constructor(
    documentIndex: DocumentIndex,
    schema: Maybe<GraphQLSchema>,
    onError?: (error: GraphQLError) => void,
    hideSuggestions?: Maybe<boolean>,
    includeExistingSchemaErrors = false,
  ) {
    this.schema = schema ?? undefined;
    this.documentIndex = documentIndex;
    this.document = this.documentIndex.document;
    this._onError = onError;
    this.hideSuggestions = hideSuggestions;
    this.includeExistingSchemaErrors = includeExistingSchemaErrors;
    this.hasDocumentDefinitions = this.documentIndex.hasDocumentDefinitions;
    this._typeNameList = undefined;
    this._objectTypeNameList = undefined;
    this.hasDocumentTypeSystemDefinitions =
      this.documentIndex.hasTypeSystemDefinitions;
    this.hasDocumentRootOperationTypeDefinitions =
      this.documentIndex.hasRootOperationTypeDefinitions;
  }

  reportError(
    message: string,
    nodes?: ReadonlyArray<Maybe<ASTNode>> | Maybe<ASTNode>,
  ): void {
    invariant(this._onError != null);
    const errorNodes: Maybe<ASTNode> | ReadonlyArray<ASTNode> = Array.isArray(
      nodes,
    )
      ? filterASTNodes(nodes as ReadonlyArray<Maybe<ASTNode>>)
      : (nodes as Maybe<ASTNode>);
    this._onError(new GraphQLError(message, { nodes: errorNodes }));
  }

  reportGraphQLError(error: GraphQLError): void {
    invariant(this._onError != null);
    this._onError(error);
  }

  getSchemaValidationElements(): SchemaValidationElements {
    if (!this.shouldValidateSchemaOnlyElements()) {
      return emptySchemaValidationElements;
    }
    invariant(this.schema != null);
    let schemaValidationElements = this._schemaValidationElements;
    if (schemaValidationElements === undefined) {
      schemaValidationElements = collectSchemaValidationElements(this.schema);
      this._schemaValidationElements = schemaValidationElements;
    }
    return schemaValidationElements;
  }

  getTypeNames(): ReadonlyArray<string> {
    if (this.schema == null) {
      if (this._typeNameList !== undefined) {
        return this._typeNameList;
      }

      const typeNames: Array<string> = [];
      const seenTypeNames = new Set<string>();
      addBuiltInTypeNames(typeNames, seenTypeNames);
      for (const [
        typeName,
        kinds,
      ] of this.documentIndex.getDocumentTypeKindMap()) {
        if (kinds.size !== 0 && !seenTypeNames.has(typeName)) {
          typeNames.push(typeName);
          seenTypeNames.add(typeName);
        }
      }
      return (this._typeNameList = typeNames);
    }
    if (this._typeNameList !== undefined) {
      return this._typeNameList;
    }

    const typeNames = [];
    const seenTypeNames = new Set<string>();
    const schemaTypeMap = this.schema.getTypeMap();
    for (const typeName in schemaTypeMap) {
      if (!Object.hasOwn(schemaTypeMap, typeName)) {
        continue;
      }
      typeNames.push(typeName);
      seenTypeNames.add(typeName);
    }
    addBuiltInTypeNames(typeNames, seenTypeNames);
    for (const [
      typeName,
      kinds,
    ] of this.documentIndex.getDocumentTypeKindMap()) {
      if (kinds.size !== 0 && !seenTypeNames.has(typeName)) {
        typeNames.push(typeName);
      }
    }
    return (this._typeNameList = typeNames);
  }

  getExecutableTypeNames(): ReadonlyArray<string> {
    if (this.hasDocumentTypeSystemDefinitions) {
      return this.getTypeNames();
    }
    const typeMap = this.schema?.getTypeMap();
    if (typeMap == null) {
      return [];
    }
    return Object.keys(typeMap);
  }

  getValidationTypeNames(): ReadonlyArray<string> {
    return this.shouldValidateSchemaOnlyElements()
      ? this.getTypeNames()
      : this.documentIndex.getDocumentTypeNames();
  }

  shouldRunTypeSystemValidationRules(): boolean {
    return (
      this.hasDocumentTypeSystemDefinitions ||
      this.includeExistingSchemaErrors ||
      this.schema == null
    );
  }

  shouldValidateSchemaOnlyElements(): boolean {
    return (
      this.schema != null &&
      (!this.hasDocumentDefinitions || this.includeExistingSchemaErrors)
    );
  }

  getRootOperationTypes(): ReadonlyMap<
    OperationTypeNode,
    RootOperationTypeRecord
  > {
    const schema = this.schema;
    if (schema == null) {
      return this.documentIndex.getDocumentRootOperationTypes();
    }

    let rootOperationTypes = this._rootOperationTypes;
    if (rootOperationTypes !== undefined) {
      return rootOperationTypes;
    }

    rootOperationTypes = new Map();
    for (const operation of operationTypes) {
      const rootType = schema.getRootType(operation);
      if (rootType != null) {
        rootOperationTypes.set(operation, {
          typeName: rootType.name,
          node: undefined,
        });
      }
    }
    for (const [
      operation,
      rootOperationType,
    ] of this.documentIndex.getExplicitDocumentRootOperationTypes()) {
      rootOperationTypes.set(operation, rootOperationType);
    }
    this._rootOperationTypes = rootOperationTypes;
    return rootOperationTypes;
  }

  getDirectiveArgumentMap(
    directiveName: string,
  ): DirectiveArgumentReferenceMap | undefined {
    this.collectDirectiveDefinitions();
    const directiveArgumentMap = this._directiveArgumentMap as Map<
      string,
      DirectiveArgumentReferenceMap
    >;
    return directiveArgumentMap.get(directiveName);
  }

  getDirectiveLocationSet(
    directiveName: string,
  ): ReadonlySet<string> | undefined {
    this.collectDirectiveDefinitions();
    const directiveLocationMap = this._directiveLocationMap as Map<
      string,
      Set<string>
    >;
    return directiveLocationMap.get(directiveName);
  }

  getDirectiveNames(): ReadonlyArray<string> {
    this.collectDirectiveDefinitions();
    if (this._directiveNameList !== undefined) {
      return this._directiveNameList;
    }
    const directiveLocationMap = this._directiveLocationMap as Map<
      string,
      ReadonlySet<string>
    >;
    return (this._directiveNameList = Array.from(directiveLocationMap.keys()));
  }

  isDirectiveRepeatable(directiveName: string): boolean | undefined {
    this.collectDirectiveDefinitions();
    const directiveRepeatableMap = this._directiveRepeatableMap as Map<
      string,
      boolean
    >;
    return directiveRepeatableMap.get(directiveName);
  }

  getUniqueTypeDefinitionErrors(): ReadonlyArray<TypeSystemValidationErrorRecord> {
    if (this._uniqueTypeDefinitionErrors !== undefined) {
      return this._uniqueTypeDefinitionErrors;
    }
    const documentErrors = this.documentIndex.getUniqueTypeDefinitionErrors();
    const schema = this.schema;
    if (schema == null) {
      return (this._uniqueTypeDefinitionErrors = documentErrors);
    }

    let schemaErrors: Array<TypeSystemValidationErrorRecord> | undefined;
    let schemaConflictTypeNames: Set<string> | undefined;
    for (const definition of this.document.definitions) {
      if (!isTypeDefinitionNode(definition)) {
        continue;
      }
      const typeName = definition.name.value;
      if (
        !specifiedScalarTypeNames.has(typeName) &&
        schema.getType(typeName) != null
      ) {
        schemaConflictTypeNames ??= new Set();
        schemaConflictTypeNames.add(typeName);
        (schemaErrors ??= []).push({
          message: `Type "${typeName}" already exists in the schema. It cannot also be defined in this type definition.`,
          nodes: definition.name,
        });
      }
    }
    const filteredDocumentErrors =
      schemaConflictTypeNames === undefined
        ? documentErrors
        : filterValidationErrorRecords(documentErrors, (error) =>
            error.typeName == null
              ? false
              : schemaConflictTypeNames.has(error.typeName),
          );
    return (this._uniqueTypeDefinitionErrors = mergeValidationErrorRecords(
      filteredDocumentErrors,
      schemaErrors,
    ));
  }

  getUniqueFieldDefinitionErrors(): ReadonlyArray<TypeSystemValidationErrorRecord> {
    if (this._uniqueFieldDefinitionErrors !== undefined) {
      return this._uniqueFieldDefinitionErrors;
    }
    const documentErrors = this.documentIndex.getUniqueFieldDefinitionErrors();
    const schema = this.schema;
    if (schema == null) {
      return (this._uniqueFieldDefinitionErrors = documentErrors);
    }

    let schemaErrors: Array<TypeSystemValidationErrorRecord> | undefined;
    let schemaConflictFieldNames: Set<string> | undefined;
    for (const definition of this.document.definitions) {
      switch (definition.kind) {
        case Kind.OBJECT_TYPE_DEFINITION:
        case Kind.OBJECT_TYPE_EXTENSION:
        case Kind.INTERFACE_TYPE_DEFINITION:
        case Kind.INTERFACE_TYPE_EXTENSION: {
          const typeName = definition.name.value;
          const schemaType = schema.getType(typeName);
          if (isObjectType(schemaType) || isInterfaceType(schemaType)) {
            const schemaFields = schemaType.getFields();
            const fields = definition.fields;
            if (fields != null) {
              for (const field of fields) {
                const fieldName = field.name.value;
                if (schemaFields[fieldName] != null) {
                  (schemaConflictFieldNames ??= new Set()).add(
                    getElementKey(typeName, fieldName),
                  );
                  (schemaErrors ??= []).push({
                    message: `Field "${typeName}.${fieldName}" already exists in the schema. It cannot also be defined in this type extension.`,
                    nodes: field.name,
                  });
                }
              }
            }
          }
          break;
        }
        case Kind.INPUT_OBJECT_TYPE_DEFINITION:
        case Kind.INPUT_OBJECT_TYPE_EXTENSION: {
          const typeName = definition.name.value;
          const schemaType = schema.getType(typeName);
          if (isGraphQLInputObjectType(schemaType)) {
            const schemaFields = schemaType.getFields();
            const fields = definition.fields;
            if (fields != null) {
              for (const field of fields) {
                const fieldName = field.name.value;
                if (schemaFields[fieldName] != null) {
                  (schemaConflictFieldNames ??= new Set()).add(
                    getElementKey(typeName, fieldName),
                  );
                  (schemaErrors ??= []).push({
                    message: `Field "${typeName}.${fieldName}" already exists in the schema. It cannot also be defined in this type extension.`,
                    nodes: field.name,
                  });
                }
              }
            }
          }
          break;
        }
        default:
          break;
      }
    }
    const filteredDocumentErrors =
      schemaConflictFieldNames === undefined
        ? documentErrors
        : filterValidationErrorRecords(documentErrors, (error) =>
            schemaConflictFieldNames.has(
              getElementKey(
                error.typeName as string,
                error.elementName as string,
              ),
            ),
          );
    return (this._uniqueFieldDefinitionErrors = mergeValidationErrorRecords(
      filteredDocumentErrors,
      schemaErrors,
    ));
  }

  getUniqueEnumValueDefinitionErrors(): ReadonlyArray<TypeSystemValidationErrorRecord> {
    if (this._uniqueEnumValueDefinitionErrors !== undefined) {
      return this._uniqueEnumValueDefinitionErrors;
    }
    const documentErrors =
      this.documentIndex.getUniqueEnumValueDefinitionErrors();
    const schema = this.schema;
    if (schema == null) {
      return (this._uniqueEnumValueDefinitionErrors = documentErrors);
    }

    let schemaErrors: Array<TypeSystemValidationErrorRecord> | undefined;
    let schemaConflictEnumValueNames: Set<string> | undefined;
    for (const definition of this.document.definitions) {
      if (
        definition.kind !== Kind.ENUM_TYPE_DEFINITION &&
        definition.kind !== Kind.ENUM_TYPE_EXTENSION
      ) {
        continue;
      }
      const typeName = definition.name.value;
      const schemaType = schema.getType(typeName);
      if (!isEnumType(schemaType)) {
        continue;
      }
      const values = definition.values;
      if (values == null) {
        continue;
      }
      for (const value of values) {
        const valueName = value.name.value;
        if (schemaType.getValue(valueName) != null) {
          (schemaConflictEnumValueNames ??= new Set()).add(
            getElementKey(typeName, valueName),
          );
          (schemaErrors ??= []).push({
            message: `Enum value "${typeName}.${valueName}" already exists in the schema. It cannot also be defined in this type extension.`,
            nodes: value.name,
          });
        }
      }
    }
    const filteredDocumentErrors =
      schemaConflictEnumValueNames === undefined
        ? documentErrors
        : filterValidationErrorRecords(documentErrors, (error) =>
            schemaConflictEnumValueNames.has(
              getElementKey(
                error.typeName as string,
                error.elementName as string,
              ),
            ),
          );
    return (this._uniqueEnumValueDefinitionErrors = mergeValidationErrorRecords(
      filteredDocumentErrors,
      schemaErrors,
    ));
  }

  getUniqueUnionMemberTypeErrors(): ReadonlyArray<TypeSystemValidationErrorRecord> {
    if (this._uniqueUnionMemberTypeErrors !== undefined) {
      return this._uniqueUnionMemberTypeErrors;
    }
    const documentErrors = this.documentIndex.getUniqueUnionMemberTypeErrors();
    const schema = this.schema;
    if (schema == null) {
      return (this._uniqueUnionMemberTypeErrors = documentErrors);
    }

    let schemaErrors: Array<TypeSystemValidationErrorRecord> | undefined;
    let schemaConflictUnionMemberNames: Set<string> | undefined;
    for (const definition of this.document.definitions) {
      if (
        definition.kind !== Kind.UNION_TYPE_DEFINITION &&
        definition.kind !== Kind.UNION_TYPE_EXTENSION
      ) {
        continue;
      }
      const typeName = definition.name.value;
      const schemaType = schema.getType(typeName);
      if (!isUnionType(schemaType)) {
        continue;
      }
      const memberTypes = definition.types;
      if (memberTypes == null) {
        continue;
      }
      for (const memberType of memberTypes) {
        const memberTypeName = memberType.name.value;
        if (
          schemaType
            .getTypes()
            .some((schemaMember) => schemaMember.name === memberTypeName)
        ) {
          (schemaConflictUnionMemberNames ??= new Set()).add(
            getElementKey(typeName, memberTypeName),
          );
          (schemaErrors ??= []).push({
            message: `Union type ${typeName} can only include type ${memberTypeName} once.`,
            nodes: memberType,
          });
        }
      }
    }
    const filteredDocumentErrors =
      schemaConflictUnionMemberNames === undefined
        ? documentErrors
        : filterValidationErrorRecords(documentErrors, (error) =>
            schemaConflictUnionMemberNames.has(
              getElementKey(
                error.typeName as string,
                error.elementName as string,
              ),
            ),
          );
    return (this._uniqueUnionMemberTypeErrors = mergeValidationErrorRecords(
      filteredDocumentErrors,
      schemaErrors,
    ));
  }

  getUniqueDirectiveDefinitionErrors(): ReadonlyArray<TypeSystemValidationErrorRecord> {
    if (this._uniqueDirectiveDefinitionErrors !== undefined) {
      return this._uniqueDirectiveDefinitionErrors;
    }
    const documentErrors =
      this.documentIndex.getUniqueDirectiveDefinitionErrors();
    const schema = this.schema;
    if (schema == null) {
      return (this._uniqueDirectiveDefinitionErrors = documentErrors);
    }

    let schemaErrors: Array<TypeSystemValidationErrorRecord> | undefined;
    let schemaConflictDirectiveNames: Set<string> | undefined;
    for (const definition of this.document.definitions) {
      if (definition.kind !== Kind.DIRECTIVE_DEFINITION) {
        continue;
      }
      const directiveName = definition.name.value;
      if (schema.getDirective(directiveName) != null) {
        (schemaConflictDirectiveNames ??= new Set()).add(directiveName);
        (schemaErrors ??= []).push({
          message: `Directive "@${directiveName}" already exists in the schema. It cannot be redefined.`,
          nodes: definition.name,
        });
      }
    }
    const filteredDocumentErrors =
      schemaConflictDirectiveNames === undefined
        ? documentErrors
        : filterValidationErrorRecords(documentErrors, (error) =>
            schemaConflictDirectiveNames.has(error.directiveName as string),
          );
    return (this._uniqueDirectiveDefinitionErrors = mergeValidationErrorRecords(
      filteredDocumentErrors,
      schemaErrors,
    ));
  }

  getObjectTypeNames(): ReadonlyArray<string> {
    if (this._objectTypeNameList !== undefined) {
      return this._objectTypeNameList;
    }

    const objectTypeNames: Array<string> = [];
    const schemaTypeMap = this.schema?.getTypeMap();
    if (schemaTypeMap != null) {
      for (const typeName in schemaTypeMap) {
        if (!Object.hasOwn(schemaTypeMap, typeName)) {
          continue;
        }
        if (isObjectType(schemaTypeMap[typeName])) {
          objectTypeNames.push(typeName);
        }
      }
    }
    for (const [
      typeName,
      kinds,
    ] of this.documentIndex.getDocumentTypeKindMap()) {
      if (
        kinds.has(DocumentTypeKind.OBJECT) &&
        schemaTypeMap?.[typeName] == null
      ) {
        objectTypeNames.push(typeName);
      }
    }
    return (this._objectTypeNameList = objectTypeNames);
  }

  isInputType(typeNode: TypeNode): boolean {
    return this.hasInputType(typeNode);
  }

  hasNonInputType(typeNode: TypeNode): boolean {
    switch (typeNode.kind) {
      case Kind.LIST_TYPE:
      case Kind.NON_NULL_TYPE:
        return this.hasNonInputType(typeNode.type);
      case Kind.NAMED_TYPE:
        return this.hasNonInputTypeName(typeNode.name.value);
    }
  }

  isOutputType(typeNode: TypeNode): boolean {
    return this.hasOutputType(typeNode);
  }

  hasNonOutputType(typeNode: TypeNode): boolean {
    switch (typeNode.kind) {
      case Kind.LIST_TYPE:
      case Kind.NON_NULL_TYPE:
        return this.hasNonOutputType(typeNode.type);
      case Kind.NAMED_TYPE:
        return this.hasNonOutputTypeName(typeNode.name.value);
    }
  }

  hasExecutableType(typeName: string): boolean {
    return this.hasDocumentTypeSystemDefinitions
      ? this.hasTypeName(typeName)
      : this.schema?.getType(typeName) != null;
  }

  isNonNullType(type: TypeReference): boolean {
    return isASTType(type)
      ? type.kind === Kind.NON_NULL_TYPE
      : isGraphQLNonNullType(type);
  }

  getNullableType(type: InputTypeReference): InputTypeReference;
  getNullableType(type: OutputTypeReference): OutputTypeReference;
  getNullableType(type: TypeReference): TypeReference;
  getNullableType(type: TypeReference): TypeReference {
    if (isASTType(type)) {
      invariant(type.kind === Kind.NON_NULL_TYPE);
      return type.type;
    }

    invariant(isGraphQLNonNullType(type));
    return type.ofType;
  }

  isListType(type: TypeReference): boolean {
    return isASTType(type)
      ? type.kind === Kind.LIST_TYPE
      : isGraphQLListType(type);
  }

  getListItemType(type: InputTypeReference): InputTypeReference;
  getListItemType(type: OutputTypeReference): OutputTypeReference;
  getListItemType(type: TypeReference): TypeReference;
  getListItemType(type: TypeReference): TypeReference {
    if (isASTType(type)) {
      invariant(type.kind === Kind.LIST_TYPE);
      return type.type;
    }

    invariant(isGraphQLListType(type));
    return type.ofType;
  }

  getTypeReference(typeNode: TypeNode): TypeReference | undefined {
    if (!this.hasDocumentTypeSystemDefinitions) {
      return this.getTypeFromSchema(typeNode);
    }

    const schemaType = this.getSchemaTypeForDocumentReference(typeNode);
    if (schemaType != null) {
      return schemaType;
    }

    if (!this.hasTypeName(getNamedTypeName(typeNode))) {
      return;
    }
    return typeNode;
  }

  getOutputTypeReference(typeNode: TypeNode): OutputTypeReference | undefined {
    if (!this.hasDocumentTypeSystemDefinitions) {
      const schemaType = this.getTypeFromSchema(typeNode);
      return isOutputType(schemaType) ? schemaType : undefined;
    }

    const schemaType = this.getSchemaTypeForDocumentReference(typeNode);
    if (isOutputType(schemaType)) {
      return schemaType;
    }

    if (!this.hasOutputType(typeNode)) {
      return;
    }
    return typeNode;
  }

  getRootType(
    operation: OperationTypeNode,
  ): CompositeTypeReference | undefined {
    if (this.schema != null && !this.hasDocumentRootOperationTypeDefinitions) {
      return this.schema.getRootType(operation) ?? undefined;
    }

    const rootOperationType = this.getRootOperationTypes().get(operation);
    if (rootOperationType == null) {
      return;
    }
    const rootType = this.getNamedOutputTypeByName(rootOperationType.typeName);
    return rootType != null && this.isCompositeType(rootType)
      ? rootType
      : undefined;
  }

  hasOutputType(typeNode: TypeNode): boolean {
    const schemaType = this.getSchemaTypeForDocumentReference(typeNode);
    if (schemaType != null) {
      return isOutputType(schemaType);
    }

    switch (typeNode.kind) {
      case Kind.LIST_TYPE:
      case Kind.NON_NULL_TYPE:
        return this.hasOutputType(typeNode.type);
      case Kind.NAMED_TYPE: {
        return this.hasOutputTypeName(typeNode.name.value);
      }
    }
  }

  getNamedOutputType(type: OutputTypeReference): OutputTypeReference;
  getNamedOutputType(type: undefined): undefined;
  getNamedOutputType(
    type: OutputTypeReference | undefined,
  ): OutputTypeReference | undefined;
  getNamedOutputType(
    type: OutputTypeReference | undefined,
  ): OutputTypeReference | undefined {
    if (type == null) {
      return;
    }
    if (!isASTType(type)) {
      return getNamedType(type);
    }
    let namedType = type;
    while (
      namedType.kind === Kind.LIST_TYPE ||
      namedType.kind === Kind.NON_NULL_TYPE
    ) {
      namedType = namedType.type;
    }
    return namedType;
  }

  getNamedOutputTypeByName(typeName: string): OutputTypeReference | undefined {
    const schemaType = this.getSchemaTypeForDocumentTypeName(typeName);
    if (schemaType != null && isOutputType(schemaType)) {
      return schemaType;
    }
    if (this.hasOutputTypeName(typeName)) {
      return createNamedTypeNode(typeName);
    }
  }

  getTypeName(type: TypeReference): string {
    const namedType = isASTType(type)
      ? getNamedTypeName(type)
      : getNamedType(type).name;
    return namedType;
  }

  getNullableInputType(
    type: InputTypeReference | undefined,
  ): InputTypeReference | undefined {
    if (type == null) {
      return;
    }
    if (this.isNonNullType(type)) {
      return this.getNullableType(type);
    }
    return type;
  }

  isCompositeType(type: TypeReference): type is CompositeTypeReference {
    if (!isASTType(type)) {
      return isGraphQLCompositeType(type);
    }
    if (type.kind !== Kind.NAMED_TYPE) {
      return false;
    }
    return (
      this.hasTypeKind(type.name.value, DocumentTypeKind.OBJECT) ||
      this.hasTypeKind(type.name.value, DocumentTypeKind.INTERFACE) ||
      this.hasTypeKind(type.name.value, DocumentTypeKind.UNION)
    );
  }

  isObjectType(type: OutputTypeReference): boolean {
    return isASTType(type)
      ? type.kind === Kind.NAMED_TYPE &&
          this.hasTypeKind(type.name.value, DocumentTypeKind.OBJECT)
      : isObjectType(type);
  }

  isInterfaceType(type: OutputTypeReference): boolean {
    return isASTType(type)
      ? type.kind === Kind.NAMED_TYPE &&
          this.hasTypeKind(type.name.value, DocumentTypeKind.INTERFACE)
      : isInterfaceType(type);
  }

  isUnionType(type: OutputTypeReference): boolean {
    return isASTType(type)
      ? type.kind === Kind.NAMED_TYPE &&
          this.hasTypeKind(type.name.value, DocumentTypeKind.UNION)
      : isUnionType(type);
  }

  isLeafType(type: OutputTypeReference): boolean {
    if (!isASTType(type)) {
      return isLeafType(getNamedType(type));
    }

    const namedType = this.getNamedOutputType(type);
    invariant(namedType != null);
    const typeName = this.getTypeName(namedType);
    return (
      this.hasTypeKind(typeName, DocumentTypeKind.SCALAR) ||
      this.hasTypeKind(typeName, DocumentTypeKind.ENUM)
    );
  }

  // eslint-disable-next-line max-params
  validateInputLiteral(
    valueNode: ValueNode,
    type: InputTypeReference,
    onError: (
      error: GraphQLError,
      path: ReadonlyArray<string | number>,
    ) => void,
    variables?: Maybe<VariableValues>,
    fragmentVariableValues?: Maybe<FragmentVariableValues>,
    hideSuggestions?: Maybe<boolean>,
  ): void {
    validateInputLiteralWithConstInputSchema(
      valueNode,
      type,
      this,
      onError,
      variables,
      fragmentVariableValues,
      hideSuggestions,
    );
  }

  getType(type: InputTypeReference): InputTypeReferenceRecord {
    const cachedReference = this._inputTypeReferenceCache?.get(type);
    if (cachedReference != null) {
      return cachedReference;
    }

    const typeStr = this.typeToString(type);
    let reference: InputTypeReferenceRecord;

    if (isASTType(type)) {
      switch (type.kind) {
        case Kind.NON_NULL_TYPE:
          reference = {
            kind: 'nonNull',
            type,
            typeStr,
            nullableType: type.type,
          };
          break;
        case Kind.LIST_TYPE:
          reference = { kind: 'list', type, typeStr, itemType: type.type };
          break;
        case Kind.NAMED_TYPE:
          if (this.isInputObjectType(type)) {
            reference = {
              kind: 'inputObject',
              type,
              typeStr,
              fields: this.getInputObjectFieldsForType(type),
              isOneOf: this.isOneOfInputObjectType(type),
            };
          } else {
            reference = { kind: 'leaf', type, typeStr };
          }
          break;
      }
    } else if (isGraphQLNonNullType(type)) {
      reference = {
        kind: 'nonNull',
        type,
        typeStr,
        nullableType: type.ofType,
      };
    } else if (isGraphQLListType(type)) {
      reference = { kind: 'list', type, typeStr, itemType: type.ofType };
    } else if (isGraphQLInputObjectType(type)) {
      reference = {
        kind: 'inputObject',
        type,
        typeStr,
        fields: this.getInputObjectFieldsForType(type),
        isOneOf: this.isOneOfInputObjectType(type),
      };
    } else {
      reference = { kind: 'leaf', type, typeStr };
    }

    (this._inputTypeReferenceCache ??= new Map<
      InputTypeReference,
      InputTypeReferenceRecord
    >()).set(type, reference);
    return reference;
  }

  getField(field: InputFieldReference): InputFieldReferenceRecord {
    let reference = this._inputFieldReferenceCache?.get(field);
    if (reference != null) {
      return reference;
    }

    reference = {
      name: this.getInputFieldName(field),
      type: this.getInputFieldType(field),
      isRequired: this.isRequiredInputField(field),
    };
    (this._inputFieldReferenceCache ??= new Map<
      InputFieldReference,
      InputFieldReferenceRecord
    >()).set(field, reference);
    return reference;
  }

  getInputTypeReference(typeNode: TypeNode): InputTypeReference | undefined {
    if (!this.hasDocumentTypeSystemDefinitions) {
      const schemaType = this.getTypeFromSchema(typeNode);
      return isInputType(schemaType) ? schemaType : undefined;
    }

    const schemaType = this.getSchemaTypeForDocumentReference(typeNode);
    if (isInputType(schemaType)) {
      return schemaType;
    }

    if (!this.hasInputType(typeNode)) {
      return;
    }
    return typeNode;
  }

  hasInputType(typeNode: TypeNode): boolean {
    const schemaType = this.getSchemaTypeForDocumentReference(typeNode);
    if (schemaType != null) {
      return isInputType(schemaType);
    }

    switch (typeNode.kind) {
      case Kind.LIST_TYPE:
      case Kind.NON_NULL_TYPE:
        return this.hasInputType(typeNode.type);
      case Kind.NAMED_TYPE:
        return this.hasInputTypeName(typeNode.name.value);
    }
  }

  getNamedInputType(type: InputTypeReference): InputTypeReference;
  getNamedInputType(type: undefined): undefined;
  getNamedInputType(
    type: InputTypeReference | undefined,
  ): InputTypeReference | undefined;
  getNamedInputType(
    type: InputTypeReference | undefined,
  ): InputTypeReference | undefined {
    if (type == null) {
      return;
    }
    if (!isASTType(type)) {
      return getNamedType(type);
    }
    let namedType = type;
    while (
      namedType.kind === Kind.LIST_TYPE ||
      namedType.kind === Kind.NON_NULL_TYPE
    ) {
      namedType = namedType.type;
    }
    return namedType;
  }

  getInputObjectFieldsForType(
    type: InputTypeReference,
  ): ReadonlyArray<InputFieldReference> | undefined {
    if (!isASTType(type)) {
      invariant(isGraphQLInputObjectType(type));
      if (!this.documentIndex.getDocumentTypeNameSet().has(type.name)) {
        return objectMapValues(type.getFields());
      }

      const schemaFieldMap = type.getFields();
      const schemaFields = objectMapValues(schemaFieldMap);
      const documentFields = this.getDocumentInputFields(type.name);
      if (documentFields == null) {
        return schemaFields;
      }
      if (schemaFields == null) {
        return Array.from(documentFields.values());
      }
      const fields: Array<InputFieldReference> = schemaFields;
      for (const field of documentFields.values()) {
        fields.push(field);
      }
      return fields;
    }

    invariant(type.kind === Kind.NAMED_TYPE);
    const typeName = type.name.value;
    const schemaType = this.getSchemaTypeForDocumentTypeName(typeName);
    if (isGraphQLInputObjectType(schemaType)) {
      return this.getInputObjectFieldsForType(schemaType);
    }
    const inputFields = this.getDocumentInputFields(typeName);
    return inputFields == null ? undefined : Array.from(inputFields.values());
  }

  isOneOfInputObjectType(type: InputTypeReference): boolean {
    if (!isASTType(type)) {
      invariant(isGraphQLInputObjectType(type));
      return (
        type.isOneOf ||
        (this.documentIndex.getDocumentTypeNameSet().has(type.name) &&
          this.documentIndex.isOneOfInputObjectType(type.name))
      );
    }

    invariant(type.kind === Kind.NAMED_TYPE);
    const typeName = type.name.value;
    const schemaType = this.getSchemaTypeForDocumentTypeName(typeName);
    return (
      (isGraphQLInputObjectType(schemaType) && schemaType.isOneOf) ||
      this.documentIndex.isOneOfInputObjectType(typeName)
    );
  }

  isOneOfInputObjectTypeName(typeName: string): boolean {
    const schemaType = this.getSchemaTypeForDocumentTypeName(typeName);
    return (
      (isGraphQLInputObjectType(schemaType) && schemaType.isOneOf) ||
      this.documentIndex.isOneOfInputObjectType(typeName)
    );
  }

  isInputObjectType(type: InputTypeReference): boolean {
    if (!isASTType(type)) {
      return isGraphQLInputObjectType(type);
    }

    if (type.kind !== Kind.NAMED_TYPE) {
      return false;
    }
    return this.hasTypeKind(type.name.value, DocumentTypeKind.INPUT_OBJECT);
  }

  getInputFieldName(field: InputFieldReference): string {
    return isInputField(field) ? field.name : field.name.value;
  }

  getInputFieldType(field: InputFieldReference): InputTypeReference {
    return isInputField(field)
      ? field.type
      : (this.getInputTypeReference(field.type) ?? field.type);
  }

  isRequiredInputField(field: InputFieldReference): boolean {
    return isInputField(field)
      ? isRequiredInputField(field)
      : field.type.kind === Kind.NON_NULL_TYPE && field.defaultValue == null;
  }

  coerceLeafLiteral(
    type: InputTypeReference,
    valueNode: ValueNode,
    variables: Maybe<VariableValues>,
    fragmentVariableValues: Maybe<FragmentVariableValues>,
    hideSuggestions: Maybe<boolean>,
  ): unknown {
    const enumValueNames = this.getEnumValueNames(type);
    if (enumValueNames != null) {
      if (valueNode.kind !== Kind.ENUM) {
        const valueStr = print(valueNode);
        throw new GraphQLError(
          `Enum "${this.typeToString(
            type,
          )}" cannot represent non-enum value: ${valueStr}.` +
            didYouMeanEnumValue(enumValueNames, valueStr, hideSuggestions),
          { nodes: valueNode },
        );
      }

      if (!enumValueNames.has(valueNode.value)) {
        const valueStr = print(valueNode);
        throw new GraphQLError(
          `Value "${valueStr}" does not exist in "${this.typeToString(
            type,
          )}" enum.` +
            didYouMeanEnumValue(enumValueNames, valueStr, hideSuggestions),
          { nodes: valueNode },
        );
      }
      return valueNode.value;
    }

    const leafType = this.getLeafType(type);
    // Invalid input types are reported by their own validation rules.
    if (leafType == null) {
      return null;
    }

    return leafType.coerceInputLiteral
      ? leafType.coerceInputLiteral(
          replaceVariables(valueNode, variables, fragmentVariableValues),
          hideSuggestions,
        )
      : leafType.parseLiteral(valueNode, undefined, hideSuggestions);
  }

  getEnumValueNames(
    type: InputTypeReference,
  ): ReadonlyMap<string, unknown> | undefined {
    if (!isASTType(type)) {
      const namedType = getNamedType(type);
      if (isEnumType(namedType)) {
        if (!this.documentIndex.getDocumentTypeNameSet().has(namedType.name)) {
          return;
        }

        const documentEnumValues = this.documentIndex.getDocumentEnumValues(
          namedType.name,
        );
        if (documentEnumValues != null) {
          const enumValueNames = new Map<string, unknown>();
          for (const value of namedType.getValues()) {
            enumValueNames.set(value.name, value);
          }
          for (const [valueName, value] of documentEnumValues) {
            enumValueNames.set(valueName, value);
          }
          return enumValueNames;
        }
      }
      return;
    }

    const typeName = getNamedTypeName(type);
    const schemaType = this.getSchemaTypeForDocumentTypeName(typeName);
    const enumValueNames = this.documentIndex.getDocumentEnumValues(typeName);
    if (isEnumType(schemaType) && enumValueNames == null) {
      return;
    }

    if (isEnumType(schemaType) && enumValueNames != null) {
      const mergedEnumValueNames = new Map<string, unknown>();
      for (const value of schemaType.getValues()) {
        mergedEnumValueNames.set(value.name, value);
      }
      for (const [valueName, value] of enumValueNames) {
        mergedEnumValueNames.set(valueName, value);
      }
      return mergedEnumValueNames;
    }
    return enumValueNames;
  }

  getLeafType(type: InputTypeReference): GraphQLLeafType | undefined {
    if (!isASTType(type)) {
      const namedType = getNamedType(type);
      return isLeafType(namedType) ? namedType : undefined;
    }

    const typeName = getNamedTypeName(type);
    const schemaType = this.getSchemaTypeForDocumentTypeName(typeName);
    if (isLeafType(schemaType)) {
      return schemaType;
    }
    return this.documentIndex.getDocumentScalarType(typeName);
  }

  getFieldDef(
    parentType: CompositeTypeReference,
    fieldName: string,
  ): FieldReference | undefined {
    if (!isASTType(parentType)) {
      if (fieldName === TypeNameMetaFieldDef.name) {
        return TypeNameMetaFieldDef;
      }

      if (this.isQueryRootType(parentType)) {
        if (fieldName === SchemaMetaFieldDef.name) {
          return SchemaMetaFieldDef;
        }
        if (fieldName === TypeMetaFieldDef.name) {
          return TypeMetaFieldDef;
        }
      }

      const schemaField = getSchemaField(parentType, fieldName);
      if (!this.documentIndex.getDocumentTypeNameSet().has(parentType.name)) {
        return schemaField;
      }

      const documentField = this.getDocumentOutputFields(parentType.name)?.get(
        fieldName,
      );
      if (documentField != null) {
        return documentField;
      }
      return schemaField ?? undefined;
    }

    if (fieldName === TypeNameMetaFieldDef.name) {
      return TypeNameMetaFieldDef;
    }

    const parentTypeName = this.getTypeName(parentType);
    if (this.isQueryRootTypeName(parentTypeName)) {
      if (fieldName === SchemaMetaFieldDef.name) {
        return SchemaMetaFieldDef;
      }
      if (fieldName === TypeMetaFieldDef.name) {
        return TypeMetaFieldDef;
      }
    }

    const schemaType = this.getSchemaTypeForDocumentTypeName(parentTypeName);
    if (isGraphQLCompositeType(schemaType)) {
      return this.getFieldDef(schemaType, fieldName);
    }

    if (this.hasOutputTypeName(parentTypeName)) {
      return this.getDocumentOutputFields(parentTypeName)?.get(fieldName);
    }
  }

  getFieldName(field: FieldReference): string {
    return isFieldDefinitionNode(field) ? field.name.value : field.name;
  }

  getFieldType(field: FieldReference): OutputTypeReference | undefined {
    return isFieldDefinitionNode(field)
      ? (this.getOutputTypeReference(field.type) ?? field.type)
      : field.type;
  }

  getFieldArguments(
    field: FieldReference,
  ): ReadonlyArray<ArgumentReference> | undefined {
    if (!isFieldDefinitionNode(field)) {
      return field.args.length === 0 ? undefined : field.args;
    }
    return field.arguments;
  }

  fieldToString(
    field: FieldReference,
    parentType?: CompositeTypeReference,
  ): string {
    if (!isFieldDefinitionNode(field)) {
      return String(field);
    }
    return parentType == null
      ? field.name.value
      : `${this.typeToString(parentType)}.${field.name.value}`;
  }

  getArgumentName(arg: ArgumentReference): string {
    return 'kind' in arg ? arg.name.value : arg.name;
  }

  getArgumentType(arg: ArgumentReference): InputTypeReference | undefined {
    return 'kind' in arg ? this.getInputTypeReference(arg.type) : arg.type;
  }

  isRequiredArgument(arg: ArgumentReference): boolean {
    return 'kind' in arg
      ? arg.type.kind === Kind.NON_NULL_TYPE && arg.defaultValue == null
      : this.isNonNullType(arg.type) && arg.defaultValue === undefined;
  }

  getArgumentDefaultValue(arg: ArgumentReference | undefined): unknown {
    return arg == null
      ? undefined
      : 'kind' in arg
        ? arg.defaultValue
        : (arg.default ?? arg.defaultValue);
  }

  argumentToString(
    arg: ArgumentReference,
    field?: FieldReference,
    parentType?: CompositeTypeReference,
  ): string {
    if (!('kind' in arg)) {
      return String(arg);
    }
    return field == null
      ? `${arg.name.value}:`
      : `${this.fieldToString(field, parentType)}(${arg.name.value}:)`;
  }

  getInputFieldDef(
    inputObjectType: InputTypeReference,
    fieldName: string,
  ): InputFieldReference | undefined {
    const namedType = this.getNamedInputType(inputObjectType);
    if (namedType == null || !this.isInputObjectType(namedType)) {
      return;
    }
    if (!isASTType(namedType)) {
      invariant(isGraphQLInputObjectType(namedType));
      if (!this.documentIndex.getDocumentTypeNameSet().has(namedType.name)) {
        return namedType.getFields()[fieldName];
      }

      const documentField = this.getDocumentInputFields(namedType.name)?.get(
        fieldName,
      );
      if (documentField != null) {
        return documentField;
      }
      return namedType.getFields()[fieldName];
    }

    invariant(namedType.kind === Kind.NAMED_TYPE);
    const typeName = namedType.name.value;
    const schemaType = this.getSchemaTypeForDocumentTypeName(typeName);
    if (isGraphQLInputObjectType(schemaType)) {
      return this.getInputFieldDef(schemaType, fieldName);
    }
    return this.getDocumentInputFields(typeName)?.get(fieldName);
  }

  getInputFieldDefaultValue(field: InputFieldReference | undefined): unknown {
    return field == null
      ? undefined
      : isInputField(field)
        ? (field.default ?? field.defaultValue)
        : field.defaultValue;
  }

  doTypesOverlap(
    typeA: CompositeTypeReference,
    typeB: CompositeTypeReference,
  ): boolean {
    if (
      this.schema != null &&
      !isASTType(typeA) &&
      !isASTType(typeB) &&
      !this.documentIndex.getDocumentTypeNameSet().has(typeA.name) &&
      !this.documentIndex.getDocumentTypeNameSet().has(typeB.name)
    ) {
      return doGraphQLTypesOverlap(this.schema, typeA, typeB);
    }

    const typeAName = this.getTypeName(typeA);
    const typeBName = this.getTypeName(typeB);
    if (typeAName === typeBName) {
      return true;
    }

    const possibleTypesA = this.getPossibleObjectTypeNames(typeA);
    const possibleTypesB = this.getPossibleObjectTypeNames(typeB);
    for (const possibleTypeA of possibleTypesA) {
      if (possibleTypesB.has(possibleTypeA)) {
        return true;
      }
    }
    return false;
  }

  isOutputTypeSubTypeOf(
    maybeSubType: OutputTypeReference,
    superType: OutputTypeReference,
  ): boolean {
    const maybeSubTypeName = this.getTypeName(maybeSubType);
    const superTypeName = this.getTypeName(superType);
    if (maybeSubTypeName === superTypeName) {
      return true;
    }
    if (
      this.schema != null &&
      !isASTType(maybeSubType) &&
      !isASTType(superType) &&
      isGraphQLAbstractType(superType) &&
      (isObjectType(maybeSubType) || isInterfaceType(maybeSubType)) &&
      !this.documentIndex.getDocumentTypeNameSet().has(maybeSubTypeName) &&
      !this.documentIndex.getDocumentTypeNameSet().has(superTypeName)
    ) {
      return this.schema.isSubType(superType, maybeSubType);
    }

    if (this.hasTypeKind(superTypeName, DocumentTypeKind.UNION)) {
      return (
        this.hasTypeKind(maybeSubTypeName, DocumentTypeKind.OBJECT) &&
        this.hasUnionMember(superTypeName, maybeSubTypeName)
      );
    }
    if (this.hasTypeKind(superTypeName, DocumentTypeKind.INTERFACE)) {
      return (
        this.getImplementedInterfaceNames(maybeSubTypeName)?.has(
          superTypeName,
        ) === true
      );
    }
    return false;
  }

  isInputTypeSubTypeOf(
    maybeSubType: TypeReference,
    superType: InputTypeReference,
  ): boolean {
    if (this.inputTypesEqual(maybeSubType, superType)) {
      return true;
    }

    if (this.isNonNullType(superType)) {
      return (
        this.isNonNullType(maybeSubType) &&
        this.isInputTypeSubTypeOf(
          this.getNullableType(maybeSubType),
          this.getNullableType(superType),
        )
      );
    }

    if (this.isNonNullType(maybeSubType)) {
      return this.isInputTypeSubTypeOf(
        this.getNullableType(maybeSubType),
        superType,
      );
    }

    if (this.isListType(superType)) {
      return (
        this.isListType(maybeSubType) &&
        this.isInputTypeSubTypeOf(
          this.getListItemType(maybeSubType),
          this.getListItemType(superType),
        )
      );
    }

    return false;
  }

  getSuggestedTypeNames(
    type: OutputTypeReference,
    fieldName: string,
  ): Array<string> {
    const namedType = this.getNamedOutputType(type);
    if (namedType == null || !this.isAbstractType(namedType)) {
      return [];
    }

    const suggestedTypeNames = new Set<string>();
    const usageCount: { [typeName: string]: number } = Object.create(null);
    for (const possibleTypeName of this.getPossibleObjectTypeNames(namedType)) {
      if (!this.hasField(possibleTypeName, fieldName)) {
        continue;
      }

      suggestedTypeNames.add(possibleTypeName);
      usageCount[possibleTypeName] = 1;

      const possibleInterfaceNames =
        this.getImplementedInterfaceNames(possibleTypeName);
      if (possibleInterfaceNames != null) {
        for (const possibleInterfaceName of possibleInterfaceNames) {
          if (!this.hasField(possibleInterfaceName, fieldName)) {
            continue;
          }

          suggestedTypeNames.add(possibleInterfaceName);
          usageCount[possibleInterfaceName] =
            (usageCount[possibleInterfaceName] ?? 0) + 1;
        }
      }
    }

    return Array.from(suggestedTypeNames).sort((typeA, typeB) => {
      const usageCountDiff = usageCount[typeB] - usageCount[typeA];
      if (usageCountDiff !== 0) {
        return usageCountDiff;
      }

      if (
        this.hasTypeKind(typeA, DocumentTypeKind.INTERFACE) &&
        this.isOutputTypeSubTypeOf(
          createNamedTypeNode(typeA),
          createNamedTypeNode(typeB),
        )
      ) {
        return -1;
      }
      if (
        this.hasTypeKind(typeB, DocumentTypeKind.INTERFACE) &&
        this.isOutputTypeSubTypeOf(
          createNamedTypeNode(typeB),
          createNamedTypeNode(typeA),
        )
      ) {
        return 1;
      }

      return naturalCompare(typeA, typeB);
    });
  }

  getSuggestedFieldNames(
    type: OutputTypeReference,
    fieldName: string,
  ): Array<string> {
    const namedType = this.getNamedOutputType(type);
    if (
      namedType == null ||
      (!this.isObjectType(namedType) && !this.isInterfaceType(namedType))
    ) {
      return [];
    }

    const fieldNames: Array<string> = [];
    this.forEachOutputFieldName(namedType, (name) => {
      fieldNames.push(name);
    });
    return suggestionList(fieldName, fieldNames);
  }

  forEachOutputFieldName(
    type: OutputTypeReference,
    onFieldName: (fieldName: string) => void,
  ): void {
    const typeName = this.getTypeName(type);
    const schemaType = this.getSchemaTypeForDocumentTypeName(typeName);
    if (
      schemaType != null &&
      (isObjectType(schemaType) || isInterfaceType(schemaType))
    ) {
      const fieldMap = schemaType.getFields();
      for (const fieldName in fieldMap) {
        if (Object.hasOwn(fieldMap, fieldName)) {
          onFieldName(fieldName);
        }
      }
    }

    const documentFields = this.getDocumentOutputFields(typeName);
    if (documentFields != null) {
      for (const fieldName of documentFields.keys()) {
        onFieldName(fieldName);
      }
    }
  }

  getFields(typeName: string): ReadonlyArray<FieldReference> | undefined {
    const schemaType = this.getSchemaTypeForDocumentTypeName(typeName);
    const schemaFieldMap =
      schemaType != null &&
      (isObjectType(schemaType) || isInterfaceType(schemaType))
        ? schemaType.getFields()
        : undefined;
    const schemaFields =
      schemaFieldMap == null ? undefined : objectMapValues(schemaFieldMap);
    const documentFields = this.getDocumentOutputFields(typeName);
    if (documentFields == null) {
      return schemaFields;
    }
    if (schemaFields == null) {
      return Array.from(documentFields.values());
    }
    const fields: Array<FieldReference> = schemaFields;
    for (const field of documentFields.values()) {
      fields.push(field);
    }
    return fields;
  }

  hasField(typeName: string, fieldName: string): boolean {
    const schemaType = this.getSchemaTypeForDocumentTypeName(typeName);
    if (
      schemaType != null &&
      (isObjectType(schemaType) || isInterfaceType(schemaType)) &&
      schemaType.getFields()[fieldName] != null
    ) {
      return true;
    }
    return this.getDocumentOutputFields(typeName)?.has(fieldName) ?? false;
  }

  isAbstractType(type: OutputTypeReference): type is CompositeTypeReference {
    if (!isASTType(type)) {
      return isInterfaceType(type) || isUnionType(type);
    }

    const namedType = this.getNamedOutputType(type);
    invariant(namedType != null);
    const typeName = this.getTypeName(namedType);
    return (
      this.hasTypeKind(typeName, DocumentTypeKind.INTERFACE) ||
      this.hasTypeKind(typeName, DocumentTypeKind.UNION)
    );
  }

  typeToString(type: TypeReference): string {
    if (!isASTType(type)) {
      return String(type);
    }

    switch (type.kind) {
      case Kind.NAMED_TYPE:
        return type.name.value;
      case Kind.LIST_TYPE:
        return `[${this.typeToString(type.type)}]`;
      case Kind.NON_NULL_TYPE:
        return `${this.typeToString(type.type)}!`;
    }
  }

  getImplementedInterfaceNames(
    typeName: string,
  ): ReadonlySet<string> | undefined {
    const cachedInterfaceNames =
      this._implementedInterfaceNamesByTypeName.get(typeName);
    if (cachedInterfaceNames != null) {
      return cachedInterfaceNames;
    }

    const interfaceNames = new Set<string>();
    const stack = new Array<string>();
    this.pushImplementedInterfaceNames(typeName, stack);
    while (stack.length !== 0) {
      const interfaceName = stack.pop() as string;
      if (interfaceNames.has(interfaceName)) {
        continue;
      }
      interfaceNames.add(interfaceName);
      this.pushImplementedInterfaceNames(interfaceName, stack);
    }
    if (interfaceNames.size === 0) {
      return;
    }
    this._implementedInterfaceNamesByTypeName.set(typeName, interfaceNames);
    return interfaceNames;
  }

  hasTypeKind(typeName: string, kind: DocumentTypeKindName): boolean {
    const schemaType = this.getSchemaType(typeName);
    if (schemaType != null && getTypeKind(schemaType) === kind) {
      return true;
    }
    return (
      this.documentIndex.getDocumentTypeKinds(typeName)?.has(kind) ?? false
    );
  }

  hasOtherTypeKind(
    typeName: string,
    expectedKind: DocumentTypeKindName,
  ): boolean {
    const schemaType = this.getSchemaType(typeName);
    if (schemaType != null && getTypeKind(schemaType) !== expectedKind) {
      return true;
    }
    const kinds = this.documentIndex.getDocumentTypeKinds(typeName);
    if (kinds == null) {
      return false;
    }
    for (const kind of kinds) {
      if (kind !== expectedKind) {
        return true;
      }
    }
    return false;
  }

  hasTypeElements(typeName: string, kind: TypeElementKindName): boolean {
    const schemaType = this.getSchemaType(typeName);
    switch (kind) {
      case TypeElementKind.OUTPUT_FIELD:
        if (
          schemaType != null &&
          (isObjectType(schemaType) || isInterfaceType(schemaType)) &&
          objectMapHasOwnKey(schemaType.getFields())
        ) {
          return true;
        }
        return this.getDocumentOutputFields(typeName) != null;
      case TypeElementKind.INPUT_FIELD:
        if (
          isGraphQLInputObjectType(schemaType) &&
          objectMapHasOwnKey(schemaType.getFields())
        ) {
          return true;
        }
        return this.getDocumentInputFields(typeName) != null;
      case TypeElementKind.UNION_MEMBER:
        if (isUnionType(schemaType) && schemaType.getTypes().length !== 0) {
          return true;
        }
        return this.getDocumentUnionMembers(typeName) != null;
      case TypeElementKind.ENUM_VALUE:
        if (isEnumType(schemaType) && schemaType.getValues().length !== 0) {
          return true;
        }
        return this.documentIndex.getDocumentEnumValues(typeName) != null;
    }
  }

  hasUnionMember(typeName: string, memberTypeName: string): boolean {
    const schemaType = this.getSchemaType(typeName);
    if (
      isUnionType(schemaType) &&
      schemaType.getTypes().some((type) => type.name === memberTypeName)
    ) {
      return true;
    }
    return this.getDocumentUnionMembers(typeName)?.has(memberTypeName) ?? false;
  }

  hasTypeName(typeName: string): boolean {
    return (
      this.getSchemaType(typeName) != null ||
      this.documentIndex.hasDocumentTypeName(typeName)
    );
  }

  private pushImplementedInterfaceNames(
    typeName: string,
    stack: Array<string>,
  ): void {
    const schemaType = this.getSchemaTypeForDocumentTypeName(typeName);
    if (
      schemaType != null &&
      (isObjectType(schemaType) || isInterfaceType(schemaType))
    ) {
      for (const iface of schemaType.getInterfaces()) {
        stack.push(iface.name);
      }
    }

    const implementedInterfaceNames =
      this.documentIndex.getDocumentImplementedInterfaceNames(typeName);
    if (implementedInterfaceNames != null) {
      for (const interfaceName of implementedInterfaceNames) {
        stack.push(interfaceName);
      }
    }
  }

  private getSchemaType(typeName: string): GraphQLNamedType | undefined {
    return this.schema?.getType(typeName) ?? getBuiltInType(typeName);
  }

  private getSchemaTypeForDocumentTypeName(
    typeName: string,
  ): GraphQLNamedType | undefined {
    return this.documentIndex.hasDocumentTypeDefinition(typeName)
      ? undefined
      : this.getSchemaType(typeName);
  }

  private hasInputTypeName(typeName: string): boolean {
    const schemaType = this.getSchemaType(typeName);
    if (schemaType != null && isInputType(schemaType)) {
      return true;
    }
    const kinds = this.documentIndex.getDocumentTypeKinds(typeName);
    if (kinds == null) {
      return false;
    }
    for (const kind of kinds) {
      if (isInputTypeKind(kind)) {
        return true;
      }
    }
    return false;
  }

  private hasNonInputTypeName(typeName: string): boolean {
    const schemaType = this.getSchemaType(typeName);
    if (schemaType != null && !isInputType(schemaType)) {
      return true;
    }
    const kinds = this.documentIndex.getDocumentTypeKinds(typeName);
    if (kinds == null) {
      return false;
    }
    for (const kind of kinds) {
      if (!isInputTypeKind(kind)) {
        return true;
      }
    }
    return false;
  }

  private hasOutputTypeName(typeName: string): boolean {
    const schemaType = this.getSchemaType(typeName);
    if (schemaType != null && isOutputType(schemaType)) {
      return true;
    }
    const kinds = this.documentIndex.getDocumentTypeKinds(typeName);
    if (kinds == null) {
      return false;
    }
    for (const kind of kinds) {
      if (isOutputTypeKind(kind)) {
        return true;
      }
    }
    return false;
  }

  private hasNonOutputTypeName(typeName: string): boolean {
    const schemaType = this.getSchemaType(typeName);
    if (schemaType != null && !isOutputType(schemaType)) {
      return true;
    }
    const kinds = this.documentIndex.getDocumentTypeKinds(typeName);
    if (kinds == null) {
      return false;
    }
    for (const kind of kinds) {
      if (!isOutputTypeKind(kind)) {
        return true;
      }
    }
    return false;
  }

  private getPossibleObjectTypeNames(
    type: CompositeTypeReference,
  ): ReadonlySet<string> {
    const typeName = this.getTypeName(type);
    const possibleTypes = new Set<string>();
    const schema = this.schema;
    if (schema != null) {
      const schemaType = this.getSchemaTypeForDocumentTypeName(typeName);
      if (isObjectType(schemaType)) {
        possibleTypes.add(typeName);
      } else if (isInterfaceType(schemaType) || isUnionType(schemaType)) {
        for (const possibleType of schema.getPossibleTypes(schemaType)) {
          possibleTypes.add(possibleType.name);
        }
      }
    }

    if (this.hasTypeKind(typeName, DocumentTypeKind.OBJECT)) {
      possibleTypes.add(typeName);
      return possibleTypes;
    }

    if (this.hasTypeKind(typeName, DocumentTypeKind.UNION)) {
      const memberTypes = this.getDocumentUnionMembers(typeName);
      if (memberTypes != null) {
        for (const memberTypeName of memberTypes.keys()) {
          if (this.hasTypeKind(memberTypeName, DocumentTypeKind.OBJECT)) {
            possibleTypes.add(memberTypeName);
          }
        }
      }
      return possibleTypes;
    }

    if (this.hasTypeKind(typeName, DocumentTypeKind.INTERFACE)) {
      for (const objectTypeName of this.getObjectTypeNames()) {
        if (
          this.getImplementedInterfaceNames(objectTypeName)?.has(typeName) ===
          true
        ) {
          possibleTypes.add(objectTypeName);
        }
      }
    }
    return possibleTypes;
  }

  private inputTypesEqual(
    typeA: TypeReference,
    typeB: InputTypeReference,
  ): boolean {
    if (this.isNonNullType(typeA) || this.isNonNullType(typeB)) {
      return (
        this.isNonNullType(typeA) &&
        this.isNonNullType(typeB) &&
        this.inputTypesEqual(
          this.getNullableType(typeA),
          this.getNullableType(typeB),
        )
      );
    }
    if (this.isListType(typeA) || this.isListType(typeB)) {
      return (
        this.isListType(typeA) &&
        this.isListType(typeB) &&
        this.inputTypesEqual(
          this.getListItemType(typeA),
          this.getListItemType(typeB),
        )
      );
    }
    return this.getTypeName(typeA) === this.getTypeName(typeB);
  }

  private getDocumentOutputFields(
    typeName: string,
  ): ReadonlyMap<string, FieldReference> | undefined {
    return this.documentIndex.getDocumentOutputFields(typeName);
  }

  private getDocumentInputFields(
    typeName: string,
  ): ReadonlyMap<string, InputFieldReference> | undefined {
    return this.documentIndex.getDocumentInputFields(typeName);
  }

  private getDocumentUnionMembers(
    typeName: string,
  ): ReadonlyMap<string, NamedTypeNode> | undefined {
    return this.documentIndex.getDocumentUnionMembers(typeName);
  }

  private isQueryRootType(type: GraphQLCompositeType): boolean {
    const schema = this.schema;
    if (schema != null && !this.hasDocumentRootOperationTypeDefinitions) {
      return schema.getQueryType() === type;
    }
    return this.isQueryRootTypeName(type.name);
  }

  private isQueryRootTypeName(typeName: string): boolean {
    const schema = this.schema;
    if (schema != null && !this.hasDocumentRootOperationTypeDefinitions) {
      return schema.getQueryType()?.name === typeName;
    }
    return this.getRootOperationTypes().get('query')?.typeName === typeName;
  }

  private collectDirectiveDefinitions(): void {
    if (this._directiveLocationMap !== undefined) {
      return;
    }

    const directiveLocationMap = new Map<string, Set<string>>();
    const directiveRepeatableMap = new Map<string, boolean>();
    const directiveArgumentMap = new Map<
      string,
      DirectiveArgumentReferenceMap
    >();

    const schema = this.schema;
    const definedDirectives =
      schema == null ? specifiedDirectives : schema.getDirectives();
    for (const directive of definedDirectives) {
      if (!isDirective(directive)) {
        continue;
      }
      addDirectiveLocations(
        directiveLocationMap,
        directive.name,
        directive.locations,
      );
      directiveRepeatableMap.set(directive.name, directive.isRepeatable);
      if (directive.args.length !== 0) {
        const args = new Map<string, ArgumentReference>();
        for (const arg of directive.args) {
          args.set(arg.name, arg);
        }
        directiveArgumentMap.set(directive.name, args);
      }
    }

    for (const directiveName of this.documentIndex.getDocumentDirectiveNames()) {
      const documentLocations =
        this.documentIndex.getDocumentDirectiveLocationSet(
          directiveName,
        ) as ReadonlySet<string>;
      directiveLocationMap.set(directiveName, new Set(documentLocations));
      const documentRepeatable =
        this.documentIndex.isDocumentDirectiveRepeatable(directiveName);
      if (documentRepeatable != null) {
        directiveRepeatableMap.set(directiveName, documentRepeatable);
      }
      const documentArguments =
        this.documentIndex.getDocumentDirectiveArgumentMap(directiveName);
      if (documentArguments == null) {
        directiveArgumentMap.delete(directiveName);
      } else {
        directiveArgumentMap.set(directiveName, documentArguments);
      }
    }

    this._directiveLocationMap = directiveLocationMap;
    this._directiveRepeatableMap = directiveRepeatableMap;
    this._directiveArgumentMap = directiveArgumentMap;
  }

  private getSchemaTypeForDocumentReference(
    typeNode: TypeNode,
  ): GraphQLType | undefined {
    if (this.schema == null) {
      return;
    }

    return this.documentIndex.hasDocumentTypeDefinition(
      getNamedTypeName(typeNode),
    )
      ? undefined
      : (typeFromAST(this.schema, typeNode) ?? undefined);
  }

  private getTypeFromSchema(typeNode: TypeNode): GraphQLType | undefined {
    if (this.schema == null) {
      return;
    }

    let cache = this._schemaTypeReferenceCache;
    if (cache?.has(typeNode)) {
      return cache.get(typeNode);
    }

    const type = typeFromAST(this.schema, typeNode) ?? undefined;
    cache ??= this._schemaTypeReferenceCache = new Map();
    cache.set(typeNode, type);
    return type;
  }
}

/** @internal */
export type TypeSystemValidationFn = (index: TypeSystemValidationIndex) => void;

interface MutableSchemaValidationElements {
  readonly rootTypes: Array<SchemaRootTypeRecord>;
  readonly scalarTypes: Array<GraphQLScalarType>;
  readonly objectTypes: Array<SchemaObjectTypeRecord>;
  readonly interfaceTypes: Array<SchemaInterfaceTypeRecord>;
  readonly unionTypes: Array<SchemaUnionTypeRecord>;
  readonly enumTypes: Array<SchemaEnumTypeRecord>;
  readonly inputObjectTypes: Array<SchemaInputObjectTypeRecord>;
  readonly directives: Array<GraphQLDirective>;
  readonly directiveLocations: Array<SchemaDirectiveLocationsRecord>;
  readonly namedElements: Array<SchemaNamedElement>;
  readonly outputTypes: Array<SchemaOutputTypeRecord>;
  readonly inputValues: Array<SchemaInputValueRecord>;
  readonly defaultValues: Array<SchemaDefaultValueRecord>;
  readonly deprecations: Array<SchemaDeprecationRecord>;
  readonly unionMembers: Array<SchemaUnionMemberRecord>;
  readonly directiveUsages: Array<SchemaDirectiveUsageRecord>;
  readonly invalidNamedTypes: Array<SchemaInvalidNamedTypeRecord>;
  readonly invalidDirectives: Array<SchemaInvalidDirectiveRecord>;
}

function collectSchemaValidationElements(
  schema: GraphQLSchema,
): SchemaValidationElements {
  const elements = createSchemaValidationElements();

  for (const operation of operationTypes) {
    const rootType = schema.getRootType(operation);
    if (rootType != null) {
      elements.rootTypes.push({ rootType, operation });
    }
  }

  for (const directive of schema.getDirectives()) {
    if (isDirective(directive)) {
      addSchemaDirectiveRecord(elements, directive);
    } else {
      elements.invalidDirectives.push({ directive });
    }
  }

  const typeMap = schema.getTypeMap();
  for (const typeName in typeMap) {
    if (!Object.hasOwn(typeMap, typeName)) {
      continue;
    }

    const type = typeMap[typeName];
    if (isNamedType(type)) {
      addSchemaTypeRecord(elements, type);
    } else {
      elements.invalidNamedTypes.push({ type });
    }
  }

  return elements;
}

function createSchemaValidationElements(): MutableSchemaValidationElements {
  return {
    rootTypes: [],
    scalarTypes: [],
    objectTypes: [],
    interfaceTypes: [],
    unionTypes: [],
    enumTypes: [],
    inputObjectTypes: [],
    directives: [],
    directiveLocations: [],
    namedElements: [],
    outputTypes: [],
    inputValues: [],
    defaultValues: [],
    deprecations: [],
    unionMembers: [],
    directiveUsages: [],
    invalidNamedTypes: [],
    invalidDirectives: [],
  };
}

function addSchemaDirectiveRecord(
  elements: MutableSchemaValidationElements,
  directive: GraphQLDirective,
): void {
  elements.directives.push(directive);
  elements.directiveLocations.push({
    locations: directive.locations,
    directive,
  });
  elements.namedElements.push(directive);
  if (directive.deprecationReason != null) {
    addSpecifiedDirectiveUsage(
      elements.directiveUsages,
      GraphQLDeprecatedDirective.name,
      directive,
    );
  }

  for (const arg of directive.args) {
    addSchemaArgumentRecord(elements, arg, directive, undefined);
  }
}

function addSchemaTypeRecord(
  elements: MutableSchemaValidationElements,
  type: GraphQLNamedType,
): void {
  elements.namedElements.push(type);

  if (isScalarType(type)) {
    elements.scalarTypes.push(type);
    if (type.specifiedByURL != null) {
      addSpecifiedDirectiveUsage(
        elements.directiveUsages,
        GraphQLSpecifiedByDirective.name,
        type,
      );
    }
    return;
  }

  if (isObjectType(type)) {
    const fields = Object.values(type.getFields());
    elements.objectTypes.push({ type, fields });
    for (const field of fields) {
      addSchemaFieldRecord(elements, field, type);
    }
    return;
  }

  if (isInterfaceType(type)) {
    const fields = Object.values(type.getFields());
    elements.interfaceTypes.push({ type, fields });
    for (const field of fields) {
      addSchemaFieldRecord(elements, field, type);
    }
    return;
  }

  if (isUnionType(type)) {
    const memberTypes = type.getTypes();
    elements.unionTypes.push({ type, memberTypes });
    for (const memberType of memberTypes) {
      elements.unionMembers.push({ memberType, union: type });
    }
    return;
  }

  if (isEnumType(type)) {
    const values = type.getValues();
    elements.enumTypes.push({ type, values });
    for (const value of values) {
      elements.namedElements.push(value);
      if (value.deprecationReason != null) {
        addSpecifiedDirectiveUsage(
          elements.directiveUsages,
          GraphQLDeprecatedDirective.name,
          value,
        );
      }
    }
    return;
  }

  if (isGraphQLInputObjectType(type)) {
    const fields = Object.values(type.getFields());
    elements.inputObjectTypes.push({ type, fields });
    if (type.isOneOf) {
      addSpecifiedDirectiveUsage(
        elements.directiveUsages,
        GraphQLOneOfDirective.name,
        type,
      );
    }
    for (const field of fields) {
      addSchemaInputFieldRecord(elements, field, type);
    }
  }
}

function addSchemaFieldRecord(
  elements: MutableSchemaValidationElements,
  field: GraphQLField<unknown, unknown>,
  parentType: GraphQLObjectType | GraphQLInterfaceType,
): void {
  elements.outputTypes.push({ outputType: field.type, field, parentType });
  elements.namedElements.push(field);
  if (field.deprecationReason != null) {
    addSpecifiedDirectiveUsage(
      elements.directiveUsages,
      GraphQLDeprecatedDirective.name,
      field,
    );
  }
  addSchemaDeprecation(elements, field, parentType);

  for (const arg of field.args) {
    addSchemaArgumentRecord(elements, arg, field, parentType);
  }
}

function addSchemaArgumentRecord(
  elements: MutableSchemaValidationElements,
  arg: GraphQLArgument,
  parentElement: GraphQLField<unknown, unknown> | GraphQLDirective,
  parentType: GraphQLObjectType | GraphQLInterfaceType | undefined,
): void {
  elements.namedElements.push(arg);
  if (arg.deprecationReason != null) {
    addSpecifiedDirectiveUsage(
      elements.directiveUsages,
      GraphQLDeprecatedDirective.name,
      arg,
    );
  }
  addSchemaInputValueRecord(elements, arg, parentElement, parentType);
}

function addSchemaInputFieldRecord(
  elements: MutableSchemaValidationElements,
  field: GraphQLInputField,
  inputObj: GraphQLInputObjectType,
): void {
  elements.namedElements.push(field);
  if (field.deprecationReason != null) {
    addSpecifiedDirectiveUsage(
      elements.directiveUsages,
      GraphQLDeprecatedDirective.name,
      field,
    );
  }
  addSchemaInputValueRecord(elements, field, inputObj, undefined);
}

function addSchemaInputValueRecord(
  elements: MutableSchemaValidationElements,
  inputValue: SchemaInputValue,
  parentElement:
    | GraphQLField<unknown, unknown>
    | GraphQLDirective
    | GraphQLInputObjectType,
  parentType: GraphQLObjectType | GraphQLInterfaceType | undefined,
): void {
  elements.inputValues.push({
    inputType: inputValue.type,
    inputValue,
    parentElement,
    parentType,
  });
  addSchemaDeprecation(elements, inputValue, parentElement);

  const defaultInput = inputValue.default;
  if (defaultInput !== undefined) {
    elements.defaultValues.push({
      defaultInput,
      inputValue,
      parentElement,
      parentType,
    });
  }
}

function addSchemaDeprecation(
  elements: MutableSchemaValidationElements,
  element: SchemaInputValue | GraphQLField<unknown, unknown>,
  parentElement:
    | GraphQLDirective
    | GraphQLField<unknown, unknown>
    | GraphQLInputObjectType
    | GraphQLObjectType
    | GraphQLInterfaceType,
): void {
  if (element.deprecationReason != null) {
    elements.deprecations.push({ element, parentElement });
  }
}

function addSpecifiedDirectiveUsage(
  directiveUsages: Array<SchemaDirectiveUsageRecord>,
  name: string,
  element: GraphQLSchema | GraphQLSchemaElement,
): void {
  directiveUsages.push({ name, element });
}

function filterASTNodes(
  nodes: ReadonlyArray<Maybe<ASTNode>>,
): ReadonlyArray<ASTNode> {
  let filteredNodes: Array<ASTNode> | undefined;
  for (let i = 0; i < nodes.length; ++i) {
    const node = nodes[i];
    if (node == null) {
      if (filteredNodes == null) {
        filteredNodes = [];
        for (let j = 0; j < i; ++j) {
          filteredNodes.push(nodes[j] as ASTNode);
        }
      }
    } else {
      filteredNodes?.push(node);
    }
  }
  return filteredNodes ?? (nodes as ReadonlyArray<ASTNode>);
}

function objectMapHasOwnKey<T>(obj: { readonly [key: string]: T }): boolean {
  for (const key in obj) {
    if (Object.hasOwn(obj, key)) {
      return true;
    }
  }
  return false;
}

function objectMapValues<T>(obj: {
  readonly [key: string]: T;
}): Array<T> | undefined {
  let values: Array<T> | undefined;
  for (const key in obj) {
    if (Object.hasOwn(obj, key)) {
      (values ??= []).push(obj[key]);
    }
  }
  return values;
}

function getSchemaField(
  parentType: GraphQLCompositeType,
  fieldName: string,
): GraphQLField<unknown, unknown> | undefined {
  return isObjectType(parentType) || isInterfaceType(parentType)
    ? parentType.getFields()[fieldName]
    : undefined;
}

function filterValidationErrorRecords(
  errors: ReadonlyArray<TypeSystemValidationErrorRecord>,
  shouldFilter: (error: TypeSystemValidationErrorRecord) => boolean,
): ReadonlyArray<TypeSystemValidationErrorRecord> {
  let filteredErrors: Array<TypeSystemValidationErrorRecord> | undefined;
  for (let i = 0; i < errors.length; ++i) {
    const error = errors[i];
    if (shouldFilter(error)) {
      filteredErrors ??= errors.slice(0, i);
    } else {
      filteredErrors?.push(error);
    }
  }
  return filteredErrors ?? errors;
}

function mergeValidationErrorRecords(
  documentErrors: ReadonlyArray<TypeSystemValidationErrorRecord>,
  schemaErrors: ReadonlyArray<TypeSystemValidationErrorRecord> | undefined,
): ReadonlyArray<TypeSystemValidationErrorRecord> {
  if (schemaErrors == null || schemaErrors.length === 0) {
    return documentErrors;
  }
  if (documentErrors.length === 0) {
    return schemaErrors;
  }
  return [...documentErrors, ...schemaErrors];
}

function getElementKey(typeName: string, elementName: string): string {
  return `${typeName}.${elementName}`;
}

function addDirectiveLocations(
  directiveLocationMap: Map<string, Set<string>>,
  directiveName: string,
  locations: ReadonlyArray<string>,
): void {
  let knownLocations = directiveLocationMap.get(directiveName);
  if (knownLocations == null) {
    knownLocations = new Set();
    directiveLocationMap.set(directiveName, knownLocations);
  }

  for (const location of locations) {
    knownLocations.add(location);
  }
}

function getTypeKind(type: GraphQLNamedType): DocumentTypeKindName {
  if (isScalarType(type)) {
    return DocumentTypeKind.SCALAR;
  }
  if (isObjectType(type)) {
    return DocumentTypeKind.OBJECT;
  }
  if (isInterfaceType(type)) {
    return DocumentTypeKind.INTERFACE;
  }
  if (isUnionType(type)) {
    return DocumentTypeKind.UNION;
  }
  if (isEnumType(type)) {
    return DocumentTypeKind.ENUM;
  }
  return DocumentTypeKind.INPUT_OBJECT;
}

function isInputTypeKind(kind: DocumentTypeKindName): boolean {
  return (
    kind === DocumentTypeKind.SCALAR ||
    kind === DocumentTypeKind.ENUM ||
    kind === DocumentTypeKind.INPUT_OBJECT
  );
}

function isOutputTypeKind(kind: DocumentTypeKindName): boolean {
  return (
    kind === DocumentTypeKind.SCALAR ||
    kind === DocumentTypeKind.OBJECT ||
    kind === DocumentTypeKind.INTERFACE ||
    kind === DocumentTypeKind.UNION ||
    kind === DocumentTypeKind.ENUM
  );
}

function isASTType(type: TypeReference): type is TypeNode {
  return 'kind' in type;
}

function createNamedTypeNode(typeName: string): NamedTypeNode {
  return {
    kind: Kind.NAMED_TYPE,
    name: {
      kind: Kind.NAME,
      value: typeName,
    },
  };
}

function isFieldDefinitionNode(
  field: FieldReference,
): field is FieldDefinitionNode {
  return 'kind' in field;
}

function didYouMeanEnumValue(
  enumValueNames: ReadonlyMap<string, unknown>,
  unknownValueStr: string,
  hideSuggestions: Maybe<boolean>,
): string {
  if (hideSuggestions) {
    return '';
  }
  return didYouMean(
    'the enum value',
    suggestionList(unknownValueStr, Array.from(enumValueNames.keys())),
  );
}

function getNamedTypeName(typeNode: TypeNode): string {
  let namedType = typeNode;
  while (
    namedType.kind === Kind.LIST_TYPE ||
    namedType.kind === Kind.NON_NULL_TYPE
  ) {
    namedType = namedType.type;
  }
  return namedType.name.value;
}

function getBuiltInType(typeName: string): GraphQLNamedType | undefined {
  return builtInTypeMap.get(typeName);
}

function addBuiltInTypeNames(
  typeNames: Array<string>,
  seenTypeNames: Set<string>,
): void {
  for (const typeName of builtInTypeMap.keys()) {
    if (!seenTypeNames.has(typeName)) {
      typeNames.push(typeName);
      seenTypeNames.add(typeName);
    }
  }
}
