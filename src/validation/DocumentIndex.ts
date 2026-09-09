/** @category Validation */

import type { Maybe } from '../jsutils/Maybe.ts';

import type {
  ASTNode,
  DefinitionNode,
  DirectiveDefinitionNode,
  DirectiveNode,
  DocumentNode,
  EnumTypeDefinitionNode,
  EnumTypeExtensionNode,
  EnumValueDefinitionNode,
  FieldDefinitionNode,
  FragmentDefinitionNode,
  InputObjectTypeDefinitionNode,
  InputObjectTypeExtensionNode,
  InputValueDefinitionNode,
  InterfaceTypeDefinitionNode,
  InterfaceTypeExtensionNode,
  NamedTypeNode,
  NameNode,
  ObjectTypeDefinitionNode,
  ObjectTypeExtensionNode,
  OperationTypeNode,
  ScalarTypeDefinitionNode,
  SchemaDefinitionNode,
  SchemaExtensionNode,
  TypeDefinitionNode,
  TypeExtensionNode,
  TypeSystemDefinitionNode,
  TypeSystemExtensionNode,
  VariableDefinitionNode,
} from '../language/ast.ts';
import { Kind } from '../language/kinds.ts';
import {
  isExecutableDefinitionNode,
  isTypeDefinitionNode,
  isTypeExtensionNode,
  isTypeSystemDefinitionNode,
  isTypeSystemExtensionNode,
} from '../language/predicates.ts';

import type {
  GraphQLArgument,
  GraphQLField,
  GraphQLInputField,
} from '../type/definition.ts';
import { GraphQLScalarType } from '../type/definition.ts';
import { specifiedScalarTypes } from '../type/scalars.ts';

/** @internal */
export type FieldReference =
  | GraphQLField<unknown, unknown>
  | FieldDefinitionNode;
/** @internal */
export type InputFieldReference = GraphQLInputField | InputValueDefinitionNode;
/** @internal */
export type ArgumentReference = GraphQLArgument | InputValueDefinitionNode;

type FieldReferenceMap = Map<string, FieldReference>;
type InputFieldReferenceMap = Map<string, InputFieldReference>;
/** @internal */
export type DirectiveArgumentReferenceMap = Map<string, ArgumentReference>;

interface DocumentTypeRecord<TKind extends DocumentTypeKindName> {
  readonly kind: TKind;
  readonly typeName: string;
}

interface DocumentScalarTypeRecord extends DocumentTypeRecord<
  typeof DocumentTypeKind.SCALAR
> {
  scalarType?: GraphQLScalarType;
}

interface DocumentObjectOrInterfaceTypeRecord<
  TKind extends
    | typeof DocumentTypeKind.OBJECT
    | typeof DocumentTypeKind.INTERFACE,
> extends DocumentTypeRecord<TKind> {
  outputFields?: FieldReferenceMap;
  implementedInterfaceNames?: Set<string>;
}

type DocumentObjectTypeRecord = DocumentObjectOrInterfaceTypeRecord<
  typeof DocumentTypeKind.OBJECT
>;

type DocumentInterfaceTypeRecord = DocumentObjectOrInterfaceTypeRecord<
  typeof DocumentTypeKind.INTERFACE
>;

interface DocumentUnionTypeRecord extends DocumentTypeRecord<
  typeof DocumentTypeKind.UNION
> {
  members?: Map<string, NamedTypeNode>;
}

interface DocumentEnumTypeRecord extends DocumentTypeRecord<
  typeof DocumentTypeKind.ENUM
> {
  values?: Map<string, EnumValueDefinitionNode>;
}

interface DocumentInputObjectTypeRecord extends DocumentTypeRecord<
  typeof DocumentTypeKind.INPUT_OBJECT
> {
  inputFields?: InputFieldReferenceMap;
  isOneOf?: boolean;
}

/** @internal */
export interface TypeSystemValidationErrorRecord {
  readonly message: string;
  readonly nodes?: ReadonlyArray<Maybe<ASTNode>> | Maybe<ASTNode>;
  readonly typeName?: string;
  readonly elementName?: string;
  readonly directiveName?: string;
}

/** @internal */
export const DocumentTypeKind = {
  SCALAR: 'Scalar',
  OBJECT: 'Object',
  INTERFACE: 'Interface',
  UNION: 'Union',
  ENUM: 'Enum',
  INPUT_OBJECT: 'InputObject',
} as const;

/** @internal */
export type DocumentTypeKindName =
  (typeof DocumentTypeKind)[keyof typeof DocumentTypeKind];

/** @internal */
export const TypeElementKind = {
  OUTPUT_FIELD: 'OutputField',
  INPUT_FIELD: 'InputField',
  UNION_MEMBER: 'UnionMember',
  ENUM_VALUE: 'EnumValue',
} as const;

/** @internal */
export type TypeElementKindName =
  (typeof TypeElementKind)[keyof typeof TypeElementKind];

const specifiedScalarTypeNames = new Set(
  specifiedScalarTypes.map((type) => type.name),
);
/** @internal */
export interface RootOperationTypeRecord {
  readonly typeName: string;
  readonly node: NamedTypeNode | undefined;
}

/** @internal */
export type DocumentImplementedTypeNode =
  | ObjectTypeDefinitionNode
  | ObjectTypeExtensionNode
  | InterfaceTypeDefinitionNode
  | InterfaceTypeExtensionNode;

/** @internal */
export interface DocumentImplementedTypeRecord {
  readonly kind: 'ObjectTypeDefinition' | 'InterfaceTypeDefinition';
  readonly node: DocumentImplementedTypeNode;
}

/** @internal */
export type DocumentInputObjectTypeNode =
  | InputObjectTypeDefinitionNode
  | InputObjectTypeExtensionNode;

/** @internal */
export interface DocumentInputObjectTypeNodeRecord {
  readonly node: DocumentInputObjectTypeNode;
}

/** @internal */
export interface FragmentSignature {
  readonly definition: FragmentDefinitionNode;
  readonly variableDefinitions: Map<string, VariableDefinitionNode>;
}

/** @internal */
export class DocumentIndex {
  readonly document: DocumentNode;
  readonly hasDocumentDefinitions: boolean;
  readonly hasTypeSystemDefinitions: boolean;
  readonly hasRootOperationTypeDefinitions: boolean;
  private _documentToTraverse: DocumentNode | undefined;
  private _fragmentSignatures: Map<string, FragmentSignature> | undefined;
  private _fragmentSignatureByName:
    | ((fragmentName: string) => FragmentSignature | undefined)
    | undefined;
  private _documentTypeNameList: ReadonlyArray<string> | undefined;
  private _documentImplementedTypes: Array<DocumentImplementedTypeRecord> = [];
  private _documentInputObjectTypes: Array<DocumentInputObjectTypeNodeRecord> =
    [];
  private _documentTypeNames: Set<string> = new Set<string>();
  private _documentTypeDefinitionNames: Set<string> = new Set<string>();
  private _documentTypeKindsByName: Map<string, Set<DocumentTypeKindName>> =
    new Map<string, Set<DocumentTypeKindName>>();
  private _documentTypeDefinitionNameByName: Map<string, NameNode> = new Map<
    string,
    NameNode
  >();
  private _documentTypeNodesByName: Map<
    string,
    Array<TypeDefinitionNode | TypeExtensionNode>
  > = new Map<string, Array<TypeDefinitionNode | TypeExtensionNode>>();
  private _documentScalarTypes: Map<string, DocumentScalarTypeRecord> = new Map<
    string,
    DocumentScalarTypeRecord
  >();
  private _documentObjectTypes: Map<string, DocumentObjectTypeRecord> = new Map<
    string,
    DocumentObjectTypeRecord
  >();
  private _documentInterfaceTypes: Map<string, DocumentInterfaceTypeRecord> =
    new Map<string, DocumentInterfaceTypeRecord>();
  private _documentUnionTypes: Map<string, DocumentUnionTypeRecord> = new Map<
    string,
    DocumentUnionTypeRecord
  >();
  private _documentEnumTypes: Map<string, DocumentEnumTypeRecord> = new Map<
    string,
    DocumentEnumTypeRecord
  >();
  private _documentInputObjectTypeRecords: Map<
    string,
    DocumentInputObjectTypeRecord
  > = new Map<string, DocumentInputObjectTypeRecord>();
  private _rootOperationTypes: Map<OperationTypeNode, RootOperationTypeRecord> =
    new Map<OperationTypeNode, RootOperationTypeRecord>();
  private _explicitRootOperationTypes: Map<
    OperationTypeNode,
    RootOperationTypeRecord
  > = new Map<OperationTypeNode, RootOperationTypeRecord>();
  private _directiveLocationMap: Map<string, Set<string>> = new Map<
    string,
    Set<string>
  >();
  private _directiveNameList: ReadonlyArray<string> | undefined;
  private _directiveRepeatableMap: Map<string, boolean> = new Map<
    string,
    boolean
  >();
  private _directiveArgumentMap: Map<string, DirectiveArgumentReferenceMap> =
    new Map<string, DirectiveArgumentReferenceMap>();
  private _documentDirectiveDefinitionNameMap: Map<string, NameNode> = new Map<
    string,
    NameNode
  >();
  private _uniqueFieldDefinitionErrors: Array<TypeSystemValidationErrorRecord> =
    [];
  private _uniqueArgumentDefinitionErrors: Array<TypeSystemValidationErrorRecord> =
    [];
  private _uniqueEnumValueDefinitionErrors: Array<TypeSystemValidationErrorRecord> =
    [];
  private _uniqueUnionMemberTypeErrors: Array<TypeSystemValidationErrorRecord> =
    [];
  private _uniqueDirectiveDefinitionErrors: Array<TypeSystemValidationErrorRecord> =
    [];
  private _uniqueTypeDefinitionErrors: Array<TypeSystemValidationErrorRecord> =
    [];
  private _documentTypeRecordsCollected: boolean = false;
  private _definedDirectivesCollected: boolean = false;

  constructor(document: Maybe<DocumentNode>) {
    this.document = document ?? { kind: Kind.DOCUMENT, definitions: [] };
    this.hasDocumentDefinitions = this.document.definitions.length !== 0;
    const documentFacts = collectDocumentFacts(this.document.definitions);
    this.hasTypeSystemDefinitions = documentFacts.hasTypeSystemDefinitions;
    this.hasRootOperationTypeDefinitions =
      documentFacts.hasRootOperationTypeDefinitions;

    this.collectDocumentDefinitions(this.document.definitions);
    this.collectDocumentValidationElements(this.document.definitions);
  }

  getDocumentToTraverse(): DocumentNode {
    if (!this.hasTypeSystemDefinitions) {
      return this.document;
    }
    return (this._documentToTraverse ??= getDocumentToTraverse(this.document));
  }

  getFragmentSignatureByName(): (
    fragmentName: string,
  ) => FragmentSignature | undefined {
    let fragmentSignatureByName = this._fragmentSignatureByName;
    if (fragmentSignatureByName == null) {
      fragmentSignatureByName = (fragmentName: string) =>
        this.getFragmentSignatures().get(fragmentName);
      this._fragmentSignatureByName = fragmentSignatureByName;
    }
    return fragmentSignatureByName;
  }

  getDocumentTypeNames(): ReadonlyArray<string> {
    return (this._documentTypeNameList ??= [...this._documentTypeNames]);
  }

  getDocumentTypeNameSet(): ReadonlySet<string> {
    return this._documentTypeNames;
  }

  getDocumentTypeKindMap(): ReadonlyMap<
    string,
    ReadonlySet<DocumentTypeKindName>
  > {
    return this._documentTypeKindsByName;
  }

  getDocumentRootOperationTypes(): ReadonlyMap<
    OperationTypeNode,
    RootOperationTypeRecord
  > {
    return this._rootOperationTypes;
  }

  getExplicitDocumentRootOperationTypes(): ReadonlyMap<
    OperationTypeNode,
    RootOperationTypeRecord
  > {
    return this._explicitRootOperationTypes;
  }

  getDocumentImplementedTypes(): ReadonlyArray<DocumentImplementedTypeRecord> {
    return this._documentImplementedTypes;
  }

  getDocumentInputObjectTypes(): ReadonlyArray<DocumentInputObjectTypeNodeRecord> {
    return this._documentInputObjectTypes;
  }

  getDocumentDirectiveArgumentMap(
    directiveName: string,
  ): DirectiveArgumentReferenceMap | undefined {
    this.collectDefinedDirectives();
    return this._directiveArgumentMap.get(directiveName);
  }

  getUniqueFieldDefinitionErrors(): ReadonlyArray<TypeSystemValidationErrorRecord> {
    this.collectDocumentTypeRecords();
    return this._uniqueFieldDefinitionErrors;
  }

  getUniqueArgumentDefinitionErrors(): ReadonlyArray<TypeSystemValidationErrorRecord> {
    return this._uniqueArgumentDefinitionErrors;
  }

  getUniqueEnumValueDefinitionErrors(): ReadonlyArray<TypeSystemValidationErrorRecord> {
    this.collectDocumentTypeRecords();
    return this._uniqueEnumValueDefinitionErrors;
  }

  getUniqueUnionMemberTypeErrors(): ReadonlyArray<TypeSystemValidationErrorRecord> {
    this.collectDocumentTypeRecords();
    return this._uniqueUnionMemberTypeErrors;
  }

  getUniqueDirectiveDefinitionErrors(): ReadonlyArray<TypeSystemValidationErrorRecord> {
    return this._uniqueDirectiveDefinitionErrors;
  }

  getUniqueTypeDefinitionErrors(): ReadonlyArray<TypeSystemValidationErrorRecord> {
    return this._uniqueTypeDefinitionErrors;
  }

  getDocumentDirectiveLocationSet(
    directiveName: string,
  ): ReadonlySet<string> | undefined {
    this.collectDefinedDirectives();
    return this._directiveLocationMap.get(directiveName);
  }

  getDocumentDirectiveNames(): ReadonlyArray<string> {
    this.collectDefinedDirectives();
    return (this._directiveNameList ??= Array.from(
      this._directiveLocationMap.keys(),
    ));
  }

  isDocumentDirectiveRepeatable(directiveName: string): boolean | undefined {
    this.collectDefinedDirectives();
    return this._directiveRepeatableMap.get(directiveName);
  }

  hasDocumentTypeDefinition(typeName: string): boolean {
    return this._documentTypeDefinitionNames.has(typeName);
  }

  getDocumentTypeDefinitionName(typeName: string): NameNode | undefined {
    return this._documentTypeDefinitionNameByName.get(typeName);
  }

  getDocumentDirectiveDefinitionName(
    directiveName: string,
  ): NameNode | undefined {
    return this._documentDirectiveDefinitionNameMap.get(directiveName);
  }

  hasDocumentTypeName(typeName: string): boolean {
    return (this._documentTypeKindsByName.get(typeName)?.size ?? 0) !== 0;
  }

  getDocumentTypeKinds(
    typeName: string,
  ): ReadonlySet<DocumentTypeKindName> | undefined {
    return this._documentTypeKindsByName.get(typeName);
  }

  getDocumentTypeNodes(
    typeName: string,
  ): ReadonlyArray<TypeDefinitionNode | TypeExtensionNode> | undefined {
    return this._documentTypeNodesByName.get(typeName);
  }

  getDocumentOutputFields(
    typeName: string,
  ): ReadonlyMap<string, FieldReference> | undefined {
    return this.getDocumentObjectOrInterfaceTypeRecord(typeName)?.outputFields;
  }

  getDocumentInputFields(
    typeName: string,
  ): ReadonlyMap<string, InputFieldReference> | undefined {
    return this.getDocumentInputObjectTypeRecord(typeName)?.inputFields;
  }

  getDocumentImplementedInterfaceNames(
    typeName: string,
  ): ReadonlySet<string> | undefined {
    return this.getDocumentObjectOrInterfaceTypeRecord(typeName)
      ?.implementedInterfaceNames;
  }

  getDocumentUnionMembers(
    typeName: string,
  ): ReadonlyMap<string, NamedTypeNode> | undefined {
    return this.getDocumentUnionTypeRecord(typeName)?.members;
  }

  getDocumentEnumValues(
    typeName: string,
  ): ReadonlyMap<string, EnumValueDefinitionNode> | undefined {
    return this.getDocumentEnumTypeRecord(typeName)?.values;
  }

  getDocumentScalarType(typeName: string): GraphQLScalarType | undefined {
    return this.getDocumentScalarTypeRecord(typeName)?.scalarType;
  }

  isOneOfInputObjectType(typeName: string): boolean {
    return this.getDocumentInputObjectTypeRecord(typeName)?.isOneOf === true;
  }

  private getOrCreateDocumentScalarTypeRecord(
    typeName: string,
  ): DocumentScalarTypeRecord {
    let record = this._documentScalarTypes.get(typeName);
    if (record == null) {
      record = { kind: DocumentTypeKind.SCALAR, typeName };
      this._documentScalarTypes.set(typeName, record);
    }
    return record;
  }

  private getOrCreateDocumentObjectTypeRecord(
    typeName: string,
  ): DocumentObjectTypeRecord {
    let record = this._documentObjectTypes.get(typeName);
    if (record == null) {
      record = { kind: DocumentTypeKind.OBJECT, typeName };
      this._documentObjectTypes.set(typeName, record);
    }
    return record;
  }

  private getOrCreateDocumentInterfaceTypeRecord(
    typeName: string,
  ): DocumentInterfaceTypeRecord {
    let record = this._documentInterfaceTypes.get(typeName);
    if (record == null) {
      record = { kind: DocumentTypeKind.INTERFACE, typeName };
      this._documentInterfaceTypes.set(typeName, record);
    }
    return record;
  }

  private getOrCreateDocumentUnionTypeRecord(
    typeName: string,
  ): DocumentUnionTypeRecord {
    let record = this._documentUnionTypes.get(typeName);
    if (record == null) {
      record = { kind: DocumentTypeKind.UNION, typeName };
      this._documentUnionTypes.set(typeName, record);
    }
    return record;
  }

  private getOrCreateDocumentEnumTypeRecord(
    typeName: string,
  ): DocumentEnumTypeRecord {
    let record = this._documentEnumTypes.get(typeName);
    if (record == null) {
      record = { kind: DocumentTypeKind.ENUM, typeName };
      this._documentEnumTypes.set(typeName, record);
    }
    return record;
  }

  private getOrCreateDocumentInputObjectTypeRecord(
    typeName: string,
  ): DocumentInputObjectTypeRecord {
    let record = this._documentInputObjectTypeRecords.get(typeName);
    if (record == null) {
      record = { kind: DocumentTypeKind.INPUT_OBJECT, typeName };
      this._documentInputObjectTypeRecords.set(typeName, record);
    }
    return record;
  }

  private getDocumentObjectOrInterfaceTypeRecord(
    typeName: string,
  ): DocumentObjectTypeRecord | DocumentInterfaceTypeRecord | undefined {
    this.collectDocumentTypeRecords();
    return (
      this._documentObjectTypes.get(typeName) ??
      this._documentInterfaceTypes.get(typeName)
    );
  }

  private getDocumentScalarTypeRecord(
    typeName: string,
  ): DocumentScalarTypeRecord | undefined {
    this.collectDocumentTypeRecords();
    return this._documentScalarTypes.get(typeName);
  }

  private getDocumentUnionTypeRecord(
    typeName: string,
  ): DocumentUnionTypeRecord | undefined {
    this.collectDocumentTypeRecords();
    return this._documentUnionTypes.get(typeName);
  }

  private getDocumentEnumTypeRecord(
    typeName: string,
  ): DocumentEnumTypeRecord | undefined {
    this.collectDocumentTypeRecords();
    return this._documentEnumTypes.get(typeName);
  }

  private getDocumentInputObjectTypeRecord(
    typeName: string,
  ): DocumentInputObjectTypeRecord | undefined {
    this.collectDocumentTypeRecords();
    return this._documentInputObjectTypeRecords.get(typeName);
  }

  private getOrCreateDocumentTypeKinds(
    typeName: string,
  ): Set<DocumentTypeKindName> {
    let kinds = this._documentTypeKindsByName.get(typeName);
    if (kinds == null) {
      kinds = new Set();
      this._documentTypeKindsByName.set(typeName, kinds);
      this._documentTypeNameList = undefined;
    }
    return kinds;
  }

  private addDocumentTypeNode(
    typeName: string,
    node: TypeDefinitionNode | TypeExtensionNode,
  ): void {
    let nodes = this._documentTypeNodesByName.get(typeName);
    if (nodes == null) {
      nodes = [];
      this._documentTypeNodesByName.set(typeName, nodes);
    }
    nodes.push(node);
  }

  private addTypeDefinition(
    definition: TypeDefinitionNode,
    kind: DocumentTypeKindName,
  ): void {
    const typeName = definition.name.value;
    if (isSpecifiedScalarTypeName(typeName)) {
      this._uniqueTypeDefinitionErrors.push({
        message: `Built-in scalar type "${typeName}" cannot be redefined.`,
        nodes: definition.name,
      });
    } else {
      const documentDefinitionName =
        this._documentTypeDefinitionNameByName.get(typeName);
      if (documentDefinitionName != null) {
        this._uniqueTypeDefinitionErrors.push({
          message: `There can be only one type named "${typeName}".`,
          nodes: [documentDefinitionName, definition.name],
          typeName,
        });
      } else {
        this._documentTypeDefinitionNameByName.set(typeName, definition.name);
      }
    }
    this.addTypeKind(typeName, kind);
    this.addDocumentTypeName(typeName);
    this._documentTypeDefinitionNames.add(typeName);
    this.addDocumentTypeNode(typeName, definition);
  }

  private addTypeExtension(extension: TypeExtensionNode): void {
    const typeName = extension.name.value;
    this.addDocumentTypeNode(typeName, extension);
    this.addDocumentTypeName(typeName);
  }

  private addSchemaOperationTypes(
    schemaNode: SchemaDefinitionNode | SchemaExtensionNode,
  ): boolean {
    const schemaOperationTypes = schemaNode.operationTypes;
    if (schemaOperationTypes == null || schemaOperationTypes.length === 0) {
      return false;
    }

    for (const operationType of schemaOperationTypes) {
      const rootOperationType = {
        typeName: operationType.type.name.value,
        node: operationType.type,
      };
      this._rootOperationTypes.set(operationType.operation, rootOperationType);
      this._explicitRootOperationTypes.set(
        operationType.operation,
        rootOperationType,
      );
    }
    return true;
  }

  private addDefaultRootOperationTypes(): void {
    this.addDefaultRootOperationType('query', 'Query');
    this.addDefaultRootOperationType('mutation', 'Mutation');
    this.addDefaultRootOperationType('subscription', 'Subscription');
  }

  private addDefaultRootOperationType(
    operation: OperationTypeNode,
    typeName: string,
  ): void {
    if (
      !this._rootOperationTypes.has(operation) &&
      this.hasDocumentTypeName(typeName)
    ) {
      this._rootOperationTypes.set(operation, { typeName, node: undefined });
    }
  }

  private addTypeKind(typeName: string, kind: DocumentTypeKindName): void {
    const kinds = this.getOrCreateDocumentTypeKinds(typeName);
    const size = kinds.size;
    kinds.add(kind);
    if (kinds.size !== size) {
      this._documentTypeNameList = undefined;
    }
  }

  private addDocumentTypeName(typeName: string): void {
    const size = this._documentTypeNames.size;
    this._documentTypeNames.add(typeName);
    if (this._documentTypeNames.size !== size) {
      this._documentTypeNameList = undefined;
    }
  }

  private collectDocumentDefinitions(
    definitions: ReadonlyArray<DefinitionNode>,
  ): void {
    let hasSchemaDefinition = false;

    for (const definition of definitions) {
      switch (definition.kind) {
        case Kind.SCHEMA_DEFINITION:
          hasSchemaDefinition = true;
          this.addSchemaOperationTypes(definition);
          break;
        case Kind.SCHEMA_EXTENSION:
          this.addSchemaOperationTypes(definition);
          break;
        case Kind.SCALAR_TYPE_DEFINITION:
          this.addTypeDefinition(definition, DocumentTypeKind.SCALAR);
          break;
        case Kind.SCALAR_TYPE_EXTENSION:
          this.addTypeExtension(definition);
          break;
        case Kind.OBJECT_TYPE_DEFINITION:
          this.addTypeDefinition(definition, DocumentTypeKind.OBJECT);
          break;
        case Kind.OBJECT_TYPE_EXTENSION:
          this.addTypeExtension(definition);
          break;
        case Kind.INTERFACE_TYPE_DEFINITION:
          this.addTypeDefinition(definition, DocumentTypeKind.INTERFACE);
          break;
        case Kind.INTERFACE_TYPE_EXTENSION:
          this.addTypeExtension(definition);
          break;
        case Kind.UNION_TYPE_DEFINITION:
          this.addTypeDefinition(definition, DocumentTypeKind.UNION);
          break;
        case Kind.UNION_TYPE_EXTENSION:
          this.addTypeExtension(definition);
          break;
        case Kind.ENUM_TYPE_DEFINITION:
          this.addTypeDefinition(definition, DocumentTypeKind.ENUM);
          break;
        case Kind.ENUM_TYPE_EXTENSION:
          this.addTypeExtension(definition);
          break;
        case Kind.INPUT_OBJECT_TYPE_DEFINITION:
          this.addTypeDefinition(definition, DocumentTypeKind.INPUT_OBJECT);
          break;
        case Kind.INPUT_OBJECT_TYPE_EXTENSION:
          this.addTypeExtension(definition);
          break;
        case Kind.DIRECTIVE_DEFINITION:
          this.addDocumentDirectiveDefinition(definition);
          break;
        default:
          break;
      }
    }

    if (!hasSchemaDefinition) {
      this.addDefaultRootOperationTypes();
    }
  }

  private collectDocumentValidationElements(
    definitions: ReadonlyArray<DefinitionNode>,
  ): void {
    for (const definition of definitions) {
      switch (definition.kind) {
        case Kind.OBJECT_TYPE_DEFINITION:
        case Kind.OBJECT_TYPE_EXTENSION:
          this.addDocumentImplementedType(
            Kind.OBJECT_TYPE_DEFINITION,
            definition,
          );
          this.addDocumentFieldArgumentDefinitionErrors(
            definition.name.value,
            definition.fields,
          );
          break;
        case Kind.INTERFACE_TYPE_DEFINITION:
        case Kind.INTERFACE_TYPE_EXTENSION:
          this.addDocumentImplementedType(
            Kind.INTERFACE_TYPE_DEFINITION,
            definition,
          );
          this.addDocumentFieldArgumentDefinitionErrors(
            definition.name.value,
            definition.fields,
          );
          break;
        case Kind.INPUT_OBJECT_TYPE_DEFINITION:
        case Kind.INPUT_OBJECT_TYPE_EXTENSION:
          this.addDocumentInputObjectType(definition);
          break;
        case Kind.DIRECTIVE_DEFINITION:
          this.addDocumentArgumentDefinitionErrors(
            `@${definition.name.value}`,
            definition.arguments,
          );
          break;
        default:
          break;
      }
    }
  }

  private addDocumentInputObjectType(node: DocumentInputObjectTypeNode): void {
    this._documentInputObjectTypes.push({ node });
  }

  private addDocumentImplementedType(
    kind:
      | typeof Kind.OBJECT_TYPE_DEFINITION
      | typeof Kind.INTERFACE_TYPE_DEFINITION,
    node: DocumentImplementedTypeNode,
  ): void {
    this._documentImplementedTypes.push({ kind, node });
  }

  private addDocumentFieldArgumentDefinitionErrors(
    typeName: string,
    fields: ReadonlyArray<FieldDefinitionNode> | undefined,
  ): void {
    if (fields == null) {
      return;
    }
    for (const field of fields) {
      this.addDocumentArgumentDefinitionErrors(
        `${typeName}.${field.name.value}`,
        field.arguments,
      );
    }
  }

  private addDocumentArgumentDefinitionErrors(
    parentInputValueStr: string,
    args: ReadonlyArray<InputValueDefinitionNode> | undefined,
  ): void {
    if (args == null) {
      return;
    }
    const knownArgNames = new Map<string, NameNode>();
    for (const arg of args) {
      const argName = arg.name.value;
      const knownArgName = knownArgNames.get(argName);
      if (knownArgName == null) {
        knownArgNames.set(argName, arg.name);
      } else {
        this._uniqueArgumentDefinitionErrors.push({
          message: `Argument "${parentInputValueStr}(${argName}:)" can only be defined once.`,
          nodes: [knownArgName, arg.name],
        });
      }
    }
  }

  private collectDocumentTypeRecords(): void {
    if (this._documentTypeRecordsCollected) {
      return;
    }

    this._documentTypeRecordsCollected = true;
    for (const definition of this.document.definitions) {
      if (isTypeDefinitionNode(definition) || isTypeExtensionNode(definition)) {
        this.collectDocumentTypeDefinitionRecord(definition);
      }
    }
  }

  private collectDocumentTypeDefinitionRecord(
    definition: TypeDefinitionNode | TypeExtensionNode,
  ): void {
    switch (definition.kind) {
      case Kind.SCALAR_TYPE_DEFINITION:
        this.addScalarDefinition(definition);
        break;
      case Kind.OBJECT_TYPE_DEFINITION:
      case Kind.OBJECT_TYPE_EXTENSION: {
        const record = this.getOrCreateDocumentObjectTypeRecord(
          definition.name.value,
        );
        this.addOutputFields(record, definition.fields);
        this.addImplementedInterfaces(
          record,
          getImplementedInterfaceTypeNames(definition.interfaces),
        );
        break;
      }
      case Kind.INTERFACE_TYPE_DEFINITION:
      case Kind.INTERFACE_TYPE_EXTENSION: {
        const record = this.getOrCreateDocumentInterfaceTypeRecord(
          definition.name.value,
        );
        this.addOutputFields(record, definition.fields);
        this.addImplementedInterfaces(
          record,
          getImplementedInterfaceTypeNames(definition.interfaces),
        );
        break;
      }
      case Kind.UNION_TYPE_DEFINITION:
      case Kind.UNION_TYPE_EXTENSION:
        this.addUnionMembers(
          this.getOrCreateDocumentUnionTypeRecord(definition.name.value),
          definition.types,
        );
        break;
      case Kind.ENUM_TYPE_DEFINITION:
      case Kind.ENUM_TYPE_EXTENSION:
        this.addEnumValues(
          this.getOrCreateDocumentEnumTypeRecord(definition.name.value),
          definition,
        );
        break;
      case Kind.INPUT_OBJECT_TYPE_DEFINITION:
        this.addInputObjectDefinition(definition);
        break;
      case Kind.INPUT_OBJECT_TYPE_EXTENSION:
        this.addInputObjectExtension(definition);
        break;
      case Kind.SCALAR_TYPE_EXTENSION:
        break;
    }
  }

  private collectDefinedDirectives(): void {
    if (this._definedDirectivesCollected) {
      return;
    }

    this._definedDirectivesCollected = true;
  }

  private addDocumentDirectiveDefinition(
    definition: DirectiveDefinitionNode,
  ): void {
    const directiveName = definition.name.value;
    const knownName =
      this._documentDirectiveDefinitionNameMap.get(directiveName);
    if (knownName != null) {
      this._uniqueDirectiveDefinitionErrors.push({
        message: `There can be only one directive named "@${directiveName}".`,
        nodes: [knownName, definition.name],
        directiveName,
      });
    } else {
      this._documentDirectiveDefinitionNameMap.set(
        directiveName,
        definition.name,
      );
    }

    this._directiveArgumentMap.delete(directiveName);
    this._directiveLocationMap.set(directiveName, new Set());
    this._directiveNameList = undefined;
    const locations = [];
    for (const location of definition.locations) {
      locations.push(location.value);
    }
    this.addDirectiveLocations(directiveName, locations);
    this._directiveRepeatableMap.set(directiveName, definition.repeatable);
    this.addDirectiveArguments(directiveName, definition.arguments);
  }

  private addOutputFields(
    record: DocumentObjectTypeRecord | DocumentInterfaceTypeRecord,
    fields: ReadonlyArray<FieldDefinitionNode> | undefined,
  ): void {
    if (fields == null || fields.length === 0) {
      return;
    }

    const typeName = record.typeName;
    const outputFields = (record.outputFields ??= new Map());
    for (const field of fields) {
      const fieldName = field.name.value;
      const knownField = outputFields.get(fieldName);
      if (knownField != null && 'kind' in knownField) {
        this._uniqueFieldDefinitionErrors.push({
          message: `Field "${typeName}.${fieldName}" can only be defined once.`,
          nodes: [knownField.name, field.name],
          typeName,
          elementName: fieldName,
        });
      }
      outputFields.set(fieldName, field);
    }
  }

  private addImplementedInterfaces(
    record: DocumentObjectTypeRecord | DocumentInterfaceTypeRecord,
    interfaceNames: ReadonlyArray<string> | undefined,
  ): void {
    if (interfaceNames == null || interfaceNames.length === 0) {
      return;
    }

    const implementedInterfaceNames = (record.implementedInterfaceNames ??=
      new Set());
    for (const interfaceName of interfaceNames) {
      implementedInterfaceNames.add(interfaceName);
    }
  }

  private addUnionMembers(
    record: DocumentUnionTypeRecord,
    memberTypes: ReadonlyArray<NamedTypeNode> | undefined,
  ): void {
    if (memberTypes == null || memberTypes.length === 0) {
      return;
    }

    const typeName = record.typeName;
    const unionMembers = (record.members ??= new Map());
    for (const memberType of memberTypes) {
      const memberTypeName = memberType.name.value;
      const knownMemberTypeNode = unionMembers.get(memberTypeName);
      if (knownMemberTypeNode != null) {
        this._uniqueUnionMemberTypeErrors.push({
          message: `Union type ${typeName} can only include type ${memberTypeName} once.`,
          nodes: [knownMemberTypeNode, memberType],
          typeName,
          elementName: memberTypeName,
        });
      }
      unionMembers.set(memberTypeName, memberType);
    }
  }

  private addScalarDefinition(definition: ScalarTypeDefinitionNode): void {
    const typeName = definition.name.value;
    const record = this.getOrCreateDocumentScalarTypeRecord(typeName);
    record.scalarType ??= new GraphQLScalarType({
      name: typeName,
      astNode: definition,
    });
  }

  private addEnumValues(
    record: DocumentEnumTypeRecord,
    definition: EnumTypeDefinitionNode | EnumTypeExtensionNode,
  ): void {
    const valueNodes = definition.values;
    if (valueNodes == null || valueNodes.length === 0) {
      return;
    }

    const typeName = record.typeName;
    const documentValues = (record.values ??= new Map());

    for (const enumValue of valueNodes) {
      const enumValueName = enumValue.name.value;
      const knownValue = documentValues.get(enumValueName);
      if (knownValue != null) {
        this._uniqueEnumValueDefinitionErrors.push({
          message: `Enum value "${typeName}.${enumValueName}" can only be defined once.`,
          nodes: [knownValue.name, enumValue.name],
          typeName,
          elementName: enumValueName,
        });
      }
      documentValues.set(enumValueName, enumValue);
    }
  }

  private addInputObjectDefinition(
    definition: InputObjectTypeDefinitionNode,
  ): void {
    const record = this.getOrCreateDocumentInputObjectTypeRecord(
      definition.name.value,
    );
    this.addInputObjectFields(record, definition.fields);

    if (definition.directives?.some((node) => node.name.value === 'oneOf')) {
      record.isOneOf = true;
    }
  }

  private addInputObjectExtension(
    extension: InputObjectTypeExtensionNode,
  ): void {
    this.addInputObjectFields(
      this.getOrCreateDocumentInputObjectTypeRecord(extension.name.value),
      extension.fields,
    );
  }

  private addInputObjectFields(
    record: DocumentInputObjectTypeRecord,
    fields: ReadonlyArray<InputValueDefinitionNode> | undefined,
  ): void {
    if (fields == null || fields.length === 0) {
      return;
    }

    const typeName = record.typeName;
    const inputFields = (record.inputFields ??= new Map());
    for (const field of fields) {
      const fieldName = field.name.value;
      const knownField = inputFields.get(fieldName);
      if (knownField != null && 'kind' in knownField) {
        this._uniqueFieldDefinitionErrors.push({
          message: `Field "${typeName}.${fieldName}" can only be defined once.`,
          nodes: [knownField.name, field.name],
          typeName,
          elementName: fieldName,
        });
      }
      inputFields.set(fieldName, field);
    }
  }

  private addDirectiveArguments(
    directiveName: string,
    args: ReadonlyArray<InputValueDefinitionNode> | undefined,
  ): void {
    if (args == null || args.length === 0) {
      return;
    }

    const argMap = new Map<string, ArgumentReference>();
    this._directiveArgumentMap.set(directiveName, argMap);

    for (const arg of args) {
      argMap.set(arg.name.value, arg);
    }
  }

  private addDirectiveLocations(
    directiveName: string,
    locations: ReadonlyArray<string>,
  ): void {
    const knownLocations = this._directiveLocationMap.get(
      directiveName,
    ) as Set<string>;

    for (const location of locations) {
      knownLocations.add(location);
    }
  }

  private getFragmentSignatures(): ReadonlyMap<string, FragmentSignature> {
    let fragmentSignatures = this._fragmentSignatures;
    if (fragmentSignatures === undefined) {
      fragmentSignatures = new Map<string, FragmentSignature>();
      for (const definition of this.document.definitions) {
        if (definition.kind !== Kind.FRAGMENT_DEFINITION) {
          continue;
        }

        const variableDefinitions = new Map<string, VariableDefinitionNode>();
        const variableDefinitionsNodes = definition.variableDefinitions;
        if (variableDefinitionsNodes != null) {
          for (const varDef of variableDefinitionsNodes) {
            variableDefinitions.set(varDef.variable.name.value, varDef);
          }
        }
        fragmentSignatures.set(definition.name.value, {
          definition,
          variableDefinitions,
        });
      }
      this._fragmentSignatures = fragmentSignatures;
    }
    return fragmentSignatures;
  }
}

function collectDocumentFacts(definitions: ReadonlyArray<DefinitionNode>): {
  hasTypeSystemDefinitions: boolean;
  hasRootOperationTypeDefinitions: boolean;
} {
  let hasTypeSystemDefinitions = false;
  let hasRootOperationTypeDefinitions = false;

  for (const definition of definitions) {
    if (
      !hasTypeSystemDefinitions &&
      (isTypeSystemDefinitionNode(definition) ||
        isTypeSystemExtensionNode(definition))
    ) {
      hasTypeSystemDefinitions = true;
    }

    if (
      !hasRootOperationTypeDefinitions &&
      (definition.kind === Kind.SCHEMA_DEFINITION ||
        definition.kind === Kind.SCHEMA_EXTENSION) &&
      definition.operationTypes != null &&
      definition.operationTypes.length !== 0
    ) {
      hasRootOperationTypeDefinitions = true;
    }

    if (hasTypeSystemDefinitions && hasRootOperationTypeDefinitions) {
      break;
    }
  }

  return { hasTypeSystemDefinitions, hasRootOperationTypeDefinitions };
}

function getImplementedInterfaceTypeNames(
  interfaces: ReadonlyArray<NamedTypeNode> | undefined,
): Array<string> | undefined {
  if (interfaces == null || interfaces.length === 0) {
    return;
  }
  const interfaceTypeNames = [];
  for (const iface of interfaces) {
    interfaceTypeNames.push(iface.name.value);
  }
  return interfaceTypeNames;
}

function isSpecifiedScalarTypeName(typeName: string): boolean {
  return specifiedScalarTypeNames.has(typeName);
}

function getDocumentToTraverse(document: DocumentNode): DocumentNode {
  const definitions: Array<DefinitionNode> = [];

  for (const definition of document.definitions) {
    if (isExecutableDefinitionNode(definition)) {
      definitions.push(definition);
      continue;
    }

    const inputValueDefinition = getInputValueTraversalDefinition(definition);
    if (inputValueDefinition != null) {
      definitions.push(inputValueDefinition);
    }
  }

  return { ...document, definitions };
}

function getInputValueTraversalDefinition(
  definition: TypeSystemDefinitionNode | TypeSystemExtensionNode,
): DefinitionNode | undefined {
  switch (definition.kind) {
    case Kind.SCHEMA_DEFINITION:
    case Kind.SCHEMA_EXTENSION:
      return hasDirectiveUsages(definition) ? definition : undefined;
    case Kind.SCALAR_TYPE_DEFINITION:
    case Kind.SCALAR_TYPE_EXTENSION:
    case Kind.UNION_TYPE_DEFINITION:
    case Kind.UNION_TYPE_EXTENSION:
      return hasDirectiveUsages(definition) ? definition : undefined;
    case Kind.OBJECT_TYPE_DEFINITION:
    case Kind.OBJECT_TYPE_EXTENSION:
    case Kind.INTERFACE_TYPE_DEFINITION:
    case Kind.INTERFACE_TYPE_EXTENSION: {
      const fields = getFieldDefinitionsToTraverse(definition.fields);
      return fields == null && !hasDirectiveUsages(definition)
        ? undefined
        : { ...definition, fields };
    }
    case Kind.ENUM_TYPE_DEFINITION:
    case Kind.ENUM_TYPE_EXTENSION: {
      let values: Array<EnumValueDefinitionNode> | undefined;
      const enumValues = definition.values;
      if (enumValues != null) {
        for (const value of enumValues) {
          if (hasDirectiveUsages(value)) {
            (values ??= []).push(value);
          }
        }
      }
      return values == null && !hasDirectiveUsages(definition)
        ? undefined
        : { ...definition, values };
    }
    case Kind.INPUT_OBJECT_TYPE_DEFINITION:
    case Kind.INPUT_OBJECT_TYPE_EXTENSION: {
      const fields = getInputValueDefinitionsToTraverse(definition.fields);
      return fields == null && !hasDirectiveUsages(definition)
        ? undefined
        : { ...definition, fields };
    }
    case Kind.DIRECTIVE_DEFINITION: {
      const args = getInputValueDefinitionsToTraverse(definition.arguments);
      return args == null && !hasDirectiveUsages(definition)
        ? undefined
        : { ...definition, arguments: args };
    }
    case Kind.DIRECTIVE_EXTENSION:
      return hasDirectiveUsages(definition) ? definition : undefined;
  }
}

function getFieldDefinitionsToTraverse(
  fields: ReadonlyArray<FieldDefinitionNode> | undefined,
): Array<FieldDefinitionNode> | undefined {
  if (fields == null) {
    return;
  }
  let fieldDefinitions: Array<FieldDefinitionNode> | undefined;
  for (const field of fields) {
    const args = getInputValueDefinitionsToTraverse(field.arguments);
    if (args != null || hasDirectiveUsages(field)) {
      (fieldDefinitions ??= []).push({ ...field, arguments: args });
    }
  }
  return fieldDefinitions;
}

function getInputValueDefinitionsToTraverse(
  inputValues: ReadonlyArray<InputValueDefinitionNode> | undefined,
): Array<InputValueDefinitionNode> | undefined {
  if (inputValues == null) {
    return;
  }
  let inputValueDefinitions: Array<InputValueDefinitionNode> | undefined;
  for (const inputValue of inputValues) {
    if (inputValue.defaultValue != null || hasDirectiveUsages(inputValue)) {
      (inputValueDefinitions ??= []).push(inputValue);
    }
  }
  return inputValueDefinitions;
}

function hasDirectiveUsages(node: {
  readonly directives?: ReadonlyArray<DirectiveNode> | undefined;
}): boolean {
  return (node.directives?.length ?? 0) !== 0;
}
