import { describe, it } from 'node:test';

import { expect } from 'chai';

import { expectJSON } from '../../__testUtils__/expectJSON.ts';

import type { GraphQLError } from '../../error/GraphQLError.ts';

import type {
  DocumentNode,
  FieldNode,
  InputObjectTypeDefinitionNode,
  ObjectTypeDefinitionNode,
} from '../../language/ast.ts';
import { Kind } from '../../language/kinds.ts';
import { parse, parseType } from '../../language/parser.ts';
import { visit } from '../../language/visitor.ts';

import type { GraphQLSchema } from '../../type/schema.ts';

import { buildSchema } from '../../utilities/buildASTSchema.ts';

import { DocumentIndex } from '../DocumentIndex.ts';
import {
  getNamedTypeName,
  IndexCursor,
  visitWithIndexCursor,
} from '../IndexCursor.ts';
import type {
  CompositeTypeReference,
  OutputTypeReference,
} from '../TypeSystemValidationIndex.ts';
import { TypeSystemValidationIndex } from '../TypeSystemValidationIndex.ts';

function createTestIndexCursor(
  document: DocumentNode,
  schema: GraphQLSchema | undefined,
  onError: (error: GraphQLError) => void,
): IndexCursor {
  return new IndexCursor(
    new TypeSystemValidationIndex(new DocumentIndex(document), schema, onError),
  );
}

describe('IndexCursor', () => {
  it('gets the named type name from nested type nodes', () => {
    expect(getNamedTypeName(parseType('[[String!]!]'))).to.equal('String');
  });

  it('tracks executable type information from existing schema and SDL', () => {
    const schema = buildSchema(`
      type Query {
        existing: Existing
      }

      type Existing {
        field: String
      }
    `);
    const document = parse(`
      extend type Query {
        local: Local
        added: Existing
      }

      type Local {
        field: Int
      }

      {
        existing { field }
        added { field }
        local { field }
      }
    `);
    const indexCursor = createTestIndexCursor(document, schema, () => {
      throw new Error('Unexpected validation error.');
    });
    const topLevelParentTypes = new Map<
      string,
      CompositeTypeReference | undefined
    >();
    const topLevelFieldTypes = new Map<
      string,
      OutputTypeReference | undefined
    >();
    const parentTypes = new Array<string | undefined>();
    const fieldTypes = new Array<string | undefined>();

    visit(
      document,
      visitWithIndexCursor(indexCursor, {
        Field(node) {
          if (
            node.name.value === 'existing' ||
            node.name.value === 'added' ||
            node.name.value === 'local'
          ) {
            topLevelParentTypes.set(
              node.name.value,
              indexCursor.getCurrentParentType() ?? undefined,
            );
            topLevelFieldTypes.set(
              node.name.value,
              indexCursor.getCurrentType() ?? undefined,
            );
          }

          if (node.name.value === 'field') {
            const parentType = indexCursor.getCurrentParentType();
            const fieldType = indexCursor.getCurrentType();
            parentTypes.push(
              parentType == null
                ? undefined
                : indexCursor.index.typeToString(parentType),
            );
            fieldTypes.push(
              fieldType == null
                ? undefined
                : indexCursor.index.typeToString(fieldType),
            );
          }
        },
      }),
    );

    expect(topLevelParentTypes.get('existing')).to.equal(schema.getQueryType());
    expect(topLevelParentTypes.get('added')).to.equal(schema.getQueryType());
    expect(topLevelParentTypes.get('local')).to.equal(schema.getQueryType());
    expect(topLevelFieldTypes.get('existing')).to.equal(
      schema.getType('Existing'),
    );
    expect(topLevelFieldTypes.get('added')).to.equal(
      schema.getType('Existing'),
    );
    const localFieldType = topLevelFieldTypes.get('local');
    expect(
      localFieldType == null
        ? undefined
        : indexCursor.index.typeToString(localFieldType),
    ).to.equal('Local');
    expect(parentTypes).to.deep.equal(['Existing', 'Existing', 'Local']);
    expect(fieldTypes).to.deep.equal(['String', 'String', 'Int']);
  });

  it('uses SDL extensions for executable input object fields and enum values', () => {
    const schema = buildSchema(`
      enum Color {
        RED
      }

      input Filter {
        color: Color
      }

      type Query {
        field(filter: Filter): String
      }
    `);
    const document = parse(`
      extend enum Color {
        BLUE
      }

      extend input Filter {
        added: Int
      }

      {
        field(filter: { color: BLUE, added: 1 })
      }
    `);
    const errors = new Array<GraphQLError>();
    const indexCursor = createTestIndexCursor(document, schema, (error) => {
      errors.push(error);
    });
    const inputFieldTypes = new Map<string, string | undefined>();

    visit(
      document,
      visitWithIndexCursor(indexCursor, {
        ObjectField(node) {
          const inputType = indexCursor.getCurrentInputType();
          inputFieldTypes.set(
            node.name.value,
            inputType == null
              ? undefined
              : indexCursor.index.typeToString(inputType),
          );
        },
        EnumValue(node) {
          const inputType = indexCursor.getCurrentInputType();
          if (inputType != null) {
            indexCursor.index.validateInputLiteral(node, inputType, (error) => {
              errors.push(error);
            });
          }
        },
      }),
    );

    expect(inputFieldTypes.get('color')).to.equal('Color');
    expect(inputFieldTypes.get('added')).to.equal('Int');
    expectJSON(errors).toDeepEqual([]);
  });

  it('keeps executable type information aligned when replacing nodes', () => {
    const schema = buildSchema(`
      type Query {
        original: Original
        replacement: Replacement
      }

      type Original {
        child: String
      }

      type Replacement {
        child: Int
      }
    `);
    const document = parse('{ original { child } }');
    const indexCursor = createTestIndexCursor(document, schema, () => {
      throw new Error('Unexpected validation error.');
    });
    const parentTypeNames = new Array<string | undefined>();
    const fieldTypeNames = new Array<string | undefined>();

    visit(
      document,
      visitWithIndexCursor(indexCursor, {
        Field(node) {
          if (node.name.value === 'original') {
            return {
              ...node,
              name: { ...node.name, value: 'replacement' },
            };
          }

          const parentType = indexCursor.getCurrentParentType();
          parentTypeNames.push(
            parentType == null
              ? undefined
              : indexCursor.index.typeToString(parentType),
          );
          const currentType = indexCursor.getCurrentType();
          fieldTypeNames.push(
            currentType == null
              ? undefined
              : indexCursor.index.typeToString(currentType),
          );
        },
      }),
    );

    expect(parentTypeNames).to.deep.equal(['Replacement']);
    expect(fieldTypeNames).to.deep.equal(['Int']);
    expect(indexCursor.getCurrentFieldDef()).to.equal(undefined);
  });

  it('tracks invalid executable input positions as unknown', () => {
    const schema = buildSchema(`
      input Input {
        known: Int
      }

      type Query {
        field(int: Int, input: Input, text: String): String
      }
    `);
    const document = parse(`
      {
        field(int: [1], input: { missing: 1 }, text: RED)
      }
    `);
    const indexCursor = createTestIndexCursor(document, schema, () => {
      throw new Error('Unexpected validation error.');
    });
    const inputTypes = new Array<unknown>();
    const enumValues = new Array<unknown>();

    visit(
      document,
      visitWithIndexCursor(indexCursor, {
        ListValue() {
          inputTypes.push(indexCursor.getCurrentInputType());
        },
        ObjectField() {
          inputTypes.push(indexCursor.getCurrentInputType());
        },
        EnumValue() {
          enumValues.push(indexCursor.getCurrentEnumValue());
        },
      }),
    );

    expect(inputTypes).to.deep.equal([undefined, undefined]);
    expect(enumValues).to.deep.equal([undefined]);
  });

  it('tracks directive and argument cursor state', () => {
    const schema = buildSchema(`
      directive @tag(value: String) on FIELD

      type Query {
        field: String
      }
    `);
    const document = parse('{ field @tag(value: "bad") }');
    const indexCursor = createTestIndexCursor(document, schema, () => {
      throw new Error('Unexpected validation error.');
    });
    const currentDirectives = new Array<string | undefined>();
    const currentArguments = new Array<string | undefined>();

    visit(
      document,
      visitWithIndexCursor(indexCursor, {
        Directive() {
          currentDirectives.push(indexCursor.getCurrentDirective()?.name);
        },
        Argument() {
          const currentArgument = indexCursor.getCurrentArgument();
          currentArguments.push(
            currentArgument == null
              ? undefined
              : indexCursor.index.getArgumentName(currentArgument),
          );
        },
      }),
    );

    expect(currentDirectives).to.deep.equal(['tag']);
    expect(currentArguments).to.deep.equal(['value']);
  });

  it('tracks executable fragment arguments through schema type information', () => {
    const schema = buildSchema(`
      type Query {
        field(int: Int): String
      }
    `);
    const document = parse(
      `
        {
          ...Frag(int: 1)
        }

        fragment Frag($int: Int) on Query {
          field(int: $int)
        }
      `,
      { experimentalFragmentArguments: true },
    );
    const indexCursor = createTestIndexCursor(document, schema, () => {
      throw new Error('Unexpected validation error.');
    });
    const fragmentArgNames = new Array<string | undefined>();

    expect(indexCursor.getCurrentFragmentArgument()).to.equal(undefined);

    visit(
      document,
      visitWithIndexCursor(indexCursor, {
        FragmentArgument() {
          fragmentArgNames.push(
            indexCursor.getCurrentFragmentArgument()?.variable.name.value,
          );
        },
      }),
    );

    expect(fragmentArgNames).to.deep.equal(['int']);
  });

  it('tracks mixed SDL executable input positions directly', () => {
    const document = parse(
      `
        type Query {
          field(values: [Int], input: Input, color: Color): String
        }

        input Input {
          known: Int = 1
        }

        enum Color {
          RED
        }

        {
          __schema {
            queryType { name }
          }
          __type(name: "Query") { name }
          __typename
          field(values: [2], input: { known: 3 }, color: RED)
          field(values: [[2]])
          ...Frag(value: 4)
        }

        fragment Frag($value: Int) on Query {
          field(values: [$value])
        }
      `,
      { experimentalFragmentArguments: true },
    );
    const indexCursor = createTestIndexCursor(document, undefined, () => {
      throw new Error('Unexpected validation error.');
    });
    const inputTypeNames = new Array<string | undefined>();
    const parentInputTypeNames = new Array<string | undefined>();
    const defaultValues = new Array<unknown>();
    const fragmentArgNames = new Array<string | undefined>();
    const enumValues = new Array<unknown>();
    const metaFieldNames = new Array<string>();

    visit(
      document,
      visitWithIndexCursor(indexCursor, {
        Field: {
          enter(node) {
            const fieldDef = indexCursor.getCurrentFieldDef();
            if (fieldDef != null && node.name.value.startsWith('__')) {
              metaFieldNames.push(indexCursor.index.getFieldName(fieldDef));
            }
            return undefined;
          },
          leave() {
            return undefined;
          },
        },
        ListValue() {
          const inputType = indexCursor.getCurrentInputType();
          inputTypeNames.push(
            inputType == null
              ? undefined
              : indexCursor.index.typeToString(inputType),
          );
        },
        ObjectField() {
          const inputType = indexCursor.getCurrentInputType();
          const parentInputType = indexCursor.getCurrentParentInputType();
          parentInputTypeNames.push(
            parentInputType == null
              ? undefined
              : indexCursor.index.typeToString(parentInputType),
          );
          inputTypeNames.push(
            inputType == null
              ? undefined
              : indexCursor.index.typeToString(inputType),
          );
          defaultValues.push(indexCursor.getCurrentDefaultValue());
        },
        FragmentArgument() {
          fragmentArgNames.push(
            indexCursor.getCurrentFragmentArgument()?.variable.name.value,
          );
        },
        EnumValue() {
          enumValues.push(indexCursor.getCurrentEnumValue());
        },
      }),
    );

    expect(inputTypeNames).to.deep.equal([
      'Int',
      'Int',
      'Int',
      undefined,
      'Int',
    ]);
    expect(parentInputTypeNames).to.deep.equal(['Input']);
    expect(
      defaultValues.map((value) =>
        typeof value === 'object' && value != null && 'kind' in value
          ? value.kind
          : undefined,
      ),
    ).to.deep.equal([Kind.INT]);
    expect(fragmentArgNames).to.deep.equal(['value']);
    expect(enumValues).to.deep.equal([undefined]);
    expect(metaFieldNames).to.deep.equal(['__schema', '__type', '__typename']);
  });

  it('tracks cursor states for invalid executable shapes', () => {
    const schema = buildSchema(`
      type Query {
        scalar: String
      }
    `);
    const document = parse(
      `
        {
          scalar {
            subfield
          }
          scalar @missing
          ... on Query {
            __typename
          }
          ... {
            __typename
          }
          ...Frag(missing: 1)
        }

        fragment Frag on Query {
          __typename
        }
      `,
      { experimentalFragmentArguments: true },
    );
    const indexCursor = createTestIndexCursor(document, schema, () => {
      throw new Error('Unexpected validation error.');
    });
    const parentTypes = new Array<string | undefined>();
    const directiveNames = new Array<string | undefined>();
    const inlineTypes = new Array<string | undefined>();
    const fragmentArgTypes = new Array<string | undefined>();

    visit(
      document,
      visitWithIndexCursor(indexCursor, {
        SelectionSet() {
          const parentType = indexCursor.getCurrentParentType();
          parentTypes.push(
            parentType == null
              ? undefined
              : indexCursor.index.typeToString(parentType),
          );
        },
        Directive() {
          directiveNames.push(indexCursor.getCurrentDirective()?.name);
        },
        InlineFragment() {
          const currentType = indexCursor.getCurrentType();
          inlineTypes.push(
            currentType == null
              ? undefined
              : indexCursor.index.typeToString(currentType),
          );
        },
        FragmentArgument() {
          const inputType = indexCursor.getCurrentInputType();
          fragmentArgTypes.push(
            inputType == null
              ? undefined
              : indexCursor.index.typeToString(inputType),
          );
        },
      }),
    );

    expect(parentTypes).to.include(undefined);
    expect(directiveNames).to.deep.equal([undefined]);
    expect(inlineTypes).to.deep.equal(['Query', 'Query']);
    expect(fragmentArgTypes).to.deep.equal([undefined]);

    const noSchemaDocument = parse('{ field }');
    const noSchemaCursor = createTestIndexCursor(
      noSchemaDocument,
      undefined,
      () => {
        throw new Error('Unexpected validation error.');
      },
    );
    const operationTypes = new Array<string | undefined>();

    visit(
      noSchemaDocument,
      visitWithIndexCursor(noSchemaCursor, {
        OperationDefinition() {
          const currentType = noSchemaCursor.getCurrentType();
          operationTypes.push(
            currentType == null
              ? undefined
              : noSchemaCursor.index.typeToString(currentType),
          );
        },
      }),
    );

    expect(operationTypes).to.deep.equal([undefined]);
  });

  it('handles cursor visitor inert nodes and edits', () => {
    const schema = buildSchema('type Query { field: String other: String }');
    const document = parse('{ field }');
    const inertCursor = createTestIndexCursor(document, schema, () => {
      throw new Error('Unexpected validation error.');
    });

    inertCursor.enter({ kind: Kind.NAME, value: 'field' });
    inertCursor.leave({ kind: Kind.NAME, value: 'field' });
    const orphanInput = findInputObjectDefinition(
      parse('input Input { value: String }'),
    ).fields?.[0];
    if (orphanInput == null) {
      throw new Error('Expected input field.');
    }
    inertCursor.enter(orphanInput);
    expect(inertCursor.getCurrentInputValueDefinitionRecord()).to.equal(
      undefined,
    );
    inertCursor.leave(orphanInput);
    const orphanField = findObjectDefinition(
      parse('type Query { field(arg: String): String }'),
    ).fields?.[0];
    if (orphanField == null) {
      throw new Error('Expected field definition.');
    }
    inertCursor.enter(orphanField);
    expect(inertCursor.getCurrentFieldDefinitionParentTypeName()).to.equal(
      undefined,
    );
    inertCursor.leave(orphanField);

    const enterCursor = createTestIndexCursor(document, schema, () => {
      throw new Error('Unexpected validation error.');
    });
    const enterEdited = visit(
      document,
      visitWithIndexCursor(enterCursor, {
        Field(node) {
          expect(enterCursor.getCurrentParentType()).to.equal(
            schema.getQueryType(),
          );
          return {
            ...node,
            name: { ...node.name, value: 'other' },
          };
        },
      }),
    );
    expect(getOnlyField(enterEdited).name.value).to.equal('other');

    const leaveCursor = createTestIndexCursor(document, schema, () => {
      throw new Error('Unexpected validation error.');
    });
    const leaveEdited = visit(
      document,
      visitWithIndexCursor(leaveCursor, {
        Field: {
          leave(node) {
            expect(leaveCursor.getCurrentParentType()).to.equal(
              schema.getQueryType(),
            );
            return {
              ...node,
              alias: { kind: Kind.NAME, value: 'alias' },
            };
          },
        },
      }),
    );
    expect(getOnlyField(leaveEdited).alias?.value).to.equal('alias');

    const skipCursor = createTestIndexCursor(document, schema, () => {
      throw new Error('Unexpected validation error.');
    });
    const skipped = visit(
      document,
      visitWithIndexCursor(skipCursor, {
        Field() {
          expect(skipCursor.getCurrentParentType()).to.equal(
            schema.getQueryType(),
          );
          return false;
        },
      }),
    );
    expect(getOnlyField(skipped).name.value).to.equal('field');
    expect(skipCursor.getCurrentParentType()).to.equal(undefined);
  });
});

function findObjectDefinition(
  document: DocumentNode,
): ObjectTypeDefinitionNode {
  const definition = document.definitions.find(
    (node) => node.kind === Kind.OBJECT_TYPE_DEFINITION,
  );
  if (definition?.kind !== Kind.OBJECT_TYPE_DEFINITION) {
    throw new Error('Expected object type definition.');
  }
  return definition;
}

function findInputObjectDefinition(
  document: DocumentNode,
): InputObjectTypeDefinitionNode {
  const definition = document.definitions.find(
    (node) => node.kind === Kind.INPUT_OBJECT_TYPE_DEFINITION,
  );
  if (definition?.kind !== Kind.INPUT_OBJECT_TYPE_DEFINITION) {
    throw new Error('Expected input object type definition.');
  }
  return definition;
}

function getOnlyField(document: DocumentNode): FieldNode {
  const [definition] = document.definitions;
  if (definition?.kind !== Kind.OPERATION_DEFINITION) {
    throw new Error('Expected operation definition.');
  }
  const [selection] = definition.selectionSet.selections;
  if (selection?.kind !== Kind.FIELD) {
    throw new Error('Expected field selection.');
  }
  return selection;
}
