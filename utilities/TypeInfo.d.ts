/** @category Type Info */
import type { Maybe } from "../jsutils/Maybe.js";
import type { ASTNode, FragmentDefinitionNode, VariableDefinitionNode } from "../language/ast.js";
import type { ASTVisitor } from "../language/visitor.js";
import type { GraphQLArgument, GraphQLCompositeType, GraphQLEnumValue, GraphQLField, GraphQLInputType, GraphQLOutputType, GraphQLType } from "../type/definition.js";
import type { GraphQLDirective } from "../type/directives.js";
import type { GraphQLSchema } from "../type/schema.js";
/** @internal */
export interface FragmentSignature {
    readonly definition: FragmentDefinitionNode;
    readonly variableDefinitions: Map<string, VariableDefinitionNode>;
}
/**
 * TypeInfo is a utility class which, given a GraphQL schema, can keep track
 * of the current field and type definitions at any point in a GraphQL document
 * AST during a recursive descent by calling `enter(node)` and `leave(node)`.
 */
export declare class TypeInfo {
    private _schema;
    private _typeStack;
    private _parentTypeStack;
    private _inputTypeStack;
    private _fieldDefStack;
    private _defaultValueStack;
    private _directive;
    private _argument;
    private _enumValue;
    private _fragmentSignaturesByName;
    private _fragmentSignature;
    private _fragmentArgument;
    /**
     * Creates a TypeInfo instance.
     * @param schema - Schema used for type lookups.
     * @param initialType - Optional type to use at the start of traversal.
     * @param fragmentSignatures - Fragment signatures available during traversal.
     * @example
     * ```ts
     * // Track field types during a visitWithTypeInfo traversal.
     * import { parse, visit } from 'graphql/language';
     * import { buildSchema } from 'graphql/utilities';
     * import { TypeInfo, visitWithTypeInfo } from 'graphql/utilities';
     *
     * const schema = buildSchema(`
     *   type Query {
     *     greeting: String
     *   }
     * `);
     * const typeInfo = new TypeInfo(schema);
     * const seenTypes = [];
     *
     * visit(
     *   parse('{ greeting }'),
     *   visitWithTypeInfo(typeInfo, {
     *     Field: () => {
     *       seenTypes.push(String(typeInfo.getType()));
     *     },
     *   }),
     * );
     *
     * seenTypes; // => ['String']
     * ```
     * @example
     * ```ts
     * // This variant starts from an initial type and supplies fragment signatures.
     * import { Kind, parse } from 'graphql/language';
     * import { buildSchema, TypeInfo } from 'graphql/utilities';
     *
     * const schema = buildSchema(`
     *   type Query {
     *     greeting(name: String): String
     *   }
     * `);
     * const fragmentDocument = parse(
     *   'fragment GreetingFields($name: String) on Query { greeting(name: $name) }',
     *   { experimentalFragmentArguments: true },
     * );
     * const fragmentDefinition = fragmentDocument.definitions[0];
     * const variableDefinition = fragmentDefinition.variableDefinitions[0];
     * const typeInfo = new TypeInfo(schema, schema.getQueryType(), (name) =>
     *   name === 'GreetingFields'
     *     ? {
     *         definition: fragmentDefinition,
     *         variableDefinitions: new Map([['name', variableDefinition]]),
     *       }
     *     : undefined,
     * );
     *
     * typeInfo.enter({
     *   kind: Kind.SELECTION_SET,
     *   selections: [],
     * });
     * typeInfo.enter({
     *   kind: Kind.FRAGMENT_SPREAD,
     *   name: { kind: Kind.NAME, value: 'GreetingFields' },
     *   arguments: [],
     *   directives: [],
     * });
     *
     * String(typeInfo.getParentType()); // => 'Query'
     * typeInfo.getFragmentSignature()?.definition.name.value; // => 'GreetingFields'
     * ```
     */
    constructor(schema: GraphQLSchema, 
    /**
     * Initial type may be provided in rare cases to facilitate traversals
     * beginning somewhere other than documents.
     */
    initialType?: Maybe<GraphQLType>, fragmentSignatures?: Maybe<(fragmentName: string) => Maybe<FragmentSignature>>);
    /**
     * Returns the value used by `Object.prototype.toString`.
     * @returns The built-in string tag for this object.
     */
    get [Symbol.toStringTag](): string;
    /**
     * Returns the current output type at this point in traversal.
     * @returns The current output type, if known.
     * @example
     * ```ts
     * import { parse, visit } from 'graphql/language';
     * import { buildSchema, TypeInfo, visitWithTypeInfo } from 'graphql/utilities';
     *
     * const schema = buildSchema(`
     *   type Query {
     *     viewer: User
     *   }
     *
     *   type User {
     *     name: String
     *   }
     * `);
     * const typeInfo = new TypeInfo(schema);
     * const fieldTypes = {};
     *
     * visit(
     *   parse('{ viewer { name } }'),
     *   visitWithTypeInfo(typeInfo, {
     *     Field: (node) => {
     *       fieldTypes[node.name.value] = String(typeInfo.getType());
     *     },
     *   }),
     * );
     *
     * fieldTypes; // => { viewer: 'User', name: 'String' }
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
     *
     * const schema = buildSchema(`
     *   type Query {
     *     viewer: User
     *   }
     *
     *   type User {
     *     name: String
     *   }
     * `);
     * const typeInfo = new TypeInfo(schema);
     * const parentTypes = {};
     *
     * visit(
     *   parse('{ viewer { name } }'),
     *   visitWithTypeInfo(typeInfo, {
     *     Field: (node) => {
     *       parentTypes[node.name.value] = String(typeInfo.getParentType());
     *     },
     *   }),
     * );
     *
     * parentTypes; // => { viewer: 'Query', name: 'User' }
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
     *
     * const schema = buildSchema(`
     *   type Query {
     *     reviews(stars: Int!, sort: Sort = NEWEST): [String]
     *   }
     *
     *   enum Sort {
     *     NEWEST
     *     OLDEST
     *   }
     * `);
     * const typeInfo = new TypeInfo(schema);
     * const inputTypes = {};
     *
     * visit(
     *   parse('{ reviews(stars: 5, sort: OLDEST) }'),
     *   visitWithTypeInfo(typeInfo, {
     *     Argument: (node) => {
     *       inputTypes[node.name.value] = String(typeInfo.getInputType());
     *     },
     *   }),
     * );
     *
     * inputTypes; // => { stars: 'Int!', sort: 'Sort' }
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
     *
     * const schema = buildSchema(`
     *   input ReviewFilter {
     *     stars: Int!
     *   }
     *
     *   type Query {
     *     reviews(filter: ReviewFilter): [String]
     *   }
     * `);
     * const typeInfo = new TypeInfo(schema);
     * const parentInputTypes = {};
     *
     * visit(
     *   parse('{ reviews(filter: { stars: 5 }) }'),
     *   visitWithTypeInfo(typeInfo, {
     *     ObjectField: (node) => {
     *       parentInputTypes[node.name.value] = String(typeInfo.getParentInputType());
     *     },
     *   }),
     * );
     *
     * parentInputTypes; // => { stars: 'ReviewFilter' }
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
     *
     * const schema = buildSchema(`
     *   type Query {
     *     greeting: String
     *   }
     * `);
     * const typeInfo = new TypeInfo(schema);
     * let fieldName;
     *
     * visit(
     *   parse('{ greeting }'),
     *   visitWithTypeInfo(typeInfo, {
     *     Field: () => {
     *       fieldName = typeInfo.getFieldDef()?.name;
     *     },
     *   }),
     * );
     *
     * fieldName; // => 'greeting'
     * ```
     */
    getFieldDef(): Maybe<GraphQLField<unknown, unknown>>;
    /**
     * Returns the default input representation for the current input position.
     * @returns The current default input, if one is available.
     * @example
     * ```ts
     * import { parse, visit } from 'graphql/language';
     * import { buildSchema, TypeInfo, visitWithTypeInfo } from 'graphql/utilities';
     *
     * const schema = buildSchema(`
     *   type Query {
     *     reviews(limit: Int = 10): [String]
     *   }
     * `);
     * const typeInfo = new TypeInfo(schema);
     * let defaultLimit;
     *
     * visit(
     *   parse('{ reviews(limit: 5) }'),
     *   visitWithTypeInfo(typeInfo, {
     *     Argument: () => {
     *       defaultLimit = typeInfo.getDefaultValue();
     *     },
     *   }),
     * );
     *
     * defaultLimit; // => { literal: { kind: 'IntValue', value: '10' } }
     * ```
     */
    getDefaultValue(): unknown;
    /**
     * Returns the current directive definition.
     * @returns The current directive definition, if known.
     * @example
     * ```ts
     * import { parse, visit } from 'graphql/language';
     * import { buildSchema, TypeInfo, visitWithTypeInfo } from 'graphql/utilities';
     *
     * const schema = buildSchema(`
     *   type Query {
     *     greeting: String
     *   }
     * `);
     * const typeInfo = new TypeInfo(schema);
     * let directiveName;
     *
     * visit(
     *   parse('{ greeting @include(if: true) }'),
     *   visitWithTypeInfo(typeInfo, {
     *     Directive: () => {
     *       directiveName = typeInfo.getDirective()?.name;
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
     *
     * const schema = buildSchema(`
     *   type Query {
     *     reviews(limit: Int = 10): [String]
     *   }
     * `);
     * const typeInfo = new TypeInfo(schema);
     * let argumentName;
     *
     * visit(
     *   parse('{ reviews(limit: 5) }'),
     *   visitWithTypeInfo(typeInfo, {
     *     Argument: () => {
     *       argumentName = typeInfo.getArgument()?.name;
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
     * let fragmentName;
     *
     * visit(
     *   document,
     *   visitWithTypeInfo(typeInfo, {
     *     FragmentSpread: () => {
     *       fragmentName = typeInfo.getFragmentSignature()?.definition.name.value;
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
     * let fragmentName;
     *
     * visit(
     *   document,
     *   visitWithTypeInfo(typeInfo, {
     *     Document: () => {
     *       const getFragmentSignature = typeInfo.getFragmentSignatureByName();
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
     * Returns the current fragment argument definition.
     * @returns The variable definition for the current fragment argument.
     * @example
     * ```ts
     * import { parse, visit } from 'graphql/language';
     * import { buildSchema, TypeInfo, visitWithTypeInfo } from 'graphql/utilities';
     *
     * const schema = buildSchema(`
     *   type Query {
     *     greeting(name: String): String
     *   }
     * `);
     * const document = parse(
     *   `
     *     {
     *       ...GreetingFields(name: "Ada")
     *     }
     *
     *     fragment GreetingFields($name: String) on Query {
     *       greeting(name: $name)
     *     }
     *   `,
     *   { experimentalFragmentArguments: true },
     * );
     * const typeInfo = new TypeInfo(schema);
     * let argumentName;
     *
     * visit(
     *   document,
     *   visitWithTypeInfo(typeInfo, {
     *     FragmentArgument: () => {
     *       argumentName = typeInfo.getFragmentArgument()?.variable.name.value;
     *     },
     *   }),
     * );
     *
     * argumentName; // => 'name'
     * ```
     */
    getFragmentArgument(): Maybe<VariableDefinitionNode>;
    /**
     * Returns the current enum value definition.
     * @returns The current enum value definition, if known.
     * @example
     * ```ts
     * import { parse, visit } from 'graphql/language';
     * import { buildSchema, TypeInfo, visitWithTypeInfo } from 'graphql/utilities';
     *
     * const schema = buildSchema(`
     *   enum Sort {
     *     NEWEST
     *     OLDEST
     *   }
     *
     *   type Query {
     *     reviews(sort: Sort = NEWEST): [String]
     *   }
     * `);
     * const typeInfo = new TypeInfo(schema);
     * let enumValueName;
     *
     * visit(
     *   parse('{ reviews(sort: OLDEST) }'),
     *   visitWithTypeInfo(typeInfo, {
     *     EnumValue: () => {
     *       enumValueName = typeInfo.getEnumValue()?.name;
     *     },
     *   }),
     * );
     *
     * enumValueName; // => 'OLDEST'
     * ```
     */
    getEnumValue(): Maybe<GraphQLEnumValue>;
    /**
     * Updates this TypeInfo instance for an entered AST node.
     * @param node - AST node being entered.
     * @returns Nothing.
     * @example
     * ```ts
     * import { Kind, parse } from 'graphql/language';
     * import { buildSchema, TypeInfo } from 'graphql/utilities';
     *
     * const schema = buildSchema(`
     *   type Query {
     *     greeting: String
     *   }
     * `);
     * const document = parse('{ greeting }');
     * const operation = document.definitions[0];
     * const selectionSet = operation.selectionSet;
     * const field = selectionSet.selections[0];
     * const typeInfo = new TypeInfo(schema);
     *
     * typeInfo.enter(operation);
     * typeInfo.enter(selectionSet);
     * typeInfo.enter(field);
     *
     * field.kind; // => Kind.FIELD
     * typeInfo.getParentType()?.name; // => 'Query'
     * String(typeInfo.getType()); // => 'String'
     * ```
     */
    enter(node: ASTNode): void;
    /**
     * Updates this TypeInfo instance for a left AST node.
     * @param node - AST node being entered.
     * @returns Nothing.
     * @example
     * ```ts
     * import { parse } from 'graphql/language';
     * import { buildSchema, TypeInfo } from 'graphql/utilities';
     *
     * const schema = buildSchema(`
     *   type Query {
     *     greeting: String
     *   }
     * `);
     * const document = parse('{ greeting }');
     * const operation = document.definitions[0];
     * const selectionSet = operation.selectionSet;
     * const field = selectionSet.selections[0];
     * const typeInfo = new TypeInfo(schema);
     *
     * typeInfo.enter(operation);
     * typeInfo.enter(selectionSet);
     * typeInfo.enter(field);
     * String(typeInfo.getType()); // => 'String'
     *
     * typeInfo.leave(field);
     * typeInfo.getType(); // => undefined
     * ```
     */
    leave(node: ASTNode): void;
}
/**
 * Creates a new visitor instance which maintains a provided TypeInfo instance
 * along with visiting visitor.
 * @param typeInfo - TypeInfo instance to update during traversal.
 * @param visitor - Visitor callbacks to wrap with TypeInfo updates.
 * @returns A visitor that keeps TypeInfo in sync while delegating callbacks.
 * @example
 * ```ts
 * import { parse, visit } from 'graphql/language';
 * import { buildSchema, TypeInfo, visitWithTypeInfo } from 'graphql/utilities';
 *
 * const schema = buildSchema(`
 *   type Query {
 *     greeting: String
 *   }
 * `);
 * const typeInfo = new TypeInfo(schema);
 * const fields = [];
 *
 * visit(
 *   parse('{ greeting }'),
 *   visitWithTypeInfo(typeInfo, {
 *     Field: (node) => {
 *       fields.push({
 *         name: node.name.value,
 *         parentType: String(typeInfo.getParentType()),
 *         type: String(typeInfo.getType()),
 *       });
 *     },
 *   }),
 * );
 *
 * fields; // => [{ name: 'greeting', parentType: 'Query', type: 'String' }]
 * ```
 */
export declare function visitWithTypeInfo(typeInfo: TypeInfo, visitor: ASTVisitor): ASTVisitor;
