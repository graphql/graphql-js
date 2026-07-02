/** @category Validation Rules */

import { inspect } from '../../jsutils/inspect.ts';
import { invariant } from '../../jsutils/invariant.ts';
import type { Maybe } from '../../jsutils/Maybe.ts';

import { GraphQLError } from '../../error/GraphQLError.ts';

import type {
  ASTNode,
  DirectiveNode,
  FieldDefinitionNode,
  InputValueDefinitionNode,
  InterfaceTypeDefinitionNode,
  InterfaceTypeExtensionNode,
  NamedTypeNode,
  ObjectTypeDefinitionNode,
  ObjectTypeExtensionNode,
  TypeNode,
} from '../../language/ast.ts';
import { Kind } from '../../language/kinds.ts';

import type {
  GraphQLArgument,
  GraphQLField,
  GraphQLInterfaceType,
  GraphQLObjectType,
  GraphQLType,
} from '../../type/definition.ts';
import {
  isInputType,
  isInterfaceType,
  isListType,
  isNonNullType,
  isObjectType,
  isOutputType,
  isRequiredArgument,
} from '../../type/definition.ts';
import { GraphQLDeprecatedDirective } from '../../type/directives.ts';
import type { GraphQLSchema } from '../../type/schema.ts';

import {
  isEqualType,
  isTypeSubTypeOf,
} from '../../utilities/typeComparators.ts';

import { IndexCursor } from '../IndexCursor.ts';
import type {
  TypeSystemValidationFn,
  TypeSystemValidationIndex,
} from '../TypeSystemValidationIndex.ts';
import { DocumentTypeKind } from '../TypeSystemValidationIndex.ts';

/**
 * Object and interface types must only implement unique, valid interfaces and
 * must satisfy their implemented interfaces.
 *
 * See https://spec.graphql.org/draft/#sec-Interfaces
 * See https://spec.graphql.org/draft/#sec-Objects
 * @category Validation Rules
 
 * @internal
 */
export const InterfaceImplementationsAreValidTypeSystemValidation: TypeSystemValidationFn =
  (index: TypeSystemValidationIndex): void => {
    if (index.shouldValidateSchemaOnlyElements()) {
      function validateImplementedInterface(
        iface: unknown,
        type: GraphQLObjectType | GraphQLInterfaceType,
        ifaceTypeNames: Set<string>,
      ): void {
        if (!isInterfaceType(iface)) {
          index.reportError(
            implementedInterfaceTypeErrorMessage(String(type), inspect(iface)),
            getAllImplementsInterfaceNodes(type, iface as GraphQLInterfaceType),
          );
          return;
        }

        if (type === iface) {
          index.reportError(
            implementedInterfaceSelfReferenceErrorMessage(String(type)),
            getAllImplementsInterfaceNodes(type, iface),
          );
          return;
        }

        if (ifaceTypeNames.has(iface.name)) {
          index.reportError(
            duplicateImplementedInterfaceErrorMessage(
              String(type),
              String(iface),
            ),
            getAllImplementsInterfaceNodes(type, iface),
          );
          return;
        }

        ifaceTypeNames.add(iface.name);

        validateTypeImplementsAncestors(index, type, iface);
        validateTypeImplementsInterface(index, type, iface);
      }

      for (const { type } of index.getSchemaValidationElements().objectTypes) {
        const ifaceTypeNames = new Set<string>();
        for (const iface of type.getInterfaces()) {
          validateImplementedInterface(iface, type, ifaceTypeNames);
        }
      }

      for (const { type } of index.getSchemaValidationElements()
        .interfaceTypes) {
        const ifaceTypeNames = new Set<string>();
        for (const iface of type.getInterfaces()) {
          validateImplementedInterface(iface, type, ifaceTypeNames);
        }
      }
    }

    const model = createSDLInterfaceImplementationModel(index.schema);
    for (const {
      kind,
      node,
    } of index.documentIndex.getDocumentImplementedTypes()) {
      addObjectOrInterfaceNode(model, node, kind);
    }
    validateSDLInterfaceImplementations(
      (error) => {
        index.reportGraphQLError(error);
      },
      new IndexCursor(index),
      model,
    );
  };

function validateTypeImplementsInterface(
  index: TypeSystemValidationIndex,
  type: GraphQLObjectType | GraphQLInterfaceType,
  iface: GraphQLInterfaceType,
): void {
  invariant(index.schema != null);
  const typeFieldMap = type.getFields();

  // Assert each interface field is implemented.
  for (const ifaceField of Object.values(iface.getFields())) {
    const typeField = typeFieldMap[ifaceField.name];

    // Assert interface field exists on type.
    if (typeField == null) {
      index.reportError(
        missingInterfaceFieldErrorMessage(String(ifaceField), String(type)),
        [ifaceField.astNode, type.astNode, ...type.extensionASTNodes],
      );
      continue;
    }

    // Assert interface field type is satisfied by type field type, by being
    // a valid subtype. (covariant)
    if (
      isOutputType(ifaceField.type) &&
      isOutputType(typeField.type) &&
      !isTypeSubTypeOf(index.schema, typeField.type, ifaceField.type)
    ) {
      index.reportError(
        interfaceFieldTypeErrorMessage(
          String(ifaceField),
          String(ifaceField.type),
          String(typeField),
          String(typeField.type),
        ),
        [ifaceField.astNode?.type, typeField.astNode?.type],
      );
    }

    // Assert each interface field arg is implemented.
    for (const ifaceArg of ifaceField.args) {
      const typeArg = findArgumentByName(typeField.args, ifaceArg.name);

      // Assert interface field arg exists on object field.
      if (!typeArg) {
        index.reportError(
          missingInterfaceFieldArgumentErrorMessage(
            String(ifaceArg),
            String(typeField),
          ),
          [ifaceArg.astNode, typeField.astNode],
        );
        continue;
      }

      // Assert interface field arg type matches object field arg type.
      // (invariant)
      // TODO: change to contravariant?
      if (
        isInputType(ifaceArg.type) &&
        isInputType(typeArg.type) &&
        !isEqualType(ifaceArg.type, typeArg.type)
      ) {
        index.reportError(
          interfaceFieldArgumentTypeErrorMessage(
            String(ifaceArg),
            String(ifaceArg.type),
            String(typeArg),
            String(typeArg.type),
          ),
          [ifaceArg.astNode?.type, typeArg.astNode?.type],
        );
      }
    }

    // Assert additional arguments must not be required.
    for (const typeArg of typeField.args) {
      if (isRequiredArgument(typeArg)) {
        const ifaceArg = findArgumentByName(ifaceField.args, typeArg.name);
        if (!ifaceArg) {
          index.reportError(
            extraRequiredArgumentErrorMessage(
              String(typeArg),
              String(typeArg.type),
              String(ifaceField),
            ),
            [typeArg.astNode, ifaceField.astNode],
          );
        }
      }
    }

    // Asserts that field is not deprecated unless interface field is.
    if (
      typeField.deprecationReason != null &&
      ifaceField.deprecationReason == null
    ) {
      index.reportError(
        implementationFieldDeprecationErrorMessage(
          `${iface.name}.${ifaceField.name}`,
          `${type.name}.${typeField.name}`,
        ),
        [
          getDeprecatedDirectiveNode(typeField.astNode),
          typeField.astNode?.type,
        ],
      );
    }
  }
}

function findArgumentByName(
  args: ReadonlyArray<GraphQLArgument>,
  name: string,
): GraphQLArgument | undefined {
  for (const arg of args) {
    if (arg.name === name) {
      return arg;
    }
  }
}

function validateTypeImplementsAncestors(
  index: TypeSystemValidationIndex,
  type: GraphQLObjectType | GraphQLInterfaceType,
  iface: GraphQLInterfaceType,
): void {
  const ifaceInterfaces = type.getInterfaces();
  for (const transitive of iface.getInterfaces()) {
    if (!ifaceInterfaces.includes(transitive)) {
      index.reportError(
        transitive === type
          ? implementedInterfaceCircularReferenceErrorMessage(
              String(type),
              String(iface),
            )
          : missingTransitiveInterfaceErrorMessage(
              String(type),
              String(transitive),
              String(iface),
            ),
        [
          ...getAllImplementsInterfaceNodes(iface, transitive),
          ...getAllImplementsInterfaceNodes(type, iface),
        ],
      );
    }
  }
}

interface SDLInterfaceImplementationModel {
  readonly schema: Maybe<GraphQLSchema>;
  readonly types: Map<string, SDLImplementedType>;
  readonly loadedSchemaTypeNames: Set<string>;
}

interface SDLImplementedType {
  readonly name: string;
  readonly kind:
    | typeof Kind.OBJECT_TYPE_DEFINITION
    | typeof Kind.INTERFACE_TYPE_DEFINITION;
  schemaType?: GraphQLObjectType | GraphQLInterfaceType;
  isFromDocument: boolean;
  readonly interfaces: Map<string, SDLImplementedInterface>;
  readonly fieldNodes: Array<FieldDefinitionNode>;
  fieldMap: Map<string, SDLImplementedField> | undefined;
}

interface SDLImplementedInterface {
  readonly firstNode: NamedTypeNode | undefined;
  lastNode: NamedTypeNode | undefined;
  isDuplicate: boolean;
}

interface SDLImplementedField {
  readonly name: string;
  readonly parentName: string;
  readonly type: TypeRef;
  readonly node: Maybe<ASTNode>;
  readonly typeNode: Maybe<TypeNode>;
  readonly typeIsOutput: boolean;
  readonly schemaArgs: ReadonlyArray<GraphQLArgument> | undefined;
  readonly argNodes: ReadonlyArray<InputValueDefinitionNode> | undefined;
  argMap: Map<string, SDLImplementedArgument> | undefined;
  readonly deprecationReason: Maybe<string>;
  readonly deprecatedDirectiveNode: Maybe<DirectiveNode>;
}

interface SDLImplementedArgument {
  readonly name: string;
  readonly type: TypeRef;
  readonly typeNode: Maybe<TypeNode>;
  readonly typeIsInput: boolean;
  readonly required: boolean;
  readonly node: Maybe<ASTNode>;
}

type TypeRef =
  | { readonly kind: 'Named'; readonly name: string }
  | { readonly kind: 'List'; readonly ofType: TypeRef }
  | { readonly kind: 'NonNull'; readonly ofType: TypeRef };

type ReportErrorFn = (error: GraphQLError) => void;

function createSDLInterfaceImplementationModel(
  schema: Maybe<GraphQLSchema>,
): SDLInterfaceImplementationModel {
  return {
    schema,
    types: new Map(),
    loadedSchemaTypeNames: new Set(),
  };
}

function validateSDLInterfaceImplementations(
  reportError: ReportErrorFn,
  indexCursor: IndexCursor,
  model: SDLInterfaceImplementationModel,
): void {
  for (const type of model.types.values()) {
    for (const [ifaceName, ifaceRecord] of type.interfaces) {
      if (
        indexCursor.index.hasOtherTypeKind(
          ifaceName,
          DocumentTypeKind.INTERFACE,
        )
      ) {
        reportError(
          new GraphQLError(
            implementedInterfaceTypeErrorMessage(type.name, ifaceName),
            { nodes: definedNodes(...implementedInterfaceNodes(ifaceRecord)) },
          ),
        );
        continue;
      }

      if (ifaceName === type.name) {
        reportError(
          new GraphQLError(
            implementedInterfaceSelfReferenceErrorMessage(type.name),
            { nodes: definedNodes(...implementedInterfaceNodes(ifaceRecord)) },
          ),
        );
        continue;
      }

      if (ifaceRecord.isDuplicate) {
        reportError(
          new GraphQLError(
            duplicateImplementedInterfaceErrorMessage(type.name, ifaceName),
            { nodes: definedNodes(...implementedInterfaceNodes(ifaceRecord)) },
          ),
        );
        continue;
      }

      const iface = model.types.get(ifaceName);
      if (iface?.kind !== Kind.INTERFACE_TYPE_DEFINITION) {
        continue;
      }
      if (!type.isFromDocument && !iface.isFromDocument) {
        continue;
      }

      validateSDLTypeImplementsAncestors(reportError, type, iface);
      validateSDLTypeImplementsInterface(
        reportError,
        model,
        indexCursor,
        type,
        iface,
      );
    }
  }
}

function validateSDLTypeImplementsAncestors(
  reportError: ReportErrorFn,
  type: SDLImplementedType,
  iface: SDLImplementedType,
): void {
  for (const [transitiveName, transitiveIfaceRecord] of iface.interfaces) {
    if (type.interfaces.has(transitiveName)) {
      continue;
    }

    const implementedIfaceRecord = type.interfaces.get(
      iface.name,
    ) as SDLImplementedInterface;

    reportError(
      new GraphQLError(
        transitiveName === type.name
          ? implementedInterfaceCircularReferenceErrorMessage(
              type.name,
              iface.name,
            )
          : missingTransitiveInterfaceErrorMessage(
              type.name,
              transitiveName,
              iface.name,
            ),
        {
          nodes: definedNodes(
            ...implementedInterfaceNodes(transitiveIfaceRecord),
            ...implementedInterfaceNodes(implementedIfaceRecord),
          ),
        },
      ),
    );
  }
}

function validateSDLTypeImplementsInterface(
  reportError: ReportErrorFn,
  model: SDLInterfaceImplementationModel,
  indexCursor: IndexCursor,
  type: SDLImplementedType,
  iface: SDLImplementedType,
): void {
  const typeFieldMap = getImplementedFields(indexCursor, type);

  for (const ifaceField of getImplementedFields(indexCursor, iface).values()) {
    const typeField = typeFieldMap.get(ifaceField.name);
    if (typeField == null) {
      reportError(
        new GraphQLError(
          missingInterfaceFieldErrorMessage(
            fieldToString(ifaceField),
            type.name,
          ),
          { nodes: definedNodes(ifaceField.node) },
        ),
      );
      continue;
    }

    validateSDLImplementationField(
      reportError,
      model,
      indexCursor,
      typeField,
      ifaceField,
    );
  }
}

function validateSDLImplementationField(
  reportError: ReportErrorFn,
  model: SDLInterfaceImplementationModel,
  indexCursor: IndexCursor,
  typeField: SDLImplementedField,
  ifaceField: SDLImplementedField,
): void {
  if (
    ifaceField.typeIsOutput &&
    typeField.typeIsOutput &&
    !isSDLTypeSubTypeOf(model, indexCursor, typeField.type, ifaceField.type)
  ) {
    reportError(
      new GraphQLError(
        interfaceFieldTypeErrorMessage(
          fieldToString(ifaceField),
          typeRefToString(ifaceField.type),
          fieldToString(typeField),
          typeRefToString(typeField.type),
        ),
        { nodes: definedNodes(ifaceField.typeNode, typeField.typeNode) },
      ),
    );
  }

  const ifaceArgMap = getImplementedArguments(indexCursor, ifaceField);
  const typeArgMap = getImplementedArguments(indexCursor, typeField);

  for (const ifaceArg of ifaceArgMap.values()) {
    const typeArg = typeArgMap.get(ifaceArg.name);
    if (typeArg == null) {
      reportError(
        new GraphQLError(
          missingInterfaceFieldArgumentErrorMessage(
            argumentToString(ifaceField, ifaceArg),
            fieldToString(typeField),
          ),
          { nodes: definedNodes(ifaceArg.node, typeField.node) },
        ),
      );
      continue;
    }

    if (
      ifaceArg.typeIsInput &&
      typeArg.typeIsInput &&
      !isTypeRefEqual(ifaceArg.type, typeArg.type)
    ) {
      reportError(
        new GraphQLError(
          interfaceFieldArgumentTypeErrorMessage(
            argumentToString(ifaceField, ifaceArg),
            typeRefToString(ifaceArg.type),
            argumentToString(typeField, typeArg),
            typeRefToString(typeArg.type),
          ),
          { nodes: definedNodes(ifaceArg.typeNode, typeArg.typeNode) },
        ),
      );
    }
  }

  for (const typeArg of typeArgMap.values()) {
    if (typeArg.required && !ifaceArgMap.has(typeArg.name)) {
      reportError(
        new GraphQLError(
          extraRequiredArgumentErrorMessage(
            argumentToString(typeField, typeArg),
            typeRefToString(typeArg.type),
            fieldToString(ifaceField),
          ),
          { nodes: definedNodes(typeArg.node, ifaceField.node) },
        ),
      );
    }
  }

  if (
    typeField.deprecationReason != null &&
    ifaceField.deprecationReason == null
  ) {
    reportError(
      new GraphQLError(
        implementationFieldDeprecationErrorMessage(
          fieldToString(ifaceField),
          fieldToString(typeField),
        ),
        {
          nodes: definedNodes(
            typeField.deprecatedDirectiveNode,
            ifaceField.node,
          ),
        },
      ),
    );
  }
}

function getImplementedTypeState(
  model: SDLInterfaceImplementationModel,
  typeName: string,
  kind:
    | typeof Kind.OBJECT_TYPE_DEFINITION
    | typeof Kind.INTERFACE_TYPE_DEFINITION,
): SDLImplementedType {
  let state = model.types.get(typeName);
  if (state == null) {
    state = {
      name: typeName,
      kind,
      isFromDocument: false,
      interfaces: new Map(),
      fieldNodes: [],
      fieldMap: undefined,
    };
    model.types.set(typeName, state);
  }
  return state;
}

function addImplementedInterface(
  type: SDLImplementedType,
  ifaceName: string,
  ifaceNode: NamedTypeNode | undefined,
): void {
  const ifaceRecord = type.interfaces.get(ifaceName);
  if (ifaceRecord == null) {
    type.interfaces.set(ifaceName, {
      firstNode: ifaceNode,
      lastNode: ifaceNode,
      isDuplicate: false,
    });
    return;
  }

  ifaceRecord.lastNode = ifaceNode;
  ifaceRecord.isDuplicate = true;
}

function addObjectOrInterfaceNode(
  model: SDLInterfaceImplementationModel,
  node:
    | ObjectTypeDefinitionNode
    | ObjectTypeExtensionNode
    | InterfaceTypeDefinitionNode
    | InterfaceTypeExtensionNode,
  kind:
    | typeof Kind.OBJECT_TYPE_DEFINITION
    | typeof Kind.INTERFACE_TYPE_DEFINITION,
): void {
  addSchemaTypeByName(model, node.name.value);
  const type = getImplementedTypeState(model, node.name.value, kind);
  type.isFromDocument = true;

  const interfaces = node.interfaces;
  if (interfaces != null) {
    for (const ifaceNode of interfaces) {
      addSchemaTypeByName(model, ifaceNode.name.value);
      addImplementedInterface(type, ifaceNode.name.value, ifaceNode);
    }
  }

  const fields = node.fields;
  if (fields != null) {
    for (const fieldNode of fields) {
      type.fieldNodes.push(fieldNode);
    }
  }

  if (kind === Kind.INTERFACE_TYPE_DEFINITION) {
    addSchemaImplementationsByInterfaceName(model, node.name.value);
  }
}

function addSchemaImplementationsByInterfaceName(
  model: SDLInterfaceImplementationModel,
  ifaceName: string,
): void {
  const schema = model.schema;
  if (schema == null) {
    return;
  }

  const schemaType = schema.getType(ifaceName);
  if (!isInterfaceType(schemaType)) {
    return;
  }

  const implementations = schema.getImplementations(schemaType);
  for (const type of implementations.objects) {
    addSchemaTypeByName(model, type.name);
  }
  for (const type of implementations.interfaces) {
    addSchemaTypeByName(model, type.name);
  }
}

function addSchemaTypeByName(
  model: SDLInterfaceImplementationModel,
  typeName: string,
): void {
  if (model.loadedSchemaTypeNames.has(typeName)) {
    return;
  }

  model.loadedSchemaTypeNames.add(typeName);
  const type = model.schema?.getType(typeName);
  if (isObjectType(type) || isInterfaceType(type)) {
    const state = getImplementedTypeState(
      model,
      type.name,
      isObjectType(type)
        ? Kind.OBJECT_TYPE_DEFINITION
        : Kind.INTERFACE_TYPE_DEFINITION,
    );
    state.schemaType ??= type;

    for (const iface of type.getInterfaces()) {
      addSchemaTypeByName(model, iface.name);
      addImplementedInterface(state, iface.name, undefined);
    }
  }
}

function getImplementedFields(
  indexCursor: IndexCursor,
  type: SDLImplementedType,
): Map<string, SDLImplementedField> {
  if (type.fieldMap != null) {
    return type.fieldMap;
  }

  const fieldMap = new Map<string, SDLImplementedField>();

  if (type.schemaType != null) {
    for (const field of Object.values(type.schemaType.getFields())) {
      addSchemaField(fieldMap, type.name, field);
    }
  }

  for (const fieldNode of type.fieldNodes) {
    addSDLField(indexCursor, fieldMap, type.name, fieldNode);
  }

  type.fieldMap = fieldMap;
  return fieldMap;
}

function addSchemaField(
  fieldMap: Map<string, SDLImplementedField>,
  parentName: string,
  field: GraphQLField<unknown, unknown>,
): void {
  addImplementedField(fieldMap, field.name, {
    name: field.name,
    parentName,
    type: typeRefFromGraphQLType(field.type),
    node: field.astNode,
    typeNode: field.astNode?.type,
    typeIsOutput: isOutputType(field.type),
    schemaArgs: field.args,
    argNodes: undefined,
    argMap: undefined,
    deprecationReason: field.deprecationReason,
    deprecatedDirectiveNode: getDeprecatedDirectiveNode(field.astNode),
  });
}

function schemaArgument(arg: GraphQLArgument): SDLImplementedArgument {
  return {
    name: arg.name,
    type: typeRefFromGraphQLType(arg.type),
    typeNode: arg.astNode?.type,
    typeIsInput: isInputType(arg.type),
    required: isRequiredArgument(arg),
    node: arg.astNode,
  };
}

function addSDLField(
  indexCursor: IndexCursor,
  fieldMap: Map<string, SDLImplementedField>,
  parentName: string,
  fieldNode: FieldDefinitionNode,
): void {
  const deprecatedDirectiveNode = getDeprecatedDirectiveNode(fieldNode);
  addImplementedField(fieldMap, fieldNode.name.value, {
    name: fieldNode.name.value,
    parentName,
    type: typeRefFromTypeNode(fieldNode.type),
    node: fieldNode,
    typeNode: fieldNode.type,
    typeIsOutput: indexCursor.index.isOutputType(fieldNode.type),
    schemaArgs: undefined,
    argNodes: fieldNode.arguments,
    argMap: undefined,
    deprecationReason: deprecatedDirectiveNode == null ? undefined : '',
    deprecatedDirectiveNode,
  });
}

function addImplementedField(
  fieldMap: Map<string, SDLImplementedField>,
  fieldName: string,
  field: SDLImplementedField,
): void {
  fieldMap.set(fieldName, field);
}

function getImplementedArguments(
  indexCursor: IndexCursor,
  field: SDLImplementedField,
): Map<string, SDLImplementedArgument> {
  if (field.argMap != null) {
    return field.argMap;
  }

  const argMap = new Map<string, SDLImplementedArgument>();
  if (field.schemaArgs != null) {
    for (const arg of field.schemaArgs) {
      addImplementedArgument(argMap, schemaArgument(arg));
    }
  }

  if (field.argNodes != null) {
    for (const argNode of field.argNodes) {
      addImplementedArgument(argMap, sdlArgument(indexCursor, argNode));
    }
  }

  field.argMap = argMap;
  return argMap;
}

function addImplementedArgument(
  argMap: Map<string, SDLImplementedArgument>,
  arg: SDLImplementedArgument,
): void {
  argMap.set(arg.name, arg);
}

function sdlArgument(
  indexCursor: IndexCursor,
  argNode: InputValueDefinitionNode,
): SDLImplementedArgument {
  return {
    name: argNode.name.value,
    type: typeRefFromTypeNode(argNode.type),
    typeNode: argNode.type,
    typeIsInput: indexCursor.index.isInputType(argNode.type),
    required:
      argNode.type.kind === Kind.NON_NULL_TYPE && argNode.defaultValue == null,
    node: argNode,
  };
}

function fieldToString(field: SDLImplementedField): string {
  return `${field.parentName}.${field.name}`;
}

function argumentToString(
  field: SDLImplementedField,
  arg: SDLImplementedArgument,
): string {
  return `${fieldToString(field)}(${arg.name}:)`;
}

function typeRefFromGraphQLType(type: GraphQLType): TypeRef {
  if (isNonNullType(type)) {
    return { kind: 'NonNull', ofType: typeRefFromGraphQLType(type.ofType) };
  }
  if (isListType(type)) {
    return { kind: 'List', ofType: typeRefFromGraphQLType(type.ofType) };
  }
  return { kind: 'Named', name: type.name };
}

function typeRefFromTypeNode(typeNode: TypeNode): TypeRef {
  if (typeNode.kind === Kind.NON_NULL_TYPE) {
    return { kind: 'NonNull', ofType: typeRefFromTypeNode(typeNode.type) };
  }
  if (typeNode.kind === Kind.LIST_TYPE) {
    return { kind: 'List', ofType: typeRefFromTypeNode(typeNode.type) };
  }
  return { kind: 'Named', name: typeNode.name.value };
}

function typeRefToString(type: TypeRef): string {
  if (type.kind === 'Named') {
    return type.name;
  }
  if (type.kind === 'List') {
    return `[${typeRefToString(type.ofType)}]`;
  }
  return `${typeRefToString(type.ofType)}!`;
}

function isTypeRefEqual(typeA: TypeRef, typeB: TypeRef): boolean {
  if (typeA.kind !== typeB.kind) {
    return false;
  }
  if (typeA.kind === 'Named') {
    return typeA.name === (typeB as typeof typeA).name;
  }
  return isTypeRefEqual(typeA.ofType, (typeB as typeof typeA).ofType);
}

function isSDLTypeSubTypeOf(
  model: SDLInterfaceImplementationModel,
  indexCursor: IndexCursor,
  maybeSubType: TypeRef,
  superType: TypeRef,
): boolean {
  if (isTypeRefEqual(maybeSubType, superType)) {
    return true;
  }

  if (superType.kind === 'NonNull') {
    return (
      maybeSubType.kind === 'NonNull' &&
      isSDLTypeSubTypeOf(
        model,
        indexCursor,
        maybeSubType.ofType,
        superType.ofType,
      )
    );
  }
  if (maybeSubType.kind === 'NonNull') {
    return isSDLTypeSubTypeOf(
      model,
      indexCursor,
      maybeSubType.ofType,
      superType,
    );
  }

  if (superType.kind === 'List') {
    return (
      maybeSubType.kind === 'List' &&
      isSDLTypeSubTypeOf(
        model,
        indexCursor,
        maybeSubType.ofType,
        superType.ofType,
      )
    );
  }
  if (maybeSubType.kind === 'List') {
    return false;
  }

  const maybeSubNamed = maybeSubType.name;
  const superNamed = superType.name;
  addSchemaTypeByName(model, maybeSubNamed);
  addSchemaTypeByName(model, superNamed);

  const superTypeState = model.types.get(superNamed);
  if (superTypeState?.kind === Kind.INTERFACE_TYPE_DEFINITION) {
    return typeImplementsInterface(model, maybeSubNamed, superNamed);
  }

  return indexCursor.index.hasUnionMember(superNamed, maybeSubNamed);
}

function typeImplementsInterface(
  model: SDLInterfaceImplementationModel,
  typeName: string,
  ifaceName: string,
  visited = new Set<string>(),
): boolean {
  if (visited.has(typeName)) {
    return false;
  }
  visited.add(typeName);

  addSchemaTypeByName(model, typeName);
  const type = model.types.get(typeName);
  if (type == null) {
    return false;
  }
  if (type.interfaces.has(ifaceName)) {
    return true;
  }
  for (const transitiveName of type.interfaces.keys()) {
    if (typeImplementsInterface(model, transitiveName, ifaceName, visited)) {
      return true;
    }
  }
  return false;
}

function implementedInterfaceNodes(
  ifaceRecord: SDLImplementedInterface,
): ReadonlyArray<NamedTypeNode | undefined> {
  return ifaceRecord.isDuplicate
    ? [ifaceRecord.firstNode, ifaceRecord.lastNode]
    : [ifaceRecord.firstNode];
}

function definedNodes(
  ...nodes: ReadonlyArray<Maybe<ASTNode>>
): ReadonlyArray<ASTNode> | undefined {
  const defined = nodes.filter((node) => node != null);
  return defined.length === 0 ? undefined : defined;
}

function implementedInterfaceTypeErrorMessage(
  typeStr: string,
  ifaceStr: string,
): string {
  return `Type ${typeStr} must only implement Interface types, it cannot implement ${ifaceStr}.`;
}

function implementedInterfaceSelfReferenceErrorMessage(
  typeStr: string,
): string {
  return `Type ${typeStr} cannot implement itself because it would create a circular reference.`;
}

function duplicateImplementedInterfaceErrorMessage(
  typeStr: string,
  ifaceStr: string,
): string {
  return `Type ${typeStr} can only implement ${ifaceStr} once.`;
}

function missingInterfaceFieldErrorMessage(
  ifaceFieldStr: string,
  typeStr: string,
): string {
  return `Interface field ${ifaceFieldStr} expected but ${typeStr} does not provide it.`;
}

function interfaceFieldTypeErrorMessage(
  ifaceFieldStr: string,
  ifaceFieldTypeStr: string,
  typeFieldStr: string,
  typeFieldTypeStr: string,
): string {
  return `Interface field ${ifaceFieldStr} expects type ${ifaceFieldTypeStr} but ${typeFieldStr} is type ${typeFieldTypeStr}.`;
}

function missingInterfaceFieldArgumentErrorMessage(
  ifaceArgStr: string,
  typeFieldStr: string,
): string {
  return `Interface field argument ${ifaceArgStr} expected but ${typeFieldStr} does not provide it.`;
}

function interfaceFieldArgumentTypeErrorMessage(
  ifaceArgStr: string,
  ifaceArgTypeStr: string,
  typeArgStr: string,
  typeArgTypeStr: string,
): string {
  return `Interface field argument ${ifaceArgStr} expects type ${ifaceArgTypeStr} but ${typeArgStr} is type ${typeArgTypeStr}.`;
}

function extraRequiredArgumentErrorMessage(
  typeArgStr: string,
  typeArgTypeStr: string,
  ifaceFieldStr: string,
): string {
  return `Argument "${typeArgStr}" must not be required type "${typeArgTypeStr}" if not provided by the Interface field "${ifaceFieldStr}".`;
}

function implementationFieldDeprecationErrorMessage(
  ifaceFieldStr: string,
  typeFieldStr: string,
): string {
  return `Interface field ${ifaceFieldStr} is not deprecated, so implementation field ${typeFieldStr} must not be deprecated.`;
}

function implementedInterfaceCircularReferenceErrorMessage(
  typeStr: string,
  ifaceStr: string,
): string {
  return `Type ${typeStr} cannot implement ${ifaceStr} because it would create a circular reference.`;
}

function missingTransitiveInterfaceErrorMessage(
  typeStr: string,
  transitiveStr: string,
  ifaceStr: string,
): string {
  return `Type ${typeStr} must implement ${transitiveStr} because it is implemented by ${ifaceStr}.`;
}

function getAllImplementsInterfaceNodes(
  type: GraphQLObjectType | GraphQLInterfaceType,
  iface: GraphQLInterfaceType,
): ReadonlyArray<NamedTypeNode> {
  const { astNode, extensionASTNodes } = type;
  const ifaceNodes = [];
  if (astNode?.interfaces != null) {
    for (const ifaceNode of astNode.interfaces) {
      if (ifaceNode.name.value === iface.name) {
        ifaceNodes.push(ifaceNode);
      }
    }
  }
  for (const extensionASTNode of extensionASTNodes) {
    if (extensionASTNode.interfaces == null) {
      continue;
    }
    for (const ifaceNode of extensionASTNode.interfaces) {
      if (ifaceNode.name.value === iface.name) {
        ifaceNodes.push(ifaceNode);
      }
    }
  }
  return ifaceNodes;
}

function getDeprecatedDirectiveNode(
  definitionNode: Maybe<{
    readonly directives?: ReadonlyArray<DirectiveNode> | undefined;
  }>,
): Maybe<DirectiveNode> {
  return definitionNode?.directives?.find(
    (node) => node.name.value === GraphQLDeprecatedDirective.name,
  );
}
