/** @category Validation */

import { devAssert } from '../jsutils/devAssert';
import { mapValue } from '../jsutils/mapValue';
import type { Maybe } from '../jsutils/Maybe';

import { GraphQLError } from '../error/GraphQLError';

import type { DocumentNode } from '../language/ast';
import { QueryDocumentKeys } from '../language/ast';
import { visit, visitInParallel } from '../language/visitor';

import type { GraphQLSchema } from '../type/schema';
import { assertValidSchema } from '../type/validate';

import { TypeInfo, visitWithTypeInfo } from '../utilities/TypeInfo';

import { specifiedRules, specifiedSDLRules } from './specifiedRules';
import type { SDLValidationRule, ValidationRule } from './ValidationContext';
import { SDLValidationContext, ValidationContext } from './ValidationContext';

// Per the specification, descriptions must not affect validation.
// See https://spec.graphql.org/draft/#sec-Descriptions
const QueryDocumentKeysToValidate = mapValue(
  QueryDocumentKeys,
  (keys: ReadonlyArray<string>) => keys.filter((key) => key !== 'description'),
);

/**
 * Options used when validating a GraphQL document.
 * @internal
 */
export interface ValidationOptions {
  /**
   * Maximum number of validation errors before validation stops.
   * @internal
   */
  maxErrors?: number;
}

/**
 * Implements the "Validation" section of the spec.
 *
 * Validation runs synchronously, returning an array of encountered errors, or
 * an empty array if no errors were encountered and the document is valid.
 *
 * A list of specific validation rules may be provided. If not provided, the
 * default list of rules defined by the GraphQL specification will be used.
 *
 * Each validation rule is a function that returns a visitor
 * (see the language/visitor API). Visitor methods are expected to return
 * GraphQLErrors, or Arrays of GraphQLErrors when invalid.
 *
 * Validate will stop validation after a `maxErrors` limit has been reached.
 * Attackers can send pathologically invalid queries to induce a DoS attack,
 * so `maxErrors` defaults to 100 errors.
 *
 * Optionally a custom TypeInfo instance may be provided. If not provided, one
 * will be created from the provided schema.
 * @param schema - Schema to validate against.
 * @param documentAST - Document AST to validate.
 * @param rules - Validation rules to apply.
 * @param options - Validation options, including error limits.
 * @param typeInfo - TypeInfo instance to update during traversal.
 * @returns Validation errors, or an empty array when the document is valid.
 * @example
 * ```ts
 * // Validate with the default specified rules.
 * import { parse } from 'graphql/language';
 * import { buildSchema } from 'graphql/utilities';
 * import { validate } from 'graphql/validation';
 *
 * const schema = buildSchema(`
 *   type Query {
 *     greeting: String
 *   }
 * `);
 *
 * validate(schema, parse('{ greeting }')); // => []
 *
 * const errors = validate(schema, parse('{ missing }'));
 * errors[0].message; // => 'Cannot query field "missing" on type "Query".'
 * ```
 * @example
 * ```ts
 * // This variant uses a custom rule list, TypeInfo, and validation options.
 * import { parse } from 'graphql/language';
 * import { buildSchema, TypeInfo } from 'graphql/utilities';
 * import { FieldsOnCorrectTypeRule, validate } from 'graphql/validation';
 *
 * const schema = buildSchema(`
 *   type Query {
 *     greeting: String
 *   }
 * `);
 * const document = parse('{ missingOne missingTwo }');
 *
 * const errors = validate(
 *   schema,
 *   document,
 *   [FieldsOnCorrectTypeRule],
 *   { maxErrors: 1 },
 *   new TypeInfo(schema),
 * );
 *
 * errors.length; // => 2
 * errors[1].message; // => 'Too many validation errors, error limit reached. Validation aborted.'
 * ```
 */
export function validate(
  schema: GraphQLSchema,
  documentAST: DocumentNode,
  rules: ReadonlyArray<ValidationRule> = specifiedRules,
  options?: ValidationOptions,

  /**
   * Deprecated TypeInfo instance used to track traversal state during
   * validation. Omit this argument so validate creates the TypeInfo instance.
   * @deprecated will be removed in 17.0.0
   */
  typeInfo: TypeInfo = new TypeInfo(schema),
): ReadonlyArray<GraphQLError> {
  const maxErrors = options?.maxErrors ?? 100;

  devAssert(documentAST, 'Must provide document.');
  // If the schema used for validation is invalid, throw an error.
  assertValidSchema(schema);

  const abortObj = Object.freeze({});
  const errors: Array<GraphQLError> = [];
  const context = new ValidationContext(
    schema,
    documentAST,
    typeInfo,
    (error) => {
      if (errors.length >= maxErrors) {
        errors.push(
          new GraphQLError(
            'Too many validation errors, error limit reached. Validation aborted.',
          ),
        );
        // eslint-disable-next-line @typescript-eslint/no-throw-literal
        throw abortObj;
      }
      errors.push(error);
    },
  );

  // This uses a specialized visitor which runs multiple visitors in parallel,
  // while maintaining the visitor skip and break API.
  const visitor = visitInParallel(rules.map((rule) => rule(context)));

  // Visit the whole document with each instance of all provided rules.
  try {
    visit(
      documentAST,
      visitWithTypeInfo(typeInfo, visitor),
      QueryDocumentKeysToValidate,
    );
  } catch (e) {
    if (e !== abortObj) {
      throw e;
    }
  }
  return errors;
}

/** @internal */
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
