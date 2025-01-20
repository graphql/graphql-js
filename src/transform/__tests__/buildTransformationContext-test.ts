import { expect } from 'chai';
import { describe, it } from 'mocha';

import { invariant } from '../../jsutils/invariant.js';

import { parse } from '../../language/parser.js';

import { GraphQLObjectType } from '../../type/definition.js';
import { GraphQLString } from '../../type/scalars.js';
import { GraphQLSchema } from '../../type/schema.js';

import { validateExecutionArgs } from '../../execution/execute.js';

import { buildTransformationContext } from '../buildTransformationContext.js';

const schema = new GraphQLSchema({
  query: new GraphQLObjectType({
    name: 'Query',
    fields: { someField: { type: GraphQLString } },
  }),
});

describe('buildTransformationContext', () => {
  it('should build a transformation context', () => {
    const validatedExecutionArgs = validateExecutionArgs({
      schema,
      document: parse('{ someField }'),
    });

    invariant('schema' in validatedExecutionArgs);

    const context = buildTransformationContext(
      validatedExecutionArgs,
      '__prefix__',
    );

    expect(context.originalDeferLabels instanceof Map).to.equal(true);
    expect(context.deferredGroupedFieldSets instanceof Map).to.equal(true);
    expect(context.streamUsageMap instanceof Map).to.equal(true);
    expect(context.prefix).to.equal('__prefix__');
    expect(context.pendingLabelsByPath instanceof Map).to.equal(true);
    expect(context.pendingResultsById instanceof Map).to.equal(true);
    expect(context.mergedResult).to.deep.equal({});
  });

  it('should handle non-standard directives', () => {
    const validatedExecutionArgs = validateExecutionArgs({
      schema,
      document: parse('{ ... @someDirective { someField } }'),
    });

    invariant('schema' in validatedExecutionArgs);

    expect(() =>
      buildTransformationContext(validatedExecutionArgs, '__prefix__'),
    ).not.to.throw();
  });
});
