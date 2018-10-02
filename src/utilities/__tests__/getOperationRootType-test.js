/**
 * Copyright (c) 2015-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @noflow
 */

import { expect } from 'chai';
import { describe, it } from 'mocha';
import { getOperationRootType } from '../getOperationRootType';
import { parse, GraphQLSchema, GraphQLObjectType, GraphQLString } from '../../';

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

describe('getOperationRootType', () => {
  it('Gets a Query type for an unnamed OperationDefinitionNode', () => {
    const testSchema = new GraphQLSchema({
      query: queryType,
    });
    const doc = parse('{ field }');
    expect(getOperationRootType(testSchema, doc.definitions[0])).to.equal(
      queryType,
    );
  });

  it('Gets a Query type for an named OperationDefinitionNode', () => {
    const testSchema = new GraphQLSchema({
      query: queryType,
    });

    const doc = parse('query Q { field }');
    expect(getOperationRootType(testSchema, doc.definitions[0])).to.equal(
      queryType,
    );
  });

  it('Gets a type for OperationTypeDefinitionNodes', () => {
    const testSchema = new GraphQLSchema({
      query: queryType,
      mutation: mutationType,
      subscription: subscriptionType,
    });

    const doc = parse(
      'schema { query: FooQuery mutation: FooMutation subscription: FooSubscription }',
    );
    const operationTypes = doc.definitions[0].operationTypes;
    expect(getOperationRootType(testSchema, operationTypes[0])).to.equal(
      queryType,
    );
    expect(getOperationRootType(testSchema, operationTypes[1])).to.equal(
      mutationType,
    );
    expect(getOperationRootType(testSchema, operationTypes[2])).to.equal(
      subscriptionType,
    );
  });

  it('Gets a Mutation type for an OperationDefinitionNode', () => {
    const testSchema = new GraphQLSchema({
      mutation: mutationType,
    });

    const doc = parse('mutation { field }');
    expect(getOperationRootType(testSchema, doc.definitions[0])).to.equal(
      mutationType,
    );
  });

  it('Gets a Subscription type for an OperationDefinitionNode', () => {
    const testSchema = new GraphQLSchema({
      subscription: subscriptionType,
    });

    const doc = parse('subscription { field }');
    expect(getOperationRootType(testSchema, doc.definitions[0])).to.equal(
      subscriptionType,
    );
  });

  it('Throws when query type not defined in schema', () => {
    const testSchema = new GraphQLSchema({});

    const doc = parse('query { field }');
    expect(() => getOperationRootType(testSchema, doc.definitions[0])).to.throw(
      'Schema does not define the required query root type.',
    );
  });

  it('Throws when mutation type not defined in schema', () => {
    const testSchema = new GraphQLSchema({});

    const doc = parse('mutation { field }');
    expect(() => getOperationRootType(testSchema, doc.definitions[0])).to.throw(
      'Schema is not configured for mutations.',
    );
  });

  it('Throws when subscription type not defined in schema', () => {
    const testSchema = new GraphQLSchema({});

    const doc = parse('subscription { field }');
    expect(() => getOperationRootType(testSchema, doc.definitions[0])).to.throw(
      'Schema is not configured for subscriptions.',
    );
  });

  it('Throws when operation not a valid operation kind', () => {
    const testSchema = new GraphQLSchema({});

    const doc = parse('{ field }');
    doc.definitions[0].operation = 'non_existent_operation';
    expect(() => getOperationRootType(testSchema, doc.definitions[0])).to.throw(
      'Can only have query, mutation and subscription operations.',
    );
  });
});
