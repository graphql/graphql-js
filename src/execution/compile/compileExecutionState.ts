import type { Maybe } from '../../jsutils/Maybe.ts';
import type { ObjMap } from '../../jsutils/ObjMap.ts';

import { GraphQLError } from '../../error/GraphQLError.ts';

import type {
  DocumentNode,
  FragmentDefinitionNode,
  OperationDefinitionNode,
  VariableDefinitionNode,
} from '../../language/ast.ts';
import { Kind } from '../../language/kinds.ts';

import type {
  GraphQLFieldResolver,
  GraphQLTypeResolver,
} from '../../type/definition.ts';
import { GraphQLDisableErrorPropagationDirective } from '../../type/directives.ts';
import { assertValidSchema } from '../../type/index.ts';
import type { GraphQLSchema } from '../../type/schema.ts';

import type { FragmentDetails } from '../collectFields.ts';
import type {
  CompileExecutionArgs,
  ExecutionHooks,
  FieldCollectors,
} from '../ExecutionArgs.ts';
import { getVariableSignature } from '../getVariableSignature.ts';

import { compileCollectFields } from './compileCollectFields.ts';

/** @internal */
export interface CompiledExecutionState extends FieldCollectors {
  /** Schema used for execution. */
  schema: GraphQLSchema;
  /** Parsed GraphQL document being executed. */
  document: DocumentNode;
  /** Fragment definitions keyed by fragment name. */
  fragmentDefinitions: ObjMap<FragmentDefinitionNode>;
  /** Fragment details keyed by fragment name. */
  fragments: ObjMap<FragmentDetails>;
  /** Operation definition selected for execution. */
  operation: OperationDefinitionNode;
  /** Operation variable definitions. */
  variableDefinitions: ReadonlyArray<VariableDefinitionNode>;
  /** Whether suggestion text should be omitted from execution errors. */
  hideSuggestions: boolean;
  /** Whether execution should use error propagation. */
  errorPropagation: boolean;
  /** Resolver used when a field does not define its own resolver. */
  fieldResolver?: Maybe<GraphQLFieldResolver<any, any>>;
  /** Resolver used when an abstract type does not define its own resolver. */
  typeResolver?: Maybe<GraphQLTypeResolver<any, any>>;
  /** Resolver used for the root subscription field. */
  subscribeFieldResolver?: Maybe<GraphQLFieldResolver<any, any>>;
  /** Whether incremental execution may begin eligible work early. */
  enableEarlyExecution: boolean;
  /** Whether experimental field batch resolvers should be used. */
  enableBatchResolvers: boolean;
  /** Execution hooks invoked during this operation. */
  hooks?: ExecutionHooks | undefined;
}

/** @internal */
export function compileExecutionState(
  args: CompileExecutionArgs,
): ReadonlyArray<GraphQLError> | CompiledExecutionState {
  const { schema, document, operationName } = args;

  // If the schema used for execution is invalid, throw an error.
  assertValidSchema(schema);

  let operation: OperationDefinitionNode | undefined;
  const errors: Array<GraphQLError> = [];
  const fragmentDefinitions: ObjMap<FragmentDefinitionNode> =
    Object.create(null);
  const fragments: ObjMap<FragmentDetails> = Object.create(null);
  for (const definition of document.definitions) {
    switch (definition.kind) {
      case Kind.OPERATION_DEFINITION:
        if (operationName == null) {
          if (operation !== undefined) {
            return [
              new GraphQLError(
                'Must provide operation name if query contains multiple operations.',
              ),
            ];
          }
          operation = definition;
        } else if (definition.name?.value === operationName) {
          operation = definition;
        }
        break;
      case Kind.FRAGMENT_DEFINITION: {
        fragmentDefinitions[definition.name.value] = definition;
        let variableSignatures;
        if (definition.variableDefinitions) {
          variableSignatures = Object.create(null);
          for (const varDef of definition.variableDefinitions) {
            const signature = getVariableSignature(schema, varDef);
            if (signature instanceof GraphQLError) {
              errors.push(signature);
              continue;
            }
            variableSignatures[signature.name] = signature;
          }
        }
        fragments[definition.name.value] = { definition, variableSignatures };
        break;
      }
      default:
      // ignore non-executable definitions
    }
  }

  if (!operation) {
    if (operationName != null) {
      return [new GraphQLError(`Unknown operation named "${operationName}".`)];
    }
    return [new GraphQLError('Must provide an operation.')];
  }
  if (errors.length > 0) {
    return errors;
  }
  const selectedOperation = operation;

  const errorPropagation = !selectedOperation.directives?.find(
    (directive) =>
      directive.name.value === GraphQLDisableErrorPropagationDirective.name,
  );
  const hideSuggestions = args.hideSuggestions ?? false;
  const compiledCollectFields = compileCollectFields(
    schema,
    fragments,
    selectedOperation.selectionSet,
    hideSuggestions,
    args.fieldResolver == null,
  );

  return {
    schema,
    document,
    fragmentDefinitions,
    fragments,
    operation: selectedOperation,
    variableDefinitions: selectedOperation.variableDefinitions ?? [],
    hideSuggestions,
    errorPropagation,
    fieldResolver: args.fieldResolver,
    typeResolver: args.typeResolver,
    subscribeFieldResolver: args.subscribeFieldResolver,
    enableEarlyExecution: args.enableEarlyExecution === true,
    enableBatchResolvers: args.enableBatchResolvers === true,
    hooks: args.hooks ?? undefined,
    collectRootFields: compiledCollectFields.collectRootFields,
    collectSubfields: compiledCollectFields.collectSubfields,
  };
}

/** @internal */
export function isExecutionErrors(
  value: ReadonlyArray<GraphQLError> | CompiledExecutionState,
): value is ReadonlyArray<GraphQLError> {
  return Array.isArray(value);
}
