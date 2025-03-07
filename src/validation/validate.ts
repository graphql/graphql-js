import type { Maybe } from '../jsutils/Maybe.js';

import { GraphQLError } from '../error/GraphQLError.js';

import type { DocumentNode } from '../language/ast.js';
import { visit, visitInParallel } from '../language/visitor.js';

import type { GraphQLSchema } from '../type/schema.js';
import { assertValidSchema } from '../type/validate.js';

import { TypeInfo, visitWithTypeInfo } from '../utilities/TypeInfo.js';

import { specifiedRules, specifiedSDLRules } from './specifiedRules.js';
import type { SDLValidationRule, ValidationRule } from './ValidationContext.js';
import {
  SDLValidationContext,
  ValidationContext,
} from './ValidationContext.js';

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
 * Validate will stop validation after a `maxErrors` limit has been reached.
 * Attackers can send pathologically invalid queries to induce a DoS attack,
 * so by default `maxErrors` set to 100 errors.
 *
 * Optionally a custom TypeInfo instance may be provided. If not provided, one
 * will be created from the provided schema.
 */
export function validate(
  schema: GraphQLSchema,
  documentAST: DocumentNode,
  rules: ReadonlyArray<ValidationRule> = specifiedRules,
  options?: { maxErrors?: number; hideSuggestions?: Maybe<boolean> },
): ReadonlyArray<GraphQLError> {
  const maxErrors = options?.maxErrors ?? 100;
  const hideSuggestions = options?.hideSuggestions ?? false;

  // If the schema used for validation is invalid, throw an error.
  assertValidSchema(schema);

  const abortError = new GraphQLError(
    'Too many validation errors, error limit reached. Validation aborted.',
  );
  const errors: Array<GraphQLError> = [];
  const typeInfo = new TypeInfo(schema);
  const context = new ValidationContext(
    schema,
    documentAST,
    typeInfo,
    (error) => {
      if (errors.length >= maxErrors) {
        throw abortError;
      }
      errors.push(error);
    },
    hideSuggestions,
  );

  // This uses a specialized visitor which runs multiple visitors in parallel,
  // while maintaining the visitor skip and break API.
  const visitor = visitInParallel(rules.map((rule) => rule(context)));

  // Visit the whole document with each instance of all provided rules.
  try {
    visit(documentAST, visitWithTypeInfo(typeInfo, visitor));
  } catch (e: unknown) {
    if (e === abortError) {
      errors.push(abortError);
    } else {
      throw e;
    }
  }
  return errors;
}

/**
 * @internal
 */
export function validateSDL(
  documentAST: DocumentNode,
  schemaToExtend?: Maybe<GraphQLSchema>,
  rules: ReadonlyArray<SDLValidationRule> = specifiedSDLRules,
): ReadonlyArray<GraphQLError> {
  const errors: Array<GraphQLError> = [];
  const context = new SDLValidationContext(
    documentAST,
    schemaToExtend,
    (error) => {
      errors.push(error);
    },
  );

  const visitors = rules.map((rule) => rule(context));
  visit(documentAST, visitInParallel(visitors));
  return errors;
}

/**
 * Utility function which asserts a SDL document is valid by throwing an error
 * if it is invalid.
 *
 * @internal
 */
export function assertValidSDL(documentAST: DocumentNode): void {
  const errors = validateSDL(documentAST);
  if (errors.length !== 0) {
    throw new Error(errors.map((error) => error.message).join('\n\n'));
  }
}

/**
 * Utility function which asserts a SDL document is valid by throwing an error
 * if it is invalid.
 *
 * @internal
 */
export function assertValidSDLExtension(
  documentAST: DocumentNode,
  schema: GraphQLSchema,
): void {
  const errors = validateSDL(documentAST, schema);
  if (errors.length !== 0) {
    throw new Error(errors.map((error) => error.message).join('\n\n'));
  }
}
