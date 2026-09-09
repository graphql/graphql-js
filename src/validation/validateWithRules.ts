/** @category Validation */

import { mapValue } from '../jsutils/mapValue.ts';
import type { Maybe } from '../jsutils/Maybe.ts';

import { GraphQLError } from '../error/GraphQLError.ts';

import type { DocumentNode } from '../language/ast.ts';
import { QueryDocumentKeys } from '../language/ast.ts';
import { visit, visitInParallel } from '../language/visitor.ts';

import type { GraphQLSchema } from '../type/schema.ts';

import { DocumentIndex } from './DocumentIndex.ts';
import { IndexCursor, visitWithIndexCursor } from './IndexCursor.ts';
import {
  specifiedASTValidationRules,
  specifiedTypeSystemValidationRules,
} from './specifiedValidationRules.ts';
import type { TypeSystemValidationFn } from './TypeSystemValidationIndex.ts';
import { TypeSystemValidationIndex } from './TypeSystemValidationIndex.ts';
import type { ASTVisitorFn } from './unifiedValidationRules/ASTValidationContext.ts';
import { ASTValidationContext } from './unifiedValidationRules/ASTValidationContext.ts';

/**
 * Options for validation.
 * @category Validation
 */
export interface ValidateWithRulesOptions {
  /** Existing schema used as validation context. */
  schema?: Maybe<GraphQLSchema>;
  /** Document AST to validate. */
  documentAST?: Maybe<DocumentNode>;
  /** AST validation rules to apply. */
  rules?: Maybe<ReadonlyArray<ASTVisitorFn>>;
  /** Type-system validation rules to apply. */
  typeSystemRules?: Maybe<ReadonlyArray<TypeSystemValidationFn>>;
  /** Maximum number of errors before document validation stops. */
  maxErrors?: number;
  /** Whether suggestion text should be omitted from validation errors. */
  hideSuggestions?: Maybe<boolean>;
  /**
   * When validating a document against an existing schema, also report schema
   * validation errors with any type-system definitions in the document taken
   * into account. By default, document validation assumes the existing schema is
   * valid and reports only document errors.
   */
  includeExistingSchemaErrors?: boolean;
}

const tooManyValidationErrorsError = new GraphQLError(
  'Too many validation errors, error limit reached. Validation aborted.',
);

// Per the specification, descriptions must not affect validation.
// See https://spec.graphql.org/draft/#sec-Descriptions
const DocumentKeysToValidate = mapValue(
  QueryDocumentKeys,
  (keys: ReadonlyArray<string>) => keys.filter((key) => key !== 'description'),
);

/**
 * Validates a GraphQL schema or document with validation rules.
 *
 * This is the validation entry point for rules with AST visitors and
 * type-system validation functions.
 * The legacy `validate` and
 * `validateSchema` functions keep their existing behavior.
 * @param options - Validation inputs and additional validation options.
 * @returns Validation errors, or an empty array when the inputs are valid.
 * @example Validate a schema with the specified validation rules.
 * ```ts
 * import { specifiedTypeSystemValidationRules, validateWithRules } from 'graphql';
 * import { buildSchema } from 'graphql/utilities';
 *
 * const schema = buildSchema('type Query { field: String }');
 * validateWithRules({
 *   schema,
 *   typeSystemRules: specifiedTypeSystemValidationRules,
 * });
 * ```
 */
export function validateWithRules(
  options: ValidateWithRulesOptions,
): ReadonlyArray<GraphQLError> {
  const existingSchema = options.schema;
  const documentAST = options.documentAST;
  const astValidationRules = options.rules;
  const typeSystemValidationRules = options.typeSystemRules;
  const useDefaultRules =
    astValidationRules == null && typeSystemValidationRules == null;

  if (documentAST == null) {
    if (existingSchema == null) {
      throw new Error('Must provide a schema or document to validate.');
    }
    if (options.includeExistingSchemaErrors === false) {
      throw new Error(
        'Cannot validate a schema without reporting existing schema errors.',
      );
    }

    const errors: Array<GraphQLError> = [];
    const documentIndex = new DocumentIndex(undefined);
    const context = new TypeSystemValidationIndex(
      documentIndex,
      existingSchema,
      (error) => {
        errors.push(error);
      },
    );
    const typeSystemRulesToRun =
      typeSystemValidationRules ??
      (useDefaultRules ? specifiedTypeSystemValidationRules : []);
    for (const rule of typeSystemRulesToRun) {
      rule(context);
    }
    return errors;
  }

  if (options.includeExistingSchemaErrors === true && existingSchema == null) {
    throw new Error(
      'Cannot include existing schema errors without an existing schema.',
    );
  }
  const includeExistingSchemaErrors =
    options.includeExistingSchemaErrors === true;

  const rulesToRun =
    astValidationRules ?? (useDefaultRules ? specifiedASTValidationRules : []);
  const typeSystemRulesToRun =
    typeSystemValidationRules ??
    (useDefaultRules ? specifiedTypeSystemValidationRules : []);

  const errors: Array<GraphQLError> = [];
  const maxErrors = options.maxErrors ?? 100;
  const onError = (error: GraphQLError): void => {
    if (errors.length >= maxErrors) {
      throw tooManyValidationErrorsError;
    }
    errors.push(error);
  };

  try {
    const documentIndex = new DocumentIndex(documentAST);
    const typeSystemIndex = new TypeSystemValidationIndex(
      documentIndex,
      existingSchema,
      onError,
      options.hideSuggestions,
      includeExistingSchemaErrors,
    );
    const indexCursor = new IndexCursor(typeSystemIndex);
    const context = new ASTValidationContext(
      documentAST,
      indexCursor,
      onError,
      {
        hideSuggestions: options.hideSuggestions,
      },
    );
    const astVisitors: Array<ReturnType<ASTVisitorFn>> = [];
    if (typeSystemIndex.shouldRunTypeSystemValidationRules()) {
      for (const rule of typeSystemRulesToRun) {
        rule(typeSystemIndex);
      }
    }

    for (const astVisitorFn of rulesToRun) {
      astVisitors.push(astVisitorFn(context));
    }

    const documentToTraverse = documentIndex.getDocumentToTraverse();
    if (
      documentToTraverse.definitions.length !== 0 &&
      astVisitors.length !== 0
    ) {
      visit(
        documentToTraverse,
        visitWithIndexCursor(context.indexCursor, visitInParallel(astVisitors)),
        DocumentKeysToValidate,
      );
    }
  } catch (error: unknown) {
    if (error === tooManyValidationErrorsError) {
      errors.push(tooManyValidationErrorsError);
    } else {
      throw error;
    }
  }

  return errors;
}
