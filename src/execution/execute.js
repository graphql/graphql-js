/* @flow */
/**
 *  Copyright (c) 2015, Facebook, Inc.
 *  All rights reserved.
 *
 *  This source code is licensed under the BSD-style license found in the
 *  LICENSE file in the root directory of this source tree. An additional grant
 *  of patent rights can be found in the PATENTS file in the same directory.
 */

import { GraphQLError, locatedError } from '../error';
import find from '../jsutils/find';
import invariant from '../jsutils/invariant';
import isNullish from '../jsutils/isNullish';
import { typeFromAST } from '../utilities/typeFromAST';
import { Kind } from '../language';
import { getVariableValues, getArgumentValues } from './values';
import {
  GraphQLScalarType,
  GraphQLObjectType,
  GraphQLEnumType,
  GraphQLList,
  GraphQLNonNull,
  GraphQLCompositeType,
  GraphQLInterfaceType,
  GraphQLUnionType,
  isAbstractType
} from '../type/definition';
import type {
  GraphQLType,
  GraphQLAbstractType,
  GraphQLFieldDefinition,
  GraphQLSelectionPlan,
  GraphQLResolvingPlan,
  GraphQLCompletionPlan,
  GraphQLSerializationPlan,
  GraphQLMappingPlan,
  GraphQLLeafType,
  GraphQLCoercionPlan
} from '../type/definition';
import { GraphQLSchema } from '../type/schema';
import {
  SchemaMetaFieldDef,
  TypeMetaFieldDef,
  TypeNameMetaFieldDef
} from '../type/introspection';
import {
  GraphQLIncludeDirective,
  GraphQLSkipDirective
} from '../type/directives';
import type {
  Directive,
  Document,
  OperationDefinition,
  SelectionSet,
  Field,
  InlineFragment,
  FragmentDefinition
} from '../language/ast';


/**
 * Terminology
 *
 * "Definitions" are the generic name for top-level statements in the document.
 * Examples of this include:
 * 1) Operations (such as a query)
 * 2) Fragments
 *
 * "Operations" are a generic name for requests in the document.
 * Examples of this include:
 * 1) query,
 * 2) mutation
 *
 * "Selections" are the definitions that can appear legally and at
 * single level of the query. These include:
 * 1) field references e.g "a"
 * 2) fragment "spreads" e.g. "...c"
 * 3) inline fragment "spreads" e.g. "...on Type { a }"
 */

/**
 * Queries are execcuted in two phases: planning and evaluation.
 * The goal of planning is to precompute data needed for evaluation
 * and to give resolvers insight into how the query will be
 * executed.
 */

/**
 * Data that must be available at all points during query execution.
 *
 * Namely, schema of the type system that is currently executing,
 * and the fragments defined in the query document
 */
type ExecutionContext = {
  schema: GraphQLSchema;
  fragments: {[key: string]: FragmentDefinition};
  rootValue: mixed;
  operation: OperationDefinition;
  variableValues: {[key: string]: mixed};
  errors: Array<GraphQLError>;
}

/**
 * The result of execution. `data` is the result of executing the
 * query, `errors` is null if no errors occurred, and is a
 * non-empty array if an error occurred.
 */
type ExecutionResult = {
  data: ?Object;
  errors?: Array<GraphQLError>;
}

/**
 * Describes how the execution engine plans to perform
 * an operation.
 */
type GraphQLOperationPlan = {
  kind: 'execute';
  type: GraphQLObjectType;
  concurrencyStrategy: string;
  fields: {[fieldName: string]: [ GraphQLResolvingPlan ]};
  fieldPlansByAlias: {[alias: string]: GraphQLResolvingPlan};
}

/**
 * Implements the "Evaluating requests" section of the GraphQL specification.
 *
 * Returns a Promise that will eventually be resolved and never rejected.
 *
 * If the arguments to this function do not result in a legal execution context,
 * a GraphQLError will be thrown immediately explaining the invalid input.
 */
export function execute(
  schema: GraphQLSchema,
  documentAST: Document,
  rootValue?: mixed,
  variableValues?: ?{[key: string]: mixed},
  operationName?: ?string
): Promise<ExecutionResult> {
  invariant(schema, 'Must provide schema');
  invariant(
    schema instanceof GraphQLSchema,
    'Schema must be an instance of GraphQLSchema. Also ensure that there are ' +
    'not multiple versions of GraphQL installed in your node_modules directory.'
  );

  // If a valid context cannot be created due to incorrect arguments,
  // this will throw an error.
  const context = buildExecutionContext(
    schema,
    documentAST,
    rootValue,
    variableValues,
    operationName
  );

  // Create an execution plan which will describe how we intend to evaluate
  // The query.
  const plan = planOperation(context, context.operation);

  // Return a Promise that will eventually resolve to the data described by
  // The "Response" section of the GraphQL specification.
  //
  // If errors are encountered while executing a GraphQL field, only that
  // field and its descendants will be omitted, and sibling fields will still
  // be executed. An execution which encounters errors will still result in a
  // resolved Promise.
  return new Promise(resolve => {
    resolve(executeOperation(context, plan, rootValue));
  }).catch(error => {
    // Errors from sub-fields of a NonNull type may propagate to the top level,
    // at which point we still log the error and null the parent field, which
    // in this case is the entire response.
    context.errors.push(error);
    return null;
  }).then(data => {
    if (!context.errors.length) {
      return { data };
    }
    return { data, errors: context.errors };
  });
}

/**
 * Constructs a ExecutionContext object from the arguments passed to
 * execute, which we will pass throughout the other execution methods.
 *
 * Throws a GraphQLError if a valid execution context cannot be created.
 */
function buildExecutionContext(
  schema: GraphQLSchema,
  documentAST: Document,
  rootValue: mixed,
  rawVariableValues: ?{[key: string]: mixed},
  operationName: ?string
): ExecutionContext {
  const errors: Array<GraphQLError> = [];
  let operation: ?OperationDefinition;
  const fragments: {[name: string]: FragmentDefinition} = Object.create(null);
  documentAST.definitions.forEach(definition => {
    switch (definition.kind) {
      case Kind.OPERATION_DEFINITION:
        if (!operationName && operation) {
          throw new GraphQLError(
            'Must provide operation name if query contains multiple operations.'
          );
        }
        if (!operationName ||
            definition.name && definition.name.value === operationName) {
          operation = definition;
        }
        break;
      case Kind.FRAGMENT_DEFINITION:
        fragments[definition.name.value] = definition;
        break;
      default: throw new GraphQLError(
        `GraphQL cannot execute a request containing a ${definition.kind}.`,
        definition
      );
    }
  });
  if (!operation) {
    if (operationName) {
      throw new GraphQLError(`Unknown operation named "${operationName}".`);
    } else {
      throw new GraphQLError('Must provide an operation.');
    }
  }
  const variableValues = getVariableValues(
    schema,
    operation.variableDefinitions || [],
    rawVariableValues || {}
  );
  const exeContext: ExecutionContext =
    { schema, fragments, rootValue, operation, variableValues, errors };
  return exeContext;
}

/**
 * Create a plan based on the "Evaluating operations" section of the spec.
 */
function planOperation(
  exeContext: ExecutionContext,
  operation: OperationDefinition
): GraphQLOperationPlan {
  const type = getOperationRootType(exeContext.schema, operation);
  const concurrencyStrategy =
    (operation.operation === 'mutation') ? 'serial' : 'parallel';

  const fields = collectFields(
    exeContext,
    type,
    operation.selectionSet,
    Object.create(null),
    Object.create(null)
  );

  const {fieldPlansByAlias, fieldPlans} = planFields(exeContext, type, fields);

  const plan: GraphQLOperationPlan = {
    kind: 'execute',
    type,
    concurrencyStrategy,
    fields: fieldPlans,
    fieldPlansByAlias
  };

  return plan;
}

type planFieldsResult = {
  fieldPlansByAlias: {[alias: string]: GraphQLResolvingPlan};
  fieldPlans: {[fieldName: string]: [ GraphQLResolvingPlan ]};
}

/**
 * Plan the "Evaluating selection sets" section of the spec
 */
function planFields(
  exeContext: ExecutionContext,
  parentType: GraphQLObjectType,
  fields: {[alias: string]: Array<Field>}
): planFieldsResult {
  const fieldPlansByAlias = Object.create(null);
  const fieldPlans = Object.create(null);
  Object.keys(fields).forEach(
    responseName => {
      const fieldASTs = fields[responseName];
      const fieldPlan = planResolveField(
        exeContext,
        parentType,
        fieldASTs
      );
      if (fieldPlan) {
        fieldPlansByAlias[responseName] = fieldPlan;
        if (fieldPlans[fieldPlan.fieldName]) {
          fieldPlans[fieldPlan.fieldName].push(fieldPlan);
        } else {
          fieldPlans[fieldPlan.fieldName] = [ fieldPlan ];
        }
      }
    }
  );
  return {fieldPlansByAlias, fieldPlans};
}

/**
 * Plan how to resolve a field.
 */
function planResolveField(
  exeContext: ExecutionContext,
  parentType: GraphQLObjectType,
  fieldASTs: Array<Field>
): ?GraphQLResolvingPlan {
  const fieldAST = fieldASTs[0];
  const fieldName = fieldAST.name.value;

  const fieldDef = getFieldDef(exeContext.schema, parentType, fieldName);
  if (!fieldDef) {
    // Omit requested fields that are not in our schema
    return;
  }

  const returnType = fieldDef.type;

  // Build a JS object of arguments from the field.arguments AST, using the
  // variables scope to fulfill any variable references.
  const args = getArgumentValues(
    fieldDef.args,
    fieldAST.arguments,
    exeContext.variableValues
  );

  const completionPlan = planCompleteValue(
    exeContext,
    returnType,
    fieldASTs,
    fieldName,
    parentType
  );

  const plan: GraphQLResolvingPlan = {
    kind: 'resolve',
    fieldName,
    fieldASTs,
    returnType,
    parentType,
    schema: exeContext.schema,
    fragments: exeContext.fragments,
    rootValue: exeContext.rootValue,
    operation: exeContext.operation,
    variableValues: exeContext.variableValues,
    fieldDefinition: fieldDef,
    args,
    returned: completionPlan
  };

  return plan;
}

/**
 * Plans the evaluation of a GraphQLScalarType or GraphQLEnumType
 * value during value completion.
 */
function planSerialization(
  exeContext: ExecutionContext,
  returnType: GraphQLLeafType,
  fieldASTs: Array<Field>,
  fieldName: string,
  parentType: GraphQLCompositeType
): GraphQLSerializationPlan {
  invariant(returnType.serialize, 'Missing serialize method on type');

  const plan: GraphQLSerializationPlan = {
    kind: 'serialize',
    fieldASTs,
    returnType,
    fieldName,
    parentType
  };

  return plan;
}

/**
 * Plans the evaluation of a GraphQLList value during value completion.
 */
function planMapping(
  exeContext: ExecutionContext,
  returnType: GraphQLList,
  fieldASTs: Array<Field>,
  fieldName: string,
  parentType: GraphQLCompositeType
): GraphQLMappingPlan {
  const innerType = returnType.ofType;

  const elementPlan =
    planCompleteValue(
      exeContext,
      innerType,
      fieldASTs,
      fieldName,
      parentType
    );

  const plan: GraphQLMappingPlan = {
    kind: 'map',
    fieldASTs,
    returnType,
    fieldName,
    parentType,
    listElement: elementPlan
  };

  return plan;
}

/**
 * Plan the evaluation of a GraphQLObjectType value during value completion.
 */
function planSelection(
  exeContext: ExecutionContext,
  type: GraphQLObjectType,
  fieldASTs: Array<Field>,
  fieldName: string,
  parentType: GraphQLCompositeType
): GraphQLSelectionPlan {

  let fields = Object.create(null);
  const visitedFragmentNames = Object.create(null);
  for (let i = 0; i < fieldASTs.length; i++) {
    const selectionSet = fieldASTs[i].selectionSet;
    if (selectionSet) {
      fields = collectFields(
        exeContext,
        type,
        selectionSet,
        fields,
        visitedFragmentNames
      );
    }
  }

  const {fieldPlansByAlias, fieldPlans} = planFields(exeContext, type, fields);

  const plan: GraphQLSelectionPlan = {
    kind: 'select',
    fieldName,
    fieldASTs,
    returnType: type,
    parentType,
    schema: exeContext.schema,
    fragments: exeContext.fragments,
    rootValue: exeContext.rootValue,
    operation: exeContext.operation,
    variableValues: exeContext.variableValues,
    fields: fieldPlans,
    fieldPlansByAlias
  };

  return plan;
}

/**
 * Plans the evaluation of an abstract type
 * value during value completion.
 */
function planCoercion(
  exeContext: ExecutionContext,
  returnType: GraphQLAbstractType,
  fieldASTs: Array<Field>,
  fieldName: string,
  parentType: GraphQLCompositeType
): GraphQLCoercionPlan {
  const abstractType = ((returnType: any): GraphQLAbstractType);
  const possibleTypes = abstractType.getPossibleTypes();
  const typeChoices = Object.create(null);
  possibleTypes.forEach(possibleType => {
    invariant(
      !typeChoices[possibleType.name],
      'Two types cannot have the same name "${possibleType.name}"' +
      'as possible types of abstract type ${abstractType.name}'
    );
    typeChoices[possibleType.name] = planSelection(
      exeContext,
      possibleType,
      fieldASTs,
      fieldName,
      parentType
    );
  });

  const plan: GraphQLCoercionPlan = {
    kind: 'coerce',
    fieldName,
    fieldASTs,
    returnType: abstractType,
    parentType,
    schema: exeContext.schema,
    fragments: exeContext.fragments,
    rootValue: exeContext.rootValue,
    operation: exeContext.operation,
    variableValues: exeContext.variableValues,
    typeChoices
  };

  return plan;
}

/**
 * Plans the evaluation of completeValue as defined in the
 * "Field entries" section of the spec.
 */
function planCompleteValue(
  exeContext: ExecutionContext,
  returnType: GraphQLType,
  fieldASTs: Array<Field>,
  fieldName: string,
  parentType: GraphQLCompositeType
): GraphQLCompletionPlan {

  // If field type is NonNull, complete for inner type
  if (returnType instanceof GraphQLNonNull) {
    return planCompleteValue(
      exeContext,
      returnType.ofType,
      fieldASTs,
      fieldName,
      parentType
    );
  }

  // If field type is Scalar or Enum, serialize to a valid value, returning
  // null if serialization is not possible.
  if (returnType instanceof GraphQLScalarType ||
      returnType instanceof GraphQLEnumType) {
    return planSerialization(
      exeContext,
      returnType,
      fieldASTs,
      fieldName,
      parentType
    );
  }

  // If field type is List, complete each item in the list with the inner type
  if (returnType instanceof GraphQLList) {
    return planMapping(
      exeContext,
      returnType,
      fieldASTs,
      fieldName,
      parentType
    );
  }

  if (returnType instanceof GraphQLObjectType) {
    return planSelection(
      exeContext,
      returnType,
      fieldASTs,
      fieldName,
      parentType
    );
  }

  if (isAbstractType(returnType)) {
    invariant(
      returnType instanceof GraphQLInterfaceType ||
      returnType instanceof GraphQLUnionType);
    return planCoercion(
      exeContext,
      returnType,
      fieldASTs,
      fieldName,
      parentType
    );
  }

  // We have handled all possibilities.  Not reachable
  invariant(false, `Cannot form plan for ${parentType}.${fieldName}`);
}

/**
 * Implements the "Evaluating operations" section of the spec.
 */
function executeOperation(
  exeContext: ExecutionContext,
  plan: GraphQLOperationPlan,
  rootValue: mixed
): Object {

  invariant(
    plan.concurrencyStrategy === 'serial' ||
    plan.concurrencyStrategy === 'parallel'
  );

  if (plan.concurrencyStrategy === 'serial') {
    return executeFieldsSerially(exeContext, rootValue, plan.fieldPlansByAlias);
  }
  return executeFields(exeContext, rootValue, plan.fieldPlansByAlias);
}

/**
 * Extracts the root type of the operation from the schema.
 */
function getOperationRootType(
  schema: GraphQLSchema,
  operation: OperationDefinition
): GraphQLObjectType {
  switch (operation.operation) {
    case 'query':
      return schema.getQueryType();
    case 'mutation':
      const mutationType = schema.getMutationType();
      if (!mutationType) {
        throw new GraphQLError(
          'Schema is not configured for mutations',
          [ operation ]
        );
      }
      return mutationType;
    case 'subscription':
      const subscriptionType = schema.getSubscriptionType();
      if (!subscriptionType) {
        throw new GraphQLError(
          'Schema is not configured for subscriptions',
          [ operation ]
        );
      }
      return subscriptionType;
    default:
      throw new GraphQLError(
        'Can only execute queries, mutations and subscriptions',
        [ operation ]
      );
  }
}

/**
 * Implements the "Evaluating selection sets" section of the spec
 * for "write" mode.
 */
function executeFieldsSerially(
  exeContext: ExecutionContext,
  sourceValue: mixed,
  fields: {[alias: string]: GraphQLResolvingPlan}
): Promise<Object> {
  return Object.keys(fields).reduce(
    (prevPromise, responseName) => prevPromise.then(results => {
      const result = resolveField(
        exeContext,
        fields[responseName],
        sourceValue
      );
      if (result === undefined) {
        return results;
      }
      if (isThenable(result)) {
        return ((result: any): Promise).then(resolvedResult => {
          results[responseName] = resolvedResult;
          return results;
        });
      }
      results[responseName] = result;
      return results;
    }),
    Promise.resolve({})
  );
}

/**
 * Implements the "Evaluating selection sets" section of the spec
 * for "read" mode.
 */
function executeFields(
  exeContext: ExecutionContext,
  sourceValue: mixed,
  fields: {[alias: string]: GraphQLResolvingPlan}
): Object {
  let containsPromise = false;

  const finalResults = Object.keys(fields).reduce(
    (results, responseName) => {
      const result = resolveField(
        exeContext,
        fields[responseName],
        sourceValue
      );
      if (result === undefined) {
        return results;
      }
      results[responseName] = result;
      if (isThenable(result)) {
        containsPromise = true;
      }
      return results;
    },
    Object.create(null)
  );

  // If there are no promises, we can just return the object
  if (!containsPromise) {
    return finalResults;
  }

  // Otherwise, results is a map from field name to the result
  // of resolving that field, which is possibly a promise. Return
  // a promise that will return this same map, but with any
  // promises replaced with the values they resolved to.
  return promiseForObject(finalResults);
}

/**
 * Given a selectionSet, adds all of the fields in that selection to
 * the passed in map of fields, and returns it at the end.
 *
 * CollectFields requires the "runtime type" of an object. For a field which
 * returns and Interface or Union type, the "runtime type" will be the actual
 * Object type returned by that field.
 */
function collectFields(
  exeContext: ExecutionContext,
  runtimeType: GraphQLObjectType,
  selectionSet: SelectionSet,
  fields: {[key: string]: Array<Field>},
  visitedFragmentNames: {[key: string]: boolean}
): {[key: string]: Array<Field>} {
  for (let i = 0; i < selectionSet.selections.length; i++) {
    const selection = selectionSet.selections[i];
    switch (selection.kind) {
      case Kind.FIELD:
        if (!shouldIncludeNode(exeContext, selection.directives)) {
          continue;
        }
        const name = getFieldEntryKey(selection);
        if (!fields[name]) {
          fields[name] = [];
        }
        fields[name].push(selection);
        break;
      case Kind.INLINE_FRAGMENT:
        if (!shouldIncludeNode(exeContext, selection.directives) ||
            !doesFragmentConditionMatch(exeContext, selection, runtimeType)) {
          continue;
        }
        collectFields(
          exeContext,
          runtimeType,
          selection.selectionSet,
          fields,
          visitedFragmentNames
        );
        break;
      case Kind.FRAGMENT_SPREAD:
        const fragName = selection.name.value;
        if (visitedFragmentNames[fragName] ||
            !shouldIncludeNode(exeContext, selection.directives)) {
          continue;
        }
        visitedFragmentNames[fragName] = true;
        const fragment = exeContext.fragments[fragName];
        if (!fragment ||
            !shouldIncludeNode(exeContext, fragment.directives) ||
            !doesFragmentConditionMatch(exeContext, fragment, runtimeType)) {
          continue;
        }
        collectFields(
          exeContext,
          runtimeType,
          fragment.selectionSet,
          fields,
          visitedFragmentNames
        );
        break;
    }
  }
  return fields;
}

/**
 * Determines if a field should be included based on the @include and @skip
 * directives, where @skip has higher precidence than @include.
 */
function shouldIncludeNode(
  exeContext: ExecutionContext,
  directives: ?Array<Directive>
): boolean {
  const skipAST = directives && find(
    directives,
    directive => directive.name.value === GraphQLSkipDirective.name
  );
  if (skipAST) {
    const { if: skipIf } = getArgumentValues(
      GraphQLSkipDirective.args,
      skipAST.arguments,
      exeContext.variableValues
    );
    return !skipIf;
  }

  const includeAST = directives && find(
    directives,
    directive => directive.name.value === GraphQLIncludeDirective.name
  );
  if (includeAST) {
    const { if: includeIf } = getArgumentValues(
      GraphQLIncludeDirective.args,
      includeAST.arguments,
      exeContext.variableValues
    );
    return Boolean(includeIf);
  }

  return true;
}

/**
 * Determines if a fragment is applicable to the given type.
 */
function doesFragmentConditionMatch(
  exeContext: ExecutionContext,
  fragment: FragmentDefinition | InlineFragment,
  type: GraphQLObjectType
): boolean {
  const typeConditionAST = fragment.typeCondition;
  if (!typeConditionAST) {
    return true;
  }
  const conditionalType = typeFromAST(exeContext.schema, typeConditionAST);
  if (conditionalType === type) {
    return true;
  }
  if (isAbstractType(conditionalType)) {
    return ((conditionalType: any): GraphQLAbstractType).isPossibleType(type);
  }
  return false;
}

/**
 * This function transforms a JS object `{[key: string]: Promise<T>}` into
 * a `Promise<{[key: string]: T}>`
 *
 * This is akin to bluebird's `Promise.props`, but implemented only using
 * `Promise.all` so it will work with any implementation of ES6 promises.
 */
function promiseForObject<T>(
  object: {[key: string]: Promise<T>}
): Promise<{[key: string]: T}> {
  const keys = Object.keys(object);
  const valuesAndPromises = keys.map(name => object[name]);
  return Promise.all(valuesAndPromises).then(
    values => values.reduce((resolvedObject, value, i) => {
      resolvedObject[keys[i]] = value;
      return resolvedObject;
    }, Object.create(null))
  );
}

/**
 * Implements the logic to compute the key of a given field’s entry
 */
function getFieldEntryKey(node: Field): string {
  return node.alias ? node.alias.value : node.name.value;
}

/**
 * Resolves the field on the given source object. In particular, this
 * figures out the value that the field returns by calling its resolve function,
 * then calls completeValue to complete promises, serialize scalars, or execute
 * the sub-selection-set for objects.
 */
function resolveField(
  exeContext: ExecutionContext,
  plan: GraphQLResolvingPlan,
  source: mixed
): mixed {

  const fieldDef = plan.fieldDefinition;
  const resolveFn = fieldDef.resolve || defaultResolveFn;
  const args = plan.args;

  // Get the resolve function, regardless of if its result is normal
  // or abrupt (error).
  const result = resolveOrError(resolveFn, source, args, plan);

  return completeValueCatchingError(
    exeContext,
    plan.returned,
    plan.returnType,
    result
  );
}

// Isolates the "ReturnOrAbrupt" behavior to not de-opt the `resolveField`
// function. Returns the result of resolveFn or the abrupt-return Error object.
function resolveOrError<T>(
  resolveFn: (
    source: mixed,
    args: { [key: string]: mixed },
    info: GraphQLResolvingPlan
  ) => T,
  source: mixed,
  args: { [key: string]: mixed },
  plan: GraphQLResolvingPlan
): Error | T {
  try {
    return resolveFn(source, args, plan);
  } catch (error) {
    // Sometimes a non-error is thrown, wrap it as an Error for a
    // consistent interface.
    return error instanceof Error ? error : new Error(error);
  }
}

// This is a small wrapper around completeValue which detects and logs errors
// in the execution context.
function completeValueCatchingError(
  exeContext: ExecutionContext,
  plan: GraphQLCompletionPlan,
  returnType: GraphQLType,
  result: mixed
): mixed {
  // If the field type is non-nullable, then it is resolved without any
  // protection from errors.
  if (returnType instanceof GraphQLNonNull) {
    return completeValue(exeContext, plan, returnType, result);
  }

  // Otherwise, error protection is applied, logging the error and resolving
  // a null value for this field if one is encountered.
  try {
    const completed = completeValue(
      exeContext,
      plan,
      returnType,
      result
    );
    if (isThenable(completed)) {
      // If `completeValue` returned a rejected promise, log the rejection
      // error and resolve to null.
      // Note: we don't rely on a `catch` method, but we do expect "thenable"
      // to take a second callback for the error case.
      return ((completed: any): Promise).then(undefined, error => {
        exeContext.errors.push(error);
        return Promise.resolve(null);
      });
    }
    return completed;
  } catch (error) {
    // If `completeValue` returned abruptly (threw an error), log the error
    // and return null.
    exeContext.errors.push(error);
    return null;
  }
}

/**
 * Implements the instructions for completeValue as defined in the
 * "Field entries" section of the spec.
 *
 * If the field type is Non-Null, then this recursively completes the value
 * for the inner type. It throws a field error if that completion returns null,
 * as per the "Nullability" section of the spec.
 *
 * If the field type is a List, then this recursively completes the value
 * for the inner type on each item in the list.
 *
 * If the field type is a Scalar or Enum, ensures the completed value is a legal
 * value of the type by calling the `serialize` method of GraphQL type
 * definition.
 *
 * Otherwise, the field type expects a sub-selection set, and will complete the
 * value by evaluating all sub-selections.
 */
function completeValue(
  exeContext: ExecutionContext,
  plan: GraphQLCompletionPlan,
  returnType: GraphQLType,
  result: mixed
): mixed {

  // If result is a Promise, apply-lift over completeValue.
  if (isThenable(result)) {
    return ((result: any): Promise).then(
      // Once resolved to a value, complete that value.
      resolved => completeValue(
        exeContext,
        plan,
        returnType,
        resolved
      ),
      // If rejected, create a located error, and continue to reject.
      error => Promise.reject(locatedError(error, plan.fieldASTs))
    );
  }

  // If result is an Error, throw a located error.
  if (result instanceof Error) {
    throw locatedError(result, plan.fieldASTs);
  }

  // If field type is NonNull, complete for inner type, and throw field error
  // if result is null.
  if (returnType instanceof GraphQLNonNull) {
    const completed = completeValue(
      exeContext,
      plan,
      returnType.ofType,
      result
    );
    if (completed === null) {
      throw new GraphQLError(
        `Cannot return null for non-nullable field ${
          plan.parentType}.${plan.fieldName}.`,
        plan.fieldASTs
      );
    }
    return completed;
  }

  // If result is null-like, return null.
  if (isNullish(result)) {
    return null;
  }

  switch (plan.kind) {
    case 'serialize':
      return evaluateSerializationPlan(result, plan);

    case 'map':
      return evaluateMappingPlan(exeContext, result, plan);

    case 'select':
      return evaluateSelectionPlan(exeContext, result, plan);

    case 'coerce':
      return evaluateCoercionPlan(exeContext, result, plan);

    // We have handled all possibilities.  Not reachable
    default:
      invariant(false, 'No plan covers runtime conditions');
  }

}

/**
 * Evaluate a serialization plan
 */
function evaluateSerializationPlan(
  result: mixed,
  plan: GraphQLSerializationPlan
): mixed {
  invariant(plan.returnType.serialize, 'Missing serialize method on type');

  // If result is null-like, return null.
  const serializedResult = plan.returnType.serialize(result);
  return isNullish(serializedResult) ? null : serializedResult;
}

/**
 * Evaluate a mapping plan
 */
function evaluateMappingPlan(
  exeContext: ExecutionContext,
  result: mixed,
  plan: GraphQLMappingPlan
): mixed {

  invariant(
    Array.isArray(result),
    `User Error: expected iterable, but did not find one for field ${
      plan.parentType}.${plan.fieldName}.`
  );
  invariant(plan.returnType.ofType);

  const elementPlan = plan.listElement;

  // This is specified as a simple map, however we're optimizing the path
  // where the list contains no Promises by avoiding creating another
  // Promise.
  const itemType = plan.returnType.ofType;
  let containsPromise = false;
  const completedResults = result.map(item => {
    const completedItem =
      completeValueCatchingError(
        exeContext,
        elementPlan,
        itemType,
        item
      );
    if (!containsPromise && isThenable(completedItem)) {
      containsPromise = true;
    }
    return completedItem;
  });

  return containsPromise ?
    Promise.all(completedResults) : completedResults;
}

/**
 * Evaluate a selection plan
 */
function evaluateSelectionPlan(
  exeContext: ExecutionContext,
  result: mixed,
  plan: GraphQLSelectionPlan
): mixed {
  const returnType = plan.returnType;

  // If there is an isTypeOf predicate function, call it with the
  // current result. If isTypeOf returns false, then raise an error rather
  // than continuing execution.
  if (returnType.isTypeOf && !returnType.isTypeOf(result, plan)) {
    throw new GraphQLError(
      `Expected value of type "${plan.returnType}" but got: ${result}.`,
      plan.fieldASTs
    );
  }

  return executeFields(
      exeContext,
      result,
      plan.fieldPlansByAlias
  );
}

/**
 * Evaluate a coercion plan
 */
function evaluateCoercionPlan(
  exeContext: ExecutionContext,
  result: mixed,
  plan: GraphQLCoercionPlan
): mixed {
  // Field type must be Object, Interface or Union and expect
  // sub-selections.
  let runtimeType: ?GraphQLObjectType;

  const abstractType = ((plan.returnType: any): GraphQLAbstractType);

  if (abstractType.resolveType) {
    runtimeType = findTypeWithResolveType(abstractType, plan, result);
  } else {
    runtimeType = findTypeWithIsTypeOf(plan, result);
  }

  invariant(
    runtimeType,
    'Could not resolve type,' +
    'probably an error in a resolveType or isTypeOf function in the schema'
  );

  invariant(plan.typeChoices !== null);

  const typeChoices = plan.typeChoices;
  const selectionPlan = typeChoices[runtimeType.name];
  if (!selectionPlan) {
    throw new GraphQLError(
      `Runtime Object type "${runtimeType}" ` +
      `is not a possible type for "${abstractType}".`,
      plan.fieldASTs
    );
  }

  return evaluateSelectionPlan(exeContext, result, selectionPlan);
}

/**
 * Determine which type in a GraphQLCoercionPlan matches the type of result.
 */
function findTypeWithResolveType(
    type:GraphQLAbstractType,
    plan: GraphQLCoercionPlan,
    result: mixed
): ?GraphQLObjectType {
  if (!type.resolveType) {
    return null;
  }
  return type.resolveType(result, plan);
}

/**
 * Determine which type in a GraphQLCoercionPlan matches the type of result.
 */
function findTypeWithIsTypeOf(
    plan: GraphQLCoercionPlan,
    result: mixed
): ?GraphQLObjectType {
  const plansByType = plan.typeChoices;
  // We constructed plansByType without a prototype
  /* eslint guard-for-in:0 */
  for (const typeName in plansByType) {
    const candidatePlan = plansByType[typeName];
    const type = candidatePlan.returnType;
    if (type.isTypeOf && type.isTypeOf(result, candidatePlan)) {
      return type;
    }
  }

  // Not found
  return null;
}

/**
 * If a resolve function is not given, then a default resolve behavior is used
 * which takes the property of the source object of the same name as the field
 * and returns it as the result, or if it's a function, returns the result
 * of calling that function.
 */
function defaultResolveFn(
  source:mixed,
  args:{ [key: string]: mixed },
  info: GraphQLResolvingPlan
) {
  const fieldName = info.fieldName;

  // ensure source is a value for which property access is acceptable.
  if (typeof source !== 'number' && typeof source !== 'string' && source) {
    const property = (source: any)[fieldName];
    return typeof property === 'function' ? property.call(source) : property;
  }
}

/**
 * Checks to see if this object acts like a Promise, i.e. has a "then"
 * function.
 */
function isThenable(value: mixed): boolean {
  return typeof value === 'object' &&
    value !== null &&
    typeof value.then === 'function';
}

/**
 * This method looks up the field on the given type defintion.
 * It has special casing for the two introspection fields, __schema
 * and __typename. __typename is special because it can always be
 * queried as a field, even in situations where no other fields
 * are allowed, like on a Union. __schema could get automatically
 * added to the query type, but that would require mutating type
 * definitions, which would cause issues.
 */
function getFieldDef(
  schema: GraphQLSchema,
  parentType: GraphQLObjectType,
  fieldName: string
): ?GraphQLFieldDefinition {
  if (fieldName === SchemaMetaFieldDef.name &&
      schema.getQueryType() === parentType) {
    return SchemaMetaFieldDef;
  } else if (fieldName === TypeMetaFieldDef.name &&
             schema.getQueryType() === parentType) {
    return TypeMetaFieldDef;
  } else if (fieldName === TypeNameMetaFieldDef.name) {
    return TypeNameMetaFieldDef;
  }
  return parentType.getFields()[fieldName];
}
