/** @category Validation */
import type { Maybe } from "../jsutils/Maybe.mjs";
import { GraphQLError } from "../error/GraphQLError.mjs";
import type { DocumentNode } from "../language/ast.mjs";
import type { GraphQLSchema } from "../type/schema.mjs";
import type { SDLValidationRule, ValidationRule } from "./ValidationContext.mjs";
/**
 * Options used when validating a GraphQL document.
 * @category Validation
 */
export interface ValidationOptions {
    /** Maximum number of validation errors before validation stops. */
    maxErrors?: number;
    /** Whether suggestion text should be omitted from validation errors. */
    hideSuggestions?: Maybe<boolean>;
    /**
     * If enabled (the default), a selection set on an object, interface or
     * union type is only required to be present, rather than to be non-empty.
     *
     * Pair this with the `allowEmptySelectionSets` parse option.
     *
     * See https://github.com/graphql/graphql-spec/pull/1227
     * @deprecated empty selection sets are now always allowed;
     */
    allowEmptySelectionSets?: boolean | undefined;
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
export declare function validate(schema: GraphQLSchema, documentAST: DocumentNode, rules?: ReadonlyArray<ValidationRule>, options?: ValidationOptions): ReadonlyArray<GraphQLError>;
/** @internal */
export declare function validateSDL(documentAST: DocumentNode, schemaToExtend?: Maybe<GraphQLSchema>, rules?: ReadonlyArray<SDLValidationRule>): ReadonlyArray<GraphQLError>;
/**
 * Utility function which asserts a SDL document is valid by throwing an error
 * if it is invalid.
 *
 * @internal
 */
export declare function assertValidSDL(documentAST: DocumentNode): void;
/**
 * Utility function which asserts a SDL document is valid by throwing an error
 * if it is invalid.
 *
 * @internal
 */
export declare function assertValidSDLExtension(documentAST: DocumentNode, schema: GraphQLSchema): void;
