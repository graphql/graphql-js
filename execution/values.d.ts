/** @category Values */
import type { Maybe } from "../jsutils/Maybe.js";
import type { ObjMap, ReadOnlyObjMap } from "../jsutils/ObjMap.js";
import { GraphQLError } from "../error/GraphQLError.js";
import type { DirectiveNode, FieldNode, FragmentSpreadNode, VariableDefinitionNode } from "../language/ast.js";
import type { GraphQLField } from "../type/definition.js";
import type { GraphQLDirective } from "../type/directives.js";
import type { GraphQLSchema } from "../type/schema.js";
import type { FragmentVariableValues } from "./collectFields.js";
import type { GraphQLVariableSignature } from "./getVariableSignature.js";
/**
 * Coerced variable values prepared for execution.
 *
 * The `coerced` map contains runtime values keyed by variable name. The
 * `sources` map records whether each value came from request input, an operation
 * default, or a fragment-variable default so utilities can preserve defaults
 * when replacing variables in literals.
 */
export interface VariableValues {
    /** Source metadata for each variable value keyed by variable name. */
    readonly sources: ReadOnlyObjMap<VariableValueSource>;
    /** Coerced runtime variable values keyed by variable name. */
    readonly coerced: ReadOnlyObjMap<unknown>;
}
interface VariableValueSource {
    readonly signature: GraphQLVariableSignature;
    readonly value?: unknown;
}
type VariableValuesOrErrors = {
    variableValues: VariableValues;
    errors?: never;
} | {
    errors: ReadonlyArray<GraphQLError>;
    variableValues?: never;
};
/**
 * Prepares an object map of variableValues of the correct type based on the
 * provided variable definitions and arbitrary input. If the input cannot be
 * parsed to match the variable definitions, GraphQLError values are returned.
 *
 * Note: Returned maps use null prototypes to avoid collisions with
 * Object prototype properties.
 * @param schema - GraphQL schema to use.
 * @param varDefNodes - The variable definition AST nodes to coerce.
 * @param inputs - The runtime variable values keyed by variable name.
 * @param options - Optional configuration for this operation.
 * @param [options.maxErrors] - Maximum number of coercion errors to report.
 * @param [options.hideSuggestions] - Whether suggestion text should be omitted
 * from errors.
 * @returns Coerced variable values with source metadata, or request errors.
 * @example
 * ```ts
 * // Coerce provided variables and apply operation defaults.
 * import assert from 'node:assert';
 * import { parse } from 'graphql/language';
 * import { buildSchema } from 'graphql/utilities';
 * import { getVariableValues } from 'graphql/execution';
 *
 * const schema = buildSchema(`
 *   type Query {
 *     reviews(stars: Int!, limit: Int = 10): [String]
 *   }
 * `);
 * const document = parse(`
 *   query ($stars: Int!, $limit: Int = 10) {
 *     reviews(stars: $stars, limit: $limit)
 *   }
 * `);
 * const operation = document.definitions[0];
 *
 * const result = getVariableValues(schema, operation.variableDefinitions, {
 *   stars: 5,
 * });
 *
 * assert('variableValues' in result);
 *
 * result.variableValues.coerced; // => { stars: 5, limit: 10 }
 * ```
 * @example
 * ```ts
 * // This variant uses maxErrors to cap reported coercion errors.
 * import assert from 'node:assert';
 * import { parse } from 'graphql/language';
 * import { buildSchema } from 'graphql/utilities';
 * import { getVariableValues } from 'graphql/execution';
 *
 * const schema = buildSchema(`
 *   input ReviewInput {
 *     stars: Int!
 *   }
 *
 *   type Query {
 *     review(input: ReviewInput!): String
 *   }
 * `);
 * const document = parse(`
 *   query ($first: ReviewInput!, $second: ReviewInput!) {
 *     first: review(input: $first)
 *     second: review(input: $second)
 *   }
 * `);
 * const operation = document.definitions[0];
 *
 * const result = getVariableValues(
 *   schema,
 *   operation.variableDefinitions,
 *   { first: { stars: 'bad' }, second: { stars: 'also bad' } },
 *   { maxErrors: 1 },
 * );
 *
 * assert('errors' in result);
 *
 * result.errors.length; // => 2
 * result.errors[1].message; // matches /error limit reached/
 * ```
 */
export declare function getVariableValues(schema: GraphQLSchema, varDefNodes: ReadonlyArray<VariableDefinitionNode>, inputs: {
    readonly [variable: string]: unknown;
}, options?: {
    maxErrors?: number;
    hideSuggestions?: boolean;
}): VariableValuesOrErrors;
/** @internal */
export declare function getFragmentVariableValues(fragmentSpreadNode: FragmentSpreadNode, fragmentSignatures: ReadOnlyObjMap<GraphQLVariableSignature>, variableValues: VariableValues, fragmentVariableValues?: Maybe<FragmentVariableValues>, hideSuggestions?: Maybe<boolean>): FragmentVariableValues;
/**
 * Prepares an object map of argument values given a list of argument
 * definitions and list of argument AST nodes.
 *
 * Note: Returned value uses a null prototype to avoid collisions with
 * JavaScript's own property names.
 * @param def - Field or directive definition that declares the arguments.
 * @param node - Field or directive AST node supplying argument literals.
 * @param variableValues - Operation variable values returned by getVariableValues.
 * @param fragmentVariableValues - Fragment variable values for the current fragment scope.
 * @param hideSuggestions - Whether suggestion text should be omitted from errors.
 * @returns A map of coerced argument values.
 * @example
 * ```ts
 * // Read literal argument values and defaults.
 * import { parse } from 'graphql/language';
 * import { buildSchema } from 'graphql/utilities';
 * import { getArgumentValues } from 'graphql/execution';
 *
 * const schema = buildSchema(`
 *   type Query {
 *     reviews(stars: Int!, limit: Int = 10): [String]
 *   }
 * `);
 * const fieldDef = schema.getQueryType().getFields().reviews;
 * const document = parse('{ reviews(stars: 5) }');
 * const fieldNode = document.definitions[0].selectionSet.selections[0];
 *
 * getArgumentValues(fieldDef, fieldNode); // => { stars: 5, limit: 10 }
 * ```
 * @example
 * ```ts
 * // This variant resolves argument values from operation variables.
 * import assert from 'node:assert';
 * import { parse } from 'graphql/language';
 * import { buildSchema } from 'graphql/utilities';
 * import { getArgumentValues, getVariableValues } from 'graphql/execution';
 *
 * const schema = buildSchema(`
 *   type Query {
 *     reviews(stars: Int!): [String]
 *   }
 * `);
 * const fieldDef = schema.getQueryType().getFields().reviews;
 * const document = parse('query ($stars: Int!) { reviews(stars: $stars) }');
 * const operation = document.definitions[0];
 * const fieldNode = document.definitions[0].selectionSet.selections[0];
 * const variables = getVariableValues(schema, operation.variableDefinitions, {
 *   stars: 5,
 * });
 *
 * assert('variableValues' in variables);
 *
 * getArgumentValues(fieldDef, fieldNode, variables.variableValues); // => { stars: 5 }
 * getArgumentValues(fieldDef, fieldNode); // throws an error
 * ```
 */
export declare function getArgumentValues(def: GraphQLField<unknown, unknown> | GraphQLDirective, node: FieldNode | DirectiveNode, variableValues?: Maybe<VariableValues>, fragmentVariableValues?: Maybe<FragmentVariableValues>, hideSuggestions?: Maybe<boolean>): ObjMap<unknown>;
/**
 * Prepares an object map of argument values given a directive definition
 * and a AST node which may contain directives. Optionally also accepts a map
 * of variable values.
 *
 * If the directive does not exist on the node, returns undefined.
 *
 * Note: Returned value uses a null prototype to avoid collisions with
 * JavaScript's own property names.
 * @param directiveDef - Directive definition to read argument definitions from.
 * @param node - AST node that may contain directives.
 * @param node.directives - The directives on the AST node.
 * @param variableValues - Operation variable values returned by getVariableValues.
 * @param fragmentVariableValues - Fragment variable values for the current fragment scope.
 * @param hideSuggestions - Whether suggestion text should be omitted from errors.
 * @returns A map of coerced directive argument values, or undefined when absent.
 * @example
 * ```ts
 * // Read literal directive arguments from a node.
 * import { parse } from 'graphql/language';
 * import { GraphQLSkipDirective } from 'graphql/type';
 * import { getDirectiveValues } from 'graphql/execution';
 *
 * const document = parse('{ name @skip(if: true) }');
 * const fieldNode = document.definitions[0].selectionSet.selections[0];
 *
 * getDirectiveValues(GraphQLSkipDirective, fieldNode); // => { if: true }
 * ```
 * @example
 * ```ts
 * // This variant resolves directive arguments from variables and handles absent directives.
 * import assert from 'node:assert';
 * import { parse } from 'graphql/language';
 * import { GraphQLIncludeDirective } from 'graphql/type';
 * import { buildSchema } from 'graphql/utilities';
 * import { getDirectiveValues, getVariableValues } from 'graphql/execution';
 *
 * const schema = buildSchema('type Query { name: String }');
 * const document = parse(
 *   'query ($includeName: Boolean!) { name @include(if: $includeName) }',
 * );
 * const operation = document.definitions[0];
 * const fieldNode = document.definitions[0].selectionSet.selections[0];
 * const variables = getVariableValues(schema, operation.variableDefinitions, {
 *   includeName: false,
 * });
 *
 * assert('variableValues' in variables);
 *
 * getDirectiveValues(
 *   GraphQLIncludeDirective,
 *   fieldNode,
 *   variables.variableValues,
 * ); // => { if: false }
 * getDirectiveValues(GraphQLIncludeDirective, { directives: [] }); // => undefined
 * ```
 */
export declare function getDirectiveValues(directiveDef: GraphQLDirective, node: {
    readonly directives?: ReadonlyArray<DirectiveNode> | undefined;
}, variableValues?: Maybe<VariableValues>, fragmentVariableValues?: Maybe<FragmentVariableValues>, hideSuggestions?: Maybe<boolean>): undefined | ObjMap<unknown>;
export {};
