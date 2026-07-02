import { describe, it } from 'node:test';

import { expect } from 'chai';

import { GraphQLError } from '../../error/GraphQLError.ts';

import type { DocumentNode } from '../../language/ast.ts';
import { Kind } from '../../language/kinds.ts';
import { parse } from '../../language/parser.ts';

import { GraphQLObjectType } from '../../type/definition.ts';
import { GraphQLString } from '../../type/scalars.ts';
import { GraphQLSchema } from '../../type/schema.ts';

import { buildSchema } from '../../utilities/buildASTSchema.ts';

import { DocumentIndex } from '../DocumentIndex.ts';
import { IndexCursor } from '../IndexCursor.ts';
import { TypeSystemValidationIndex } from '../TypeSystemValidationIndex.ts';
import type { ASTValidationContextOptions } from '../unifiedValidationRules/ASTValidationContext.ts';
import { ASTValidationContext } from '../unifiedValidationRules/ASTValidationContext.ts';

describe('ASTValidationContext', () => {
  it('extends SDL validation context for unified rule validation', () => {
    const errors = new Array<GraphQLError>();
    const context = createTestASTValidationContext(
      parse('{ field }'),
      new GraphQLSchema({
        query: new GraphQLObjectType({
          name: 'Query',
          fields: {
            field: { type: GraphQLString },
          },
        }),
      }),
      (error) => {
        errors.push(error);
      },
      {
        hideSuggestions: true,
      },
    );

    expect(Object.prototype.toString.call(context)).to.equal(
      '[object ASTValidationContext]',
    );
    expect(context.hideSuggestions).to.equal(true);
    expect(context.document.kind).to.equal(Kind.DOCUMENT);
    expect(context.index.schema?.getQueryType()?.name).to.equal('Query');

    context.reportError(new GraphQLError('Reported.'));
    expect(errors.map((error) => error.message)).to.deep.equal(['Reported.']);
  });

  it('provides document type information and variable usages to unified rules', () => {
    const schema = buildSchema(`
      type Query {
        field(arg: ID): String
      }
    `);
    const ast = parse(
      `
        query ($opId: ID) {
          nested {
            child
          }
          ...Frag(id: $opId)
        }

        fragment Frag($id: ID) on Query {
          field(arg: $id)
        }

        fragment NoVars on Query {
          field
        }
      `,
      { experimentalFragmentArguments: true },
    );
    const context = createTestASTValidationContext(
      ast,
      schema,
      () => undefined,
    );
    const operation = ast.definitions.find(
      (definition) => definition.kind === Kind.OPERATION_DEFINITION,
    );
    const fragment = ast.definitions.find(
      (definition) => definition.kind === Kind.FRAGMENT_DEFINITION,
    );
    if (operation?.kind !== Kind.OPERATION_DEFINITION) {
      throw new Error('Expected operation definition.');
    }
    if (fragment?.kind !== Kind.FRAGMENT_DEFINITION) {
      throw new Error('Expected fragment definition.');
    }

    const signature =
      context.documentIndex.getFragmentSignatureByName()('Frag');
    expect(signature?.definition).to.equal(fragment);
    expect(context.getFragment('Frag')).to.equal(fragment);
    expect(context.getFragment('Frag')).to.equal(fragment);
    expect(
      signature?.variableDefinitions.get('id')?.variable.name.value,
    ).to.equal('id');
    expect(
      context.documentIndex.getFragmentSignatureByName()('NoVars')
        ?.variableDefinitions.size,
    ).to.equal(0);

    const fragmentUsages = context.getVariableUsages(fragment);
    expect(fragmentUsages).to.have.length(1);
    expect(fragmentUsages[0].node.name.value).to.equal('id');
    expect(
      fragmentUsages[0].fragmentVariableDefinition?.variable.name.value,
    ).to.equal('id');
    expect(context.getFragmentSpreads(operation.selectionSet)).to.have.length(
      1,
    );

    const recursiveUsages = context.getRecursiveVariableUsages(operation);
    expect(recursiveUsages.map((usage) => usage.node.name.value)).to.deep.equal(
      ['opId', 'id'],
    );
  });
});

function createTestASTValidationContext(
  document: DocumentNode,
  schema: GraphQLSchema | undefined,
  onError: (error: GraphQLError) => void,
  options?: Partial<ASTValidationContextOptions>,
): ASTValidationContext {
  const indexCursor = new IndexCursor(
    new TypeSystemValidationIndex(new DocumentIndex(document), schema),
  );
  return new ASTValidationContext(document, indexCursor, onError, {
    ...options,
  });
}
