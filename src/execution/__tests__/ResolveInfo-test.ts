import { assert, expect } from 'chai';
import { describe, it } from 'mocha';

import { parse } from '../../language/parser.js';

import {
  GraphQLObjectType,
  GraphQLSchema,
  GraphQLString,
} from '../../type/index.js';

import { collectFields } from '../collectFields.js';
import { validateExecutionArgs } from '../entrypoints.js';
import { ResolveInfo } from '../ResolveInfo.js';

describe('ResolveInfo', () => {
  const query = new GraphQLObjectType({
    name: 'Query',
    fields: { test: { type: GraphQLString } },
  });

  const validatedExecutionArgs = validateExecutionArgs({
    schema: new GraphQLSchema({ query }),
    document: parse(`{ test }`),
    rootValue: { test: 'root' },
  });

  assert('schema' in validatedExecutionArgs);

  const { schema, fragments, rootValue, operation, variableValues } =
    validatedExecutionArgs;

  const collectedFields = collectFields(
    schema,
    fragments,
    variableValues,
    query,
    operation.selectionSet,
    false,
  );

  const fieldDetailsList = collectedFields.groupedFieldSet.get('test');

  assert(fieldDetailsList != null);

  const path = { key: 'test', prev: undefined, typename: 'Query' };

  const abortController = new AbortController();
  const abortSignal = abortController.signal;
  let unregisterCalled = false;
  const resolveInfo = new ResolveInfo(
    validatedExecutionArgs,
    query.getFields().test,
    fieldDetailsList,
    query,
    path,
    () => ({
      abortSignal,
      unregister: () => {
        unregisterCalled = true;
      },
    }),
  );

  it('exposes fieldName', () => {
    expect(resolveInfo.fieldName).to.equal('test');
  });

  it('exposes fieldNodes', () => {
    const retrievedFieldNodes = resolveInfo.fieldNodes;
    expect(retrievedFieldNodes).to.deep.equal(
      fieldDetailsList.map((fieldDetails) => fieldDetails.node),
    );
    expect(retrievedFieldNodes).to.equal(resolveInfo.fieldNodes); // ensure same reference
  });

  it('exposes returnType', () => {
    expect(resolveInfo.returnType).to.equal(query.getFields().test.type);
  });

  it('exposes parentType', () => {
    expect(resolveInfo.parentType).to.equal(query);
  });

  it('exposes path', () => {
    expect(resolveInfo.path).to.deep.equal(path);
  });

  it('exposes schema', () => {
    expect(resolveInfo.schema).to.equal(schema);
  });

  it('exposes fragments', () => {
    expect(resolveInfo.fragments).to.equal(
      validatedExecutionArgs.fragmentDefinitions,
    );
  });

  it('exposes rootValue', () => {
    expect(resolveInfo.rootValue).to.equal(rootValue);
  });

  it('exposes operation', () => {
    expect(resolveInfo.operation).to.equal(operation);
  });

  it('exposes variableValues', () => {
    expect(resolveInfo.variableValues).to.equal(
      validatedExecutionArgs.variableValues,
    );
  });

  it('exposes abortSignal', () => {
    const retrievedAbortSignal = resolveInfo.abortSignal;
    expect(retrievedAbortSignal).to.equal(abortSignal);
    expect(retrievedAbortSignal).to.equal(resolveInfo.abortSignal); // ensure same reference
  });

  it('calls unregisterAbortSignal', () => {
    resolveInfo.unregisterAbortSignal();
    expect(unregisterCalled).to.equal(true);
  });
});
