/** @category Validation Context */
import type { Maybe } from "../jsutils/Maybe.mjs";
import type { GraphQLError } from "../error/GraphQLError.mjs";
import type { DocumentNode, FragmentDefinitionNode, FragmentSpreadNode, OperationDefinitionNode, SelectionSetNode, VariableDefinitionNode, VariableNode } from "../language/ast.mjs";
import type { ASTVisitor } from "../language/visitor.mjs";
import type { GraphQLArgument, GraphQLCompositeType, GraphQLEnumValue, GraphQLField, GraphQLInputType, GraphQLOutputType } from "../type/definition.mjs";
import type { GraphQLDirective } from "../type/directives.mjs";
import type { GraphQLSchema } from "../type/schema.mjs";
import type { FragmentSignature } from "../utilities/TypeInfo.mjs";
import { TypeInfo } from "../utilities/TypeInfo.mjs";
type NodeWithSelectionSet = OperationDefinitionNode | FragmentDefinitionNode;
interface VariableUsage {
    readonly node: VariableNode;
    readonly type: Maybe<GraphQLInputType>;
    readonly parentType: Maybe<GraphQLInputType>;
    readonly defaultValue: unknown;
    readonly fragmentVariableDefinition: Maybe<VariableDefinitionNode>;
}
/**
 * An instance of this class is passed as the "this" context to all validators,
 * allowing access to commonly useful contextual information from within a
 * validation rule.
 *
 * @internal
 */
export declare class ASTValidationContext {
    private _ast;
    private _onError;
    private _fragments;
    private _fragmentSpreads;
    private _recursivelyReferencedFragments;
    constructor(ast: DocumentNode, onError: (error: GraphQLError) => void);
    get [Symbol.toStringTag](): string;
    reportError(error: GraphQLError): void;
    getDocument(): DocumentNode;
    getFragment(name: string): Maybe<FragmentDefinitionNode>;
    getFragmentSpreads(node: SelectionSetNode): ReadonlyArray<FragmentSpreadNode>;
    getRecursivelyReferencedFragments(operation: OperationDefinitionNode): ReadonlyArray<FragmentDefinitionNode>;
}
/** @internal */
export type ASTValidationRule = (context: ASTValidationContext) => ASTVisitor;
/** @internal */
export declare class SDLValidationContext extends ASTValidationContext {
    private _schema;
    constructor(ast: DocumentNode, schema: Maybe<GraphQLSchema>, onError: (error: GraphQLError) => void);
    get hideSuggestions(): boolean;
    get [Symbol.toStringTag](): string;
    getSchema(): Maybe<GraphQLSchema>;
}
/** @internal */
export type SDLValidationRule = (context: SDLValidationContext) => ASTVisitor;
/** Validation context passed to query validation rules. */
export declare class ValidationContext extends ASTValidationContext {
    private _schema;
    private _typeInfo;
    private _variableUsages;
    private _recursiveVariableUsages;
    private _hideSuggestions;
    /**
     * Creates a ValidationContext instance.
     * @param schema - Schema used to validate the document.
     * @param ast - Document AST being validated.
     * @param typeInfo - TypeInfo instance used to track traversal state.
     * @param onError - Callback invoked for each validation error.
     * @param hideSuggestions - Whether suggestion text should be omitted from errors.
     * @example
     * ```ts
     * import { parse } from 'graphql/language';
     * import { GraphQLError } from 'graphql/error';
     * import { buildSchema, TypeInfo } from 'graphql/utilities';
     * import { ValidationContext } from 'graphql/validation';
     *
     * const schema = buildSchema(`
     *   type Query {
     *     greeting: String
     *   }
     * `);
     * const document = parse('{ greeting }');
     * const errors = [];
     * const context = new ValidationContext(
     *   schema,
     *   document,
     *   new TypeInfo(schema),
     *   (error) => errors.push(error),
     * );
     *
     * context.reportError(new GraphQLError('Example validation error.'));
     *
     * context.getSchema(); // => schema
     * errors[0].message; // => 'Example validation error.'
     * ```
     */
    constructor(schema: GraphQLSchema, ast: DocumentNode, typeInfo: TypeInfo, onError: (error: GraphQLError) => void, hideSuggestions?: Maybe<boolean>);
    /**
     * Returns the value used by `Object.prototype.toString`.
     * @returns The built-in string tag for this object.
     */
    get [Symbol.toStringTag](): string;
    /**
     * Returns whether validation error suggestions are hidden.
     * @returns True when suggestion text should be omitted from errors.
     */
    get hideSuggestions(): boolean;
    /**
     * Returns the schema being used by this validation context.
     * @returns The schema being validated against.
     * @example
     * ```ts
     * import { parse } from 'graphql/language';
     * import { buildSchema, TypeInfo } from 'graphql/utilities';
     * import { ValidationContext } from 'graphql/validation';
     *
     * const schema = buildSchema(`
     *   type Query {
     *     greeting: String
     *   }
     * `);
     * const context = new ValidationContext(
     *   schema,
     *   parse('{ greeting }'),
     *   new TypeInfo(schema),
     *   () => {},
     * );
     *
     * context.getSchema().getQueryType()?.name; // => 'Query'
     * ```
     */
    getSchema(): GraphQLSchema;
    /**
     * Returns variable usages found directly within this node.
     * @param node - The AST node to inspect or visit.
     * @returns Variable usages found directly within this node.
     * @example
     * ```ts
     * import { parse } from 'graphql/language';
     * import { buildSchema, TypeInfo } from 'graphql/utilities';
     * import { ValidationContext } from 'graphql/validation';
     *
     * const schema = buildSchema(`
     *   type Query {
     *     greeting(name: String): String
     *   }
     * `);
     * const document = parse('query ($name: String) { greeting(name: $name) }');
     * const operation = document.definitions[0];
     * const context = new ValidationContext(
     *   schema,
     *   document,
     *   new TypeInfo(schema),
     *   () => {},
     * );
     *
     * const usages = context.getVariableUsages(operation);
     *
     * usages[0].node.name.value; // => 'name'
     * String(usages[0].type); // => 'String'
     * ```
     */
    getVariableUsages(node: NodeWithSelectionSet): ReadonlyArray<VariableUsage>;
    /**
     * Returns variable usages for an operation, including variables used by referenced fragments.
     * @param operation - Operation definition to inspect.
     * @returns Variable usages reachable from the operation.
     * @example
     * ```ts
     * import { parse } from 'graphql/language';
     * import { buildSchema, TypeInfo } from 'graphql/utilities';
     * import { ValidationContext } from 'graphql/validation';
     *
     * const schema = buildSchema(`
     *   type Query {
     *     viewer: User
     *   }
     *
     *   type User {
     *     name(prefix: String): String
     *   }
     * `);
     * const document = parse(`
     *   query ($prefix: String) {
     *     viewer {
     *       ...UserName
     *     }
     *   }
     *
     *   fragment UserName on User {
     *     name(prefix: $prefix)
     *   }
     * `);
     * const operation = document.definitions[0];
     * const context = new ValidationContext(
     *   schema,
     *   document,
     *   new TypeInfo(schema),
     *   () => {},
     * );
     *
     * const usages = context.getRecursiveVariableUsages(operation);
     *
     * usages.map((usage) => usage.node.name.value); // => ['prefix']
     * ```
     */
    getRecursiveVariableUsages(operation: OperationDefinitionNode): ReadonlyArray<VariableUsage>;
    /**
     * Returns the current output type at this point in traversal.
     * @returns The current output type, if known.
     * @example
     * ```ts
     * import { parse, visit } from 'graphql/language';
     * import { buildSchema, TypeInfo, visitWithTypeInfo } from 'graphql/utilities';
     * import { ValidationContext } from 'graphql/validation';
     *
     * const schema = buildSchema(`
     *   type Query {
     *     greeting: String
     *   }
     * `);
     * const document = parse('{ greeting }');
     * const typeInfo = new TypeInfo(schema);
     * const context = new ValidationContext(schema, document, typeInfo, () => {});
     * let typeName;
     *
     * visit(
     *   document,
     *   visitWithTypeInfo(typeInfo, {
     *     Field: () => {
     *       typeName = String(context.getType());
     *     },
     *   }),
     * );
     *
     * typeName; // => 'String'
     * ```
     */
    getType(): Maybe<GraphQLOutputType>;
    /**
     * Returns the current parent composite type.
     * @returns The current parent composite type, if known.
     * @example
     * ```ts
     * import { parse, visit } from 'graphql/language';
     * import { buildSchema, TypeInfo, visitWithTypeInfo } from 'graphql/utilities';
     * import { ValidationContext } from 'graphql/validation';
     *
     * const schema = buildSchema(`
     *   type Query {
     *     greeting: String
     *   }
     * `);
     * const document = parse('{ greeting }');
     * const typeInfo = new TypeInfo(schema);
     * const context = new ValidationContext(schema, document, typeInfo, () => {});
     * let parentTypeName;
     *
     * visit(
     *   document,
     *   visitWithTypeInfo(typeInfo, {
     *     Field: () => {
     *       parentTypeName = context.getParentType()?.name;
     *     },
     *   }),
     * );
     *
     * parentTypeName; // => 'Query'
     * ```
     */
    getParentType(): Maybe<GraphQLCompositeType>;
    /**
     * Returns the current input type at this point in traversal.
     * @returns The current input type, if known.
     * @example
     * ```ts
     * import { parse, visit } from 'graphql/language';
     * import { buildSchema, TypeInfo, visitWithTypeInfo } from 'graphql/utilities';
     * import { ValidationContext } from 'graphql/validation';
     *
     * const schema = buildSchema(`
     *   type Query {
     *     reviews(limit: Int): [String]
     *   }
     * `);
     * const document = parse('{ reviews(limit: 5) }');
     * const typeInfo = new TypeInfo(schema);
     * const context = new ValidationContext(schema, document, typeInfo, () => {});
     * let inputTypeName;
     *
     * visit(
     *   document,
     *   visitWithTypeInfo(typeInfo, {
     *     Argument: () => {
     *       inputTypeName = String(context.getInputType());
     *     },
     *   }),
     * );
     *
     * inputTypeName; // => 'Int'
     * ```
     */
    getInputType(): Maybe<GraphQLInputType>;
    /**
     * Returns the parent input type for the current input position.
     * @returns The parent input type, if known.
     * @example
     * ```ts
     * import { parse, visit } from 'graphql/language';
     * import { buildSchema, TypeInfo, visitWithTypeInfo } from 'graphql/utilities';
     * import { ValidationContext } from 'graphql/validation';
     *
     * const schema = buildSchema(`
     *   input ReviewFilter {
     *     stars: Int
     *   }
     *
     *   type Query {
     *     reviews(filter: ReviewFilter): [String]
     *   }
     * `);
     * const document = parse('{ reviews(filter: { stars: 5 }) }');
     * const typeInfo = new TypeInfo(schema);
     * const context = new ValidationContext(schema, document, typeInfo, () => {});
     * let parentInputTypeName;
     *
     * visit(
     *   document,
     *   visitWithTypeInfo(typeInfo, {
     *     ObjectField: () => {
     *       parentInputTypeName = String(context.getParentInputType());
     *     },
     *   }),
     * );
     *
     * parentInputTypeName; // => 'ReviewFilter'
     * ```
     */
    getParentInputType(): Maybe<GraphQLInputType>;
    /**
     * Returns the current field definition.
     * @returns The current field definition, if known.
     * @example
     * ```ts
     * import { parse, visit } from 'graphql/language';
     * import { buildSchema, TypeInfo, visitWithTypeInfo } from 'graphql/utilities';
     * import { ValidationContext } from 'graphql/validation';
     *
     * const schema = buildSchema(`
     *   type Query {
     *     greeting: String
     *   }
     * `);
     * const document = parse('{ greeting }');
     * const typeInfo = new TypeInfo(schema);
     * const context = new ValidationContext(schema, document, typeInfo, () => {});
     * let fieldName;
     *
     * visit(
     *   document,
     *   visitWithTypeInfo(typeInfo, {
     *     Field: () => {
     *       fieldName = context.getFieldDef()?.name;
     *     },
     *   }),
     * );
     *
     * fieldName; // => 'greeting'
     * ```
     */
    getFieldDef(): Maybe<GraphQLField<unknown, unknown>>;
    /**
     * Returns the current directive definition.
     * @returns The current directive definition, if known.
     * @example
     * ```ts
     * import { parse, visit } from 'graphql/language';
     * import { buildSchema, TypeInfo, visitWithTypeInfo } from 'graphql/utilities';
     * import { ValidationContext } from 'graphql/validation';
     *
     * const schema = buildSchema(`
     *   type Query {
     *     greeting: String
     *   }
     * `);
     * const document = parse('{ greeting @include(if: true) }');
     * const typeInfo = new TypeInfo(schema);
     * const context = new ValidationContext(schema, document, typeInfo, () => {});
     * let directiveName;
     *
     * visit(
     *   document,
     *   visitWithTypeInfo(typeInfo, {
     *     Directive: () => {
     *       directiveName = context.getDirective()?.name;
     *     },
     *   }),
     * );
     *
     * directiveName; // => 'include'
     * ```
     */
    getDirective(): Maybe<GraphQLDirective>;
    /**
     * Returns the current argument definition.
     * @returns The current argument definition, if known.
     * @example
     * ```ts
     * import { parse, visit } from 'graphql/language';
     * import { buildSchema, TypeInfo, visitWithTypeInfo } from 'graphql/utilities';
     * import { ValidationContext } from 'graphql/validation';
     *
     * const schema = buildSchema(`
     *   type Query {
     *     reviews(limit: Int): [String]
     *   }
     * `);
     * const document = parse('{ reviews(limit: 5) }');
     * const typeInfo = new TypeInfo(schema);
     * const context = new ValidationContext(schema, document, typeInfo, () => {});
     * let argumentName;
     *
     * visit(
     *   document,
     *   visitWithTypeInfo(typeInfo, {
     *     Argument: () => {
     *       argumentName = context.getArgument()?.name;
     *     },
     *   }),
     * );
     *
     * argumentName; // => 'limit'
     * ```
     */
    getArgument(): Maybe<GraphQLArgument>;
    /**
     * Returns the fragment signature referenced by the current fragment spread.
     * @returns The referenced fragment signature, if available.
     * @example
     * ```ts
     * import { parse, visit } from 'graphql/language';
     * import { buildSchema, TypeInfo, visitWithTypeInfo } from 'graphql/utilities';
     * import { ValidationContext } from 'graphql/validation';
     *
     * const schema = buildSchema(`
     *   type Query {
     *     greeting: String
     *   }
     * `);
     * const document = parse(
     *   `
     *     {
     *       ...GreetingFields
     *     }
     *
     *     fragment GreetingFields on Query {
     *       greeting
     *     }
     *   `,
     *   { experimentalFragmentArguments: true },
     * );
     * const typeInfo = new TypeInfo(schema);
     * const context = new ValidationContext(schema, document, typeInfo, () => {});
     * let fragmentName;
     *
     * visit(
     *   document,
     *   visitWithTypeInfo(typeInfo, {
     *     FragmentSpread: () => {
     *       fragmentName = context.getFragmentSignature()?.definition.name.value;
     *     },
     *   }),
     * );
     *
     * fragmentName; // => 'GreetingFields'
     * ```
     */
    getFragmentSignature(): Maybe<FragmentSignature>;
    /**
     * Returns the function used to look up fragment signatures by name.
     * @returns A function that maps fragment names to fragment signatures.
     * @example
     * ```ts
     * import { parse, visit } from 'graphql/language';
     * import { buildSchema, TypeInfo, visitWithTypeInfo } from 'graphql/utilities';
     * import { ValidationContext } from 'graphql/validation';
     *
     * const schema = buildSchema(`
     *   type Query {
     *     greeting: String
     *   }
     * `);
     * const document = parse(
     *   `
     *     {
     *       ...GreetingFields
     *     }
     *
     *     fragment GreetingFields on Query {
     *       greeting
     *     }
     *   `,
     *   { experimentalFragmentArguments: true },
     * );
     * const typeInfo = new TypeInfo(schema);
     * const context = new ValidationContext(schema, document, typeInfo, () => {});
     * let fragmentName;
     *
     * visit(
     *   document,
     *   visitWithTypeInfo(typeInfo, {
     *     Document: () => {
     *       const getFragmentSignature = context.getFragmentSignatureByName();
     *       fragmentName =
     *         getFragmentSignature('GreetingFields')?.definition.name.value;
     *     },
     *   }),
     * );
     *
     * fragmentName; // => 'GreetingFields'
     * ```
     */
    getFragmentSignatureByName(): (fragmentName: string) => Maybe<FragmentSignature>;
    /**
     * Returns the current enum value definition.
     * @returns The current enum value definition, if known.
     * @example
     * ```ts
     * import { parse, visit } from 'graphql/language';
     * import { buildSchema, TypeInfo, visitWithTypeInfo } from 'graphql/utilities';
     * import { ValidationContext } from 'graphql/validation';
     *
     * const schema = buildSchema(`
     *   enum Sort {
     *     NEWEST
     *     OLDEST
     *   }
     *
     *   type Query {
     *     reviews(sort: Sort): [String]
     *   }
     * `);
     * const document = parse('{ reviews(sort: OLDEST) }');
     * const typeInfo = new TypeInfo(schema);
     * const context = new ValidationContext(schema, document, typeInfo, () => {});
     * let enumValueName;
     *
     * visit(
     *   document,
     *   visitWithTypeInfo(typeInfo, {
     *     EnumValue: () => {
     *       enumValueName = context.getEnumValue()?.name;
     *     },
     *   }),
     * );
     *
     * enumValueName; // => 'OLDEST'
     * ```
     */
    getEnumValue(): Maybe<GraphQLEnumValue>;
}
/** A function that creates an AST visitor for validating a GraphQL document. */
export type ValidationRule = (context: ValidationContext) => ASTVisitor;
export {};
