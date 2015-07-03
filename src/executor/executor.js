/* @flow */
/**
 *  Copyright (c) 2015, Facebook, Inc.
 *  All rights reserved.
 *
 *  This source code is licensed under the BSD-style license found in the
 *  LICENSE file in the root directory of this source tree. An additional grant
 *  of patent rights can be found in the PATENTS file in the same directory.
 */

import { GraphQLError, formatError } from '../error';
import type { GraphQLFormattedError } from '../error';
import invariant from '../utils/invariant';
import typeFromAST from '../utils/typeFromAST';
import isNullish from '../utils/isNullish';
import { Kind } from '../language';
import {
  getVariableValues,
  getArgumentValues,
  getDirectiveValue
} from './values';
import {
  GraphQLScalarType,
  GraphQLObjectType,
  GraphQLInterfaceType,
  GraphQLUnionType,
  GraphQLEnumType,
  GraphQLList,
  GraphQLNonNull
} from '../type/definition';
import type {
  GraphQLFieldDefinition,
  GraphQLType
} from '../type/definition';
import type { GraphQLSchema } from '../type/schema';
import {
  SchemaMetaFieldDef,
  TypeMetaFieldDef,
  TypeNameMetaFieldDef
} from '../type/introspection';
import {
  GraphQLIfDirective,
  GraphQLUnlessDirective
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
 * "Selections" are the statements that can appear legally and at
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
  fragments: {[key: string]: FragmentDefinition};
  root: Object;
  operation: OperationDefinition;
  variables: {[key: string]: any};
  errors: Array<Error>;
}

/**
 * The result of execution. `data` is the result of executing the
 * query, `errors` is null if no errors occurred, and is a
 * non-empty array if an error occurred.
 */
type ExecutionResult = {
  data: ?Object;
  errors?: Array<GraphQLFormattedError>;
}

/**
 * Implements the "Evaluating requests" section of the spec.
 */
export function execute(
  schema: GraphQLSchema,
  root: any,
  ast: Document,
  operationName?: ?string,
  args?: ?{[key: string]: string}
): Promise<ExecutionResult> {
  invariant(schema, 'Must provide schema');
  var errors = [];

  return new Promise(resolve => {
    var exeContext =
      buildExecutionContext(schema, root, ast, operationName, args, errors);
    resolve(
      executeOperation(
        exeContext,
        root,
        exeContext.operation
      )
    );
  }).catch(error => {
    errors.push(error);
    return null;
  }).then(data => {
    if (!errors.length) {
      return { data };
    }
    return {
      data: data,
      errors: errors.map(formatError)
    };
  });
}

/**
 * Constructs a ExecutionContext object from the arguments passed to
 * execute, which we will pass throughout the other execution methods.
 */
function buildExecutionContext(
  schema: GraphQLSchema,
  root: Object,
  ast: Document,
  operationName?: ?string,
  args?: ?{[key: string]: string},
  errors: Array<Error>
): ExecutionContext {
  var operations: {[name: string]: OperationDefinition} = {};
  var fragments: {[name: string]: FragmentDefinition} = {};
  ast.definitions.forEach(statement => {
    switch (statement.kind) {
      case Kind.OPERATION_DEFINITION:
        operations[statement.name ? statement.name.value : ''] = statement;
        break;
      case Kind.FRAGMENT_DEFINITION:
        fragments[statement.name.value] = statement;
        break;
    }
  });
  if (!operationName && Object.keys(operations).length !== 1) {
    throw new GraphQLError(
      'Must provide operation name if query contains multiple operations'
    );
  }
  var opName = operationName || Object.keys(operations)[0];
  var operation = operations[opName];
  if (!operation) {
    throw new GraphQLError(
      'Unknown operation name: ' + opName
    );
  }
  var variables = getVariableValues(
    schema,
    operation.variableDefinitions || [],
    args || {}
  );
  var exeContext: ExecutionContext =
    { schema, fragments, root, operation, variables, errors };
  return exeContext;
}

/**
 * Implements the "Evaluating operations" section of the spec.
 */
function executeOperation(
  exeContext: ExecutionContext,
  root: Object,
  operation: OperationDefinition
): Object {
  var type = getOperationRootType(exeContext.schema, operation);
  var fields = collectFields(exeContext, type, operation.selectionSet, {}, {});
  if (operation.operation === 'mutation') {
    return executeFieldsSerially(exeContext, type, root, fields);
  }
  return executeFields(exeContext, type, root, fields);
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
      var mutationType = schema.getMutationType();
      if (!mutationType) {
        throw new GraphQLError(
          'Schema is not configured for mutations',
          [operation]
        );
      }
      return mutationType;
    default:
      throw new GraphQLError(
        'Can only execute queries and mutations',
        [operation]
      );
  }
}

/**
 * Implements the "Evaluating selection sets" section of the spec
 * for "write" mode.
 */
function executeFieldsSerially(
  exeContext: ExecutionContext,
  parentType: GraphQLObjectType,
  source: Object,
  fields: {[key: string]: Array<Field>}
): Promise<Object> {
  return Object.keys(fields).reduce(
    (prevPromise, responseName) => prevPromise.then((results) => {
      var fieldASTs = fields[responseName];
      var result = resolveField(exeContext, parentType, source, fieldASTs);
      if (result === undefined) {
        return results;
      }
      if (isThenable(result)) {
        return result.then(resolvedResult => {
          results[responseName] = resolvedResult;
          return results;
        });
      } else {
        results[responseName] = result;
      }
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
  parentType: GraphQLObjectType,
  source: Object,
  fields: {[key: string]: Array<Field>}
): Object {
  var containsPromise = false;

  var finalResults = Object.keys(fields).reduce(
    (results, responseName) => {
      var fieldASTs = fields[responseName];
      var result = resolveField(exeContext, parentType, source, fieldASTs);
      if (result === undefined) {
        return results;
      }
      results[responseName] = result;
      if (isThenable(result)) {
        containsPromise = true;
      }
      return results;
    },
    {}
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
 */
function collectFields(
  exeContext: ExecutionContext,
  type: GraphQLObjectType,
  selectionSet: SelectionSet,
  fields: {[key: string]: Array<Field>},
  visitedFragmentNames: {[key: string]: boolean}
): {[key: string]: Array<Field>} {
  for (var i = 0; i < selectionSet.selections.length; i++) {
    var selection = selectionSet.selections[i];
    switch (selection.kind) {
      case Kind.FIELD:
        if (!shouldIncludeNode(exeContext, selection.directives)) {
          continue;
        }
        var name = getFieldEntryKey(selection);
        if (!fields[name]) {
          fields[name] = [];
        }
        fields[name].push(selection);
        break;
      case Kind.INLINE_FRAGMENT:
        if (!shouldIncludeNode(exeContext, selection.directives) ||
            !doesFragmentConditionMatch(exeContext, selection, type)) {
          continue;
        }
        collectFields(
          exeContext,
          type,
          selection.selectionSet,
          fields,
          visitedFragmentNames
        );
        break;
      case Kind.FRAGMENT_SPREAD:
        var fragName = selection.name.value;
        if (visitedFragmentNames[fragName] ||
            !shouldIncludeNode(exeContext, selection.directives)) {
          continue;
        }
        visitedFragmentNames[fragName] = true;
        var fragment = exeContext.fragments[fragName];
        if (!fragment ||
            !shouldIncludeNode(exeContext, fragment.directives) ||
            !doesFragmentConditionMatch(exeContext, fragment, type)) {
          continue;
        }
        collectFields(
          exeContext,
          type,
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
 * Determines if a field should be included based on @if and @unless directives.
 */
function shouldIncludeNode(
  exeContext: ExecutionContext,
  directives: ?Array<Directive>
): boolean {
  var ifDirective =
    getDirectiveValue(GraphQLIfDirective, directives, exeContext.variables);
  if (ifDirective !== undefined) {
    return ifDirective;
  }

  var unlessDirective =
    getDirectiveValue(GraphQLUnlessDirective, directives, exeContext.variables);
  if (unlessDirective !== undefined) {
    return !unlessDirective;
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
  var conditionalType = typeFromAST(exeContext.schema, fragment.typeCondition);
  if (conditionalType === type) {
    return true;
  }
  if (conditionalType instanceof GraphQLInterfaceType ||
      conditionalType instanceof GraphQLUnionType) {
    return conditionalType.isPossibleType(type);
  }
  return false;
}

/**
 * A wrapper around Promise.all that operates on an object rather than an
 * iterable.
 *
 * Effectively, this method transforms a `Map<string, Promise<T>>` into
 * a `Promise<Map<string, T>>`, in the same way that `Promise.all` transforms
 * a `Array<Promise<T>>` into a `Promise<Array<T>>`.
 *
 * This is akin to bluebird's `Promise.props`, but implemented only using
 * `Promise.all` so it will work with any implementation of ES6 promises.
 */
function promiseForObject(
  object: Object
): Promise<Object> {
  var keys = Object.keys(object);
  var valuesAndPromises = keys.map(name => object[name]);
  return Promise.all(valuesAndPromises).then(
    values => values.reduce((resolvedObject, value, i) => {
      resolvedObject[keys[i]] = value;
      return resolvedObject;
    }, {})
  );
}

/**
 * Implements the logic to compute the key of a given field’s entry
 */
function getFieldEntryKey(node: Field): string {
  return node.alias ? node.alias.value : node.name.value;
}

/**
 * A wrapper function for resolving the field, that catches the error
 * and adds it to the context's global if the error is not rethrowable.
 */
function resolveField(
  exeContext: ExecutionContext,
  parentType: GraphQLObjectType,
  source: Object,
  fieldASTs: Array<Field>
): any {
  var fieldDef = getFieldDef(exeContext.schema, parentType, fieldASTs[0]);
  if (!fieldDef) {
    return;
  }

  // If the field type is non-nullable, then it is resolved without any
  // protection from errors.
  if (fieldDef.type instanceof GraphQLNonNull) {
    return resolveFieldOrError(
      exeContext,
      parentType,
      source,
      fieldASTs,
      fieldDef
    );
  }

  // Otherwise, error protection is applied, logging the error and resolving
  // a null value for this field if one is encountered.
  try {
    var result = resolveFieldOrError(
      exeContext,
      parentType,
      source,
      fieldASTs,
      fieldDef
    );
    if (isThenable(result)) {
      return result.then(undefined, error => {
        exeContext.errors.push(error);
        return Promise.resolve(null);
      });
    }
    return result;
  } catch (error) {
    exeContext.errors.push(error);
    return null;
  }
}

/**
 * Resolves the field on the given source object. In particular, this
 * figures out the object that the field returns using the resolve function,
 * then calls completeField to coerce scalars or execute the sub
 * selection set for objects.
 */
function resolveFieldOrError(
  exeContext: ExecutionContext,
  parentType: GraphQLObjectType,
  source: Object,
  fieldASTs: Array<Field>,
  fieldDef: GraphQLFieldDefinition
): any {
  var fieldAST = fieldASTs[0];
  var fieldType = fieldDef.type;
  var resolveFn = fieldDef.resolve || defaultResolveFn;

  // Build a JS object of arguments from the field.arguments AST, using the
  // variables scope to fulfill any variable references.
  // TODO: find a way to memoize, in case this field is within a Array type.
  var args = getArgumentValues(
    fieldDef.args,
    fieldAST.arguments,
    exeContext.variables
  );

  try {
    var result = resolveFn(
      source,
      args,
      exeContext.root,
      // TODO: provide all fieldASTs, not just the first field
      fieldAST,
      fieldType,
      parentType,
      exeContext.schema
    );
  } catch (error) {
    throw new GraphQLError(error.message, [fieldAST], error.stack);
  }

  if (isThenable(result)) {
    return result.then(
      resolvedResult => completeField(
        exeContext,
        fieldType,
        fieldASTs,
        resolvedResult
      ),
      error => Promise.reject(
        new GraphQLError(error.message, [fieldAST], error.stack)
      )
    );
  }

  return completeField(
    exeContext,
    fieldType,
    fieldASTs,
    result
  );
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
 * value of the type by calling the `coerce` method of GraphQL type definition.
 *
 * Otherwise, the field type expects a sub-selection set, and will complete the
 * value by evaluating all sub-selections.
 */
function completeField(
  exeContext: ExecutionContext,
  fieldType: GraphQLType,
  fieldASTs: Array<Field>,
  result: any
): any {
  // If field type is NonNull, complete for inner type, and throw field error
  // if result is null.
  if (fieldType instanceof GraphQLNonNull) {
    var completed = completeField(
      exeContext,
      fieldType.ofType,
      fieldASTs,
      result
    );
    if (completed === null) {
      throw new GraphQLError(
        'Cannot return null for non-nullable type.',
        fieldASTs
      );
    }
    return completed;
  }

  // If result is null-like, return null.
  if (isNullish(result)) {
    return null;
  }

  // If field type is List, complete each item in the list with the inner type
  if (fieldType instanceof GraphQLList) {
    var itemType = fieldType.ofType;
    invariant(
      Array.isArray(result),
      'User Error: expected iterable, but did not find one.'
    );
    var results = result.map(item => completeField(
      exeContext,
      itemType,
      fieldASTs,
      item
    ));

    if (results.some(isThenable)) {
      return Promise.all(results);
    } else {
      return results;
    }
  }

  // If field type is Scalar or Enum, coerce to a valid value, returning null
  // if coercion is not possible.
  if (fieldType instanceof GraphQLScalarType ||
      fieldType instanceof GraphQLEnumType) {
    invariant(fieldType.coerce, 'Missing coerce method on type');
    var coercedResult = fieldType.coerce(result);
    return isNullish(coercedResult) ? null : coercedResult;
  }

  // Field type must be Object, Interface or Union and expect sub-selections.

  var objectType: ?GraphQLObjectType =
    fieldType instanceof GraphQLObjectType ? fieldType :
    fieldType instanceof GraphQLInterfaceType ||
    fieldType instanceof GraphQLUnionType ? fieldType.resolveType(result) :
    null;

  if (!objectType) {
    return null;
  }

  // Collect sub-fields to execute to complete this value.
  var subFieldASTs = {};
  var visitedFragmentNames = {};
  for (var i = 0; i < fieldASTs.length; i++) {
    var selectionSet = fieldASTs[i].selectionSet;
    if (selectionSet) {
      subFieldASTs = collectFields(
        exeContext,
        objectType,
        selectionSet,
        subFieldASTs,
        visitedFragmentNames
      );
    }
  }

  return executeFields(exeContext, objectType, result, subFieldASTs);
}

/**
 * If a resolve function is not given, then a default resolve behavior is used
 * which takes the property of the source object of the same name as the field
 * and returns it as the result, or if it's a function, returns the result
 * of calling that function.
 */
function defaultResolveFn(source, args, root, fieldAST) {
  var property = source[fieldAST.name.value];
  return typeof property === 'function' ? property.call(source) : property;
}

/**
 * Checks to see if this object acts like a Promise, i.e. has a "then"
 * function.
 */
function isThenable(value: any): boolean {
  return value && typeof value === 'object' && typeof value.then === 'function';
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
  fieldAST: Field
): ?GraphQLFieldDefinition {
  var name = fieldAST.name.value;
  if (name === SchemaMetaFieldDef.name &&
      schema.getQueryType() === parentType) {
    return SchemaMetaFieldDef;
  } else if (name === TypeMetaFieldDef.name &&
             schema.getQueryType() === parentType) {
    return TypeMetaFieldDef;
  } else if (name === TypeNameMetaFieldDef.name) {
    return TypeNameMetaFieldDef;
  }
  return parentType.getFields()[name];
}
