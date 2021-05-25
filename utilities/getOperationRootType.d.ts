import type {
  OperationDefinitionNode,
  OperationTypeDefinitionNode,
} from '../language/ast';
import type { GraphQLSchema } from '../type/schema';
import type { GraphQLObjectType } from '../type/definition';
/**
 * Extracts the root type of the operation from the schema.
 */
export declare function getOperationRootType(
  schema: GraphQLSchema,
  operation: OperationDefinitionNode | OperationTypeDefinitionNode,
): GraphQLObjectType;
