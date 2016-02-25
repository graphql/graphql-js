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

/**
 * Create a plan based on the "Evaluating operations" section of the spec.
 */
export function planOperation(
  exeContext: ExecutionContext,
  operation: OperationDefinition
): Object {
  const type = getOperationRootType(exeContext.schema, operation);
  const fields = collectFields(
    exeContext,
    type,
    operation.selectionSet,
    Object.create(null),
    Object.create(null)
  );
  /*
  if (operation.operation === 'mutation') {
  } else {
  }
  */
  return fields; // @TODO Fix
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

