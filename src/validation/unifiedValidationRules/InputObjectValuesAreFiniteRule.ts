/** @category Validation Rules */

import type { Maybe } from '../../jsutils/Maybe.ts';

import { GraphQLError } from '../../error/GraphQLError.ts';

import type {
  ASTNode,
  InputObjectTypeDefinitionNode,
  InputObjectTypeExtensionNode,
  InputValueDefinitionNode,
  TypeNode,
} from '../../language/ast.ts';
import { Kind } from '../../language/kinds.ts';

import type {
  GraphQLInputField,
  GraphQLInputObjectType,
  GraphQLInputType,
} from '../../type/definition.ts';
import {
  getNamedType,
  isInputObjectType,
  isListType,
  isNonNullType,
} from '../../type/definition.ts';
import { GraphQLOneOfDirective } from '../../type/directives.ts';
import type { GraphQLSchema } from '../../type/schema.ts';

import type {
  TypeSystemValidationFn,
  TypeSystemValidationIndex,
} from '../TypeSystemValidationIndex.ts';

/**
 * Input object types must be able to be provided finite values. Circular
 * references must be breakable by nullable or list fields, including the
 * OneOf-specific cycle rules.
 *
 * See https://spec.graphql.org/draft/#sec-Input-Objects
 * See https://spec.graphql.org/draft/#sec-OneOf-Input-Objects
 * @category Validation Rules
 
 * @internal
 */
export const InputObjectValuesAreFiniteTypeSystemValidation: TypeSystemValidationFn =
  (index: TypeSystemValidationIndex): void => {
    if (index.shouldValidateSchemaOnlyElements()) {
      const finiteValueStates = new Map<
        GraphQLInputObjectType,
        InputObjectFiniteValueState
      >();

      for (const { type, fields } of index.getSchemaValidationElements()
        .inputObjectTypes) {
        initializeInputObjectFiniteValueState(finiteValueStates, type, fields);
      }

      detectInputObjectNonFiniteValues(index, finiteValueStates);
    }

    const inputObjectTypes = index.documentIndex.getDocumentInputObjectTypes();
    if (inputObjectTypes.length === 0) {
      return;
    }

    const finiteValueStates = createSDLInputObjectFiniteValueStates(
      index.schema,
    );
    for (const { node } of inputObjectTypes) {
      if (node.kind === Kind.INPUT_OBJECT_TYPE_DEFINITION) {
        addSDLInputObjectDefinition(finiteValueStates, node);
      } else {
        addSDLInputObjectExtension(finiteValueStates, node);
      }
    }
    detectSDLInputObjectNonFiniteValues((error) => {
      index.reportGraphQLError(error);
    }, finiteValueStates);
  };

interface InputObjectFiniteValueTarget {
  field: GraphQLInputField;
  target: GraphQLInputObjectType;
}

interface InputObjectFiniteValueState {
  inputObj: GraphQLInputObjectType;
  fields: ReadonlyArray<GraphQLInputField>;
  targets: Array<InputObjectFiniteValueTarget>;
  dependents: Array<InputObjectFiniteValueState>;
  unresolvedTargetCount: number;
  hasFiniteValue: boolean;
}

function initializeInputObjectFiniteValueState(
  finiteValueStates: Map<GraphQLInputObjectType, InputObjectFiniteValueState>,
  inputObj: GraphQLInputObjectType,
  fields: ReadonlyArray<GraphQLInputField>,
): void {
  finiteValueStates.set(inputObj, {
    inputObj,
    fields,
    targets: [],
    dependents: [],
    unresolvedTargetCount: 0,
    hasFiniteValue: false,
  });
}

// Implements the spec's InputObjectHasUnbreakableCycle algorithm for all Input
// Objects in one pass by propagating known breakable types through reverse edges.
function detectInputObjectNonFiniteValues(
  index: TypeSystemValidationIndex,
  finiteValueStates: ReadonlyMap<
    GraphQLInputObjectType,
    InputObjectFiniteValueState
  >,
): void {
  const inputObjectsWithFiniteValues: Array<InputObjectFiniteValueState> = [];

  for (const state of finiteValueStates.values()) {
    const inputObj = state.inputObj;
    const { fields } = state;

    for (const field of fields) {
      const target = getFiniteValueTarget(inputObj, field.type);
      if (target === undefined) {
        continue;
      }

      state.targets.push({ field, target });
      const targetState = finiteValueStates.get(target);
      if (targetState !== undefined) {
        targetState.dependents.push(state);
      }
    }

    if (inputObj.isOneOf) {
      // OneOf Input Objects have an unbreakable cycle if every field leads to an unbreakable cycle.
      if (fields.length === 0 || state.targets.length < fields.length) {
        markInputObjectHasFiniteValue(state);
      }
    } else {
      // Non-OneOf Input Objects have an unbreakable cycle if any non-null field has one.
      state.unresolvedTargetCount = state.targets.length;
      if (state.targets.length === 0) {
        markInputObjectHasFiniteValue(state);
      }
    }
  }

  let nextFiniteValueState: InputObjectFiniteValueState | undefined;
  while (
    (nextFiniteValueState = inputObjectsWithFiniteValues.pop()) !== undefined
  ) {
    for (const dependentState of nextFiniteValueState.dependents) {
      if (dependentState.hasFiniteValue) {
        continue;
      }

      if (dependentState.inputObj.isOneOf) {
        markInputObjectHasFiniteValue(dependentState);
        continue;
      }

      --dependentState.unresolvedTargetCount;
      if (dependentState.unresolvedTargetCount === 0) {
        markInputObjectHasFiniteValue(dependentState);
      }
    }
  }

  // Tracks already visited types to ensure that cycles are not redundantly
  // reported.
  const visitedTypes = new Set<GraphQLInputObjectType>();

  // Array of fields used to produce meaningful errors.
  const fieldPath: Array<{ fieldStr: string; astNode: Maybe<ASTNode> }> = [];

  // Position in the field path.
  const fieldPathIndexByType = new Map<GraphQLInputObjectType, number>();

  for (const state of finiteValueStates.values()) {
    if (!state.hasFiniteValue) {
      reportCycleRecursive(state);
    }
  }

  function markInputObjectHasFiniteValue(
    finiteValueState: InputObjectFiniteValueState,
  ): void {
    if (!finiteValueState.hasFiniteValue) {
      finiteValueState.hasFiniteValue = true;
      inputObjectsWithFiniteValues.push(finiteValueState);
    }
  }

  function reportCycleRecursive(state: InputObjectFiniteValueState): void {
    const inputObj = state.inputObj;
    if (visitedTypes.has(inputObj)) {
      return;
    }

    visitedTypes.add(inputObj);
    fieldPathIndexByType.set(inputObj, fieldPath.length);

    for (const { field, target } of state.targets) {
      const targetState = finiteValueStates.get(target);
      if (targetState?.hasFiniteValue !== false) {
        continue;
      }

      const cycleIndex = fieldPathIndexByType.get(target);
      fieldPath.push({
        fieldStr: `${inputObj}.${field.name}`,
        astNode: field.astNode,
      });

      if (cycleIndex === undefined) {
        reportCycleRecursive(targetState);
      } else {
        const cyclePath = fieldPath.slice(cycleIndex);
        const pathStr = cyclePath.map((p) => p.fieldStr).join(', ');
        index.reportError(
          inputObjectFiniteValueCycleErrorMessage(String(target), pathStr),
          cyclePath.map((p) => p.astNode),
        );
      }

      fieldPath.pop();
    }

    fieldPathIndexByType.delete(inputObj);
  }
}

function getFiniteValueTarget(
  inputObj: GraphQLInputObjectType,
  fieldType: GraphQLInputType,
): GraphQLInputObjectType | undefined {
  if (inputObj.isOneOf) {
    if (isInputObjectType(fieldType)) {
      return fieldType;
    }
    return;
  }

  if (isNonNullType(fieldType) && isInputObjectType(fieldType.ofType)) {
    return fieldType.ofType;
  }
}

interface SDLInputObjectFiniteValueTarget {
  field: SDLInputObjectField;
  target: SDLInputObjectFiniteValueState;
}

interface SDLInputObjectField {
  parentName: string;
  name: string;
  type: SDLTypeRef;
  astNode: Maybe<ASTNode>;
  isFromDocument: boolean;
}

interface SDLInputObjectFiniteValueState {
  name: string;
  fields: Array<SDLInputObjectField>;
  targets: Array<SDLInputObjectFiniteValueTarget>;
  dependents: Array<SDLInputObjectFiniteValueState>;
  unresolvedTargetCount: number;
  hasFiniteValue: boolean;
  isOneOf: boolean;
}

type SDLTypeRef =
  | { kind: 'Named'; name: string }
  | { kind: 'List'; ofType: SDLTypeRef }
  | { kind: 'NonNull'; ofType: SDLTypeRef };

function createSDLInputObjectFiniteValueStates(
  schema: Maybe<GraphQLSchema>,
): Map<string, SDLInputObjectFiniteValueState> {
  const states = new Map<string, SDLInputObjectFiniteValueState>();

  if (schema != null) {
    for (const type of Object.values(schema.getTypeMap())) {
      if (!isInputObjectType(type)) {
        continue;
      }

      const state = getSDLInputObjectFiniteValueState(states, type.name);
      state.isOneOf ||= type.isOneOf;
      for (const field of Object.values(type.getFields())) {
        state.fields.push({
          parentName: type.name,
          name: field.name,
          type: sdlTypeRefFromGraphQLType(field.type),
          astNode: field.astNode,
          isFromDocument: false,
        });
      }
    }
  }

  return states;
}

function addSDLInputObjectDefinition(
  states: Map<string, SDLInputObjectFiniteValueState>,
  definition: InputObjectTypeDefinitionNode,
): void {
  const inputObjectName = definition.name.value;
  const state = getSDLInputObjectFiniteValueState(states, inputObjectName);
  state.isOneOf ||= hasOneOfDirective(definition);
  addSDLInputObjectFields(states, inputObjectName, definition.fields);
}

function addSDLInputObjectExtension(
  states: Map<string, SDLInputObjectFiniteValueState>,
  extension: InputObjectTypeExtensionNode,
): void {
  addSDLInputObjectFields(states, extension.name.value, extension.fields);
}

function addSDLInputObjectFields(
  states: Map<string, SDLInputObjectFiniteValueState>,
  inputObjectName: string,
  fields: ReadonlyArray<InputValueDefinitionNode> | undefined,
): void {
  const state = getSDLInputObjectFiniteValueState(states, inputObjectName);
  if (fields == null) {
    return;
  }

  for (const field of fields) {
    state.fields.push({
      parentName: inputObjectName,
      name: field.name.value,
      type: sdlTypeRefFromTypeNode(field.type),
      astNode: field,
      isFromDocument: true,
    });
  }
}

function getSDLInputObjectFiniteValueState(
  states: Map<string, SDLInputObjectFiniteValueState>,
  name: string,
): SDLInputObjectFiniteValueState {
  let state = states.get(name);
  if (state == null) {
    state = {
      name,
      fields: [],
      targets: [],
      dependents: [],
      unresolvedTargetCount: 0,
      hasFiniteValue: false,
      isOneOf: false,
    };
    states.set(name, state);
  }
  return state;
}

function detectSDLInputObjectNonFiniteValues(
  reportError: (error: GraphQLError) => void,
  finiteValueStates: ReadonlyMap<string, SDLInputObjectFiniteValueState>,
): void {
  const inputObjectsWithFiniteValues: Array<SDLInputObjectFiniteValueState> =
    [];

  for (const state of finiteValueStates.values()) {
    for (const field of state.fields) {
      const targetName = getSDLFiniteValueTargetName(state, field.type);
      const target =
        targetName == null ? undefined : finiteValueStates.get(targetName);
      if (target == null) {
        continue;
      }

      state.targets.push({ field, target });
      target.dependents.push(state);
    }

    if (state.isOneOf) {
      if (
        state.fields.length === 0 ||
        state.targets.length < state.fields.length
      ) {
        markInputObjectHasFiniteValue(state);
      }
    } else {
      state.unresolvedTargetCount = state.targets.length;
      if (state.targets.length === 0) {
        markInputObjectHasFiniteValue(state);
      }
    }
  }

  let nextFiniteValueState: SDLInputObjectFiniteValueState | undefined;
  while (
    (nextFiniteValueState = inputObjectsWithFiniteValues.pop()) !== undefined
  ) {
    for (const dependentState of nextFiniteValueState.dependents) {
      if (dependentState.hasFiniteValue) {
        continue;
      }

      if (dependentState.isOneOf) {
        markInputObjectHasFiniteValue(dependentState);
        continue;
      }

      --dependentState.unresolvedTargetCount;
      if (dependentState.unresolvedTargetCount === 0) {
        markInputObjectHasFiniteValue(dependentState);
      }
    }
  }

  const visitedTypes = new Set<string>();
  const fieldPath = new Array<SDLInputObjectField>();
  const fieldPathIndexByType = new Map<string, number>();

  for (const state of finiteValueStates.values()) {
    if (!state.hasFiniteValue) {
      reportCycleRecursive(state);
    }
  }

  function markInputObjectHasFiniteValue(
    finiteValueState: SDLInputObjectFiniteValueState,
  ): void {
    if (!finiteValueState.hasFiniteValue) {
      finiteValueState.hasFiniteValue = true;
      inputObjectsWithFiniteValues.push(finiteValueState);
    }
  }

  function reportCycleRecursive(state: SDLInputObjectFiniteValueState): void {
    if (visitedTypes.has(state.name)) {
      return;
    }

    visitedTypes.add(state.name);
    fieldPathIndexByType.set(state.name, fieldPath.length);

    for (const { field, target } of state.targets) {
      if (target.hasFiniteValue) {
        continue;
      }

      const cycleIndex = fieldPathIndexByType.get(target.name);
      fieldPath.push(field);

      if (cycleIndex === undefined) {
        reportCycleRecursive(target);
      } else {
        const cyclePath = fieldPath.slice(cycleIndex);
        if (!cyclePath.some((pathField) => pathField.isFromDocument)) {
          fieldPath.pop();
          continue;
        }
        reportError(
          new GraphQLError(
            inputObjectFiniteValueCycleErrorMessage(
              target.name,
              cyclePath.map(fieldToString),
            ),
            {
              nodes: cyclePath
                .map((p) => p.astNode)
                .filter((node) => node != null),
            },
          ),
        );
      }

      fieldPath.pop();
    }

    fieldPathIndexByType.delete(state.name);
  }
}

function fieldToString(field: SDLInputObjectField): string {
  return `${field.parentName}.${field.name}`;
}

function getSDLFiniteValueTargetName(
  state: SDLInputObjectFiniteValueState,
  fieldType: SDLTypeRef,
): string | undefined {
  if (state.isOneOf) {
    return fieldType.kind === 'Named' ? fieldType.name : undefined;
  }

  return fieldType.kind === 'NonNull' && fieldType.ofType.kind === 'Named'
    ? fieldType.ofType.name
    : undefined;
}

function inputObjectFiniteValueCycleErrorMessage(
  inputObjStr: string,
  fieldPath: string | ReadonlyArray<string>,
): string {
  const pathStr = Array.isArray(fieldPath) ? fieldPath.join(', ') : fieldPath;
  return `Input Object ${inputObjStr} cannot be provided a finite value because it references itself through fields: ${pathStr}.`;
}

function hasOneOfDirective(node: {
  readonly directives?:
    | ReadonlyArray<{ readonly name: { readonly value: string } }>
    | undefined;
}): boolean {
  return (
    node.directives?.some(
      (directiveNode) =>
        directiveNode.name.value === GraphQLOneOfDirective.name,
    ) ?? false
  );
}

function sdlTypeRefFromGraphQLType(type: GraphQLInputType): SDLTypeRef {
  if (isNonNullType(type)) {
    return { kind: 'NonNull', ofType: sdlTypeRefFromGraphQLType(type.ofType) };
  }
  if (isListType(type)) {
    return { kind: 'List', ofType: sdlTypeRefFromGraphQLType(type.ofType) };
  }
  return { kind: 'Named', name: getNamedType(type).name };
}

function sdlTypeRefFromTypeNode(typeNode: TypeNode): SDLTypeRef {
  if (typeNode.kind === Kind.NON_NULL_TYPE) {
    return { kind: 'NonNull', ofType: sdlTypeRefFromTypeNode(typeNode.type) };
  }
  if (typeNode.kind === Kind.LIST_TYPE) {
    return { kind: 'List', ofType: sdlTypeRefFromTypeNode(typeNode.type) };
  }
  return { kind: 'Named', name: typeNode.name.value };
}
