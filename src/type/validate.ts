import { inspect } from '../jsutils/inspect';
import type { Maybe } from '../jsutils/Maybe';

import { GraphQLError } from '../error/GraphQLError';

import type {
  ASTNode,
  DirectiveNode,
  InterfaceTypeDefinitionNode,
  InterfaceTypeExtensionNode,
  NamedTypeNode,
  ObjectTypeDefinitionNode,
  ObjectTypeExtensionNode,
  UnionTypeDefinitionNode,
  UnionTypeExtensionNode,
} from '../language/ast';
import { OperationTypeNode } from '../language/ast';

import { isEqualType, isTypeSubTypeOf } from '../utilities/typeComparators';

import type {
  GraphQLEnumType,
  GraphQLInputField,
  GraphQLInputObjectType,
  GraphQLInterfaceType,
  GraphQLObjectType,
  GraphQLUnionType,
} from './definition';
import {
  isEnumType,
  isInputObjectType,
  isInputType,
  isInterfaceType,
  isNamedType,
  isNonNullType,
  isObjectType,
  isOutputType,
  isRequiredArgument,
  isRequiredInputField,
  isUnionType,
} from './definition';
import { GraphQLDeprecatedDirective, isDirective } from './directives';
import { isIntrospectionType } from './introspection';
import type { GraphQLSchema } from './schema';
import { assertSchema } from './schema';

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
  const queryType = schema.getQueryType();
  if (!queryType) {
    context.reportError('Query root type must be provided.', schema.astNode);
  } else if (!isObjectType(queryType)) {
    context.reportError(
      `Query root type must be Object type, it cannot be ${inspect(
        queryType,
      )}.`,
      getOperationTypeNode(schema, OperationTypeNode.QUERY) ??
        (queryType as any).astNode,
    );
  }

  const mutationType = schema.getMutationType();
  if (mutationType && !isObjectType(mutationType)) {
    context.reportError(
      'Mutation root type must be Object type if provided, it cannot be ' +
        `${inspect(mutationType)}.`,
      getOperationTypeNode(schema, OperationTypeNode.MUTATION) ??
        (mutationType as any).astNode,
    );
  }

  const subscriptionType = schema.getSubscriptionType();
  if (subscriptionType && !isObjectType(subscriptionType)) {
    context.reportError(
      'Subscription root type must be Object type if provided, it cannot be ' +
        `${inspect(subscriptionType)}.`,
      getOperationTypeNode(schema, OperationTypeNode.SUBSCRIPTION) ??
        (subscriptionType as any).astNode,
    );
  }
}

function getOperationTypeNode(
  schema: GraphQLSchema,
  operation: OperationTypeNode,
): Maybe<ASTNode> {
  return [schema.astNode, ...schema.extensionASTNodes]
    .flatMap(
      // FIXME: https://github.com/graphql/graphql-js/issues/2203
      (schemaNode) => /* c8 ignore next */ schemaNode?.operationTypes ?? [],
    )
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

    // TODO: Ensure proper locations.

    // Ensure the arguments are valid.
    for (const arg of directive.args) {
      // Ensure they are named correctly.
      validateName(context, arg);

      // Ensure the type is an input type.
      if (!isInputType(arg.type)) {
        context.reportError(
          `The type of @${directive.name}(${arg.name}:) must be Input Type ` +
            `but got: ${inspect(arg.type)}.`,
          arg.astNode,
        );
      }

      if (isRequiredArgument(arg) && arg.deprecationReason != null) {
        context.reportError(
          `Required argument @${directive.name}(${arg.name}:) cannot be deprecated.`,
          [getDeprecatedDirectiveNode(arg.astNode), arg.astNode?.type],
        );
      }
    }
  }
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
  const validateInputObjectCircularRefs =
    createInputObjectCircularRefsValidator(context);
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

      // Ensure Input Objects do not contain non-nullable circular references
      validateInputObjectCircularRefs(type);
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
    context.reportError(`Type ${type.name} must define one or more fields.`, [
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
        `The type of ${type.name}.${field.name} must be Output Type ` +
          `but got: ${inspect(field.type)}.`,
        field.astNode?.type,
      );
    }

    // Ensure the arguments are valid
    for (const arg of field.args) {
      const argName = arg.name;

      // Ensure they are named correctly.
      validateName(context, arg);

      // Ensure the type is an input type
      if (!isInputType(arg.type)) {
        context.reportError(
          `The type of ${type.name}.${field.name}(${argName}:) must be Input ` +
            `Type but got: ${inspect(arg.type)}.`,
          arg.astNode?.type,
        );
      }

      if (isRequiredArgument(arg) && arg.deprecationReason != null) {
        context.reportError(
          `Required argument ${type.name}.${field.name}(${argName}:) cannot be deprecated.`,
          [getDeprecatedDirectiveNode(arg.astNode), arg.astNode?.type],
        );
      }
    }
  }
}

function validateInterfaces(
  context: SchemaValidationContext,
  type: GraphQLObjectType | GraphQLInterfaceType,
): void {
  const ifaceTypeNames = Object.create(null);
  for (const iface of type.getInterfaces()) {
    if (!isInterfaceType(iface)) {
      context.reportError(
        `Type ${inspect(type)} must only implement Interface types, ` +
          `it cannot implement ${inspect(iface)}.`,
        getAllImplementsInterfaceNodes(type, iface),
      );
      continue;
    }

    if (type === iface) {
      context.reportError(
        `Type ${type.name} cannot implement itself because it would create a circular reference.`,
        getAllImplementsInterfaceNodes(type, iface),
      );
      continue;
    }

    if (ifaceTypeNames[iface.name]) {
      context.reportError(
        `Type ${type.name} can only implement ${iface.name} once.`,
        getAllImplementsInterfaceNodes(type, iface),
      );
      continue;
    }

    ifaceTypeNames[iface.name] = true;

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
    const fieldName = ifaceField.name;
    const typeField = typeFieldMap[fieldName];

    // Assert interface field exists on type.
    if (!typeField) {
      context.reportError(
        `Interface field ${iface.name}.${fieldName} expected but ${type.name} does not provide it.`,
        [ifaceField.astNode, type.astNode, ...type.extensionASTNodes],
      );
      continue;
    }

    // Assert interface field type is satisfied by type field type, by being
    // a valid subtype. (covariant)
    if (!isTypeSubTypeOf(context.schema, typeField.type, ifaceField.type)) {
      context.reportError(
        `Interface field ${iface.name}.${fieldName} expects type ` +
          `${inspect(ifaceField.type)} but ${type.name}.${fieldName} ` +
          `is type ${inspect(typeField.type)}.`,
        [ifaceField.astNode?.type, typeField.astNode?.type],
      );
    }

    // Assert each interface field arg is implemented.
    for (const ifaceArg of ifaceField.args) {
      const argName = ifaceArg.name;
      const typeArg = typeField.args.find((arg) => arg.name === argName);

      // Assert interface field arg exists on object field.
      if (!typeArg) {
        context.reportError(
          `Interface field argument ${iface.name}.${fieldName}(${argName}:) expected but ${type.name}.${fieldName} does not provide it.`,
          [ifaceArg.astNode, typeField.astNode],
        );
        continue;
      }

      // Assert interface field arg type matches object field arg type.
      // (invariant)
      // TODO: change to contravariant?
      if (!isEqualType(ifaceArg.type, typeArg.type)) {
        context.reportError(
          `Interface field argument ${iface.name}.${fieldName}(${argName}:) ` +
            `expects type ${inspect(ifaceArg.type)} but ` +
            `${type.name}.${fieldName}(${argName}:) is type ` +
            `${inspect(typeArg.type)}.`,
          [ifaceArg.astNode?.type, typeArg.astNode?.type],
        );
      }

      // TODO: validate default values?
    }

    // Assert additional arguments must not be required.
    for (const typeArg of typeField.args) {
      const argName = typeArg.name;
      const ifaceArg = ifaceField.args.find((arg) => arg.name === argName);
      if (!ifaceArg && isRequiredArgument(typeArg)) {
        context.reportError(
          `Object field ${type.name}.${fieldName} includes required argument ${argName} that is missing from the Interface field ${iface.name}.${fieldName}.`,
          [typeArg.astNode, ifaceField.astNode],
        );
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
          ? `Type ${type.name} cannot implement ${iface.name} because it would create a circular reference.`
          : `Type ${type.name} must implement ${transitive.name} because it is implemented by ${iface.name}.`,
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
      `Union type ${union.name} must define one or more member types.`,
      [union.astNode, ...union.extensionASTNodes],
    );
  }

  const includedTypeNames = Object.create(null);
  for (const memberType of memberTypes) {
    if (includedTypeNames[memberType.name]) {
      context.reportError(
        `Union type ${union.name} can only include type ${memberType.name} once.`,
        getUnionMemberTypeNodes(union, memberType.name),
      );
      continue;
    }
    includedTypeNames[memberType.name] = true;
    if (!isObjectType(memberType)) {
      context.reportError(
        `Union type ${union.name} can only include Object types, ` +
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
      `Enum type ${enumType.name} must define one or more values.`,
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
      `Input Object type ${inputObj.name} must define one or more fields.`,
      [inputObj.astNode, ...inputObj.extensionASTNodes],
    );
  }

  // Ensure the arguments are valid
  for (const field of fields) {
    // Ensure they are named correctly.
    validateName(context, field);

    // Ensure the type is an input type
    if (!isInputType(field.type)) {
      context.reportError(
        `The type of ${inputObj.name}.${field.name} must be Input Type ` +
          `but got: ${inspect(field.type)}.`,
        field.astNode?.type,
      );
    }

    if (isRequiredInputField(field) && field.deprecationReason != null) {
      context.reportError(
        `Required input field ${inputObj.name}.${field.name} cannot be deprecated.`,
        [getDeprecatedDirectiveNode(field.astNode), field.astNode?.type],
      );
    }
  }
}

function createInputObjectCircularRefsValidator(
  context: SchemaValidationContext,
): (inputObj: GraphQLInputObjectType) => void {
  // Modified copy of algorithm from 'src/validation/rules/NoFragmentCycles.js'.
  // Tracks already visited types to maintain O(N) and to ensure that cycles
  // are not redundantly reported.
  const visitedTypes = Object.create(null);

  // Array of types nodes used to produce meaningful errors
  const fieldPath: Array<GraphQLInputField> = [];

  // Position in the type path
  const fieldPathIndexByTypeName = Object.create(null);

  return detectCycleRecursive;

  // This does a straight-forward DFS to find cycles.
  // It does not terminate when a cycle was found but continues to explore
  // the graph to find all possible cycles.
  function detectCycleRecursive(inputObj: GraphQLInputObjectType): void {
    if (visitedTypes[inputObj.name]) {
      return;
    }

    visitedTypes[inputObj.name] = true;
    fieldPathIndexByTypeName[inputObj.name] = fieldPath.length;

    const fields = Object.values(inputObj.getFields());
    for (const field of fields) {
      if (isNonNullType(field.type) && isInputObjectType(field.type.ofType)) {
        const fieldType = field.type.ofType;
        const cycleIndex = fieldPathIndexByTypeName[fieldType.name];

        fieldPath.push(field);
        if (cycleIndex === undefined) {
          detectCycleRecursive(fieldType);
        } else {
          const cyclePath = fieldPath.slice(cycleIndex);
          const pathStr = cyclePath.map((fieldObj) => fieldObj.name).join('.');
          context.reportError(
            `Cannot reference Input Object "${fieldType.name}" within itself through a series of non-null fields: "${pathStr}".`,
            cyclePath.map((fieldObj) => fieldObj.astNode),
          );
        }
        fieldPath.pop();
      }
    }

    fieldPathIndexByTypeName[inputObj.name] = undefined;
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

  // FIXME: https://github.com/graphql/graphql-js/issues/2203
  return nodes
    .flatMap((typeNode) => /* c8 ignore next */ typeNode.interfaces ?? [])
    .filter((ifaceNode) => ifaceNode.name.value === iface.name);
}

function getUnionMemberTypeNodes(
  union: GraphQLUnionType,
  typeName: string,
): Maybe<ReadonlyArray<NamedTypeNode>> {
  const { astNode, extensionASTNodes } = union;
  const nodes: ReadonlyArray<UnionTypeDefinitionNode | UnionTypeExtensionNode> =
    astNode != null ? [astNode, ...extensionASTNodes] : extensionASTNodes;

  // FIXME: https://github.com/graphql/graphql-js/issues/2203
  return nodes
    .flatMap((unionNode) => /* c8 ignore next */ unionNode.types ?? [])
    .filter((typeNode) => typeNode.name.value === typeName);
}

function getDeprecatedDirectiveNode(
  definitionNode: Maybe<{ readonly directives?: ReadonlyArray<DirectiveNode> }>,
): Maybe<DirectiveNode> {
  return definitionNode?.directives?.find(
    (node) => node.name.value === GraphQLDeprecatedDirective.name,
  );
}
