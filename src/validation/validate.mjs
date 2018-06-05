/**
 * Copyright (c) 2015-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow strict
 */

import invariant from '../jsutils/invariant';
import { GraphQLError } from '../error';
import { visit, visitInParallel, visitWithTypeInfo } from '../language/visitor';
import type { DocumentNode } from '../language/ast';
import type { ASTVisitor } from '../language/visitor';
import { GraphQLSchema } from '../type/schema';
import { assertValidSchema } from '../type/validate';
import { TypeInfo } from '../utilities/TypeInfo';
import { specifiedRules } from './specifiedRules';
import ValidationContext from './ValidationContext';

/**
 * Implements the "Validation" section of the spec.
 *
 * Validation runs synchronously, returning an array of encountered errors, or
 * an empty array if no errors were encountered and the document is valid.
 *
 * A list of specific validation rules may be provided. If not provided, the
 * default list of rules defined by the GraphQL specification will be used.
 *
 * Each validation rules is a function which returns a visitor
 * (see the language/visitor API). Visitor methods are expected to return
 * GraphQLErrors, or Arrays of GraphQLErrors when invalid.
 *
 * Optionally a custom TypeInfo instance may be provided. If not provided, one
 * will be created from the provided schema.
 */
export function validate(
  schema: GraphQLSchema,
  ast: DocumentNode,
  rules?: $ReadOnlyArray<any>,
  typeInfo?: TypeInfo,
): $ReadOnlyArray<GraphQLError> {
  invariant(ast, 'Must provide document');
  // If the schema used for validation is invalid, throw an error.
  assertValidSchema(schema);
  return visitUsingRules(
    schema,
    typeInfo || new TypeInfo(schema),
    ast,
    rules || specifiedRules,
  );
}

/**
 * This uses a specialized visitor which runs multiple visitors in parallel,
 * while maintaining the visitor skip and break API.
 *
 * @internal
 */
function visitUsingRules(
  schema: GraphQLSchema,
  typeInfo: TypeInfo,
  documentAST: DocumentNode,
  rules: $ReadOnlyArray<(ValidationContext) => ASTVisitor>,
): $ReadOnlyArray<GraphQLError> {
  const context = new ValidationContext(schema, documentAST, typeInfo);
  const visitors = rules.map(rule => rule(context));
  // Visit the whole document with each instance of all provided rules.
  visit(documentAST, visitWithTypeInfo(typeInfo, visitInParallel(visitors)));
  return context.getErrors();
}
