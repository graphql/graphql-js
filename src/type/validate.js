/**
 * Copyright (c) 2015-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow
 */

import {
  GraphQLInterfaceType,
  GraphQLObjectType,
  GraphQLNonNull,
  isType,
} from './definition';
import { GraphQLDirective } from './directives';
import { GraphQLSchema } from './schema';
import find from '../jsutils/find';
import { isEqualType, isTypeSubTypeOf } from '../utilities/typeComparators';
import type {
  ASTNode,
  FieldDefinitionNode,
  InputValueDefinitionNode,
  NamedTypeNode,
  TypeNode,
} from '../language/ast';
import { GraphQLError } from '../error/GraphQLError';

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
  if (!(schema instanceof GraphQLSchema)) {
    if (!schema) {
      throw new Error('Must provide schema.');
    }

    // Provide as descriptive an error as possible when attempting to use a
    // schema cross-realm.
    if (Object.getPrototypeOf(schema).constructor.name === 'GraphQLSchema') {
      throw new Error(`Cannot use a GraphQLSchema from another module or realm.

Ensure that there is only one instance of "graphql" in the node_modules
directory. If different versions of "graphql" are the dependencies of other
relied on modules, use "resolutions" to ensure only one version is installed.

https://yarnpkg.com/en/docs/selective-version-resolutions

Duplicate "graphql" modules cannot be used at the same time since different
versions may have different capabilities and behavior. The data from one
version used in the function from another could produce confusing and
spurious results.`);
    } else {
      throw new Error(
        'Schema must be an instance of GraphQLSchema. ' +
          `Received: ${String(schema)}`,
      );
    }
  }

  // If this Schema has already been validated, return the previous results.
  if (schema.__validationErrors) {
    return schema.__validationErrors;
  }

  // Validate the schema, producing a list of errors.
  const context = new SchemaValidationContext();
  validateRootTypes(context, schema);
  validateDirectives(context, schema);
  validateTypes(context, schema);

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
  _errors: Array<GraphQLError>;

  constructor() {
    this._errors = [];
  }

  reportError(
    message: string,
    nodes?: $ReadOnlyArray<?ASTNode> | ?ASTNode,
  ): void {
    const _nodes = (Array.isArray(nodes) ? nodes : [nodes]).filter(Boolean);
    this._errors.push(new GraphQLError(message, _nodes));
  }

  getErrors(): $ReadOnlyArray<GraphQLError> {
    return this._errors;
  }
}

function validateRootTypes(context, schema) {
  const queryType = schema.getQueryType();
  if (!queryType) {
    context.reportError(`Query root type must be provided.`, schema.astNode);
  } else if (!(queryType instanceof GraphQLObjectType)) {
    context.reportError(
      `Query root type must be Object type but got: ${String(queryType)}.`,
      getOperationTypeNode(schema, queryType, 'query'),
    );
  }

  const mutationType = schema.getMutationType();
  if (mutationType && !(mutationType instanceof GraphQLObjectType)) {
    context.reportError(
      'Mutation root type must be Object type if provided but got: ' +
        `${String(mutationType)}.`,
      getOperationTypeNode(schema, mutationType, 'mutation'),
    );
  }

  const subscriptionType = schema.getSubscriptionType();
  if (subscriptionType && !(subscriptionType instanceof GraphQLObjectType)) {
    context.reportError(
      'Subscription root type must be Object type if provided but got: ' +
        `${String(subscriptionType)}.`,
      getOperationTypeNode(schema, subscriptionType, 'subscription'),
    );
  }
}

function getOperationTypeNode(
  schema: GraphQLSchema,
  type: GraphQLObjectType,
  operation: string,
): ?ASTNode {
  const astNode = schema.astNode;
  const operationTypeNode =
    astNode &&
    astNode.operationTypes.find(
      operationType => operationType.operation === operation,
    );
  return operationTypeNode ? operationTypeNode.type : type && type.astNode;
}

function validateDirectives(
  context: SchemaValidationContext,
  schema: GraphQLSchema,
): void {
  const directives = schema.getDirectives();
  directives.forEach(directive => {
    if (!(directive instanceof GraphQLDirective)) {
      context.reportError(
        `Expected directive but got: ${String(directive)}.`,
        directive && directive.astNode,
      );
    }
  });
}

function validateTypes(
  context: SchemaValidationContext,
  schema: GraphQLSchema,
): void {
  const typeMap = schema.getTypeMap();
  Object.keys(typeMap).forEach(typeName => {
    const type = typeMap[typeName];

    // Ensure all provided types are in fact GraphQL type.
    if (!isType(type)) {
      context.reportError(
        `Expected GraphQL type but got: ${String(type)}.`,
        type && type.astNode,
      );
    }

    // Ensure objects implement the interfaces they claim to.
    if (type instanceof GraphQLObjectType) {
      const implementedTypeNames = Object.create(null);

      type.getInterfaces().forEach(iface => {
        if (implementedTypeNames[iface.name]) {
          context.reportError(
            `${type.name} must declare it implements ${iface.name} only once.`,
            getAllImplementsInterfaceNode(type, iface),
          );
        }
        implementedTypeNames[iface.name] = true;
        validateObjectImplementsInterface(context, schema, type, iface);
      });
    }
  });
}

function validateObjectImplementsInterface(
  context: SchemaValidationContext,
  schema: GraphQLSchema,
  object: GraphQLObjectType,
  iface: GraphQLInterfaceType,
): void {
  if (!(iface instanceof GraphQLInterfaceType)) {
    context.reportError(
      `${String(object)} must only implement Interface types, it cannot ` +
        `implement ${String(iface)}.`,
      getImplementsInterfaceNode(object, iface),
    );
    return;
  }

  const objectFieldMap = object.getFields();
  const ifaceFieldMap = iface.getFields();

  // Assert each interface field is implemented.
  Object.keys(ifaceFieldMap).forEach(fieldName => {
    const objectField = objectFieldMap[fieldName];
    const ifaceField = ifaceFieldMap[fieldName];

    // Assert interface field exists on object.
    if (!objectField) {
      context.reportError(
        `"${iface.name}" expects field "${fieldName}" but "${object.name}" ` +
          'does not provide it.',
        [getFieldNode(iface, fieldName), object.astNode],
      );
      // Continue loop over fields.
      return;
    }

    // Assert interface field type is satisfied by object field type, by being
    // a valid subtype. (covariant)
    if (!isTypeSubTypeOf(schema, objectField.type, ifaceField.type)) {
      context.reportError(
        `${iface.name}.${fieldName} expects type ` +
          `"${String(ifaceField.type)}" but ${object.name}.${fieldName} is ` +
          `type "${String(objectField.type)}".`,
        [
          getFieldTypeNode(iface, fieldName),
          getFieldTypeNode(object, fieldName),
        ],
      );
    }

    // Assert each interface field arg is implemented.
    ifaceField.args.forEach(ifaceArg => {
      const argName = ifaceArg.name;
      const objectArg = find(objectField.args, arg => arg.name === argName);

      // Assert interface field arg exists on object field.
      if (!objectArg) {
        context.reportError(
          `${iface.name}.${fieldName} expects argument "${argName}" but ` +
            `${object.name}.${fieldName} does not provide it.`,
          [
            getFieldArgNode(iface, fieldName, argName),
            getFieldNode(object, fieldName),
          ],
        );
        // Continue loop over arguments.
        return;
      }

      // Assert interface field arg type matches object field arg type.
      // (invariant)
      // TODO: change to contravariant?
      if (!isEqualType(ifaceArg.type, objectArg.type)) {
        context.reportError(
          `${iface.name}.${fieldName}(${argName}:) expects type ` +
            `"${String(ifaceArg.type)}" but ` +
            `${object.name}.${fieldName}(${argName}:) is type ` +
            `"${String(objectArg.type)}".`,
          [
            getFieldArgTypeNode(iface, fieldName, argName),
            getFieldArgTypeNode(object, fieldName, argName),
          ],
        );
      }

      // TODO: validate default values?
    });

    // Assert additional arguments must not be required.
    objectField.args.forEach(objectArg => {
      const argName = objectArg.name;
      const ifaceArg = find(ifaceField.args, arg => arg.name === argName);
      if (!ifaceArg && objectArg.type instanceof GraphQLNonNull) {
        context.reportError(
          `${object.name}.${fieldName}(${argName}:) is of required type ` +
            `"${String(objectArg.type)}" but is not also provided by the ` +
            `interface ${iface.name}.${fieldName}.`,
          [
            getFieldArgTypeNode(object, fieldName, argName),
            getFieldNode(iface, fieldName),
          ],
        );
      }
    });
  });
}

function getImplementsInterfaceNode(
  type: GraphQLObjectType,
  iface: GraphQLInterfaceType,
): ?NamedTypeNode {
  return getAllImplementsInterfaceNode(type, iface)[0];
}

function getAllImplementsInterfaceNode(
  type: GraphQLObjectType,
  iface: GraphQLInterfaceType,
): Array<NamedTypeNode> {
  const implementsNodes = [];
  const astNodes = [type.astNode].concat(type.extensionASTNodes || []);
  for (let i = 0; i < astNodes.length; i++) {
    const astNode = astNodes[i];
    if (astNode && astNode.interfaces) {
      astNode.interfaces.forEach(node => {
        if (node.name.value === iface.name) {
          implementsNodes.push(node);
        }
      });
    }
  }
  return implementsNodes;
}

function getFieldNode(
  type: GraphQLObjectType | GraphQLInterfaceType,
  fieldName: string,
): ?FieldDefinitionNode {
  const astNodes = [type.astNode].concat(type.extensionASTNodes || []);
  for (let i = 0; i < astNodes.length; i++) {
    const astNode = astNodes[i];
    const fieldNode =
      astNode &&
      astNode.fields &&
      astNode.fields.find(node => node.name.value === fieldName);
    if (fieldNode) {
      return fieldNode;
    }
  }
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
  const fieldNode = getFieldNode(type, fieldName);
  return (
    fieldNode &&
    fieldNode.arguments &&
    fieldNode.arguments.find(node => node.name.value === argName)
  );
}

function getFieldArgTypeNode(
  type: GraphQLObjectType | GraphQLInterfaceType,
  fieldName: string,
  argName: string,
): ?TypeNode {
  const fieldArgNode = getFieldArgNode(type, fieldName, argName);
  return fieldArgNode && fieldArgNode.type;
}
