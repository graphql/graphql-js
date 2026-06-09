/** @category Validation */

import { mapValue } from '../jsutils/mapValue.ts';
import type { Maybe } from '../jsutils/Maybe.ts';

import { GraphQLError } from '../error/GraphQLError.ts';

import type { DocumentNode } from '../language/ast.ts';
import { QueryDocumentKeys } from '../language/ast.ts';
import { visit, visitInParallel } from '../language/visitor.ts';

import type { GraphQLSchema } from '../type/schema.ts';
import { assertValidSchema } from '../type/validate.ts';

import { TypeInfo, visitWithTypeInfo } from '../utilities/TypeInfo.ts';

import { shouldTrace, validateChannel } from '../diagnostics.ts';

import { specifiedRules, specifiedSDLRules } from './specifiedRules.ts';
import type { SDLValidationRule, ValidationRule } from './ValidationContext.ts';
import {
  SDLValidationContext,
  ValidationContext,
} from './ValidationContext.ts';

/**
 * Options used when validating a GraphQL document.
 * @category Validation
 */
export interface ValidationOptions {
  /** Maximum number of validation errors before validation stops. */
  maxErrors?: number;
  /** Whether suggestion text should be omitted from validation errors. */
  hideSuggestions?: Maybe<boolean>;
}

// Per the specification, descriptions must not affect validation.
// See https://spec.graphql.org/draft/#sec-Descriptions
const QueryDocumentKeysToValidate = mapValue(
  QueryDocumentKeys,
  (keys: ReadonlyArray<string>) => keys.filter((key) => key !== 'description'),
);

const tooManyValidationErrorsError = new GraphQLError(
  'Too many validation errors, error limit reached. Validation aborted.',
);

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
 * @param schema - Schema to validate against.
 * @param documentAST - Document AST to validate.
 * @param rules - Validation rules to apply.
 * @param options - Validation options, including error limits and suggestions.
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
 *     fullName: String
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
 * // This variant uses a custom rule list and validation options.
 * import { parse } from 'graphql/language';
 * import { buildSchema } from 'graphql/utilities';
 * import { FieldsOnCorrectTypeRule, validate } from 'graphql/validation';
 *
 * const schema = buildSchema(`
 *   type Query {
 *     greeting: String
 *   }
 * `);
 * const document = parse('{ missingOne missingTwo }');
 *
 * const errors = validate(schema, document, [FieldsOnCorrectTypeRule], {
 *   maxErrors: 1,
 * });
 *
 * errors.length; // => 2
 * errors[1].message; // => 'Too many validation errors, error limit reached. Validation aborted.'
 *
 * const hiddenSuggestionErrors = validate(
 *   schema,
 *   parse('{ name }'),
 *   [FieldsOnCorrectTypeRule],
 *   { hideSuggestions: true },
 * );
 *
 * hiddenSuggestionErrors[0].message; // => 'Cannot query field "name" on type "Query".'
 * ```
 */
export function validate(
  schema: GraphQLSchema,
  documentAST: DocumentNode,
  rules: ReadonlyArray<ValidationRule> = specifiedRules,
  options?: ValidationOptions,
): ReadonlyArray<GraphQLError> {
  return shouldTrace(validateChannel)
    ? validateChannel.traceSync(
        () => validateImpl(schema, documentAST, rules, options),
        { schema, document: documentAST },
      )
    : validateImpl(schema, documentAST, rules, options);
}

function validateImpl(
  schema: GraphQLSchema,
  documentAST: DocumentNode,
  rules: ReadonlyArray<ValidationRule>,
  options: ValidationOptions | undefined,
): ReadonlyArray<GraphQLError> {
  const maxErrors = options?.maxErrors ?? 100;
  const hideSuggestions = options?.hideSuggestions ?? false;

  // If the schema used for validation is invalid, throw an error.
  assertValidSchema(schema);

  const errors: Array<GraphQLError> = [];
  const typeInfo = new TypeInfo(schema);
  const context = new ValidationContext(
    schema,
    documentAST,
    typeInfo,
    (error) => {
      if (errors.length >= maxErrors) {
        throw tooManyValidationErrorsError;
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
    visit(
      documentAST,
      visitWithTypeInfo(typeInfo, visitor),
      QueryDocumentKeysToValidate,
    );
  } catch (e: unknown) {
    if (e === tooManyValidationErrorsError) {
      errors.push(tooManyValidationErrorsError);
    } else {
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
