import { describe, it } from 'node:test';

import { expect } from 'chai';

import { invariant } from '../../../jsutils/invariant.ts';

import { parse } from '../../../language/parser.ts';

import { buildSchema } from '../../../utilities/buildASTSchema.ts';

import type { GroupedFieldSet } from '../../collectFields.ts';
import { validateExecutionArgs } from '../../execute.ts';

import { compileCollectFields } from '../compileCollectFields.ts';

const schema = buildSchema(`
  interface Named {
    name: String
  }

  interface Hidden {
    hidden: String
  }

  input FlagInput {
    enabled: Boolean
  }

  type Query implements Named {
    aliasSource: String
    argField(flag: Boolean): String
    child: Query
    deferredInline: String
    deferredSpread: String
    field: String
    hidden: String
    included: String
    name: String
    notIncluded: String
    skipped: String
    viaFragmentVariable: String
  }

  type Other implements Hidden {
    hidden: String
  }
`);

function collectRootFields(
  query: string,
  variableValues?: { readonly [variable: string]: unknown },
) {
  const { compiledCollectFields, coercedVariableValues, queryType } =
    compileOperationCollectFields(query, variableValues);

  return compiledCollectFields.collectRootFields(
    coercedVariableValues,
    queryType,
  );
}

function expectFieldCounts(
  groupedFieldSet: GroupedFieldSet,
  expectedCounts: { readonly [responseName: string]: number },
): void {
  for (const [responseName, count] of Object.entries(expectedCounts)) {
    expect(groupedFieldSet.get(responseName)).to.have.lengthOf(count);
  }
}

function expectMissingFields(
  groupedFieldSet: GroupedFieldSet,
  responseNames: ReadonlyArray<string>,
): void {
  for (const responseName of responseNames) {
    expect(groupedFieldSet.has(responseName)).to.equal(false);
  }
}

function compileOperationCollectFields(
  query: string,
  variableValues?: { readonly [variable: string]: unknown },
) {
  const document = parse(query, { experimentalFragmentArguments: true });
  const validatedExecutionArgs = validateExecutionArgs({
    schema,
    document,
    variableValues,
  });

  invariant('operation' in validatedExecutionArgs);

  const queryType = schema.getQueryType();
  invariant(queryType != null);

  const compiledCollectFields = compileCollectFields(
    schema,
    validatedExecutionArgs.fragments,
    validatedExecutionArgs.operation.selectionSet,
    false,
    true,
  );

  return {
    compiledCollectFields,
    coercedVariableValues: validatedExecutionArgs.variableValues,
    queryType,
  };
}

describe('compiledCollectFields', () => {
  it('collects fields with precompiled selections and runtime variables', () => {
    const { groupedFieldSet, newDeferUsages } = collectRootFields(
      `
        query (
          $show: Boolean! = true
          $label: String = "fromVar"
          $missingShow: Boolean
          $nullLabel: String
        ) {
          field
          unknownField
          alias: aliasSource
          skipped @skip(if: true)
          notIncluded @include(if: false)
          included @include(if: $show)
          streamed: field @stream
          ... @skip(if: true) {
            skippedInline: field
          }
          ... @include(if: true) {
            includedInline: field
          }
          ... {
            name
          }
          ... on Query {
            field
          }
          ... on Named {
            name
          }
          ... on Other {
            hidden
          }
          ... on Hidden {
            hidden
          }
          ... on MissingType {
            missingType: field
          }
          ...Missing
          ...Missing
          ...SkippedFragment @skip(if: true)
          ...OtherFragment
          ...DeferredFragment @defer(label: "first")
          ...DeferredFragment @defer(label: "second")
          ... @defer(label: "inline") {
            deferredInline
          }
          ... @defer {
            unlabeledDeferred: deferredInline
          }
          ... @defer(if: false) {
            deferredFalse: deferredInline
          }
          ... @defer(label: $label) {
            deferredWithVariableLabel: deferredInline
          }
          ... @defer(if: $show, label: "variableIf") {
            deferredWithVariableIf: deferredInline
          }
          ... @defer(if: $missingShow, label: "defaultedVariableIf") {
            deferredWithDefaultedVariableIf: deferredInline
          }
          ... @defer(label: $nullLabel) {
            deferredWithNullVariableLabel: deferredInline
          }
          ...ArgFragment(show: $show)
          ...StaticArgFragment(show: false, label: "fragmentRuntimeLabel")
          ...DefaultArgFragment
          ...NoStaticArg
          ...StringArg(value: "string")
          ...NullArg(show: null)
          ...ObjectArg(input: { enabled: false })
          ...ListArg(values: [false, true])
          ...OuterObjectArg(input: { enabled: false })
          ...OperationDependentObjectArg(input: { enabled: $show })
          ...ArgValueFragment(show: $show)
          ...RepeatedFragment
          ...RepeatedFragment
          child {
            ...StaticArgFragment(show: false)
          }
        }

        fragment SkippedFragment on Query {
          skipped
        }

        fragment OtherFragment on Other {
          hidden
        }

        fragment DeferredFragment on Query {
          deferredSpread
        }

        fragment ArgFragment($show: Boolean!) on Query {
          viaFragmentVariable @include(if: $show)
        }

        fragment StaticArgFragment(
          $show: Boolean!
          $label: String = "fragmentLabel"
        ) on Query {
          staticIncluded: field @skip(if: $show)
          staticExcluded: field @include(if: $show)
          ... @defer(label: "static") {
            deferredInStatic: deferredInline
          }
          ... @defer(label: $label) {
            deferredInStaticWithVariableLabel: deferredInline
          }
          ...NestedStaticArgFragment(show: $show)
        }

        fragment NestedStaticArgFragment($show: Boolean!) on Query {
          nestedStaticIncluded: field @skip(if: $show)
          nestedStaticExcluded: field @include(if: $show)
        }

        fragment DefaultArgFragment($show: Boolean = false) on Query {
          defaultIncluded: field @skip(if: $show)
        }

        fragment NoStaticArg($unused: Boolean) on Query {
          noStaticArg: field
        }

        fragment StringArg($value: String) on Query {
          stringArg: field
        }

        fragment NullArg($show: Boolean) on Query {
          nullArg: field
        }

        fragment ObjectArg($input: FlagInput) on Query {
          objectArg: field
        }

        fragment ListArg($values: [Boolean]) on Query {
          listArg: field
        }

        fragment OuterObjectArg($input: FlagInput) on Query {
          ...InnerObjectArg(input: $input)
        }

        fragment InnerObjectArg($input: FlagInput) on Query {
          innerObjectArg: field
        }

        fragment OperationDependentObjectArg($input: FlagInput) on Query {
          operationDependentObjectArg: field
        }

        fragment ArgValueFragment($show: Boolean!) on Query {
          argField(flag: $show)
        }

        fragment RepeatedFragment on Query {
          repeated: field
        }
      `,
      { show: true, label: 'runtimeLabel', nullLabel: null },
    );

    expectFieldCounts(groupedFieldSet, {
      field: 2,
      unknownField: 1,
      alias: 1,
      included: 1,
      streamed: 1,
      includedInline: 1,
      name: 2,
      deferredSpread: 1,
      deferredInline: 1,
      unlabeledDeferred: 1,
      deferredWithVariableLabel: 1,
      deferredWithVariableIf: 1,
      deferredWithDefaultedVariableIf: 1,
      deferredWithNullVariableLabel: 1,
      viaFragmentVariable: 1,
      staticIncluded: 1,
      deferredInStatic: 1,
      deferredInStaticWithVariableLabel: 1,
      nestedStaticIncluded: 1,
      defaultIncluded: 1,
      noStaticArg: 1,
      stringArg: 1,
      nullArg: 1,
      objectArg: 1,
      listArg: 1,
      innerObjectArg: 1,
      operationDependentObjectArg: 1,
      argField: 1,
      repeated: 1,
      child: 1,
    });

    expectMissingFields(groupedFieldSet, [
      'hidden',
      'notIncluded',
      'skipped',
      'skippedInline',
      'missingType',
    ]);
    const fieldDetails = groupedFieldSet.get('field')?.[0];
    invariant(fieldDetails != null);
    expect(fieldDetails.compiledFieldPlan?.fieldDef.name).to.equal('field');
    expect(groupedFieldSet.get('unknownField')?.[0].compiledFieldPlan).to.equal(
      undefined,
    );
    expect(groupedFieldSet.get('deferredFalse')).to.have.lengthOf(1);
    expectMissingFields(groupedFieldSet, [
      'staticExcluded',
      'nestedStaticExcluded',
    ]);

    expect(newDeferUsages.map((deferUsage) => deferUsage.label)).to.deep.equal([
      'first',
      'inline',
      undefined,
      undefined,
      'variableIf',
      'defaultedVariableIf',
      undefined,
      'static',
      undefined,
    ]);
  });

  it('collects subfields with precompiled field selection sets', () => {
    const { compiledCollectFields, coercedVariableValues, queryType } =
      compileOperationCollectFields(`
        {
          ...ChildFragment(show: false)
        }

        fragment ChildFragment($show: Boolean!) on Query {
          child {
            ...StaticArgFragment(show: $show)
          }
        }

        fragment StaticArgFragment($show: Boolean!) on Query {
          staticIncluded: field @skip(if: $show)
          staticExcluded: field @include(if: $show)
        }
      `);

    const rootFields = compiledCollectFields.collectRootFields(
      coercedVariableValues,
      queryType,
    );
    const childFields = rootFields.groupedFieldSet.get('child');
    invariant(childFields != null);

    const subfields = compiledCollectFields.collectSubfields(
      coercedVariableValues,
      queryType,
      childFields,
    );

    expect(subfields.groupedFieldSet.get('staticIncluded')).to.have.lengthOf(1);
    expect(subfields.groupedFieldSet.has('staticExcluded')).to.equal(false);

    const rawSubfields = compiledCollectFields.collectSubfields(
      coercedVariableValues,
      queryType,
      [
        {
          node: childFields[0].node,
          deferUsage: undefined,
          fragmentVariableValues: childFields[0].fragmentVariableValues,
          staticFragmentVariableValues:
            childFields[0].staticFragmentVariableValues,
          compiledFieldPlan: undefined,
        },
      ],
    );

    expect(rawSubfields.groupedFieldSet.get('staticIncluded')).to.have.lengthOf(
      1,
    );

    const direct = compileOperationCollectFields(`
      {
        child {
          field
        }
      }
    `);
    const directRootFields = direct.compiledCollectFields.collectRootFields(
      direct.coercedVariableValues,
      direct.queryType,
    );
    const directChildFields = directRootFields.groupedFieldSet.get('child');
    invariant(directChildFields != null);

    const directSubfields = direct.compiledCollectFields.collectSubfields(
      direct.coercedVariableValues,
      direct.queryType,
      directChildFields,
    );

    const scalarFields = directSubfields.groupedFieldSet.get('field');
    invariant(scalarFields != null);
    expect(scalarFields).to.have.lengthOf(1);

    const scalarSubfields = direct.compiledCollectFields.collectSubfields(
      direct.coercedVariableValues,
      direct.queryType,
      scalarFields,
    );

    expect(scalarSubfields.groupedFieldSet.size).to.equal(0);

    const extraNode = parse('{ child { field } }').definitions[0];
    invariant(extraNode.kind === 'OperationDefinition');
    const extraField = extraNode.selectionSet.selections[0];
    invariant(extraField.kind === 'Field');

    const extraSubfields = direct.compiledCollectFields.collectSubfields(
      direct.coercedVariableValues,
      direct.queryType,
      [
        {
          node: extraField,
          deferUsage: undefined,
          fragmentVariableValues: undefined,
          staticFragmentVariableValues: undefined,
          compiledFieldPlan: undefined,
        },
      ],
    );

    expect(extraSubfields.groupedFieldSet.get('field')).to.have.lengthOf(1);
  });

  it('throws directive argument errors for non-fast-path directives', () => {
    expect(() =>
      collectRootFields(`
        {
          field @include
        }
      `),
    ).to.throw();

    expect(() =>
      collectRootFields(`
        {
          field @include(if: null)
        }
      `),
    ).to.throw();

    expect(() =>
      collectRootFields(
        `
          {
            ...BadDirective(show: null)
          }

          fragment BadDirective($show: Boolean) on Query {
            field @include(if: $show)
          }
        `,
      ),
    ).to.throw();

    expect(() =>
      collectRootFields(`
        {
          ...BadDefault
        }

        fragment BadDefault($show: Boolean = "bad") on Query {
          field @include(if: $show)
        }
      `),
    ).to.throw();

    expect(() =>
      collectRootFields(`
        {
          ... @defer(if: null) {
            field
          }
        }
      `),
    ).to.throw();

    expect(() =>
      collectRootFields(`
        {
          ...BadDefer(show: true)
        }

        fragment BadDefer($show: Boolean) on Query {
          ... @defer(if: null) {
            field
          }
        }
      `),
    ).to.throw();
  });
});
