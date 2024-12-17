import type { ConstValueNode } from '../language/ast.js';
import type { GraphQLArgument, GraphQLInputField } from '../type/definition.js';
export declare function getDefaultValueAST(argOrInputField: GraphQLArgument | GraphQLInputField): ConstValueNode | undefined;
