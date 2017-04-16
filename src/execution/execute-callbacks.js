import { isCollection, forEach } from 'iterall';

import { GraphQLError, locatedError } from '../error';
import find from '../jsutils/find';
import invariant from '../jsutils/invariant';
import isNullish from '../jsutils/isNullish';
import { typeFromAST } from '../utilities/typeFromAST';
import * as Kind from '../language/kinds';
import { getVariableValues, getArgumentValues } from './values';
import {
  GraphQLScalarType,
  GraphQLObjectType,
  GraphQLEnumType,
  GraphQLList,
  GraphQLNonNull,
  GraphQLInterfaceType,
  GraphQLUnionType,
  isAbstractType
} from '../type/definition';
import type {
  GraphQLType,
  GraphQLLeafType,
  GraphQLAbstractType,
  GraphQLField,
  GraphQLFieldResolver,
  GraphQLResolveInfo,
  ResponsePath,
} from '../type/definition';
import { GraphQLSchema } from '../type/schema';
import {
  SchemaMetaFieldDef,
  TypeMetaFieldDef,
  TypeNameMetaFieldDef,
} from '../type/introspection';
import {
  GraphQLIncludeDirective,
  GraphQLSkipDirective,
} from '../type/directives';
import type {
  DirectiveNode,
  DocumentNode,
  OperationDefinitionNode,
  SelectionSetNode,
  FieldNode,
  InlineFragmentNode,
  FragmentDefinitionNode,
} from '../language/ast';

import * as Most from 'most';


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
 * Data that must be available at all points during query execution.
 *
 * Namely, schema of the type system that is currently executing,
 * and the fragments defined in the query document
 */
type ExecutionContext = {
  schema: GraphQLSchema;
  fragments: {[key: string]: FragmentDefinitionNode};
  rootValue: mixed;
  contextValue: mixed;
  operation: OperationDefinitionNode;
  variableValues: {[key: string]: mixed};
  errors: Array<GraphQLError>;
};

/**
 * The result of GraphQL execution.
 *
 *   - `data` is the result of a successful execution of the query.
 *   - `errors` is included when any errors occurred as a non-empty array.
 */
export type ExecutionResult = {
  data?: ?{[key: string]: mixed};
  errors?: Array<GraphQLError>;
};

type ExecutionDescriptor = {
  exeContext: ExecutionContext,
  fieldNodes: Array<FieldNode>,
  info: GraphQLResolveInfo,
};

// !!!: CompleteType could be more clear types.
type CompleteType = mixed;

// !!!: wrong type def for Most.js
type ProcessFields = (rxjs$Observable<rxjs$Observable<CompleteType>>) =>
  rxjs$Observable<Array<CompleteType>>;

export function execute(
  schema: GraphQLSchema,
  document: DocumentNode,
  rootValue?: mixed,
  contextValue?: mixed,
  variableValues?: ?{[key: string]: mixed},
  operationName?: ?string
): Promise<ExecutionResult> {
  return executeMost(
    schema: GraphQLSchema,
    document,
    rootValue,
    contextValue,
    variableValues,
    operationName
  )
  .take(1)
  .reduce((_, x) => x, undefined);
}

export function executeMost(
  schema: GraphQLSchema,
  document: DocumentNode,
  rootValue?: mixed,
  contextValue?: mixed,
  variableValues?: ?{[key: string]: mixed},
  operationName?: ?string
) {
  invariant(schema, 'Must provide schema');
  invariant(document, 'Must provide document');
  invariant(
    schema instanceof GraphQLSchema,
    'Schema must be an instance of GraphQLSchema. Also ensure that there are ' +
    'not multiple versions of GraphQL installed in your node_modules directory.'
  );

  // Variables, if provided, must be an object.
  invariant(
    !variableValues || typeof variableValues === 'object',
    'Variables must be provided as an Object where each property is a ' +
    'variable value. Perhaps look to see if an unparsed JSON string ' +
    'was provided.'
  );

  // If a valid context cannot be created due to incorrect arguments,
  // this will throw an error.
  const context = buildExecutionContext(
    schema,
    document,
    rootValue,
    contextValue,
    variableValues,
    operationName
  );

  // Return an Observable that will eventually resolve to the data described by
  // The "Response" section of the GraphQL specification.
  //
  // If errors are encountered while executing a GraphQL field, only that
  // field and its descendants will be omitted, and sibling fields will still
  // be executed. An execution which encounters errors will still result in a
  // resolved Observable.
  return executeOperation(context, context.operation, rootValue)
    .recoverWith(error => {
      // Errors from sub-fields of a NonNull type may propagate to the top
      // level, at which point we still log the error and null the parent field,
      // which in this case is the entire response.
      context.errors.push(error);
      return Most.of(null);
    })
    .map(data => {
      if (!context.errors.length) {
        return { data };
      }
      return { data, errors: context.errors };
    });
}

/**
 * Implements the "Evaluating operations" section of the spec.
 */
function executeOperation(
  exeContext: ExecutionContext,
  operation: OperationDefinitionNode,
  rootValue: mixed
) {
  const type = getOperationRootType(exeContext.schema, operation);
  const fields = collectFields(
    exeContext,
    type,
    operation.selectionSet,
    Object.create(null),
    Object.create(null)
  );

  const path = undefined;

  if (operation.operation === 'mutation') {
    return executeFieldsSerially(exeContext, type, rootValue, path, fields);
  }
  return executeFields(exeContext, type, rootValue, path, fields);
}

/**
 * Implements the "Evaluating selection sets" section of the spec
 * for "write" mode.
 */
function executeFieldsSerially(
  exeContext: ExecutionContext,
  parentType: GraphQLObjectType,
  sourceValue: mixed,
  path: ResponsePath,
  fields: {[key: string]: Array<FieldNode>}
) {
  return eachResolvedFields$$(exeContext, parentType, sourceValue, path, fields,
    // We only allow each mutation field to execute only once (`take(1)`) and
    // serially (`concatAll()`). Convert the sequential results into an array.
    fieldStreamList => {
      // Start with an empty stream, and take one value from each stream in the
      // list.
      const serialStream = fieldStreamList.reduce((prev, curr) => {
        return prev.concat(curr.take(1));
      }, Most.empty());

      // A Promise containing the result
      const result = serialStream.reduce((resultList, value) => {
        return resultList.concat(value);
      }, []);
      return Most.fromPromise(result);
    }
  );
}

/**
 * Implements the "Evaluating selection sets" section of the spec
 * for "read" mode.
 */
function executeFields(
  exeContext: ExecutionContext,
  parentType: GraphQLObjectType,
  sourceValue: mixed,
  path: ResponsePath,
  fields: {[key: string]: Array<FieldNode>}
) {
  return eachResolvedFields$$(exeContext, parentType, sourceValue, path, fields,
    // We combine all higher-order observables of resolved fields into an array.
    // When any elements (observable) sends a new value, pop a new array for the
    // total results.
    fieldStreamList => {
      return Most.combineArray((...values) => [ ...values ], fieldStreamList);
    }
  );
}

/**
 * Return a Observable which execute fields properly. You will use processFields
 * to decide how to manipulate each higher-order observable of fields and
 * how to assemble the each field result into a total result.
 */
function eachResolvedFields$$(
  exeContext: ExecutionContext,
  parentType: GraphQLObjectType,
  sourceValue: mixed,
  path: ResponsePath,
  fields: {[key: string]: Array<FieldNode>},
  processFields: ProcessFields
) {
  // Generate `Array< $( {[fieldName]: result} ) >` for the execution sequence.
  const resolvedFields = [];
  Object.keys(fields).forEach(fieldName => {
    const fieldNodes = fields[fieldName];
    const fieldPath = addPath(path, fieldName);
    const fieldResult$ = resolveField(
      exeContext,
      parentType,
      sourceValue,
      fieldNodes,
      fieldPath
    );
    // The fieldResult$ might be null due to the field definition is not found
    // without throwing any error. We filter those illegal fieldResult$ to avoid
    // generate any result.
    if (fieldResult$) {
      // `$( result )` -> `$( {[fieldName]: result} )`
      const field$ = fieldResult$.map(result => ({[fieldName]: result}));
      resolvedFields.push(field$);
    }
  });

  if (resolvedFields.length === 0) {
    // !!!: we haven't tested when the fields is an empty object.
    // We try to give the finalResults a default value if it completes without
    // emitting any next value. The final results will always be an object for
    // the query field. The default result is an empty object.
    return Most.of({});
  }

  // Let `processFields` callback decides how to execute and assemble the
  // results of Observables.
  // `Array< $( {[fieldName]: result} )>` -> `$(Array< {[fieldName]: result} >)`
  const assembledResult = processFields(resolvedFields);

  // `$(Array< {[fieldName]: result} >)` -> `$(Object{ [fieldName]: result })`
  return assembledResult
    // Convert the field results (array) to a total result (object) by `reduce`.
    .map(fieldResults =>
      fieldResults.reduce((results, fieldResult) => {
        return Object.assign(results, fieldResult);
      }, {})
    );
}

/**
 * Resolves the field on the given source object. In particular, this
 * figures out the value that the field returns by calling its resolve function,
 * then calls completeValue to complete observables, serialize scalars, or
 * execute the sub-selection-set for objects.
 */
function resolveField(
  exeContext: ExecutionContext,
  parentType: GraphQLObjectType,
  source: mixed,
  fieldNodes: Array<FieldNode>,
  path: ResponsePath
) {
  const fieldNode = fieldNodes[0];
  const fieldName = fieldNode.name.value;

  const fieldDef = getFieldDef(exeContext.schema, parentType, fieldName);
  if (!fieldDef) {
    // Return null to skip resolve this field.
    return null;
  }

  const returnType = fieldDef.type;
  const resolveFn = fieldDef.resolve || defaultFieldResolver;

  // The resolve function's optional third argument is a context value that
  // is provided to every resolve function within an execution. It is commonly
  // used to represent an authenticated user, or request-specific caches.
  const context = exeContext.contextValue;

  // The resolve function's optional fourth argument is a collection of
  // information about the current execution state.
  const info: GraphQLResolveInfo = {
    fieldName,
    fieldNodes,
    returnType,
    parentType,
    path,
    schema: exeContext.schema,
    fragments: exeContext.fragments,
    rootValue: exeContext.rootValue,
    operation: exeContext.operation,
    variableValues: exeContext.variableValues,
  };

  const descriptor: ExecutionDescriptor = {
    exeContext,
    fieldNodes,
    info,
  };

  // Defer the resolveFn part. It will only be triggered when the Observable is
  // subscribed.
  return Most.empty().continueWith(() => {
    // Get the resolve function, regardless of if its result is normal
    // or abrupt (error).
    const result = resolveOrError(
      exeContext,
      fieldDef,
      fieldNode,
      resolveFn,
      source,
      context,
      info
    );

    return completeResolvedValue(
      descriptor,
      path,
      returnType,
      result
    );
  });
}

// This is a small wrapper around completeValue which catch and annotate errors.
// If the field type is nullable, we resolve a null value for this field and .
// log it in the execution context.
function completeResolvedValue(
  descriptor: ExecutionDescriptor,
  path: ResponsePath,
  returnType: GraphQLType,
  result: mixed
) {
  return completeValue(descriptor, path, returnType, result)
    .recoverWith(error => {
      // Annotates errors with location information.
      const pathKeys = responsePathAsArray(path);
      const annotated = locatedError(error, descriptor.fieldNodes, pathKeys);

      if (returnType instanceof GraphQLNonNull) {
        // If the field type is non-nullable, then it is resolved without any
        // protection from errors, however it still properly locates the error.
        return Most.throwError(annotated);
      }

      // Otherwise, error protection is applied, logging the error and
      // resolving a null value for this field if one is encountered.
      descriptor.exeContext.errors.push(annotated);
      console.log(`push annotated error: ${annotated}`);
      return Most.of(null);
    });
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
 * If the field is an abstract type, determine the runtime type of the value
 * and then complete based on that type
 *
 * Otherwise, the field type expects a sub-selection set, and will complete the
 * value by evaluating all sub-selections.
 */
function completeValue(
  descriptor: ExecutionDescriptor,
  path: ResponsePath,
  returnType: GraphQLType,
  result: mixed
) {
  // If result is a Promise, apply-lift over completeValue.
  if (isThenable(result)) {
    return completePromiseValue(descriptor, path, returnType, result);
  }

  // If result is an Error, throw a located error.
  if (result instanceof Error) {
    return Most.throwError(result);
  }

  // If field type is NonNull, complete for inner type, and throw field error
  // if result is null.
  if (returnType instanceof GraphQLNonNull) {
    return completeNonNullValue(descriptor, path, returnType, result);
  }

  // If result value is null-ish (null, undefined, or NaN) then return null.
  if (isNullish(result)) {
    return Most.of(null);
  }

  // If field type is List, complete each item in the list with the inner type
  if (returnType instanceof GraphQLList) {
    return completeListValue(descriptor, path, returnType, result);
  }

  // If field type is a leaf type, Scalar or Enum, serialize to a valid value,
  // returning null if serialization is not possible.
  if (returnType instanceof GraphQLScalarType ||
      returnType instanceof GraphQLEnumType) {
    return completeLeafValue(returnType, result);
  }

  // If field type is an abstract type, Interface or Union, determine the
  // runtime Object type and complete for that type.
  if (returnType instanceof GraphQLInterfaceType ||
      returnType instanceof GraphQLUnionType) {
    return completeAbstractValue(descriptor, path, returnType, result);
  }

  // If field type is Object, execute and complete all sub-selections.
  if (returnType instanceof GraphQLObjectType) {
    return completeObjectValue(descriptor, path, returnType, result);
  }

  // Not reachable. All possible output types have been considered.
  return Most.throwError(new Error(
    `Cannot complete value of unexpected type "${String(returnType)}".`
  ));
}

function completePromiseValue(
  descriptor: ExecutionDescriptor,
  path: ResponsePath,
  returnType: GraphQLType,
  result: Promise<mixed>
) {
  return (onNext, onError, onComplete) => {
    result.then(resolved => {
      completeValue(descriptor, path, returnType, resolved)
        (onNext, onError, onComplete);
    }, onError);
  };
}

function completeNonNullValue(
  descriptor: ExecutionDescriptor,
  path: ResponsePath,
  returnType: GraphQLNonNull,
  result: mixed
) {
  return (onNext, onError, onComplete) => {
    const onCheckNextValue = value => {
      if (value === null) {
        return onError(new Error(
          `Cannot return null for non-nullable field ${
            descriptor.info.parentType.name}.${descriptor.info.fieldName}.`
        ));
      }
      return onNext(value);
    }

    return completeValue(descriptor, path, returnType.ofType, result)
      (onCheckNextValue, onError, onComplete);
  };
}


/**
 * Complete a list value by completing each item in the list with the
 * inner type
 */
function completeListValue(
  descriptor: ExecutionDescriptor,
  path: ResponsePath,
  returnType: GraphQLList<*>,
  result: mixed
) {
  // !!!: We are using `Most.of()` for the result.
  // `Most.of()` might not support other collection types which the library
  // 'iterall' supports.
  // This conditional test might not be useful.
  if (!isCollection(result)) {
    return (onNext, onError, onComplete) => {
      onError(new Error(
        `Expected Iterable, but did not find one for field ${
          descriptor.info.parentType.name}.${descriptor.info.fieldName}.`
      ));
    }
  }

  const itemType = returnType.ofType;
  const streamList = [];
  forEach(result, (item, index) => {
    // No need to modify the info object containing the path,
    // since from here on it is not ever accessed by resolver functions.
    const fieldPath = addPath(path, index);
    const completedItem = completeResolvedValue(
      descriptor,
      fieldPath,
      itemType,
      item
    );
    streamList.push(completedItem);
  });

  if (streamList.length === 0) {
    return Most.of([]);
  }

  return Most.combineArray((...values) => [ ...values ], streamList);
}

/**
 * Complete a Scalar or Enum by serializing to a valid value, returning
 * null if serialization is not possible.
 */
function completeLeafValue(
  returnType: GraphQLLeafType,
  result: mixed
) {
  if (!returnType.serialize) {
    return Most.throwError(new Error(
      `Missing serialize method on type "${String(returnType)}"`
    ));
  }

  const serializedResult = returnType.serialize(result);

  if (isNullish(serializedResult)) {
    return Most.throwError(new Error(
      `Expected a value of type "${String(returnType)}" but received: ${
        String(result)}`
    ));
  }
  return Most.of(serializedResult);
}

/**
 * Complete a value of an abstract type by determining the runtime object type
 * of that value, then complete the value for that type.
 */
function completeAbstractValue(
  descriptor: ExecutionDescriptor,
  path: ResponsePath,
  returnType: GraphQLAbstractType,
  result: mixed
) {
  const { exeContext, fieldNodes, info } = descriptor;
  let runtimeType = returnType.resolveType ?
    returnType.resolveType(result, exeContext.contextValue, info) :
    defaultResolveTypeFn(result, exeContext.contextValue, info, returnType);

  // If resolveType returns a string, we assume it's a GraphQLObjectType name.
  if (typeof runtimeType === 'string') {
    runtimeType = exeContext.schema.getType(runtimeType);
  }

  if (!(runtimeType instanceof GraphQLObjectType)) {
    return Most.throwError(new GraphQLError(
      `Abstract type ${returnType.name} must resolve to an Object type at ` +
      `runtime for field ${info.parentType.name}.${info.fieldName} with ` +
      `value "${String(result)}", received "${String(runtimeType)}".`,
      fieldNodes
    ));
  }

  if (!exeContext.schema.isPossibleType(returnType, runtimeType)) {
    return Most.throwError(new GraphQLError(
      `Runtime Object type "${runtimeType.name}" is not a possible type ` +
      `for "${returnType.name}".`,
      fieldNodes
    ));
  }

  return completeObjectValue(descriptor, path, runtimeType, result);
}

/**
 * Complete an Object value by executing all sub-selections.
 */
function completeObjectValue(
  descriptor: ExecutionDescriptor,
  path: ResponsePath,
  returnType: GraphQLObjectType,
  result: mixed
) {
  const { exeContext, fieldNodes, info } = descriptor;
  // If there is an isTypeOf predicate function, call it with the
  // current result. If isTypeOf returns false, then raise an error rather
  // than continuing execution.
  if (returnType.isTypeOf &&
      !returnType.isTypeOf(result, exeContext.contextValue, info)) {
    return Most.throwError(new GraphQLError(
      `Expected value of type "${returnType.name}" but got: ${String(result)}.`,
      fieldNodes
    ));
  }

  // Collect sub-fields to execute to complete this value.
  let subFieldNodes = Object.create(null);
  const visitedFragmentNames = Object.create(null);
  for (let i = 0; i < fieldNodes.length; i++) {
    const selectionSet = fieldNodes[i].selectionSet;
    if (selectionSet) {
      subFieldNodes = collectFields(
        exeContext,
        returnType,
        selectionSet,
        subFieldNodes,
        visitedFragmentNames
      );
    }
  }

  return executeFields(exeContext, returnType, result, path, subFieldNodes);
}




// -----------------------------------------------------------------------------
// unmodified helper functions (in execute.js)
// -----------------------------------------------------------------------------

/**
 * Given a ResponsePath (found in the `path` entry in the information provided
 * as the last argument to a field resolver), return an Array of the path keys.
 */
export function responsePathAsArray(
  path: ResponsePath
): Array<string | number> {
  const flattened = [];
  let curr = path;
  while (curr) {
    flattened.push(curr.key);
    curr = curr.prev;
  }
  return flattened.reverse();
}


function addPath(prev: ResponsePath, key: string | number) {
  return { prev, key };
}

/**
 * Constructs a ExecutionContext object from the arguments passed to
 * execute, which we will pass throughout the other execution methods.
 *
 * Throws a GraphQLError if a valid execution context cannot be created.
 */
function buildExecutionContext(
  schema: GraphQLSchema,
  document: DocumentNode,
  rootValue: mixed,
  contextValue: mixed,
  rawVariableValues: ?{[key: string]: mixed},
  operationName: ?string
): ExecutionContext {
  const errors: Array<GraphQLError> = [];
  let operation: ?OperationDefinitionNode;
  const fragments: {[name: string]: FragmentDefinitionNode} =
    Object.create(null);
  document.definitions.forEach(definition => {
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
        [ definition ]
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

  return {
    schema,
    fragments,
    rootValue,
    contextValue,
    operation,
    variableValues,
    errors
  };
}

/**
 * Extracts the root type of the operation from the schema.
 */
function getOperationRootType(
  schema: GraphQLSchema,
  operation: OperationDefinitionNode
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
  selectionSet: SelectionSetNode,
  fields: {[key: string]: Array<FieldNode>},
  visitedFragmentNames: {[key: string]: boolean}
): {[key: string]: Array<FieldNode>} {
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
  directives: ?Array<DirectiveNode>
): boolean {
  const skipNode = directives && find(
    directives,
    directive => directive.name.value === GraphQLSkipDirective.name
  );
  if (skipNode) {
    const { if: skipIf } = getArgumentValues(
      GraphQLSkipDirective,
      skipNode,
      exeContext.variableValues
    );
    if (skipIf === true) {
      return false;
    }
  }

  const includeNode = directives && find(
    directives,
    directive => directive.name.value === GraphQLIncludeDirective.name
  );
  if (includeNode) {
    const { if: includeIf } = getArgumentValues(
      GraphQLIncludeDirective,
      includeNode,
      exeContext.variableValues
    );
    if (includeIf === false) {
      return false;
    }
  }

  return true;
}

/**
 * Determines if a fragment is applicable to the given type.
 */
function doesFragmentConditionMatch(
  exeContext: ExecutionContext,
  fragment: FragmentDefinitionNode | InlineFragmentNode,
  type: GraphQLObjectType
): boolean {
  const typeConditionNode = fragment.typeCondition;
  if (!typeConditionNode) {
    return true;
  }
  const conditionalType = typeFromAST(exeContext.schema, typeConditionNode);
  if (conditionalType === type) {
    return true;
  }
  if (isAbstractType(conditionalType)) {
    const abstractType = ((conditionalType: any): GraphQLAbstractType);
    return exeContext.schema.isPossibleType(abstractType, type);
  }
  return false;
}

/**
 * Implements the logic to compute the key of a given field's entry
 */
function getFieldEntryKey(node: FieldNode): string {
  return node.alias ? node.alias.value : node.name.value;
}

// Isolates the "ReturnOrAbrupt" behavior to not de-opt the `resolveField`
// function. Returns the result of resolveFn or the abrupt-return Error object.
function resolveOrError<TSource, TContext>(
  exeContext: ExecutionContext,
  fieldDef: GraphQLField<TSource, TContext>,
  fieldNode: FieldNode,
  resolveFn: GraphQLFieldResolver<TSource, TContext>,
  source: TSource,
  context: TContext,
  info: GraphQLResolveInfo
): Error | mixed {
  try {
    // Build a JS object of arguments from the field.arguments AST, using the
    // variables scope to fulfill any variable references.
    // TODO: find a way to memoize, in case this field is within a List type.
    const args = getArgumentValues(
      fieldDef,
      fieldNode,
      exeContext.variableValues
    );

    return resolveFn(source, args, context, info);
  } catch (error) {
    // Sometimes a non-error is thrown, wrap it as an Error for a
    // consistent interface.
    return error instanceof Error ? error : new Error(error);
  }
}

/**
 * If a resolveType function is not given, then a default resolve behavior is
 * used which tests each possible type for the abstract type by calling
 * isTypeOf for the object being coerced, returning the first type that matches.
 */
function defaultResolveTypeFn(
  value: mixed,
  context: mixed,
  info: GraphQLResolveInfo,
  abstractType: GraphQLAbstractType
): ?GraphQLObjectType {
  const possibleTypes = info.schema.getPossibleTypes(abstractType);
  for (let i = 0; i < possibleTypes.length; i++) {
    const type = possibleTypes[i];
    if (type.isTypeOf && type.isTypeOf(value, context, info)) {
      return type;
    }
  }
}

/**
 * If a resolve function is not given, then a default resolve behavior is used
 * which takes the property of the source object of the same name as the field
 * and returns it as the result, or if it's a function, returns the result
 * of calling that function while passing along args and context.
 */
export const defaultFieldResolver: GraphQLFieldResolver<any, *> =
function (source, args, context, info) {
  // ensure source is a value for which property access is acceptable.
  if (typeof source === 'object' || typeof source === 'function') {
    const property = source[info.fieldName];
    if (typeof property === 'function') {
      return source[info.fieldName](args, context, info);
    }
    return property;
  }
};

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
): ?GraphQLField<*, *> {
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
