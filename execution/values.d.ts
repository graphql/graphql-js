import type { Maybe } from '../jsutils/Maybe';
import type { ObjMap } from '../jsutils/ObjMap';
import type { GraphQLError } from '../error/GraphQLError';
import type {
  FieldNode,
  DirectiveNode,
  VariableDefinitionNode,
} from '../language/ast';
import type { GraphQLDirective } from '../type/directives';
import type { GraphQLSchema } from '../type/schema';
import type { GraphQLField } from '../type/definition';
type CoercedVariableValues =
  | { errors: ReadonlyArray<GraphQLError>; coerced?: never }
  | { errors?: never; coerced: { [key: string]: unknown } };
/**
 * Prepares an object map of variableValues of the correct type based on the
 * provided variable definitions and arbitrary input. If the input cannot be
 * parsed to match the variable definitions, a GraphQLError will be thrown.
 *
 * Note: The returned value is a plain Object with a prototype, since it is
 * exposed to user code. Care should be taken to not pull values from the
 * Object prototype.
 */
export function getVariableValues(
  schema: GraphQLSchema,
  varDefNodes: ReadonlyArray<VariableDefinitionNode>,
  inputs: { [key: string]: unknown },
  options?: { maxErrors?: number },
): CoercedVariableValues;
/**
 * Prepares an object map of argument values given a list of argument
 * definitions and list of argument AST nodes.
 *
 * Note: The returned value is a plain Object with a prototype, since it is
 * exposed to user code. Care should be taken to not pull values from the
 * Object prototype.
 */
export function getArgumentValues(
  def: GraphQLField<unknown, unknown> | GraphQLDirective,
  node: FieldNode | DirectiveNode,
  variableValues?: Maybe<ObjMap<unknown>>,
): { [key: string]: unknown };
/**
 * Prepares an object map of argument values given a directive definition
 * and a AST node which may contain directives. Optionally also accepts a map
 * of variable values.
 *
 * If the directive does not exist on the node, returns undefined.
 *
 * Note: The returned value is a plain Object with a prototype, since it is
 * exposed to user code. Care should be taken to not pull values from the
 * Object prototype.
 */
export function getDirectiveValues(
  directiveDef: GraphQLDirective,
  node: {
    readonly directives?: ReadonlyArray<DirectiveNode>;
  },
  variableValues?: Maybe<ObjMap<unknown>>,
): undefined | { [key: string]: unknown };