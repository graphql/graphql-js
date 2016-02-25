/* @flow */
/**
 *  Copyright (c) 2015, Facebook, Inc.
 *  All rights reserved.
 *
 *  This source code is licensed under the BSD-style license found in the
 *  LICENSE file in the root directory of this source tree. An additional grant
 *  of patent rights can be found in the PATENTS file in the same directory.
 */
import { GraphQLError } from '../error';
import { GraphQLSchema } from '../type/schema';
import { ExecutionContext } from './context';
import { Kind } from '../language';
import find from '../jsutils/find';
import { getArgumentValues } from './values';
import { typeFromAST } from '../utilities/typeFromAST';
import {
  GraphQLObjectType,
  GraphQLAbstractType,
  GraphQLResolveInfo,
  GraphQLFieldDefinition,
  GraphQLOutputType,
  isAbstractType
} from '../type/definition';
import {
  GraphQLIncludeDirective,
  GraphQLSkipDirective
} from '../type/directives';
import type {
  Directive,
  OperationDefinition,
  SelectionSet,
  InlineFragment,
  Field,
  FragmentDefinition
} from '../language/ast';
import {
  SchemaMetaFieldDef,
  TypeMetaFieldDef,
  TypeNameMetaFieldDef
} from '../type/introspection';

/**
 */
export type FieldResolvingPlan = {
    resolveFn: mixed;
    args: { [key: string]: mixed },
    info: GraphQLResolveInfo;
    returnType: GraphQLOutputType;
    fieldASTs: Array<Field>;
}

/**
 */
export type OperationExecutionPlan = {
	type: GraphQLObjectType;
	fields: {[key: string]: Array<Field>};
	strategy: string;
	fieldPlans: {[key: string]: FieldResolvingPlan};
}

/**
 * Create a plan based on the "Evaluating operations" section of the spec.
 */
export function planOperation(
  exeContext: ExecutionContext,
  operation: OperationDefinition
): OperationExecutionPlan {
  const type = getOperationRootType(exeContext.schema, operation);
  const fields = collectFields(
    exeContext,
    type,
    operation.selectionSet,
    Object.create(null),
    Object.create(null)
  );
  const strategy = (operation.operation === 'mutation') ? 'serial' : 'parallel';

  const fieldPlans = planFields(exeContext, type, fields);

  const plan: OperationExecutionPlan = {
    type,
    fields,
    strategy,
    fieldPlans
  };

  return plan;
}

/**
 * Implements the "Evaluating selection sets" section of the spec
 */
function planFields(
  exeContext: ExecutionContext,
  parentType: GraphQLObjectType,
  fields: {[key: string]: Array<Field>}
): {[key: string]: FieldResolvingPlan} {
/*
  const finalResults = Object.keys(fields).reduce(
    (results, responseName) => {
      const fieldASTs = fields[responseName];
      const result = planResolveField(
        exeContext,
        parentType,
        fieldASTs
      );
      results[responseName] = result;
    },
    Object.create(null)
  );
  return finalResults;
*/
  const results = Object.create(null);
  Object.keys(fields).forEach(
    responseName => {
      const fieldASTs = fields[responseName];
      const result = planResolveField(
        exeContext,
        parentType,
        fieldASTs
      );
      if (result !== undefined) {
        results[responseName] = result;
      }
    }
  );
  return results;
}

/**
 * Plan how to a field.
 */
function planResolveField(
  exeContext: ExecutionContext,
  parentType: GraphQLObjectType,
  fieldASTs: Array<Field>
): ?FieldResolvingPlan {
  const fieldAST = fieldASTs[0];
  const fieldName = fieldAST.name.value;

  const fieldDef = getFieldDef(exeContext.schema, parentType, fieldName);
  if (!fieldDef) {
    // @TODO is it intentional that this fails silently?  Should note that
    return;
  }

  const returnType = fieldDef.type;
  const resolveFn = fieldDef.resolve || defaultResolveFn;

  // Build a JS object of arguments from the field.arguments AST, using the
  // variables scope to fulfill any variable references.
  const args = getArgumentValues(
    fieldDef.args,
    fieldAST.arguments,
    exeContext.variableValues
  );

  // The resolve function's optional third argument is a collection of
  // information about the current execution state.
  const info: GraphQLResolveInfo = {
    fieldName,
    fieldASTs,
    returnType,
    parentType,
    schema: exeContext.schema,
    fragments: exeContext.fragments,
    rootValue: exeContext.rootValue,
    operation: exeContext.operation,
    variableValues: exeContext.variableValues,
  };

  const plan: FieldResolvingPlan = {
    resolveFn,
    args,
    info,
    returnType,
    fieldASTs
  };

  return plan;
}


/**
 * Extracts the root type of the operation from the schema.
 */
export function getOperationRootType(
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
 * Given a selectionSet, adds all of the fields in that selection to
 * the passed in map of fields, and returns it at the end.
 *
 * CollectFields requires the "runtime type" of an object. For a field which
 * returns and Interface or Union type, the "runtime type" will be the actual
 * Object type returned by that field.
 */
export function collectFields(
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
 * Implements the logic to compute the key of a given field’s entry
 */
function getFieldEntryKey(node: Field): string {
  return node.alias ? node.alias.value : node.name.value;
}

/**
 * If a resolve function is not given, then a default resolve behavior is used
 * which takes the property of the source object of the same name as the field
 * and returns it as the result, or if it's a function, returns the result
 * of calling that function.
 */
export function defaultResolveFn(
  source:mixed,
  args:{ [key: string]: mixed },
  info: GraphQLResolveInfo
) {
  const fieldName = info.fieldName;

  // ensure source is a value for which property access is acceptable.
  if (typeof source !== 'number' && typeof source !== 'string' && source) {
    const property = (source: any)[fieldName];
    return typeof property === 'function' ? property.call(source) : property;
  }
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
export function getFieldDef(
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
