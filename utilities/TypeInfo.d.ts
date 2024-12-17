import type { Maybe } from '../jsutils/Maybe.js';
import type { ASTNode, FragmentDefinitionNode, VariableDefinitionNode } from '../language/ast.js';
import type { ASTVisitor } from '../language/visitor.js';
import type { GraphQLArgument, GraphQLCompositeType, GraphQLEnumValue, GraphQLField, GraphQLInputType, GraphQLOutputType, GraphQLType } from '../type/definition.js';
import type { GraphQLDirective } from '../type/directives.js';
import type { GraphQLSchema } from '../type/schema.js';
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
    constructor(schema: GraphQLSchema, 
    /**
     * Initial type may be provided in rare cases to facilitate traversals
     *  beginning somewhere other than documents.
     */
    initialType?: Maybe<GraphQLType>, fragmentSignatures?: Maybe<(fragmentName: string) => Maybe<FragmentSignature>>);
    get [Symbol.toStringTag](): string;
    getType(): Maybe<GraphQLOutputType>;
    getParentType(): Maybe<GraphQLCompositeType>;
    getInputType(): Maybe<GraphQLInputType>;
    getParentInputType(): Maybe<GraphQLInputType>;
    getFieldDef(): Maybe<GraphQLField<unknown, unknown>>;
    getDefaultValue(): unknown;
    getDirective(): Maybe<GraphQLDirective>;
    getArgument(): Maybe<GraphQLArgument>;
    getFragmentSignature(): Maybe<FragmentSignature>;
    getFragmentSignatureByName(): (fragmentName: string) => Maybe<FragmentSignature>;
    getFragmentArgument(): Maybe<VariableDefinitionNode>;
    getEnumValue(): Maybe<GraphQLEnumValue>;
    enter(node: ASTNode): void;
    leave(node: ASTNode): void;
}
/**
 * Creates a new visitor instance which maintains a provided TypeInfo instance
 * along with visiting visitor.
 */
export declare function visitWithTypeInfo(typeInfo: TypeInfo, visitor: ASTVisitor): ASTVisitor;
