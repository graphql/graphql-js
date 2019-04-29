/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow strict
 */

import find from '../polyfills/find';
import flatMap from '../polyfills/flatMap';
import objectValues from '../polyfills/objectValues';
import objectEntries from '../polyfills/objectEntries';
import {
  type GraphQLObjectType,
  type GraphQLInterfaceType,
  type GraphQLUnionType,
  type GraphQLEnumType,
  type GraphQLInputObjectType,
  isObjectType,
  isInterfaceType,
  isUnionType,
  isEnumType,
  isInputObjectType,
  isNamedType,
  isInputType,
  isOutputType,
  isRequiredArgument,
} from './definition';
import { type GraphQLDirective, isDirective } from './directives';
import { isIntrospectionType } from './introspection';
import { type GraphQLSchema, assertSchema } from './schema';
import inspect from '../jsutils/inspect';
import { GraphQLError } from '../error/GraphQLError';
import {
  type ASTNode,
  type FieldDefinitionNode,
  type InputValueDefinitionNode,
  type NamedTypeNode,
  type TypeNode,
} from '../language/ast';
import { isValidNameError } from '../utilities/assertValidName';
import { isEqualType, isTypeSubTypeOf } from '../utilities/typeComparators';

/**
 * Implements the "Type Validation" sub-sections of the specification's
 * "Type System" section.
 *
 * Validation runs synchronously, returning an array of encountered errors, or
 * an empty array if no errors were encountered and the Schema is valid.
 */
export function validateSchema(
  schema: GraphQLSchema,
): $ReadOnlyArray<GraphQLError> {
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
    throw new Error(errors.map(error => error.message).join('\n\n'));
  }
}

class SchemaValidationContext {
  +_errors: Array<GraphQLError>;
  +schema: GraphQLSchema;

  constructor(schema) {
    this._errors = [];
    this.schema = schema;
  }

  reportError(
    message: string,
    nodes?: $ReadOnlyArray<?ASTNode> | ?ASTNode,
  ): void {
    const _nodes = Array.isArray(nodes) ? nodes.filter(Boolean) : nodes;
    this.addError(new GraphQLError(message, _nodes));
  }

  addError(error: GraphQLError): void {
    this._errors.push(error);
  }

  getErrors(): $ReadOnlyArray<GraphQLError> {
    return this._errors;
  }
}

function validateRootTypes(context) {
  const schema = context.schema;
  const queryType = schema.getQueryType();
  if (!queryType) {
    context.reportError(`Query root type must be provided.`, schema.astNode);
  } else if (!isObjectType(queryType)) {
    context.reportError(
      `Query root type must be Object type, it cannot be ${inspect(
        queryType,
      )}.`,
      getOperationTypeNode(schema, queryType, 'query'),
    );
  }

  const mutationType = schema.getMutationType();
  if (mutationType && !isObjectType(mutationType)) {
    context.reportError(
      'Mutation root type must be Object type if provided, it cannot be ' +
        `${inspect(mutationType)}.`,
      getOperationTypeNode(schema, mutationType, 'mutation'),
    );
  }

  const subscriptionType = schema.getSubscriptionType();
  if (subscriptionType && !isObjectType(subscriptionType)) {
    context.reportError(
      'Subscription root type must be Object type if provided, it cannot be ' +
        `${inspect(subscriptionType)}.`,
      getOperationTypeNode(schema, subscriptionType, 'subscription'),
    );
  }
}

function getOperationTypeNode(
  schema: GraphQLSchema,
  type: GraphQLObjectType,
  operation: string,
): ?ASTNode {
  const operationNodes = getAllSubNodes(schema, node => node.operationTypes);
  for (const node of operationNodes) {
    if (node.operation === operation) {
      return node.type;
    }
  }

  return type.astNode;
}

function validateDirectives(context: SchemaValidationContext): void {
  for (const directive of context.schema.getDirectives()) {
    // Ensure all directives are in fact GraphQL directives.
    if (!isDirective(directive)) {
      context.reportError(
        `Expected directive but got: ${inspect(directive)}.`,
        directive && directive.astNode,
      );
      continue;
    }

    // Ensure they are named correctly.
    validateName(context, directive);

    // TODO: Ensure proper locations.

    // Ensure the arguments are valid.
    const argNames = Object.create(null);
    for (const arg of directive.args) {
      const argName = arg.name;

      // Ensure they are named correctly.
      validateName(context, arg);

      // Ensure they are unique per directive.
      if (argNames[argName]) {
        context.reportError(
          `Argument @${directive.name}(${argName}:) can only be defined once.`,
          getAllDirectiveArgNodes(directive, argName),
        );
        continue;
      }
      argNames[argName] = true;

      // Ensure the type is an input type.
      if (!isInputType(arg.type)) {
        context.reportError(
          `The type of @${directive.name}(${argName}:) must be Input Type ` +
            `but got: ${inspect(arg.type)}.`,
          getDirectiveArgTypeNode(directive, argName),
        );
      }
    }
  }
}

function validateName(
  context: SchemaValidationContext,
  node: { +name: string, +astNode: ?ASTNode },
): void {
  // If a schema explicitly allows some legacy name which is no longer valid,
  // allow it to be assumed valid.
  if (context.schema.__allowedLegacyNames.indexOf(node.name) !== -1) {
    return;
  }
  // Ensure names are valid, however introspection types opt out.
  const error = isValidNameError(node.name, node.astNode || undefined);
  if (error) {
    context.addError(error);
  }
}

function validateTypes(context: SchemaValidationContext): void {
  const typeMap = context.schema.getTypeMap();
  for (const type of objectValues(typeMap)) {
    // Ensure all provided types are in fact GraphQL type.
    if (!isNamedType(type)) {
      context.reportError(
        `Expected GraphQL named type but got: ${inspect(type)}.`,
        type && type.astNode,
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
      validateObjectInterfaces(context, type);
    } else if (isInterfaceType(type)) {
      // Ensure fields are valid.
      validateFields(context, type);
    } else if (isUnionType(type)) {
      // Ensure Unions include valid member types.
      validateUnionMembers(context, type);
    } else if (isEnumType(type)) {
      // Ensure Enums have valid values.
      validateEnumValues(context, type);
    } else if (isInputObjectType(type)) {
      // Ensure Input Object fields are valid.
      validateInputFields(context, type);
    }
  }
}

function validateFields(
  context: SchemaValidationContext,
  type: GraphQLObjectType | GraphQLInterfaceType,
): void {
  const fields = objectValues(type.getFields());

  // Objects and Interfaces both must define one or more fields.
  if (fields.length === 0) {
    context.reportError(
      `Type ${type.name} must define one or more fields.`,
      getAllNodes(type),
    );
  }

  for (const field of fields) {
    // Ensure they are named correctly.
    validateName(context, field);

    // Ensure the type is an output type
    if (!isOutputType(field.type)) {
      context.reportError(
        `The type of ${type.name}.${field.name} must be Output Type ` +
          `but got: ${inspect(field.type)}.`,
        getFieldTypeNode(type, field.name),
      );
    }

    // Ensure the arguments are valid
    const argNames = Object.create(null);
    for (const arg of field.args) {
      const argName = arg.name;

      // Ensure they are named correctly.
      validateName(context, arg);

      // Ensure they are unique per field.
      if (argNames[argName]) {
        context.reportError(
          `Field argument ${type.name}.${field.name}(${argName}:) can only ` +
            'be defined once.',
          getAllFieldArgNodes(type, field.name, argName),
        );
      }
      argNames[argName] = true;

      // Ensure the type is an input type
      if (!isInputType(arg.type)) {
        context.reportError(
          `The type of ${type.name}.${field.name}(${argName}:) must be Input ` +
            `Type but got: ${inspect(arg.type)}.`,
          getFieldArgTypeNode(type, field.name, argName),
        );
      }
    }
  }
}

function validateObjectInterfaces(
  context: SchemaValidationContext,
  object: GraphQLObjectType,
): void {
  const implementedTypeNames = Object.create(null);
  for (const iface of object.getInterfaces()) {
    if (!isInterfaceType(iface)) {
      context.reportError(
        `Type ${inspect(object)} must only implement Interface types, ` +
          `it cannot implement ${inspect(iface)}.`,
        getImplementsInterfaceNode(object, iface),
      );
      continue;
    }

    if (implementedTypeNames[iface.name]) {
      context.reportError(
        `Type ${object.name} can only implement ${iface.name} once.`,
        getAllImplementsInterfaceNodes(object, iface),
      );
      continue;
    }
    implementedTypeNames[iface.name] = true;
    validateObjectImplementsInterface(context, object, iface);
  }
}

function validateObjectImplementsInterface(
  context: SchemaValidationContext,
  object: GraphQLObjectType,
  iface: GraphQLInterfaceType,
): void {
  const objectFieldMap = object.getFields();
  const ifaceFieldMap = iface.getFields();

  // Assert each interface field is implemented.
  for (const [fieldName, ifaceField] of objectEntries(ifaceFieldMap)) {
    const objectField = objectFieldMap[fieldName];

    // Assert interface field exists on object.
    if (!objectField) {
      context.reportError(
        `Interface field ${iface.name}.${fieldName} expected but ` +
          `${object.name} does not provide it.`,
        [getFieldNode(iface, fieldName), ...getAllNodes(object)],
      );
      continue;
    }

    // Assert interface field type is satisfied by object field type, by being
    // a valid subtype. (covariant)
    if (!isTypeSubTypeOf(context.schema, objectField.type, ifaceField.type)) {
      context.reportError(
        `Interface field ${iface.name}.${fieldName} expects type ` +
          `${inspect(ifaceField.type)} but ${object.name}.${fieldName} ` +
          `is type ${inspect(objectField.type)}.`,
        [
          getFieldTypeNode(iface, fieldName),
          getFieldTypeNode(object, fieldName),
        ],
      );
    }

    // Assert each interface field arg is implemented.
    for (const ifaceArg of ifaceField.args) {
      const argName = ifaceArg.name;
      const objectArg = find(objectField.args, arg => arg.name === argName);

      // Assert interface field arg exists on object field.
      if (!objectArg) {
        context.reportError(
          `Interface field argument ${iface.name}.${fieldName}(${argName}:) ` +
            `expected but ${object.name}.${fieldName} does not provide it.`,
          [
            getFieldArgNode(iface, fieldName, argName),
            getFieldNode(object, fieldName),
          ],
        );
        continue;
      }

      // Assert interface field arg type matches object field arg type.
      // (invariant)
      // TODO: change to contravariant?
      if (!isEqualType(ifaceArg.type, objectArg.type)) {
        context.reportError(
          `Interface field argument ${iface.name}.${fieldName}(${argName}:) ` +
            `expects type ${inspect(ifaceArg.type)} but ` +
            `${object.name}.${fieldName}(${argName}:) is type ` +
            `${inspect(objectArg.type)}.`,
          [
            getFieldArgTypeNode(iface, fieldName, argName),
            getFieldArgTypeNode(object, fieldName, argName),
          ],
        );
      }

      // TODO: validate default values?
    }

    // Assert additional arguments must not be required.
    for (const objectArg of objectField.args) {
      const argName = objectArg.name;
      const ifaceArg = find(ifaceField.args, arg => arg.name === argName);
      if (!ifaceArg && isRequiredArgument(objectArg)) {
        context.reportError(
          `Object field ${object.name}.${fieldName} includes required ` +
            `argument ${argName} that is missing from the Interface field ` +
            `${iface.name}.${fieldName}.`,
          [
            getFieldArgNode(object, fieldName, argName),
            getFieldNode(iface, fieldName),
          ],
        );
      }
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
      getAllNodes(union),
    );
  }

  const includedTypeNames = Object.create(null);
  for (const memberType of memberTypes) {
    if (includedTypeNames[memberType.name]) {
      context.reportError(
        `Union type ${union.name} can only include type ` +
          `${memberType.name} once.`,
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
      getAllNodes(enumType),
    );
  }

  for (const enumValue of enumValues) {
    const valueName = enumValue.name;

    // Ensure valid name.
    validateName(context, enumValue);
    if (valueName === 'true' || valueName === 'false' || valueName === 'null') {
      context.reportError(
        `Enum type ${enumType.name} cannot include value: ${valueName}.`,
        enumValue.astNode,
      );
    }
  }
}

function validateInputFields(
  context: SchemaValidationContext,
  inputObj: GraphQLInputObjectType,
): void {
  const fields = objectValues(inputObj.getFields());

  if (fields.length === 0) {
    context.reportError(
      `Input Object type ${inputObj.name} must define one or more fields.`,
      getAllNodes(inputObj),
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
        field.astNode && field.astNode.type,
      );
    }
  }
}

type SDLDefinedObject<T, K> = {
  +astNode: ?T,
  +extensionASTNodes?: ?$ReadOnlyArray<K>,
};

function getAllNodes<T: ASTNode, K: ASTNode>(
  object: SDLDefinedObject<T, K>,
): $ReadOnlyArray<T | K> {
  const { astNode, extensionASTNodes } = object;
  return astNode
    ? extensionASTNodes
      ? [astNode].concat(extensionASTNodes)
      : [astNode]
    : extensionASTNodes || [];
}

function getAllSubNodes<T: ASTNode, K: ASTNode, L: ASTNode>(
  object: SDLDefinedObject<T, K>,
  getter: (T | K) => ?(L | $ReadOnlyArray<L>),
): $ReadOnlyArray<L> {
  return flatMap(getAllNodes(object), item => getter(item) || []);
}

function getImplementsInterfaceNode(
  type: GraphQLObjectType,
  iface: GraphQLInterfaceType,
): ?NamedTypeNode {
  return getAllImplementsInterfaceNodes(type, iface)[0];
}

function getAllImplementsInterfaceNodes(
  type: GraphQLObjectType,
  iface: GraphQLInterfaceType,
): $ReadOnlyArray<NamedTypeNode> {
  return getAllSubNodes(type, typeNode => typeNode.interfaces).filter(
    ifaceNode => ifaceNode.name.value === iface.name,
  );
}

function getFieldNode(
  type: GraphQLObjectType | GraphQLInterfaceType,
  fieldName: string,
): ?FieldDefinitionNode {
  return find(
    getAllSubNodes(type, typeNode => typeNode.fields),
    fieldNode => fieldNode.name.value === fieldName,
  );
}

function getFieldTypeNode(
  type: GraphQLObjectType | GraphQLInterfaceType,
  fieldName: string,
): ?TypeNode {
  const fieldNode = getFieldNode(type, fieldName);
  return fieldNode && fieldNode.type;
}

function getFieldArgNode(
  type: GraphQLObjectType | GraphQLInterfaceType,
  fieldName: string,
  argName: string,
): ?InputValueDefinitionNode {
  return getAllFieldArgNodes(type, fieldName, argName)[0];
}

function getAllFieldArgNodes(
  type: GraphQLObjectType | GraphQLInterfaceType,
  fieldName: string,
  argName: string,
): $ReadOnlyArray<InputValueDefinitionNode> {
  const argNodes = [];
  const fieldNode = getFieldNode(type, fieldName);
  if (fieldNode && fieldNode.arguments) {
    for (const node of fieldNode.arguments) {
      if (node.name.value === argName) {
        argNodes.push(node);
      }
    }
  }
  return argNodes;
}

function getFieldArgTypeNode(
  type: GraphQLObjectType | GraphQLInterfaceType,
  fieldName: string,
  argName: string,
): ?TypeNode {
  const fieldArgNode = getFieldArgNode(type, fieldName, argName);
  return fieldArgNode && fieldArgNode.type;
}

function getAllDirectiveArgNodes(
  directive: GraphQLDirective,
  argName: string,
): $ReadOnlyArray<InputValueDefinitionNode> {
  return getAllSubNodes(
    directive,
    directiveNode => directiveNode.arguments,
  ).filter(argNode => argNode.name.value === argName);
}

function getDirectiveArgTypeNode(
  directive: GraphQLDirective,
  argName: string,
): ?TypeNode {
  const argNode = getAllDirectiveArgNodes(directive, argName)[0];
  return argNode && argNode.type;
}

function getUnionMemberTypeNodes(
  union: GraphQLUnionType,
  typeName: string,
): ?$ReadOnlyArray<NamedTypeNode> {
  return getAllSubNodes(union, unionNode => unionNode.types).filter(
    typeNode => typeNode.name.value === typeName,
  );
}
