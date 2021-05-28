import { inspect } from '../jsutils/inspect';
import type { Maybe } from '../jsutils/Maybe';

import { GraphQLError } from '../error/GraphQLError';
import { locatedError } from '../error/locatedError';

import type {
  ASTNode,
  NamedTypeNode,
  DirectiveNode,
  OperationTypeNode,
  ObjectTypeDefinitionNode,
  ObjectTypeExtensionNode,
  InterfaceTypeDefinitionNode,
  InterfaceTypeExtensionNode,
  UnionTypeDefinitionNode,
  UnionTypeExtensionNode,
} from '../language/ast';

import { isValidNameError } from '../utilities/assertValidName';
import { isEqualType, isTypeSubTypeOf } from '../utilities/typeComparators';

import type { GraphQLSchema } from './schema';
import type {
  GraphQLObjectType,
  GraphQLInterfaceType,
  GraphQLUnionType,
  GraphQLEnumType,
  GraphQLInputObjectType,
  GraphQLInputField,
} from './definition';
import { assertSchema } from './schema';
import { isIntrospectionType } from './introspection';
import { isDirective, GraphQLDeprecatedDirective } from './directives';
import {
  isObjectType,
  isInterfaceType,
  isUnionType,
  isEnumType,
  isInputObjectType,
  isNamedType,
  isNonNullType,
  isInputType,
  isOutputType,
  isRequiredArgument,
  isRequiredInputField,
} from './definition';

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
    this.addError(new GraphQLError(message, _nodes));
  }

  addError(error: GraphQLError): void {
    this._errors.push(error);
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
      getOperationTypeNode(schema, 'query') ?? (queryType as any).astNode,
    );
  }

  const mutationType = schema.getMutationType();
  if (mutationType && !isObjectType(mutationType)) {
    context.reportError(
      'Mutation root type must be Object type if provided, it cannot be ' +
        `${inspect(mutationType)}.`,
      getOperationTypeNode(schema, 'mutation') ?? (mutationType as any).astNode,
    );
  }

  const subscriptionType = schema.getSubscriptionType();
  if (subscriptionType && !isObjectType(subscriptionType)) {
    context.reportError(
      'Subscription root type must be Object type if provided, it cannot be ' +
        `${inspect(subscriptionType)}.`,
      getOperationTypeNode(schema, 'subscription') ??
        (subscriptionType as any).astNode,
    );
  }
}

function getOperationTypeNode(
  schema: GraphQLSchema,
  operation: OperationTypeNode,
): Maybe<ASTNode> {
  // istanbul ignore next (See: 'https://github.com/graphql/graphql-js/issues/2203')
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

    // TODO: Ensure proper locations.

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
    }
  }
}

function validateName(
  context: SchemaValidationContext,
  node: { readonly name: string; readonly astNode: Maybe<ASTNode> },
): void {
  // Ensure names are valid, however introspection types opt out.
  const error = isValidNameError(node.name);
  if (error) {
    context.addError(locatedError(error, node.astNode));
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
          `The type of ${arg} must be Input ` +
            `Type but got: ${inspect(arg.type)}.`,
          arg.astNode?.type,
        );
      }

      if (isRequiredArgument(arg) && arg.deprecationReason != null) {
        context.reportError(`Required argument ${arg} cannot be deprecated.`, [
          getDeprecatedDirectiveNode(arg.astNode),
          arg.astNode?.type,
        ]);
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

    if (ifaceTypeNames[iface.name]) {
      context.reportError(
        `Type ${type} can only implement ${iface} once.`,
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
    const typeField = typeFieldMap[ifaceField.name];

    // Assert interface field exists on type.
    if (!typeField) {
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
          [
            // istanbul ignore next (TODO need to write coverage tests)
            ifaceArg.astNode?.type,
            // istanbul ignore next (TODO need to write coverage tests)
            typeArg.astNode?.type,
          ],
        );
      }

      // TODO: validate default values?
    }

    // Assert additional arguments must not be required.
    for (const typeArg of typeField.args) {
      if (isRequiredArgument(typeArg)) {
        const ifaceArg = ifaceField.args.find(
          (arg) => arg.name === typeArg.name,
        );
        if (!ifaceArg) {
          context.reportError(
            `Argument ${typeArg} must not be required type ${typeArg.type} ` +
              `if not provided by the Interface field ${ifaceField}.`,
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

  const includedTypeNames = Object.create(null);
  for (const memberType of memberTypes) {
    if (includedTypeNames[memberType.name]) {
      context.reportError(
        `Union type ${union} can only include type ${memberType} once.`,
        getUnionMemberTypeNodes(union, memberType.name),
      );
      continue;
    }
    includedTypeNames[memberType.name] = true;
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
    const valueName = enumValue.name;

    // Ensure valid name.
    validateName(context, enumValue);
    if (valueName === 'true' || valueName === 'false' || valueName === 'null') {
      context.reportError(
        `Enum type ${enumType} cannot include value: ${valueName}.`,
        enumValue.astNode,
      );
    }
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

  // Ensure the arguments are valid
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
        [
          getDeprecatedDirectiveNode(field.astNode),
          // istanbul ignore next (TODO need to write coverage tests)
          field.astNode?.type,
        ],
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
            `Cannot reference Input Object "${fieldType}" within itself through a series of non-null fields: "${pathStr}".`,
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

  // istanbul ignore next (See: 'https://github.com/graphql/graphql-js/issues/2203')
  return nodes
    .flatMap((typeNode) => typeNode.interfaces ?? [])
    .filter((ifaceNode) => ifaceNode.name.value === iface.name);
}

function getUnionMemberTypeNodes(
  union: GraphQLUnionType,
  typeName: string,
): Maybe<ReadonlyArray<NamedTypeNode>> {
  const { astNode, extensionASTNodes } = union;
  const nodes: ReadonlyArray<UnionTypeDefinitionNode | UnionTypeExtensionNode> =
    astNode != null ? [astNode, ...extensionASTNodes] : extensionASTNodes;

  // istanbul ignore next (See: 'https://github.com/graphql/graphql-js/issues/2203')
  return nodes
    .flatMap((unionNode) => unionNode.types ?? [])
    .filter((typeNode) => typeNode.name.value === typeName);
}

function getDeprecatedDirectiveNode(
  definitionNode: Maybe<{ readonly directives?: ReadonlyArray<DirectiveNode> }>,
): Maybe<DirectiveNode> {
  // istanbul ignore next (See: 'https://github.com/graphql/graphql-js/issues/2203')
  return definitionNode?.directives?.find(
    (node) => node.name.value === GraphQLDeprecatedDirective.name,
  );
}
