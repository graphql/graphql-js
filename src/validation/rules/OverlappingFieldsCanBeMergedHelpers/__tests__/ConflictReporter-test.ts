import { describe, it } from 'node:test';

import { expect } from 'chai';

import type { GraphQLError } from '../../../../error/GraphQLError.ts';

import type {
  FieldNode,
  FragmentSpreadNode,
} from '../../../../language/ast.ts';
import { Kind } from '../../../../language/kinds.ts';
import { parse } from '../../../../language/parser.ts';

import { GraphQLInt, GraphQLString } from '../../../../type/scalars.ts';
import { GraphQLSchema } from '../../../../type/schema.ts';

import { ConflictReporter } from '../ConflictReporter.ts';
import { FieldOccurrence } from '../FieldOccurrence.ts';

const schema = new GraphQLSchema({});
const context = { getSchema: () => schema };

function field(nodeOrName: FieldNode | string): FieldOccurrence {
  return new FieldOccurrence(
    context,
    undefined,
    typeof nodeOrName === 'string'
      ? {
          kind: Kind.FIELD,
          name: { kind: Kind.NAME, value: nodeOrName },
        }
      : nodeOrName,
  );
}

function reporterFor(errors: Array<GraphQLError>): ConflictReporter {
  return new ConflictReporter(
    {
      reportError(error: GraphQLError) {
        errors.push(error);
      },
    },
    { fieldContainsDescendant: () => false },
  );
}

function reporterForAncestry(
  errors: Array<GraphQLError>,
  fieldContainsDescendant: (
    containingField: FieldOccurrence,
    descendantField: FieldOccurrence,
  ) => boolean,
): ConflictReporter {
  return new ConflictReporter(
    {
      reportError(error: GraphQLError) {
        errors.push(error);
      },
    },
    { fieldContainsDescendant },
  );
}

function fragmentSpreadPair() {
  const operation = parse('{ ...F(value: { z: 1, a: 2 }) ...F }', {
    experimentalFragmentArguments: true,
  }).definitions[0];
  if (operation.kind !== Kind.OPERATION_DEFINITION) {
    throw new Error('Expected operation definition.');
  }
  const [firstNode, secondNode] = operation.selectionSet.selections;
  if (
    firstNode?.kind !== Kind.FRAGMENT_SPREAD ||
    secondNode?.kind !== Kind.FRAGMENT_SPREAD
  ) {
    throw new Error('Expected fragment spreads.');
  }
  return [firstNode, secondNode] as const;
}

describe('ConflictReporter', () => {
  it('describes conflicting fragment spreads in source form', () => {
    const errors: Array<GraphQLError> = [];
    const reporter = reporterFor(errors);
    const [first, second] = fragmentSpreadPair();

    reporter.reportFragmentArgumentConflict([first, second]);

    expect(errors[0]?.message).to.equal(
      'Spreads "F" conflict because F(value: { z: 1, a: 2 }) and F have different fragment arguments.',
    );
    expect(errors[0]?.nodes).to.deep.equal([
      first,
      second,
    ] satisfies ReadonlyArray<FragmentSpreadNode>);
  });

  it('deduplicates fragment spread pairs regardless of order', () => {
    const errors: Array<GraphQLError> = [];
    const reporter = reporterFor(errors);
    const [first, second] = fragmentSpreadPair();

    reporter.reportFragmentArgumentConflict([first, second]);
    reporter.reportFragmentArgumentConflict([second, first]);

    expect(errors).to.have.length(1);
  });

  it('reports conflicting field names', () => {
    const errors: Array<GraphQLError> = [];
    const reporter = reporterFor(errors);
    const field1 = field('one');
    const field2 = field('two');

    reporter.reportFieldCallConflict('value', [field2, field1]);

    expect(errors.map(({ message }) => message)).to.deep.equal([
      'Fields "value" conflict because "two" and "one" are different fields. Use different aliases on the fields to fetch both if this was intentional.',
    ]);
  });

  it('reports differing field arguments', () => {
    const errors: Array<GraphQLError> = [];
    const reporter = reporterFor(errors);

    reporter.reportFieldCallConflict('value', [field('value'), field('value')]);

    expect(errors.map(({ message }) => message)).to.deep.equal([
      'Fields "value" conflict because they have differing arguments. Use different aliases on the fields to fetch both if this was intentional.',
    ]);
  });

  it('deduplicates field pairs regardless of order', () => {
    const errors: Array<GraphQLError> = [];
    const reporter = reporterFor(errors);
    const field1 = field('one');
    const field2 = field('two');

    reporter.reportFieldCallConflict('value', [field1, field2]);
    reporter.reportFieldCallConflict('value', [field2, field1]);

    expect(errors).to.have.length(1);
  });

  it('reports a response shape conflict', () => {
    const errors: Array<GraphQLError> = [];
    const reporter = reporterFor(errors);
    const field1 = field('value');
    const field3 = field('value');
    Object.defineProperty(field1, 'getOutputType', {
      value: () => GraphQLString,
    });
    Object.defineProperty(field3, 'getOutputType', {
      value: () => GraphQLInt,
    });

    reporter.reportResponseShapeConflict('value', [field1, field3]);
    expect(errors.map(({ message }) => message)).to.deep.equal([
      'Fields "value" conflict because they return conflicting types "String" and "Int". Use different aliases on the fields to fetch both if this was intentional.',
    ]);
  });

  it('reports independent conflicts for the same field pair', () => {
    const errors: Array<GraphQLError> = [];
    const reporter = reporterFor(errors);
    const field1 = field('one');
    const field2 = field('two');
    Object.defineProperty(field1, 'getOutputType', {
      value: () => GraphQLString,
    });
    Object.defineProperty(field2, 'getOutputType', {
      value: () => GraphQLInt,
    });

    reporter.reportResponseShapeConflict('value', [field1, field2]);
    reporter.reportFieldCallConflict('value', [field1, field2]);

    expect(errors.map(({ message }) => message)).to.deep.equal([
      'Fields "value" conflict because they return conflicting types "String" and "Int". Use different aliases on the fields to fetch both if this was intentional.',
      'Fields "value" conflict because "one" and "two" are different fields. Use different aliases on the fields to fetch both if this was intentional.',
    ]);
  });

  it('reports a conflict from the nearest common containing path', () => {
    const errors: Array<GraphQLError> = [];
    const reporter = reporterFor(errors);
    const operation = parse(`
      {
        outer { inner { value: one } }
        outer { inner { value: two } }
        unrelated
        unrelated
      }
    `).definitions[0];
    if (operation.kind !== Kind.OPERATION_DEFINITION) {
      throw new Error('Expected operation definition.');
    }
    const [outer1, outer2, unrelated1, unrelated2] =
      operation.selectionSet.selections;
    if (
      outer1?.kind !== Kind.FIELD ||
      outer2?.kind !== Kind.FIELD ||
      unrelated1?.kind !== Kind.FIELD ||
      unrelated2?.kind !== Kind.FIELD
    ) {
      throw new Error('Expected outer fields.');
    }
    const inner1 = outer1.selectionSet?.selections[0];
    const inner2 = outer2.selectionSet?.selections[0];
    if (inner1?.kind !== Kind.FIELD || inner2?.kind !== Kind.FIELD) {
      throw new Error('Expected inner fields.');
    }
    const value1 = inner1.selectionSet?.selections[0];
    const value2 = inner2.selectionSet?.selections[0];
    if (value1?.kind !== Kind.FIELD || value2?.kind !== Kind.FIELD) {
      throw new Error('Expected value fields.');
    }

    const outerPath = reporter.extendContainingFieldPath(undefined, 'outer', [
      field(unrelated2),
      field(unrelated1),
    ]);
    const innerPath = reporter.extendContainingFieldPath(outerPath, 'inner', [
      field(inner1),
      field(inner2),
    ]);
    reporter.reportFieldCallConflict(
      'value',
      [field(value1), field(value2)],
      innerPath,
    );
    expect(errors).to.have.length(1);
    if (outerPath !== undefined) {
      reporter.emitPendingConflict(outerPath);
    }

    expect(errors.map(({ message }) => message)).to.deep.equal([
      'Fields "inner" conflict because subfields "value" conflict because "one" and "two" are different fields. Use different aliases on the fields to fetch both if this was intentional.',
    ]);
  });

  it('reports conflicts without a containing path immediately', () => {
    const errors: Array<GraphQLError> = [];
    const reporter = reporterFor(errors);

    reporter.reportFieldCallConflict(
      'value',
      [field('one'), field('two')],
      undefined,
    );

    expect(errors).to.have.length(1);
  });

  it('reports a deep failure with its full common field path', () => {
    const errors: Array<GraphQLError> = [];
    const reporter = reporterFor(errors);
    const operation = parse(`
      {
        outer { inner { value: one } }
        outer { inner { value: two } }
      }
    `).definitions[0];
    if (operation.kind !== Kind.OPERATION_DEFINITION) {
      throw new Error('Expected operation definition.');
    }
    const [outerNode1, outerNode2] = operation.selectionSet.selections;
    if (outerNode1?.kind !== Kind.FIELD || outerNode2?.kind !== Kind.FIELD) {
      throw new Error('Expected outer fields.');
    }
    const innerNode1 = outerNode1.selectionSet?.selections[0];
    const innerNode2 = outerNode2.selectionSet?.selections[0];
    if (innerNode1?.kind !== Kind.FIELD || innerNode2?.kind !== Kind.FIELD) {
      throw new Error('Expected inner fields.');
    }
    const valueNode1 = innerNode1.selectionSet?.selections[0];
    const valueNode2 = innerNode2.selectionSet?.selections[0];
    if (valueNode1?.kind !== Kind.FIELD || valueNode2?.kind !== Kind.FIELD) {
      throw new Error('Expected value fields.');
    }

    const outerPath = reporter.extendContainingFieldPath(undefined, 'outer', [
      field(outerNode1),
      field(outerNode2),
    ]);
    const innerPath = reporter.extendContainingFieldPath(outerPath, 'inner', [
      field(innerNode1),
      field(innerNode2),
    ]);
    reporter.reportFieldCallConflict(
      'value',
      [field(valueNode1), field(valueNode2)],
      innerPath,
    );
    if (outerPath !== undefined) {
      reporter.emitPendingConflict(outerPath);
    }

    expect(errors.map(({ message }) => message)).to.deep.equal([
      'Fields "outer" conflict because subfields "inner" conflict because subfields "value" conflict because "one" and "two" are different fields. Use different aliases on the fields to fetch both if this was intentional.',
    ]);
  });

  it('resolves containing fields from descendants outward', () => {
    const errors: Array<GraphQLError> = [];
    const leaf1 = field('leaf1');
    const leaf2 = field('leaf2');
    const inner1 = field('inner1');
    const inner2 = field('inner2');
    const wrongOuter1 = field('wrongOuter1');
    const wrongOuter2 = field('wrongOuter2');
    const outer1 = field('outer1');
    const outer2 = field('outer2');
    const descendants = new Map<FieldOccurrence, Set<FieldOccurrence>>([
      [inner1, new Set([leaf1])],
      [inner2, new Set([leaf2])],
      [wrongOuter1, new Set([leaf1])],
      [wrongOuter2, new Set([leaf2])],
      [outer1, new Set([inner1])],
      [outer2, new Set([inner2])],
    ]);
    const reporter = reporterForAncestry(
      errors,
      (containingField, descendantField) =>
        descendants.get(containingField)?.has(descendantField) ?? false,
    );
    const outerPath = reporter.extendContainingFieldPath(undefined, 'outer', [
      wrongOuter1,
      wrongOuter2,
      outer1,
      outer2,
    ]);
    const innerPath = reporter.extendContainingFieldPath(outerPath, 'inner', [
      inner1,
      inner2,
    ]);

    reporter.reportFieldCallConflict('value', [leaf1, leaf2], innerPath);
    if (outerPath !== undefined) {
      reporter.emitPendingConflict(outerPath);
    }

    expect(errors[0]?.nodes).to.deep.equal([
      outer1.node,
      inner1.node,
      leaf1.node,
      outer2.node,
      inner2.node,
      leaf2.node,
    ]);
  });

  it('does not attribute ancestry to two occurrences of one field node', () => {
    const errors: Array<GraphQLError> = [];
    const leaf1 = field('leaf1');
    const leaf2 = field('leaf2');
    const sharedNode = field('shared').node;
    const shared1 = field(sharedNode);
    const shared2 = field(sharedNode);
    const unrelated = field('unrelated');
    const reporter = reporterForAncestry(
      errors,
      (containingField, descendantField) =>
        (containingField === shared1 && descendantField === leaf1) ||
        (containingField === shared2 && descendantField === leaf2),
    );
    const containingPath = reporter.extendContainingFieldPath(
      undefined,
      'parent',
      [shared1, shared2, unrelated],
    );

    reporter.reportFieldCallConflict('value', [leaf1, leaf2], containingPath);
    if (containingPath !== undefined) {
      reporter.emitPendingConflict(containingPath);
    }

    expect(errors.map(({ message }) => message)).to.deep.equal([
      'Fields "value" conflict because "leaf1" and "leaf2" are different fields. Use different aliases on the fields to fetch both if this was intentional.',
    ]);
  });

  it('only extends paths with two distinct containing fields', () => {
    const errors: Array<GraphQLError> = [];
    const reporter = reporterFor(errors);
    expect(reporter.extendContainingFieldPath(undefined, 'field', [])).to.equal(
      undefined,
    );
    expect(
      reporter.extendContainingFieldPath(undefined, 'field', [field('one')]),
    ).to.equal(undefined);

    const operation = parse('{ first second }').definitions[0];
    if (operation.kind !== Kind.OPERATION_DEFINITION) {
      throw new Error('Expected operation definition.');
    }
    const [first, second] = operation.selectionSet.selections;
    if (first?.kind !== Kind.FIELD || second?.kind !== Kind.FIELD) {
      throw new Error('Expected fields.');
    }
    expect(
      reporter.extendContainingFieldPath(undefined, 'field', [
        field(second),
        field(first),
      ]),
    ).not.to.equal(undefined);
    expect(errors).to.deep.equal([]);
  });
});
