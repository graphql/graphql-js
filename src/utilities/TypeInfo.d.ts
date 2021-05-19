import type { Maybe } from '../jsutils/Maybe';

import type { ASTVisitor } from '../language/visitor';
import type { ASTNode, FieldNode } from '../language/ast';
import type { GraphQLSchema } from '../type/schema';
import type { GraphQLDirective } from '../type/directives';
import type {
  GraphQLType,
  GraphQLInputType,
  GraphQLOutputType,
  GraphQLCompositeType,
  GraphQLField,
  GraphQLArgument,
  GraphQLEnumValue,
} from '../type/definition';

/**
 * TypeInfo is a utility class which, given a GraphQL schema, can keep track
 * of the current field and type definitions at any point in a GraphQL document
 * AST during a recursive descent by calling `enter(node)` and `leave(node)`.
 */
export class TypeInfo {
  constructor(
    schema: GraphQLSchema,
    // Initial type may be provided in rare cases to facilitate traversals
    // beginning somewhere other than documents.
    initialType?: GraphQLType,

    // @deprecated will be removed in 17.0.0
    getFieldDefFn?: getFieldDef,
  );

  getType(): Maybe<GraphQLOutputType>;
  getParentType(): Maybe<GraphQLCompositeType>;
  getInputType(): Maybe<GraphQLInputType>;
  getParentInputType(): Maybe<GraphQLInputType>;
  getFieldDef(): Maybe<GraphQLField<unknown, unknown>>;
  getDefaultValue(): Maybe<unknown>;
  getDirective(): Maybe<GraphQLDirective>;
  getArgument(): Maybe<GraphQLArgument>;
  getEnumValue(): Maybe<GraphQLEnumValue>;
  enter(node: ASTNode): any;
  leave(node: ASTNode): any;
}

type getFieldDef = (
  schema: GraphQLSchema,
  parentType: GraphQLType,
  fieldNode: FieldNode,
) => Maybe<GraphQLField<unknown, unknown>>;

/**
 * Creates a new visitor instance which maintains a provided TypeInfo instance
 * along with visiting visitor.
 */
export function visitWithTypeInfo(
  typeInfo: TypeInfo,
  visitor: ASTVisitor,
): ASTVisitor;
