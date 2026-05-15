import type { ObjMap } from '../jsutils/ObjMap.ts';
import type { Path } from '../jsutils/Path.ts';

import type {
  FieldNode,
  FragmentDefinitionNode,
  OperationDefinitionNode,
} from '../language/ast.ts';

import type {
  GraphQLField,
  GraphQLObjectType,
  GraphQLResolveInfo,
  GraphQLResolveInfoHelpers,
} from '../type/index.ts';
import type { GraphQLSchema } from '../type/schema.ts';

import type { VariableValues } from './values.ts';

/** @internal */
export interface BuildResolveInfoExecutionArgs {
  schema: GraphQLSchema;
  fragmentDefinitions: ObjMap<FragmentDefinitionNode>;
  rootValue: unknown;
  operation: OperationDefinitionNode;
  variableValues: VariableValues;
}

/** @internal */
// eslint-disable-next-line max-params
export function buildResolveInfo(
  validatedExecutionArgs: BuildResolveInfoExecutionArgs,
  fieldDef: GraphQLField<unknown, unknown>,
  fieldNodes: ReadonlyArray<FieldNode>,
  parentType: GraphQLObjectType,
  path: Path,
  getAbortSignal: () => AbortSignal | undefined,
  getAsyncHelpers: () => GraphQLResolveInfoHelpers,
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
    getAbortSignal,
    getAsyncHelpers,
  };
}
