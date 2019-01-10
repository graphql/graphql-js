/**
 * Copyright (c) 2015-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow strict
 */

import { expect } from 'chai';
import { describe, it } from 'mocha';
import invariant from '../../jsutils/invariant';
import { getOperationRootType } from '../getOperationRootType';
import {
  Kind,
  parse,
  GraphQLSchema,
  GraphQLObjectType,
  GraphQLString,
} from '../../';

const queryType = new GraphQLObjectType({
  name: 'FooQuery',
  fields: () => ({
    field: { type: GraphQLString },
  }),
});

const mutationType = new GraphQLObjectType({
  name: 'FooMutation',
  fields: () => ({
    field: { type: GraphQLString },
  }),
});

const subscriptionType = new GraphQLObjectType({
  name: 'FooSubscription',
  fields: () => ({
    field: { type: GraphQLString },
  }),
});

function getOperationNode(doc) {
  const operationNode = doc.definitions[0];
  invariant(operationNode && operationNode.kind === Kind.OPERATION_DEFINITION);
  return operationNode;
}

describe('getOperationRootType', () => {
  it('Gets a Query type for an unnamed OperationDefinitionNode', () => {
    const testSchema = new GraphQLSchema({
      query: queryType,
    });
    const doc = parse('{ field }');
    const operationNode = getOperationNode(doc);
    expect(getOperationRootType(testSchema, operationNode)).to.equal(queryType);
  });

  it('Gets a Query type for an named OperationDefinitionNode', () => {
    const testSchema = new GraphQLSchema({
      query: queryType,
    });

    const doc = parse('query Q { field }');
    const operationNode = getOperationNode(doc);
    expect(getOperationRootType(testSchema, operationNode)).to.equal(queryType);
  });

  it('Gets a type for OperationTypeDefinitionNodes', () => {
    const testSchema = new GraphQLSchema({
      query: queryType,
      mutation: mutationType,
      subscription: subscriptionType,
    });

    const doc = parse(`
      schema {
        query: FooQuery
        mutation: FooMutation
        subscription: FooSubscription
      }
    `);

    const schemaNode = doc.definitions[0];
    invariant(schemaNode && schemaNode.kind === Kind.SCHEMA_DEFINITION);
    const [
      queryNode,
      mutationNode,
      subscriptionNode,
    ] = schemaNode.operationTypes;

    expect(getOperationRootType(testSchema, queryNode)).to.equal(queryType);
    expect(getOperationRootType(testSchema, mutationNode)).to.equal(
      mutationType,
    );
    expect(getOperationRootType(testSchema, subscriptionNode)).to.equal(
      subscriptionType,
    );
  });

  it('Gets a Mutation type for an OperationDefinitionNode', () => {
    const testSchema = new GraphQLSchema({
      mutation: mutationType,
    });

    const doc = parse('mutation { field }');
    const operationNode = getOperationNode(doc);
    expect(getOperationRootType(testSchema, operationNode)).to.equal(
      mutationType,
    );
  });

  it('Gets a Subscription type for an OperationDefinitionNode', () => {
    const testSchema = new GraphQLSchema({
      subscription: subscriptionType,
    });

    const doc = parse('subscription { field }');
    const operationNode = getOperationNode(doc);
    expect(getOperationRootType(testSchema, operationNode)).to.equal(
      subscriptionType,
    );
  });

  it('Throws when query type not defined in schema', () => {
    const testSchema = new GraphQLSchema({});

    const doc = parse('query { field }');
    const operationNode = getOperationNode(doc);
    expect(() => getOperationRootType(testSchema, operationNode)).to.throw(
      'Schema does not define the required query root type.',
    );
  });

  it('Throws when mutation type not defined in schema', () => {
    const testSchema = new GraphQLSchema({});

    const doc = parse('mutation { field }');
    const operationNode = getOperationNode(doc);
    expect(() => getOperationRootType(testSchema, operationNode)).to.throw(
      'Schema is not configured for mutations.',
    );
  });

  it('Throws when subscription type not defined in schema', () => {
    const testSchema = new GraphQLSchema({});

    const doc = parse('subscription { field }');
    const operationNode = getOperationNode(doc);
    expect(() => getOperationRootType(testSchema, operationNode)).to.throw(
      'Schema is not configured for subscriptions.',
    );
  });

  it('Throws when operation not a valid operation kind', () => {
    const testSchema = new GraphQLSchema({});

    const doc = parse('{ field }');
    const operationNode = {
      ...getOperationNode(doc),
      // $DisableFlowOnNegativeTest
      operation: 'non_existent_operation',
    };
    expect(() => getOperationRootType(testSchema, operationNode)).to.throw(
      'Can only have query, mutation and subscription operations.',
    );
  });
});
