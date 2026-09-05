import { memoize1 } from '../../jsutils/memoize1.ts';
import type { Path } from '../../jsutils/Path.ts';

import type { FieldNode } from '../../language/ast.ts';

import type {
  GraphQLField,
  GraphQLFieldResolver,
  GraphQLLeafType,
  GraphQLNullableOutputType,
  GraphQLObjectType,
  GraphQLOutputType,
  GraphQLResolveInfo,
  GraphQLResolveInfoHelpers,
} from '../../type/definition.ts';
import { isLeafType, isNonNullType } from '../../type/definition.ts';

import type { FieldDetailsList } from '../collectFields.ts';
import type { ValidatedExecutionArgs } from '../ExecutionArgs.ts';

import type { CompiledArgumentValues } from './compileArgumentValues.ts';
import type { CompiledStreamDirective } from './compileStreamDirective.ts';
import { getCompiledArgumentValues } from './getCompiledArgumentValues.ts';

/** @internal */
export interface CompiledResolvedField {
  info: GraphQLResolveInfo | undefined;
  result: unknown;
}

/** @internal */
export interface CompiledExecutionRuntime {
  validatedExecutionArgs: ValidatedExecutionArgs;
  getAbortSignal: () => AbortSignal | undefined;
  getAsyncHelpers: () => GraphQLResolveInfoHelpers;
}

/** @internal */
export interface CompiledFieldExecutionPlan {
  fieldDef: GraphQLField<unknown, unknown>;
  returnType: GraphQLOutputType;
  nullableReturnType: GraphQLNullableOutputType;
  completedNonNull: boolean;
  leafType: GraphQLLeafType | undefined;
  compiledArgumentValues: CompiledArgumentValues;
  compiledStreamDirective: CompiledStreamDirective;
  resolveField: (
    runtime: CompiledExecutionRuntime,
    parentType: GraphQLObjectType,
    source: unknown,
    fieldDetailsList: FieldDetailsList,
    path: Path,
  ) => CompiledResolvedField;
  resolveFieldValue: (
    runtime: CompiledExecutionRuntime,
    parentType: GraphQLObjectType,
    source: unknown,
    fieldDetailsList: FieldDetailsList,
    path: Path,
  ) => unknown;
  buildResolveInfo: (
    runtime: CompiledExecutionRuntime,
    parentType: GraphQLObjectType,
    fieldDetailsList: FieldDetailsList,
    path: Path,
  ) => GraphQLResolveInfo;
}

/** @internal */
export interface CompiledFieldResolver {
  fieldDef: GraphQLField<unknown, unknown>;
  returnType: GraphQLOutputType;
  nullableReturnType: GraphQLNullableOutputType;
  completedNonNull: boolean;
  leafType: GraphQLLeafType | undefined;
  fieldResolveFn: GraphQLFieldResolver<any, any> | undefined;
  usesDefaultFieldResolver: boolean;
}

/** @internal */
export function compileFieldResolver(
  fieldDef: GraphQLField<unknown, unknown>,
  usesDefaultFieldResolver: boolean,
): CompiledFieldResolver {
  const returnType = fieldDef.type;
  const { nullableReturnType, completedNonNull } =
    getNullableReturnType(returnType);
  return {
    fieldDef,
    returnType,
    nullableReturnType,
    completedNonNull,
    leafType: isLeafType(nullableReturnType) ? nullableReturnType : undefined,
    fieldResolveFn: fieldDef.resolve,
    usesDefaultFieldResolver,
  };
}

/** @internal */
export function compileFieldExecutionPlan(
  fieldResolver: CompiledFieldResolver,
  compiledArgumentValues: CompiledArgumentValues,
  compiledStreamDirective: CompiledStreamDirective,
): CompiledFieldExecutionPlan {
  const {
    fieldDef,
    returnType,
    nullableReturnType,
    completedNonNull,
    leafType,
    fieldResolveFn,
    usesDefaultFieldResolver,
  } = fieldResolver;
  const fieldNodes = [compiledArgumentValues.node];
  let resolveField: CompiledFieldExecutionPlan['resolveField'];
  let resolveFieldValue: CompiledFieldExecutionPlan['resolveFieldValue'];

  if (fieldResolveFn === undefined) {
    if (usesDefaultFieldResolver) {
      resolveField = function resolveDefaultField(
        runtime,
        parentType,
        source,
        fieldDetailsList,
        path,
      ) {
        const object = getObjectLikeSource(source);
        if (object !== undefined) {
          const property = getObjectProperty(object, fieldDef.name);
          if (typeof property !== 'function') {
            return { info: undefined, result: property };
          }

          const info = buildCompiledResolveInfo(
            runtime,
            parentType,
            fieldDetailsList,
            path,
          );
          const { contextValue, variableValues } =
            runtime.validatedExecutionArgs;
          const args = getCompiledArgumentValues(
            compiledArgumentValues,
            variableValues,
          );
          return {
            info,
            result: property.call(object, args, contextValue, info),
          };
        }

        return { info: undefined, result: undefined };
      };

      resolveFieldValue = function resolveDefaultFieldValue(
        runtime,
        parentType,
        source,
        fieldDetailsList,
        path,
      ) {
        const object = getObjectLikeSource(source);
        if (object !== undefined) {
          const property = getObjectProperty(object, fieldDef.name);
          if (typeof property !== 'function') {
            return property;
          }

          const info = buildCompiledResolveInfo(
            runtime,
            parentType,
            fieldDetailsList,
            path,
          );
          const { contextValue, variableValues } =
            runtime.validatedExecutionArgs;
          const args = getCompiledArgumentValues(
            compiledArgumentValues,
            variableValues,
          );
          return property.call(object, args, contextValue, info);
        }

        return undefined;
      };
    } else {
      resolveField = function resolveRuntimeField(
        runtime,
        parentType,
        source,
        fieldDetailsList,
        path,
      ) {
        const validatedExecutionArgs = runtime.validatedExecutionArgs;
        const info = buildCompiledResolveInfo(
          runtime,
          parentType,
          fieldDetailsList,
          path,
        );
        const args = getCompiledArgumentValues(
          compiledArgumentValues,
          validatedExecutionArgs.variableValues,
        );
        return {
          info,
          result: validatedExecutionArgs.fieldResolver(
            source,
            args,
            validatedExecutionArgs.contextValue,
            info,
          ),
        };
      };

      resolveFieldValue = function resolveRuntimeFieldValue(
        runtime,
        parentType,
        source,
        fieldDetailsList,
        path,
      ) {
        const validatedExecutionArgs = runtime.validatedExecutionArgs;
        const info = buildCompiledResolveInfo(
          runtime,
          parentType,
          fieldDetailsList,
          path,
        );
        const args = getCompiledArgumentValues(
          compiledArgumentValues,
          validatedExecutionArgs.variableValues,
        );
        return validatedExecutionArgs.fieldResolver(
          source,
          args,
          validatedExecutionArgs.contextValue,
          info,
        );
      };
    }
  } else {
    const resolveFn = fieldResolveFn;

    resolveField = function resolveFieldWithResolver(
      runtime,
      parentType,
      source,
      fieldDetailsList,
      path,
    ) {
      const validatedExecutionArgs = runtime.validatedExecutionArgs;

      const info = buildCompiledResolveInfo(
        runtime,
        parentType,
        fieldDetailsList,
        path,
      );

      const args = getCompiledArgumentValues(
        compiledArgumentValues,
        validatedExecutionArgs.variableValues,
      );
      return {
        info,
        result: resolveFn(
          source,
          args,
          validatedExecutionArgs.contextValue,
          info,
        ),
      };
    };

    resolveFieldValue = function resolveFieldValueWithResolver(
      runtime,
      parentType,
      source,
      fieldDetailsList,
      path,
    ) {
      const validatedExecutionArgs = runtime.validatedExecutionArgs;
      const info = buildCompiledResolveInfo(
        runtime,
        parentType,
        fieldDetailsList,
        path,
      );

      const args = getCompiledArgumentValues(
        compiledArgumentValues,
        validatedExecutionArgs.variableValues,
      );
      return resolveFn(source, args, validatedExecutionArgs.contextValue, info);
    };
  }

  return {
    fieldDef,
    returnType,
    nullableReturnType,
    completedNonNull,
    leafType,
    compiledArgumentValues,
    compiledStreamDirective,
    resolveField,
    resolveFieldValue,
    buildResolveInfo: buildCompiledResolveInfo,
  };

  function buildCompiledResolveInfo(
    runtime: CompiledExecutionRuntime,
    parentType: GraphQLObjectType,
    fieldDetailsList: FieldDetailsList,
    path: Path,
  ): GraphQLResolveInfo {
    const {
      fragmentDefinitions,
      operation,
      rootValue,
      schema,
      variableValues,
    } = runtime.validatedExecutionArgs;
    return {
      fieldName: fieldDef.name,
      fieldNodes: getFieldNodes(fieldDetailsList),
      returnType,
      parentType,
      path,
      schema,
      fragments: fragmentDefinitions,
      rootValue,
      operation,
      variableValues,
      getAbortSignal: runtime.getAbortSignal,
      getAsyncHelpers: runtime.getAsyncHelpers,
    };
  }

  function getFieldNodes(
    fieldDetailsList: FieldDetailsList,
  ): ReadonlyArray<FieldNode> {
    return fieldDetailsList.length === 1
      ? fieldNodes
      : toNodes(fieldDetailsList);
  }
}

function getNullableReturnType(returnType: GraphQLOutputType): {
  nullableReturnType: GraphQLNullableOutputType;
  completedNonNull: boolean;
} {
  let nullableReturnType = returnType;
  let completedNonNull = false;
  while (isNonNullType(nullableReturnType)) {
    completedNonNull = true;
    nullableReturnType = nullableReturnType.ofType;
  }
  return { nullableReturnType, completedNonNull };
}

function getObjectLikeSource(source: unknown): object | undefined {
  return (typeof source === 'object' && source !== null) ||
    typeof source === 'function'
    ? source
    : undefined;
}

function getObjectProperty(object: object, fieldName: string): unknown {
  return (object as { [key: string]: unknown })[fieldName];
}

const toNodes = memoize1(
  (fieldDetailsList: FieldDetailsList): ReadonlyArray<FieldNode> =>
    fieldDetailsList.map((fieldDetails) => fieldDetails.node),
);
