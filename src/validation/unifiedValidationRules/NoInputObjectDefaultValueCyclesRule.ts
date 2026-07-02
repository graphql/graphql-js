/** @category Validation Rules */

import { isIterableObject } from '../../jsutils/isIterableObject.ts';
import { isObjectLike } from '../../jsutils/isObjectLike.ts';
import type { Maybe } from '../../jsutils/Maybe.ts';
import type { ObjMap } from '../../jsutils/ObjMap.ts';

import { GraphQLError } from '../../error/GraphQLError.ts';

import type {
  ConstValueNode,
  InputObjectTypeDefinitionNode,
  InputObjectTypeExtensionNode,
  InputValueDefinitionNode,
  TypeNode,
} from '../../language/ast.ts';
import { Kind } from '../../language/kinds.ts';

import type {
  GraphQLDefaultInput,
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
import type { GraphQLSchema } from '../../type/schema.ts';

import type {
  TypeSystemValidationFn,
  TypeSystemValidationIndex,
} from '../TypeSystemValidationIndex.ts';

/**
 * Input object field default values must not create circular default value
 * references.
 *
 * See https://spec.graphql.org/draft/#sec-Input-Objects
 * @category Validation Rules
 
 * @internal
 */
export const NoInputObjectDefaultValueCyclesTypeSystemValidation: TypeSystemValidationFn =
  (index: TypeSystemValidationIndex): void => {
    if (index.shouldValidateSchemaOnlyElements()) {
      const validateInputObjectDefaultValueCircularRefs =
        createInputObjectDefaultValueCircularRefsValidator(index);

      for (const { type, fields } of index.getSchemaValidationElements()
        .inputObjectTypes) {
        if (fields.some((field) => field.default !== undefined)) {
          validateInputObjectDefaultValueCircularRefs(type);
        }
      }
    }

    const inputObjectTypes = index.documentIndex.getDocumentInputObjectTypes();
    if (inputObjectTypes.length === 0) {
      return;
    }

    const inputObjects = createSDLInputObjectDefaultValueCircularRefStates(
      index.schema,
    );
    for (const { node } of inputObjectTypes) {
      if (node.kind === Kind.INPUT_OBJECT_TYPE_DEFINITION) {
        addSDLInputObjectDefaultValueDefinition(inputObjects, node);
      } else {
        addSDLInputObjectDefaultValueExtension(inputObjects, node);
      }
    }
    detectSDLInputObjectDefaultValueCircularRefs((error) => {
      index.reportGraphQLError(error);
    }, inputObjects);
  };

function createInputObjectDefaultValueCircularRefsValidator(
  index: TypeSystemValidationIndex,
): (inputObj: GraphQLInputObjectType) => void {
  // Modified copy of algorithm from 'src/validation/rules/NoFragmentCycles.js'.
  // Tracks already visited types to maintain O(N) and to ensure that cycles
  // are not redundantly reported.
  const visitedFields = Object.create(null);

  // Array of keys for fields and default values used to produce meaningful errors.
  const fieldPath: Array<
    [fieldStr: string, defaultValue: ConstValueNode | undefined]
  > = [];

  // Position in the path
  const fieldPathIndex: ObjMap<number | undefined> = Object.create(null);

  // This does a straight-forward DFS to find cycles.
  // It does not terminate when a cycle was found but continues to explore
  // the graph to find all possible cycles.
  return function validateInputObjectDefaultValueCircularRefs(
    inputObj: GraphQLInputObjectType,
  ): void {
    // Start with an empty object as a way to visit every field in this input
    // object type and apply every default value.
    return detectValueDefaultValueCycle(inputObj, Object.create(null));
  };

  function detectValueDefaultValueCycle(
    inputObj: GraphQLInputObjectType,
    defaultValue: unknown,
  ): void {
    // If the value is a List, recursively check each entry for a cycle.
    // Otherwise, only object values can contain a cycle.
    if (isIterableObject(defaultValue)) {
      for (const itemValue of defaultValue) {
        detectValueDefaultValueCycle(inputObj, itemValue);
      }
      return;
    } else if (!isObjectLike(defaultValue)) {
      return;
    }

    // Check each defined field for a cycle.
    for (const field of Object.values(inputObj.getFields())) {
      const namedFieldType = getNamedType(field.type);

      // Only input object type fields can result in a cycle.
      if (!isInputObjectType(namedFieldType)) {
        continue;
      }

      if (Object.hasOwn(defaultValue, field.name)) {
        // If the provided value has this field defined, recursively check it
        // for cycles.
        detectValueDefaultValueCycle(namedFieldType, defaultValue[field.name]);
      } else {
        // Otherwise check this field's default value for cycles.
        detectFieldDefaultValueCycle(
          field,
          namedFieldType,
          `${inputObj}.${field.name}`,
        );
      }
    }
  }

  function detectLiteralDefaultValueCycle(
    inputObj: GraphQLInputObjectType,
    defaultValue: ConstValueNode,
  ): void {
    // If the value is a List, recursively check each entry for a cycle.
    // Otherwise, only object values can contain a cycle.
    if (defaultValue.kind === Kind.LIST) {
      for (const itemLiteral of defaultValue.values) {
        detectLiteralDefaultValueCycle(inputObj, itemLiteral);
      }
      return;
    } else if (defaultValue.kind !== Kind.OBJECT) {
      return;
    }

    // Check each defined field for a cycle.
    for (const field of Object.values(inputObj.getFields())) {
      const namedFieldType = getNamedType(field.type);

      // Only input object type fields can result in a cycle.
      if (!isInputObjectType(namedFieldType)) {
        continue;
      }

      let hasFieldNode = false;
      for (const fieldNode of defaultValue.fields) {
        if (fieldNode.name.value === field.name) {
          hasFieldNode = true;
          // If the provided value has this field defined, recursively check it
          // for cycles.
          detectLiteralDefaultValueCycle(namedFieldType, fieldNode.value);
        }
      }

      if (!hasFieldNode) {
        // Otherwise check this field's default value for cycles.
        detectFieldDefaultValueCycle(
          field,
          namedFieldType,
          `${inputObj}.${field.name}`,
        );
      }
    }
  }

  function detectFieldDefaultValueCycle(
    field: GraphQLInputField,
    fieldType: GraphQLInputObjectType,
    fieldStr: string,
  ): void {
    // Only a field with a default value can result in a cycle.
    const defaultInput = field.default;
    if (defaultInput === undefined) {
      return;
    }

    // Check to see if there is cycle.
    const cycleIndex = fieldPathIndex[fieldStr];
    if (cycleIndex !== undefined) {
      index.reportError(
        inputObjectDefaultValueCycleErrorMessage(
          fieldStr,
          fieldPath
            .slice(cycleIndex)
            .map(([stringForMessage]) => stringForMessage),
        ),
        fieldPath.slice(cycleIndex - 1).map(([, node]) => node),
      );
      return;
    }

    // Recurse into this field's default value once, tracking the path.
    if (visitedFields[fieldStr] === undefined) {
      visitedFields[fieldStr] = true;
      fieldPathIndex[fieldStr] = fieldPath.push([
        fieldStr,
        field.astNode?.defaultValue,
      ]);
      if (defaultInput.literal) {
        detectLiteralDefaultValueCycle(fieldType, defaultInput.literal);
      } else {
        detectValueDefaultValueCycle(fieldType, defaultInput.value);
      }
      fieldPath.pop();
      fieldPathIndex[fieldStr] = undefined;
    }
  }
}

interface SDLInputObjectDefaultValueState {
  name: string;
  fields: Array<SDLInputObjectDefaultField>;
}

interface SDLInputObjectDefaultField {
  name: string;
  parentName: string;
  type: SDLTypeRef;
  defaultInput: GraphQLDefaultInput | undefined;
  defaultValueNode: ConstValueNode | undefined;
  isFromDocument: boolean;
}

type SDLTypeRef =
  | { kind: 'Named'; name: string }
  | { kind: 'List'; ofType: SDLTypeRef }
  | { kind: 'NonNull'; ofType: SDLTypeRef };

function createSDLInputObjectDefaultValueCircularRefStates(
  schema: Maybe<GraphQLSchema>,
): Map<string, SDLInputObjectDefaultValueState> {
  const states = new Map<string, SDLInputObjectDefaultValueState>();

  if (schema != null) {
    for (const type of Object.values(schema.getTypeMap())) {
      if (!isInputObjectType(type)) {
        continue;
      }

      const state = getSDLInputObjectDefaultValueState(states, type.name);
      for (const field of Object.values(type.getFields())) {
        state.fields.push({
          name: field.name,
          parentName: type.name,
          type: sdlTypeRefFromGraphQLType(field.type),
          defaultInput: field.default,
          defaultValueNode:
            field.astNode?.defaultValue ?? field.default?.literal,
          isFromDocument: false,
        });
      }
    }
  }

  return states;
}

function addSDLInputObjectDefaultValueDefinition(
  states: Map<string, SDLInputObjectDefaultValueState>,
  definition: InputObjectTypeDefinitionNode,
): void {
  addSDLInputObjectDefaultValueFields(
    states,
    definition.name.value,
    definition.fields,
  );
}

function addSDLInputObjectDefaultValueExtension(
  states: Map<string, SDLInputObjectDefaultValueState>,
  extension: InputObjectTypeExtensionNode,
): void {
  addSDLInputObjectDefaultValueFields(
    states,
    extension.name.value,
    extension.fields,
  );
}

function addSDLInputObjectDefaultValueFields(
  states: Map<string, SDLInputObjectDefaultValueState>,
  inputObjectName: string,
  fields: ReadonlyArray<InputValueDefinitionNode> | undefined,
): void {
  const state = getSDLInputObjectDefaultValueState(states, inputObjectName);
  if (fields == null) {
    return;
  }

  for (const field of fields) {
    state.fields.push({
      name: field.name.value,
      parentName: inputObjectName,
      type: sdlTypeRefFromTypeNode(field.type),
      defaultInput:
        field.defaultValue == null
          ? undefined
          : { literal: field.defaultValue },
      defaultValueNode: field.defaultValue ?? undefined,
      isFromDocument: true,
    });
  }
}

function getSDLInputObjectDefaultValueState(
  states: Map<string, SDLInputObjectDefaultValueState>,
  name: string,
): SDLInputObjectDefaultValueState {
  let state = states.get(name);
  if (state == null) {
    state = { name, fields: [] };
    states.set(name, state);
  }
  return state;
}

function detectSDLInputObjectDefaultValueCircularRefs(
  reportError: (error: GraphQLError) => void,
  inputObjects: ReadonlyMap<string, SDLInputObjectDefaultValueState>,
): void {
  const visitedFields = new Set<SDLInputObjectDefaultField>();
  const fieldPath = new Array<
    [
      field: SDLInputObjectDefaultField,
      defaultValue: ConstValueNode | undefined,
    ]
  >();
  const fieldPathIndex = new Map<SDLInputObjectDefaultField, number>();

  for (const inputObj of inputObjects.values()) {
    detectValueDefaultValueCycle(inputObj, Object.create(null));
  }

  function detectValueDefaultValueCycle(
    inputObj: SDLInputObjectDefaultValueState,
    defaultValue: unknown,
  ): void {
    if (isIterableObject(defaultValue)) {
      for (const itemValue of defaultValue) {
        detectValueDefaultValueCycle(inputObj, itemValue);
      }
      return;
    }
    if (!isObjectLike(defaultValue)) {
      return;
    }

    for (const field of inputObj.fields) {
      const fieldType = getSDLFieldInputObjectType(inputObjects, field.type);
      if (fieldType == null) {
        continue;
      }

      if (Object.hasOwn(defaultValue, field.name)) {
        detectValueDefaultValueCycle(fieldType, defaultValue[field.name]);
      } else {
        detectFieldDefaultValueCycle(field, fieldType);
      }
    }
  }

  function detectLiteralDefaultValueCycle(
    inputObj: SDLInputObjectDefaultValueState,
    defaultValue: ConstValueNode,
  ): void {
    if (defaultValue.kind === Kind.LIST) {
      for (const itemLiteral of defaultValue.values) {
        detectLiteralDefaultValueCycle(inputObj, itemLiteral);
      }
      return;
    }
    if (defaultValue.kind !== Kind.OBJECT) {
      return;
    }

    for (const field of inputObj.fields) {
      const fieldType = getSDLFieldInputObjectType(inputObjects, field.type);
      if (fieldType == null) {
        continue;
      }

      let hasFieldNode = false;
      for (const fieldNode of defaultValue.fields) {
        if (fieldNode.name.value === field.name) {
          hasFieldNode = true;
          detectLiteralDefaultValueCycle(fieldType, fieldNode.value);
        }
      }

      if (!hasFieldNode) {
        detectFieldDefaultValueCycle(field, fieldType);
      }
    }
  }

  function detectFieldDefaultValueCycle(
    field: SDLInputObjectDefaultField,
    fieldType: SDLInputObjectDefaultValueState,
  ): void {
    const defaultInput = field.defaultInput;
    if (defaultInput === undefined) {
      return;
    }

    const cycleIndex = fieldPathIndex.get(field);
    if (cycleIndex !== undefined) {
      const cyclePath = fieldPath.slice(cycleIndex - 1);
      if (!cyclePath.some(([pathField]) => pathField.isFromDocument)) {
        return;
      }
      reportError(
        new GraphQLError(
          inputObjectDefaultValueCycleErrorMessage(
            fieldToString(field),
            fieldPath
              .slice(cycleIndex)
              .map(([pathField]) => fieldToString(pathField)),
          ),
          {
            nodes: cyclePath
              .map(([, node]) => node)
              .filter((node) => node != null),
          },
        ),
      );
      return;
    }

    if (!visitedFields.has(field)) {
      visitedFields.add(field);
      fieldPathIndex.set(
        field,
        fieldPath.push([field, field.defaultValueNode]),
      );
      if (defaultInput.literal) {
        detectLiteralDefaultValueCycle(fieldType, defaultInput.literal);
      } else {
        detectValueDefaultValueCycle(fieldType, defaultInput.value);
      }
      fieldPath.pop();
      fieldPathIndex.delete(field);
    }
  }
}

function fieldToString(field: SDLInputObjectDefaultField): string {
  return `${field.parentName}.${field.name}`;
}

function getSDLFieldInputObjectType(
  inputObjects: ReadonlyMap<string, SDLInputObjectDefaultValueState>,
  type: SDLTypeRef,
): SDLInputObjectDefaultValueState | undefined {
  return inputObjects.get(getSDLNamedTypeName(type));
}

function getSDLNamedTypeName(type: SDLTypeRef): string {
  if (type.kind === 'Named') {
    return type.name;
  }
  return getSDLNamedTypeName(type.ofType);
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

function inputObjectDefaultValueCycleErrorMessage(
  fieldStr: string,
  viaFieldStrings: ReadonlyArray<string>,
): string {
  const viaPath =
    viaFieldStrings.length === 0
      ? ''
      : ` via the default values of: ${viaFieldStrings.join(', ')}`;

  return `Invalid circular reference. The default value of Input Object field ${fieldStr} references itself${viaPath}.`;
}
