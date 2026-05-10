import type { ObjMap } from '../jsutils/ObjMap.js';
import type { Path } from '../jsutils/Path.js';

import type {
  FieldNode,
  FragmentDefinitionNode,
  OperationDefinitionNode,
} from '../language/ast.js';

import type {
  GraphQLField,
  GraphQLObjectType,
  GraphQLResolveInfo,
  GraphQLResolveInfoHelpers,
} from '../type/index.js';
import type { GraphQLSchema } from '../type/schema.js';

import type { VariableValues } from './values.js';

export interface BuildResolveInfoExecutionArgs {
  schema: GraphQLSchema;
  fragmentDefinitions: ObjMap<FragmentDefinitionNode>;
  rootValue: unknown;
  operation: OperationDefinitionNode;
  variableValues: VariableValues;
}

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
