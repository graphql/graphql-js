import type { Path } from '../jsutils/Path.js';

import type { FieldNode } from '../language/ast.js';

import type {
  GraphQLField,
  GraphQLObjectType,
  GraphQLResolveInfo,
} from '../type/definition.js';

import type { ValidatedExecutionArgs } from './Executor.js';

/**
 * TODO: consider no longer exporting this function
 * @internal
 */
export function buildResolveInfo(
  validatedExecutionArgs: ValidatedExecutionArgs,
  fieldDef: GraphQLField<unknown, unknown>,
  fieldNodes: ReadonlyArray<FieldNode>,
  parentType: GraphQLObjectType,
  path: Path,
): GraphQLResolveInfo {
  const { schema, fragmentDefinitions, rootValue, operation, variableValues } =
    validatedExecutionArgs;
  // The resolve function's optional fourth argument is a collection of
  // information about the current execution state.
  return {
    fieldName: fieldDef.name,
    fieldNodes,
    returnType: fieldDef.type,
    parentType,
    path,
    schema,
    fragments: fragmentDefinitions,
    rootValue,
    operation,
    variableValues,
  };
}
