import { expect } from 'chai';
import { describe, it } from 'mocha';

import { invariant } from '../../jsutils/invariant';

import { Kind } from '../../language/kinds';
import { parse } from '../../language/parser';

import { GraphQLObjectType } from '../../type/definition';
import { GraphQLString } from '../../type/scalars';
import { GraphQLSchema } from '../../type/schema';

import { collectFields } from '../collectFields';
import { ResolveInfo } from '../ResolveInfo';

describe('ResolveInfo', () => {
  const query = new GraphQLObjectType({
    name: 'Query',
    fields: { test: { type: GraphQLString } },
  });

  const document = parse('{ test }');

  const operation = document.definitions[0];
  invariant(operation.kind === Kind.OPERATION_DEFINITION);

  const executionDetails = {
    schema: new GraphQLSchema({ query }),
    operation,
    fragments: {},
    rootValue: { test: 'root' },
    variableValues: {},
  };

  const { schema, fragments, rootValue, variableValues } = executionDetails;

  const groupedFieldSet = collectFields(
    schema,
    fragments,
    variableValues,
    query,
    operation.selectionSet,
  );

  const fieldDetailsList = groupedFieldSet.get('test');
  invariant(fieldDetailsList != null);

  const path = { key: 'test', prev: undefined, typename: 'Query' };

  const resolveInfo = new ResolveInfo(
    executionDetails,
    query.getFields().test,
    fieldDetailsList,
    query,
    path,
  );

  it('exposes fieldName', () => {
    expect(resolveInfo.fieldName).to.equal('test');
  });

  it('exposes fieldNodes', () => {
    const retrievedFieldNodes = resolveInfo.fieldNodes;
    expect(retrievedFieldNodes).to.deep.equal(fieldDetailsList);
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
    expect(resolveInfo.fragments).to.equal(fragments);
  });

  it('exposes rootValue', () => {
    expect(resolveInfo.rootValue).to.equal(rootValue);
  });

  it('exposes operation', () => {
    expect(resolveInfo.operation).to.equal(operation);
  });

  it('exposes variableValues', () => {
    expect(resolveInfo.variableValues).to.equal(variableValues);
  });
});
