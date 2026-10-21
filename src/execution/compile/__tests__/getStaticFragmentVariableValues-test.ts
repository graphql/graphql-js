import { describe, it } from 'node:test';

import { expect } from 'chai';

import { invariant } from '../../../jsutils/invariant.ts';
import type { ObjMap } from '../../../jsutils/ObjMap.ts';

import type {
  FragmentDefinitionNode,
  FragmentSpreadNode,
} from '../../../language/ast.ts';
import { Kind } from '../../../language/kinds.ts';
import { parse } from '../../../language/parser.ts';

import { GraphQLBoolean } from '../../../type/scalars.ts';

import { buildSchema } from '../../../utilities/buildASTSchema.ts';

import type { FragmentVariableValues } from '../../collectFields.ts';
import type { GraphQLVariableSignature } from '../../getVariableSignature.ts';
import { getVariableSignature } from '../../getVariableSignature.ts';

import { compileFragmentVariables } from '../compileFragmentVariables.ts';
import { getStaticFragmentVariableValues } from '../getStaticFragmentVariableValues.ts';

const schema = buildSchema(`
  input FlagInput {
    enabled: Boolean
  }

  type Query {
    child: Query
    field: String
  }
`);

function getFragmentCase(query: string): {
  fragmentSpread: FragmentSpreadNode;
  fragmentDefinition: FragmentDefinitionNode;
} {
  const document = parse(query, { experimentalFragmentArguments: true });
  const operation = document.definitions[0];
  invariant(operation.kind === Kind.OPERATION_DEFINITION);
  const fragmentSpread = operation.selectionSet.selections[0];
  invariant(fragmentSpread.kind === Kind.FRAGMENT_SPREAD);
  const fragmentDefinition = document.definitions[1];
  invariant(fragmentDefinition.kind === Kind.FRAGMENT_DEFINITION);
  return { fragmentSpread, fragmentDefinition };
}

function getVariableSignatures(
  fragmentDefinition: FragmentDefinitionNode,
): ObjMap<GraphQLVariableSignature> {
  const signatures: ObjMap<GraphQLVariableSignature> = Object.create(null);
  for (const variableDefinition of fragmentDefinition.variableDefinitions ??
    []) {
    const signature = getVariableSignature(schema, variableDefinition);
    invariant(!('message' in signature));
    signatures[signature.name] = signature;
  }
  return signatures;
}

function getParentStaticValues(): FragmentVariableValues {
  const signature: GraphQLVariableSignature = {
    name: 'operationFlag',
    type: GraphQLBoolean,
    default: undefined,
  };
  return {
    sources: {
      operationFlag: {
        signature,
        value: undefined,
        fragmentVariableValues: undefined,
      },
    },
    coerced: { operationFlag: true },
  };
}

describe('getStaticFragmentVariableValues', () => {
  it('gets static fragment variable values', () => {
    const { fragmentSpread, fragmentDefinition } = getFragmentCase(`
      {
        ...Fragment(
          show: true
          input: { enabled: false }
          values: [true, false]
        )
      }

      fragment Fragment(
        $show: Boolean
        $input: FlagInput
        $values: [Boolean]
      ) on Query {
        field
      }
    `);

    const signatures = getVariableSignatures(fragmentDefinition);
    const compiled = compileFragmentVariables(fragmentSpread, signatures);

    expect(getStaticFragmentVariableValues(compiled, undefined)).to.deep.equal({
      sources: {
        show: {
          signature: signatures.show,
          value: fragmentSpread.arguments?.[0].value,
          fragmentVariableValues: undefined,
        },
        input: {
          signature: signatures.input,
          value: fragmentSpread.arguments?.[1].value,
          fragmentVariableValues: undefined,
        },
        values: {
          signature: signatures.values,
          value: fragmentSpread.arguments?.[2].value,
          fragmentVariableValues: undefined,
        },
      },
      coerced: {
        show: true,
        input: { enabled: false },
        values: [true, false],
      },
    });
  });

  it('uses static parent values for dynamic fragment variable values', () => {
    const { fragmentSpread, fragmentDefinition } = getFragmentCase(`
      {
        ...Fragment(show: $operationFlag, values: [false, $operationFlag])
      }

      fragment Fragment($show: Boolean, $values: [Boolean]) on Query {
        field
      }
    `);

    const compiled = compileFragmentVariables(
      fragmentSpread,
      getVariableSignatures(fragmentDefinition),
    );
    const staticValues = getStaticFragmentVariableValues(
      compiled,
      getParentStaticValues(),
    );

    expect(staticValues?.coerced).to.deep.equal({
      show: true,
      values: [false, true],
    });
  });

  it('uses fragment variable defaults as static values', () => {
    const { fragmentSpread, fragmentDefinition } = getFragmentCase(`
      {
        ...Fragment
      }

      fragment Fragment($show: Boolean = false) on Query {
        field
      }
    `);

    const compiled = compileFragmentVariables(
      fragmentSpread,
      getVariableSignatures(fragmentDefinition),
    );

    expect(
      getStaticFragmentVariableValues(compiled, undefined)?.coerced,
    ).to.deep.equal({ show: false });
  });

  it('drops invalid static values', () => {
    const { fragmentSpread, fragmentDefinition } = getFragmentCase(`
      {
        ...Fragment(show: "bad")
      }

      fragment Fragment($show: Boolean) on Query {
        field
      }
    `);

    const compiled = compileFragmentVariables(
      fragmentSpread,
      getVariableSignatures(fragmentDefinition),
    );

    expect(getStaticFragmentVariableValues(compiled, undefined)).to.equal(
      undefined,
    );
  });
});
