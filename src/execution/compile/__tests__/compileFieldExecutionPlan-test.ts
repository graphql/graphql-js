import { describe, it } from 'node:test';

import { assert, expect } from 'chai';

import { addPath } from '../../../jsutils/Path.ts';

import { parse } from '../../../language/parser.ts';

import { GraphQLObjectType } from '../../../type/definition.ts';
import { GraphQLString } from '../../../type/scalars.ts';
import { GraphQLSchema } from '../../../type/schema.ts';

import type { FieldDetailsList } from '../../collectFields.ts';
import { validateExecutionArgs } from '../../execute.ts';

import { compileArgumentValues } from '../compileArgumentValues.ts';
import {
  compileFieldExecutionPlan,
  compileFieldResolver,
} from '../compileFieldExecutionPlan.ts';

describe('compileFieldExecutionPlan', () => {
  it('resolves undefined for default-resolved fields on non-object sources', () => {
    const queryType = new GraphQLObjectType({
      name: 'Query',
      fields: {
        foo: { type: GraphQLString },
      },
    });
    const schema = new GraphQLSchema({ query: queryType });
    const document = parse('{ foo }');
    const operation = document.definitions[0];
    assert(operation.kind === 'OperationDefinition');
    const fieldNode = operation.selectionSet.selections[0];
    assert(fieldNode.kind === 'Field');
    const fieldDef = queryType.getFields().foo;
    assert(fieldDef !== undefined);
    const plan = compileFieldExecutionPlan(
      compileFieldResolver(fieldDef, true),
      compileArgumentValues(fieldDef, fieldNode, false, undefined),
      null,
    );
    const validatedExecutionArgs = validateExecutionArgs({ schema, document });
    assert('schema' in validatedExecutionArgs);
    const fieldDetailsList: FieldDetailsList = [
      {
        node: fieldNode,
        deferUsage: undefined,
        fragmentVariableValues: undefined,
        staticFragmentVariableValues: undefined,
        compiledFieldPlan: plan,
      },
    ];

    const result = plan.resolveField(
      {
        validatedExecutionArgs,
        getAbortSignal: () => undefined,
        getAsyncHelpers: () => ({
          promiseAll: (values) => Promise.all(values),
          track: () => undefined,
        }),
      },
      queryType,
      null,
      fieldDetailsList,
      addPath(undefined, 'foo', 'Query'),
    );

    expect(result).to.deep.equal({ info: undefined, result: undefined });
  });

  it('resolves fields with a runtime field resolver', () => {
    const queryType = new GraphQLObjectType({
      name: 'Query',
      fields: {
        foo: { type: GraphQLString },
      },
    });
    const schema = new GraphQLSchema({ query: queryType });
    const document = parse('{ foo }');
    const operation = document.definitions[0];
    assert(operation.kind === 'OperationDefinition');
    const fieldNode = operation.selectionSet.selections[0];
    assert(fieldNode.kind === 'Field');
    const fieldDef = queryType.getFields().foo;
    assert(fieldDef !== undefined);
    const plan = compileFieldExecutionPlan(
      compileFieldResolver(fieldDef, false),
      compileArgumentValues(fieldDef, fieldNode, false, undefined),
      null,
    );
    const validatedExecutionArgs = validateExecutionArgs({
      schema,
      document,
      fieldResolver(_source, _args, _context, info) {
        return info.fieldName;
      },
    });
    assert('schema' in validatedExecutionArgs);
    const fieldDetailsList: FieldDetailsList = [
      {
        node: fieldNode,
        deferUsage: undefined,
        fragmentVariableValues: undefined,
        staticFragmentVariableValues: undefined,
        compiledFieldPlan: plan,
      },
    ];

    const result = plan.resolveField(
      {
        validatedExecutionArgs,
        getAbortSignal: () => undefined,
        getAsyncHelpers: () => ({
          promiseAll: (values) => Promise.all(values),
          track: () => undefined,
        }),
      },
      queryType,
      {},
      fieldDetailsList,
      addPath(undefined, 'foo', 'Query'),
    );

    expect(result).to.have.property('result', 'foo');
    expect(result.info).to.have.property('fieldName', 'foo');
  });
});
