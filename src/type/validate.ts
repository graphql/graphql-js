import { AccumulatorMap } from '../jsutils/AccumulatorMap.js';
import { capitalize } from '../jsutils/capitalize.js';
import { andList } from '../jsutils/formatList.js';
import { inspect } from '../jsutils/inspect.js';
import { invariant } from '../jsutils/invariant.js';
import { isIterableObject } from '../jsutils/isIterableObject.js';
import { isObjectLike } from '../jsutils/isObjectLike.js';
import { keyMap } from '../jsutils/keyMap.js';
import { mapValue } from '../jsutils/mapValue.js';
import type { Maybe } from '../jsutils/Maybe.js';
import type { ObjMap } from '../jsutils/ObjMap.js';
import { printPathArray } from '../jsutils/printPathArray.js';

import { GraphQLError } from '../error/GraphQLError.js';

import type {
  ASTNode,
  ConstValueNode,
  DirectiveNode,
  InterfaceTypeDefinitionNode,
  InterfaceTypeExtensionNode,
  NamedTypeNode,
  ObjectTypeDefinitionNode,
  ObjectTypeExtensionNode,
  UnionTypeDefinitionNode,
  UnionTypeExtensionNode,
} from '../language/ast.js';
import { OperationTypeNode } from '../language/ast.js';
import { Kind } from '../language/kinds.js';

import { isEqualType, isTypeSubTypeOf } from '../utilities/typeComparators.js';
import {
  validateInputLiteral,
  validateInputValue,
} from '../utilities/validateInputValue.js';

import type {
  GraphQLArgument,
  GraphQLEnumType,
  GraphQLInputField,
  GraphQLInputObjectType,
  GraphQLInputType,
  GraphQLInterfaceType,
  GraphQLObjectType,
  GraphQLUnionType,
} from './definition.js';
import {
  assertLeafType,
  getNamedType,
  isEnumType,
  isInputObjectType,
  isInputType,
  isInterfaceType,
  isListType,
  isNamedType,
  isNonNullType,
  isObjectType,
  isOutputType,
  isRequiredArgument,
  isRequiredInputField,
  isUnionType,
} from './definition.js';
import { GraphQLDeprecatedDirective, isDirective } from './directives.js';
import { isIntrospectionType } from './introspection.js';
import type { GraphQLSchema } from './schema.js';
import { assertSchema } from './schema.js';

/**
 * Implements the "Type Validation" sub-sections of the specification's
 * "Type System" section.
 *
 * Validation runs synchronously, returning an array of encountered errors, or
 * an empty array if no errors were encountered and the Schema is valid.
 */
export function validateSchema(
  schema: GraphQLSchema,
): ReadonlyArray<GraphQLError> {
  // First check to ensure the provided value is in fact a GraphQLSchema.
  assertSchema(schema);

  // If this Schema has already been validated, return the previous results.
  if (schema.__validationErrors) {
    return schema.__validationErrors;
  }

  // Validate the schema, producing a list of errors.
  const context = new SchemaValidationContext(schema);
  validateRootTypes(context);
  validateDirectives(context);
  validateTypes(context);

  // Persist the results of validation before returning to ensure validation
  // does not run multiple times for this schema.
  const errors = context.getErrors();
  schema.__validationErrors = errors;
  return errors;
}

/**
 * Utility function which asserts a schema is valid by throwing an error if
 * it is invalid.
 */
export function assertValidSchema(schema: GraphQLSchema): void {
  const errors = validateSchema(schema);
  if (errors.length !== 0) {
    throw new Error(errors.map((error) => error.message).join('\n\n'));
  }
}

class SchemaValidationContext {
  readonly _errors: Array<GraphQLError>;
  readonly schema: GraphQLSchema;

  constructor(schema: GraphQLSchema) {
    this._errors = [];
    this.schema = schema;
  }

  reportError(
    message: string,
    nodes?: ReadonlyArray<Maybe<ASTNode>> | Maybe<ASTNode>,
  ): void {
    const _nodes = Array.isArray(nodes)
      ? (nodes.filter(Boolean) as ReadonlyArray<ASTNode>)
      : (nodes as Maybe<ASTNode>);
    this._errors.push(new GraphQLError(message, { nodes: _nodes }));
  }

  getErrors(): ReadonlyArray<GraphQLError> {
    return this._errors;
  }
}

function validateRootTypes(context: SchemaValidationContext): void {
  const schema = context.schema;

  if (schema.getQueryType() == null) {
    context.reportError('Query root type must be provided.', schema.astNode);
  }

  const rootTypesMap = new AccumulatorMap<
    GraphQLObjectType,
    OperationTypeNode
  >();
  for (const operationType of Object.values(OperationTypeNode)) {
    const rootType = schema.getRootType(operationType);

    if (rootType != null) {
      if (!isObjectType(rootType)) {
        const operationTypeStr = capitalize(operationType);
        const rootTypeStr = inspect(rootType);
        context.reportError(
          operationType === OperationTypeNode.QUERY
            ? `${operationTypeStr} root type must be Object type, it cannot be ${rootTypeStr}.`
            : `${operationTypeStr} root type must be Object type if provided, it cannot be ${rootTypeStr}.`,
          getOperationTypeNode(schema, operationType) ??
            (rootType as any).astNode,
        );
      } else {
        rootTypesMap.add(rootType, operationType);
      }
    }
  }

  for (const [rootType, operationTypes] of rootTypesMap) {
    if (operationTypes.length > 1) {
      const operationList = andList(operationTypes);
      context.reportError(
        `All root types must be different, "${rootType}" type is used as ${operationList} root types.`,
        operationTypes.map((operationType) =>
          getOperationTypeNode(schema, operationType),
        ),
      );
    }
  }
}

function getOperationTypeNode(
  schema: GraphQLSchema,
  operation: OperationTypeNode,
): Maybe<ASTNode> {
  return [schema.astNode, ...schema.extensionASTNodes]
    .flatMap((schemaNode) => schemaNode?.operationTypes ?? [])
    .find((operationNode) => operationNode.operation === operation)?.type;
}

function validateDirectives(context: SchemaValidationContext): void {
  for (const directive of context.schema.getDirectives()) {
    // Ensure all directives are in fact GraphQL directives.
    if (!isDirective(directive)) {
      context.reportError(
        `Expected directive but got: ${inspect(directive)}.`,
        (directive as any)?.astNode,
      );
      continue;
    }

    // Ensure they are named correctly.
    validateName(context, directive);

    if (directive.locations.length === 0) {
      context.reportError(
        `Directive ${directive} must include 1 or more locations.`,
        directive.astNode,
      );
    }

    // Ensure the arguments are valid.
    for (const arg of directive.args) {
      // Ensure they are named correctly.
      validateName(context, arg);

      // Ensure the type is an input type.
      if (!isInputType(arg.type)) {
        context.reportError(
          `The type of ${arg} must be Input Type ` +
            `but got: ${inspect(arg.type)}.`,
          arg.astNode,
        );
      }

      if (isRequiredArgument(arg) && arg.deprecationReason != null) {
        context.reportError(`Required argument ${arg} cannot be deprecated.`, [
          getDeprecatedDirectiveNode(arg.astNode),
          arg.astNode?.type,
        ]);
      }

      validateDefaultValue(context, arg);
    }
  }
}

function validateDefaultValue(
  context: SchemaValidationContext,
  inputValue: GraphQLArgument | GraphQLInputField,
): void {
  const defaultInput = inputValue.default;

  if (!defaultInput) {
    return;
  }

  if (defaultInput.literal) {
    validateInputLiteral(
      defaultInput.literal,
      inputValue.type,
      (error, path) => {
        context.reportError(
          `${inputValue} has invalid default value${printPathArray(path)}: ${
            error.message
          }`,
          error.nodes,
        );
      },
    );
  } else {
    const errors: Array<[GraphQLError, ReadonlyArray<string | number>]> = [];
    validateInputValue(defaultInput.value, inputValue.type, (error, path) => {
      errors.push([error, path]);
    });

    // If there were validation errors, check to see if it can be "uncoerced"
    // and then correctly validated. If so, report a clear error with a path
    // to resolution.
    if (errors.length > 0) {
      try {
        const uncoercedValue = uncoerceDefaultValue(
          defaultInput.value,
          inputValue.type,
        );

        const uncoercedErrors = [];
        validateInputValue(uncoercedValue, inputValue.type, (error, path) => {
          uncoercedErrors.push([error, path]);
        });

        if (uncoercedErrors.length === 0) {
          context.reportError(
            `${inputValue} has invalid default value: ${inspect(
              defaultInput.value,
            )}. Did you mean: ${inspect(uncoercedValue)}?`,
            inputValue.astNode?.defaultValue,
          );
          return;
        }
      } catch (_error) {
        // ignore
      }
    }

    // Otherwise report the original set of errors.
    for (const [error, path] of errors) {
      context.reportError(
        `${inputValue} has invalid default value${printPathArray(path)}: ${
          error.message
        }`,
        inputValue.astNode?.defaultValue,
      );
    }
  }
}

/**
 * Historically GraphQL.js allowed default values to be provided as
 * assumed-coerced "internal" values, however default values should be provided
 * as "external" pre-coerced values. `uncoerceDefaultValue()` will convert such
 * "internal" values to "external" values to display as part of validation.
 *
 * This performs the "opposite" of `coerceInputValue()`. Given an "internal"
 * coerced value, reverse the process to provide an "external" uncoerced value.
 */
function uncoerceDefaultValue(value: unknown, type: GraphQLInputType): unknown {
  if (isNonNullType(type)) {
    return uncoerceDefaultValue(value, type.ofType);
  }

  if (value === null) {
    return null;
  }

  if (isListType(type)) {
    if (isIterableObject(value)) {
      return Array.from(value, (itemValue) =>
        uncoerceDefaultValue(itemValue, type.ofType),
      );
    }
    return [uncoerceDefaultValue(value, type.ofType)];
  }

  if (isInputObjectType(type)) {
    invariant(isObjectLike(value));
    const fieldDefs = type.getFields();
    return mapValue(value, (fieldValue, fieldName) => {
      invariant(fieldName in fieldDefs);
      return uncoerceDefaultValue(fieldValue, fieldDefs[fieldName].type);
    });
  }

  assertLeafType(type);

  // For most leaf types (Scalars, Enums), output value coercion ("serialize") is
  // the inverse of input coercion ("parseValue") and will produce an
  // "external" value. Historically, this method was also used as part of the
  // now-deprecated "astFromValue" to perform the same behavior.
  return type.coerceOutputValue(value);
}

function validateName(
  context: SchemaValidationContext,
  node: { readonly name: string; readonly astNode: Maybe<ASTNode> },
): void {
  // Ensure names are valid, however introspection types opt out.
  if (node.name.startsWith('__')) {
    context.reportError(
      `Name "${node.name}" must not begin with "__", which is reserved by GraphQL introspection.`,
      node.astNode,
    );
  }
}

function validateTypes(context: SchemaValidationContext): void {
  // Ensure Input Objects do not contain non-nullable circular references.
  const validateInputObjectNonNullCircularRefs =
    createInputObjectNonNullCircularRefsValidator(context);
  const validateInputObjectDefaultValueCircularRefs =
    createInputObjectDefaultValueCircularRefsValidator(context);
  const typeMap = context.schema.getTypeMap();
  for (const type of Object.values(typeMap)) {
    // Ensure all provided types are in fact GraphQL type.
    if (!isNamedType(type)) {
      context.reportError(
        `Expected GraphQL named type but got: ${inspect(type)}.`,
        (type as any).astNode,
      );
      continue;
    }

    // Ensure it is named correctly (excluding introspection types).
    if (!isIntrospectionType(type)) {
      validateName(context, type);
    }

    if (isObjectType(type)) {
      // Ensure fields are valid
      validateFields(context, type);

      // Ensure objects implement the interfaces they claim to.
      validateInterfaces(context, type);
    } else if (isInterfaceType(type)) {
      // Ensure fields are valid.
      validateFields(context, type);

      // Ensure interfaces implement the interfaces they claim to.
      validateInterfaces(context, type);
    } else if (isUnionType(type)) {
      // Ensure Unions include valid member types.
      validateUnionMembers(context, type);
    } else if (isEnumType(type)) {
      // Ensure Enums have valid values.
      validateEnumValues(context, type);
    } else if (isInputObjectType(type)) {
      // Ensure Input Object fields are valid.
      validateInputFields(context, type);

      // Ensure Input Objects do not contain invalid field circular references.
      // Ensure Input Objects do not contain non-nullable circular references.
      validateInputObjectNonNullCircularRefs(type);

      // Ensure Input Objects do not contain invalid default value circular references.
      validateInputObjectDefaultValueCircularRefs(type);
    }
  }
}

function validateFields(
  context: SchemaValidationContext,
  type: GraphQLObjectType | GraphQLInterfaceType,
): void {
  const fields = Object.values(type.getFields());

  // Objects and Interfaces both must define one or more fields.
  if (fields.length === 0) {
    context.reportError(`Type ${type} must define one or more fields.`, [
      type.astNode,
      ...type.extensionASTNodes,
    ]);
  }

  for (const field of fields) {
    // Ensure they are named correctly.
    validateName(context, field);

    // Ensure the type is an output type
    if (!isOutputType(field.type)) {
      context.reportError(
        `The type of ${field} must be Output Type ` +
          `but got: ${inspect(field.type)}.`,
        field.astNode?.type,
      );
    }

    // Ensure the arguments are valid
    for (const arg of field.args) {
      // Ensure they are named correctly.
      validateName(context, arg);

      // Ensure the type is an input type
      if (!isInputType(arg.type)) {
        context.reportError(
          `The type of ${arg} must be Input Type but got: ${inspect(arg.type)}.`,
          arg.astNode?.type,
        );
      }

      if (isRequiredArgument(arg) && arg.deprecationReason != null) {
        context.reportError(`Required argument ${arg} cannot be deprecated.`, [
          getDeprecatedDirectiveNode(arg.astNode),
          arg.astNode?.type,
        ]);
      }

      validateDefaultValue(context, arg);
    }
  }
}

function validateInterfaces(
  context: SchemaValidationContext,
  type: GraphQLObjectType | GraphQLInterfaceType,
): void {
  const ifaceTypeNames = new Set<string>();
  for (const iface of type.getInterfaces()) {
    if (!isInterfaceType(iface)) {
      context.reportError(
        `Type ${type} must only implement Interface types, ` +
          `it cannot implement ${inspect(iface)}.`,
        getAllImplementsInterfaceNodes(type, iface),
      );
      continue;
    }

    if (type === iface) {
      context.reportError(
        `Type ${type} cannot implement itself because it would create a circular reference.`,
        getAllImplementsInterfaceNodes(type, iface),
      );
      continue;
    }

    if (ifaceTypeNames.has(iface.name)) {
      context.reportError(
        `Type ${type} can only implement ${iface} once.`,
        getAllImplementsInterfaceNodes(type, iface),
      );
      continue;
    }

    ifaceTypeNames.add(iface.name);

    validateTypeImplementsAncestors(context, type, iface);
    validateTypeImplementsInterface(context, type, iface);
  }
}

function validateTypeImplementsInterface(
  context: SchemaValidationContext,
  type: GraphQLObjectType | GraphQLInterfaceType,
  iface: GraphQLInterfaceType,
): void {
  const typeFieldMap = type.getFields();

  // Assert each interface field is implemented.
  for (const ifaceField of Object.values(iface.getFields())) {
    const typeField = typeFieldMap[ifaceField.name];

    // Assert interface field exists on type.
    if (typeField == null) {
      context.reportError(
        `Interface field ${ifaceField} expected but ${type} does not provide it.`,
        [ifaceField.astNode, type.astNode, ...type.extensionASTNodes],
      );
      continue;
    }

    // Assert interface field type is satisfied by type field type, by being
    // a valid subtype. (covariant)
    if (!isTypeSubTypeOf(context.schema, typeField.type, ifaceField.type)) {
      context.reportError(
        `Interface field ${ifaceField} expects type ${ifaceField.type} ` +
          `but ${typeField} is type ${typeField.type}.`,
        [ifaceField.astNode?.type, typeField.astNode?.type],
      );
    }

    // Assert each interface field arg is implemented.
    for (const ifaceArg of ifaceField.args) {
      const typeArg = typeField.args.find((arg) => arg.name === ifaceArg.name);

      // Assert interface field arg exists on object field.
      if (!typeArg) {
        context.reportError(
          `Interface field argument ${ifaceArg} expected but ${typeField} does not provide it.`,
          [ifaceArg.astNode, typeField.astNode],
        );
        continue;
      }

      // Assert interface field arg type matches object field arg type.
      // (invariant)
      // TODO: change to contravariant?
      if (!isEqualType(ifaceArg.type, typeArg.type)) {
        context.reportError(
          `Interface field argument ${ifaceArg} expects type ${ifaceArg.type} ` +
            `but ${typeArg} is type ${typeArg.type}.`,
          [ifaceArg.astNode?.type, typeArg.astNode?.type],
        );
      }
    }

    // Assert additional arguments must not be required.
    for (const typeArg of typeField.args) {
      if (isRequiredArgument(typeArg)) {
        const ifaceArg = ifaceField.args.find(
          (arg) => arg.name === typeArg.name,
        );
        if (!ifaceArg) {
          context.reportError(
            `Argument "${typeArg}" must not be required type "${typeArg.type}" ` +
              `if not provided by the Interface field "${ifaceField}".`,
            [typeArg.astNode, ifaceField.astNode],
          );
        }
      }
    }
  }
}

function validateTypeImplementsAncestors(
  context: SchemaValidationContext,
  type: GraphQLObjectType | GraphQLInterfaceType,
  iface: GraphQLInterfaceType,
): void {
  const ifaceInterfaces = type.getInterfaces();
  for (const transitive of iface.getInterfaces()) {
    if (!ifaceInterfaces.includes(transitive)) {
      context.reportError(
        transitive === type
          ? `Type ${type} cannot implement ${iface} because it would create a circular reference.`
          : `Type ${type} must implement ${transitive} because it is implemented by ${iface}.`,
        [
          ...getAllImplementsInterfaceNodes(iface, transitive),
          ...getAllImplementsInterfaceNodes(type, iface),
        ],
      );
    }
  }
}

function validateUnionMembers(
  context: SchemaValidationContext,
  union: GraphQLUnionType,
): void {
  const memberTypes = union.getTypes();

  if (memberTypes.length === 0) {
    context.reportError(
      `Union type ${union} must define one or more member types.`,
      [union.astNode, ...union.extensionASTNodes],
    );
  }

  const includedTypeNames = new Set<string>();
  for (const memberType of memberTypes) {
    if (includedTypeNames.has(memberType.name)) {
      context.reportError(
        `Union type ${union} can only include type ${memberType} once.`,
        getUnionMemberTypeNodes(union, memberType.name),
      );
      continue;
    }
    includedTypeNames.add(memberType.name);
    if (!isObjectType(memberType)) {
      context.reportError(
        `Union type ${union} can only include Object types, ` +
          `it cannot include ${inspect(memberType)}.`,
        getUnionMemberTypeNodes(union, String(memberType)),
      );
    }
  }
}

function validateEnumValues(
  context: SchemaValidationContext,
  enumType: GraphQLEnumType,
): void {
  const enumValues = enumType.getValues();

  if (enumValues.length === 0) {
    context.reportError(
      `Enum type ${enumType} must define one or more values.`,
      [enumType.astNode, ...enumType.extensionASTNodes],
    );
  }

  for (const enumValue of enumValues) {
    // Ensure valid name.
    validateName(context, enumValue);
  }
}

function validateInputFields(
  context: SchemaValidationContext,
  inputObj: GraphQLInputObjectType,
): void {
  const fields = Object.values(inputObj.getFields());

  if (fields.length === 0) {
    context.reportError(
      `Input Object type ${inputObj} must define one or more fields.`,
      [inputObj.astNode, ...inputObj.extensionASTNodes],
    );
  }

  // Ensure the input fields are valid
  for (const field of fields) {
    // Ensure they are named correctly.
    validateName(context, field);

    // Ensure the type is an input type
    if (!isInputType(field.type)) {
      context.reportError(
        `The type of ${field} must be Input Type ` +
          `but got: ${inspect(field.type)}.`,
        field.astNode?.type,
      );
    }

    if (isRequiredInputField(field) && field.deprecationReason != null) {
      context.reportError(
        `Required input field ${field} cannot be deprecated.`,
        [getDeprecatedDirectiveNode(field.astNode), field.astNode?.type],
      );
    }

    validateDefaultValue(context, field);

    if (inputObj.isOneOf) {
      validateOneOfInputObjectField(inputObj, field, context);
    }
  }
}

function validateOneOfInputObjectField(
  type: GraphQLInputObjectType,
  field: GraphQLInputField,
  context: SchemaValidationContext,
): void {
  if (isNonNullType(field.type)) {
    context.reportError(
      `OneOf input field ${type}.${field.name} must be nullable.`,
      field.astNode?.type,
    );
  }

  if (field.default !== undefined || field.defaultValue !== undefined) {
    context.reportError(
      `OneOf input field ${type}.${field.name} cannot have a default value.`,
      field.astNode,
    );
  }
}

function createInputObjectNonNullCircularRefsValidator(
  context: SchemaValidationContext,
): (inputObj: GraphQLInputObjectType) => void {
  // Modified copy of algorithm from 'src/validation/rules/NoFragmentCycles.js'.
  // Tracks already visited types to maintain O(N) and to ensure that cycles
  // are not redundantly reported.
  const visitedTypes = new Set<GraphQLInputObjectType>();

  // Array of types nodes used to produce meaningful errors
  const fieldPath: Array<{ fieldStr: string; astNode: Maybe<ASTNode> }> = [];

  // Position in the type path
  const fieldPathIndexByTypeName: ObjMap<number | undefined> =
    Object.create(null);

  return detectCycleRecursive;

  // This does a straight-forward DFS to find cycles.
  // It does not terminate when a cycle was found but continues to explore
  // the graph to find all possible cycles.
  function detectCycleRecursive(inputObj: GraphQLInputObjectType): void {
    if (visitedTypes.has(inputObj)) {
      return;
    }

    visitedTypes.add(inputObj);
    fieldPathIndexByTypeName[inputObj.name] = fieldPath.length;

    const fields = Object.values(inputObj.getFields());
    for (const field of fields) {
      if (isNonNullType(field.type) && isInputObjectType(field.type.ofType)) {
        const fieldType = field.type.ofType;
        const cycleIndex = fieldPathIndexByTypeName[fieldType.name];

        fieldPath.push({
          fieldStr: `${inputObj}.${field.name}`,
          astNode: field.astNode,
        });
        if (cycleIndex === undefined) {
          detectCycleRecursive(fieldType);
        } else {
          const cyclePath = fieldPath.slice(cycleIndex);
          const pathStr = cyclePath
            .map((fieldObj) => fieldObj.fieldStr)
            .join(', ');
          context.reportError(
            `Invalid circular reference. The Input Object ${fieldType} references itself ${
              cyclePath.length > 1
                ? 'via the non-null fields:'
                : 'in the non-null field'
            } ${pathStr}.`,
            cyclePath.map((fieldObj) => fieldObj.astNode),
          );
        }
        fieldPath.pop();
      }
    }

    fieldPathIndexByTypeName[inputObj.name] = undefined;
  }
}

function createInputObjectDefaultValueCircularRefsValidator(
  context: SchemaValidationContext,
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
    return detectValueDefaultValueCycle(inputObj, {});
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
    const fieldNodes = keyMap(defaultValue.fields, (field) => field.name.value);
    for (const field of Object.values(inputObj.getFields())) {
      const namedFieldType = getNamedType(field.type);

      // Only input object type fields can result in a cycle.
      if (!isInputObjectType(namedFieldType)) {
        continue;
      }

      if (Object.hasOwn(fieldNodes, field.name)) {
        // If the provided value has this field defined, recursively check it
        // for cycles.
        detectLiteralDefaultValueCycle(
          namedFieldType,
          fieldNodes[field.name].value,
        );
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
    if (cycleIndex !== undefined && cycleIndex > 0) {
      context.reportError(
        `Invalid circular reference. The default value of Input Object field ${fieldStr} references itself${
          cycleIndex < fieldPath.length
            ? ` via the default values of: ${fieldPath
                .slice(cycleIndex)
                .map(([stringForMessage]) => stringForMessage)
                .join(', ')}`
            : ''
        }.`,
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

function getAllImplementsInterfaceNodes(
  type: GraphQLObjectType | GraphQLInterfaceType,
  iface: GraphQLInterfaceType,
): ReadonlyArray<NamedTypeNode> {
  const { astNode, extensionASTNodes } = type;
  const nodes: ReadonlyArray<
    | ObjectTypeDefinitionNode
    | ObjectTypeExtensionNode
    | InterfaceTypeDefinitionNode
    | InterfaceTypeExtensionNode
  > = astNode != null ? [astNode, ...extensionASTNodes] : extensionASTNodes;

  return nodes
    .flatMap((typeNode) => typeNode.interfaces ?? [])
    .filter((ifaceNode) => ifaceNode.name.value === iface.name);
}

function getUnionMemberTypeNodes(
  union: GraphQLUnionType,
  typeName: string,
): ReadonlyArray<NamedTypeNode> {
  const { astNode, extensionASTNodes } = union;
  const nodes: ReadonlyArray<UnionTypeDefinitionNode | UnionTypeExtensionNode> =
    astNode != null ? [astNode, ...extensionASTNodes] : extensionASTNodes;

  return nodes
    .flatMap((unionNode) => /* c8 ignore next */ unionNode.types ?? [])
    .filter((typeNode) => typeNode.name.value === typeName);
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
