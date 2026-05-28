/** @category Execution */

import type { Maybe } from '../jsutils/Maybe.ts';
import type { ObjMap } from '../jsutils/ObjMap.ts';
import type { PromiseOrValue } from '../jsutils/PromiseOrValue.ts';

import type {
  DocumentNode,
  FragmentDefinitionNode,
  OperationDefinitionNode,
  SubscriptionOperationDefinitionNode,
} from '../language/ast.ts';

import type {
  GraphQLFieldResolver,
  GraphQLObjectType,
  GraphQLTypeResolver,
} from '../type/definition.ts';
import type { GraphQLSchema } from '../type/schema.ts';

import type {
  FieldDetailsList,
  FragmentDetails,
  RootFieldCollection,
  SubfieldCollection,
} from './collectFields.ts';
import type { ExecutionResult } from './Executor.ts';
import type { VariableValues } from './values.ts';

/** @internal */
export const EMPTY_VARIABLE_VALUES: {
  readonly [variable: string]: unknown;
} = Object.freeze(Object.create(null));

/** Function used to execute a validated root selection set for a subscription event. */
export type RootSelectionSetExecutor = (
  validatedExecutionArgs: ValidatedSubscriptionArgs,
) => PromiseOrValue<ExecutionResult>;

/** Arguments accepted by compileExecution and compileSubscription. */
export interface CompileExecutionArgs {
  /** The schema used for validation or execution. */
  schema: GraphQLSchema;
  /** The parsed GraphQL document to execute. */
  document: DocumentNode;
  /** Name of the operation to execute when the document contains multiple operations. */
  operationName?: Maybe<string>;
  /** Resolver used when a field does not define its own resolver. */
  fieldResolver?: Maybe<GraphQLFieldResolver<any, any>>;
  /** Resolver used when an abstract type does not define its own resolver. */
  typeResolver?: Maybe<GraphQLTypeResolver<any, any>>;
  /** Resolver used for the root subscription field. */
  subscribeFieldResolver?: Maybe<GraphQLFieldResolver<any, any>>;
  /** Whether suggestion text should be omitted from request errors. */
  hideSuggestions?: Maybe<boolean>;
  /** Whether incremental execution may begin eligible work early. */
  enableEarlyExecution?: Maybe<boolean>;
  /** Whether experimental field batch resolvers should be used. */
  enableBatchResolvers?: Maybe<boolean>;
  /** Execution hooks invoked during this operation. */
  hooks?: Maybe<ExecutionHooks>;
}

/** Runtime arguments accepted by compiled execution methods. */
export interface CompiledExecutionArgs {
  /** Initial root value passed to the operation. */
  rootValue?: unknown;
  /** Application context value passed to every resolver. */
  contextValue?: unknown;
  /** Runtime variable values keyed by variable name. */
  variableValues?: Maybe<{ readonly [variable: string]: unknown }>;
  /** AbortSignal used to cancel execution. */
  abortSignal?: Maybe<AbortSignal>;
  /** Additional execution options. */
  options?: {
    /**
     * Set the maximum number of errors allowed for coercing (defaults to 50).
     *
     * @internal
     */
    maxCoercionErrors?: number;
  };
}

/** Arguments accepted by execute and executeSync. */
export interface ExecutionArgs
  extends CompileExecutionArgs, CompiledExecutionArgs {}

/**
 * Data that must be available at all points during query execution.
 *
 * Namely, schema of the type system that is currently executing,
 * and the fragments defined in the query document
 */
export interface ValidatedExecutionArgs {
  /** Schema used for execution. */
  schema: GraphQLSchema;
  /** Parsed GraphQL document being executed. */
  document: DocumentNode;
  // TODO: consider deprecating/removing fragmentDefinitions if/when fragment
  // arguments are officially supported and/or the full fragment details are
  // exposed within GraphQLResolveInfo.
  /** Fragment definitions keyed by fragment name. */
  fragmentDefinitions: ObjMap<FragmentDefinitionNode>;
  /** Fragment details keyed by fragment name. */
  fragments: ObjMap<FragmentDetails>;
  /** Root value passed to the operation. */
  rootValue: unknown;
  /** Application context value passed to every resolver. */
  contextValue: unknown;
  /** Operation definition selected for execution. */
  operation: OperationDefinitionNode;
  /** Operation variable values with source metadata and coerced runtime values. */
  variableValues: VariableValues;
  /** Raw variable values provided by the caller before coercion. */
  rawVariableValues: Maybe<{ readonly [variable: string]: unknown }>;
  /** Resolver used for fields without an explicit resolver. */
  fieldResolver: GraphQLFieldResolver<any, any>;
  /** Resolver used for abstract types without an explicit type resolver. */
  typeResolver: GraphQLTypeResolver<any, any>;
  /** Resolver used for subscription fields without an explicit subscribe resolver. */
  subscribeFieldResolver: GraphQLFieldResolver<any, any>;
  /** Whether suggestion text should be omitted from execution errors. */
  hideSuggestions: boolean;
  /** Whether execution should use error propagation. */
  errorPropagation: boolean;
  /** External signal that may abort execution. */
  externalAbortSignal: AbortSignal | undefined;
  /** Whether incremental execution may begin eligible work early. */
  enableEarlyExecution: boolean;
  /** Whether experimental field batch resolvers should be used. */
  enableBatchResolvers: boolean;
  /** Execution hooks supplied by the caller. */
  hooks: ExecutionHooks | undefined;
  /** Memoized field collectors for this execution. @internal */
  fieldCollectors: FieldCollectors;
}

/** Validated execution arguments for a subscription operation. */
export interface ValidatedSubscriptionArgs extends ValidatedExecutionArgs {
  /** Subscription operation definition selected for execution. */
  operation: SubscriptionOperationDefinitionNode;
}

/** @internal */
export interface FieldCollectors {
  collectRootFields: (
    variableValues: VariableValues,
    rootType: GraphQLObjectType,
  ) => RootFieldCollection;
  collectSubfields: (
    variableValues: VariableValues,
    returnType: GraphQLObjectType,
    fieldDetailsList: FieldDetailsList,
  ) => SubfieldCollection;
}

/** Information passed to hooks after asynchronous execution work has finished. */
export interface AsyncWorkFinishedInfo {
  /** Validated execution arguments for the operation that finished async work. */
  validatedExecutionArgs: ValidatedExecutionArgs;
}

/** Optional hooks invoked during GraphQL execution. */
export interface ExecutionHooks {
  /** Called after all tracked asynchronous execution work has settled. */
  asyncWorkFinished?: (info: AsyncWorkFinishedInfo) => void;
}
