import { describe, it } from 'node:test';

import { expect } from 'chai';

import { DirectiveLocation } from '../../language/directiveLocation.ts';
import { Kind } from '../../language/kinds.ts';
import { parse } from '../../language/parser.ts';

import { DocumentIndex, DocumentTypeKind } from '../DocumentIndex.ts';

describe('DocumentIndex', () => {
  it('indexes empty and executable-only documents', () => {
    const emptyIndex = new DocumentIndex(undefined);

    expect(emptyIndex.document).to.deep.equal({
      kind: Kind.DOCUMENT,
      definitions: [],
    });
    expect(emptyIndex.hasDocumentDefinitions).to.equal(false);
    expect(emptyIndex.hasTypeSystemDefinitions).to.equal(false);
    expect(emptyIndex.hasRootOperationTypeDefinitions).to.equal(false);
    expect(emptyIndex.getDocumentTypeNames()).to.deep.equal([]);
    expect(emptyIndex.getDocumentTypeNames()).to.equal(
      emptyIndex.getDocumentTypeNames(),
    );
    expect(emptyIndex.getDocumentTypeNameSet().size).to.equal(0);
    expect(emptyIndex.getDocumentTypeKindMap().size).to.equal(0);
    expect(emptyIndex.getDocumentTypeKinds('Missing')).to.equal(undefined);
    expect(emptyIndex.hasDocumentTypeName('Missing')).to.equal(false);
    expect(emptyIndex.hasDocumentTypeDefinition('Missing')).to.equal(false);
    expect(emptyIndex.getDocumentOutputFields('Missing')).to.equal(undefined);
    expect(emptyIndex.getDocumentInputFields('Missing')).to.equal(undefined);
    expect(emptyIndex.getDocumentUnionMembers('Missing')).to.equal(undefined);
    expect(emptyIndex.getDocumentEnumValues('Missing')).to.equal(undefined);
    expect(emptyIndex.getDocumentScalarType('Missing')).to.equal(undefined);
    expect(emptyIndex.isOneOfInputObjectType('Missing')).to.equal(false);
    expect(emptyIndex.getFragmentSignatureByName()('Missing')).to.equal(
      undefined,
    );
    expect(emptyIndex.getDocumentDirectiveNames()).to.deep.equal([]);
    expect(emptyIndex.getDocumentDirectiveLocationSet('include')).to.equal(
      undefined,
    );
    expect(emptyIndex.isDocumentDirectiveRepeatable('include')).to.equal(
      undefined,
    );
    expect(emptyIndex.getDocumentDirectiveArgumentMap('include')).to.equal(
      undefined,
    );

    const executableDocument = parse('{ field }');
    const executableIndex = new DocumentIndex(executableDocument);
    expect(executableIndex.getDocumentToTraverse()).to.equal(
      executableDocument,
    );
    expect(executableIndex.hasTypeSystemDefinitions).to.equal(false);
  });

  it('indexes document type-system definitions', () => {
    const document = parse(`
      type Query {
        field(arg: String, arg: Int): String
        repeated: String
        repeated: Int
      }

      type Mutation {
        mutate: String
      }

      type Subscription {
        event: String
      }

      interface Node {
        id: ID
      }

      interface Resource implements Node {
        id: ID
      }

      extend type Query implements Node & Resource {
        extra: String
      }

      union Search = Query | Other | Query
      extend union Search = Other

      type Other {
        field: String
      }

      enum Color {
        RED
        RED
      }

      extend enum Color {
        BLUE
      }

      input Filter @oneOf {
        term: String
        term: Int
      }

      extend input Filter {
        other: String
      }

      scalar Date
      extend scalar Date @specifiedBy(url: "https://example.com/date")

      directive @tag(arg: String, label: String) repeatable on FIELD | FIELD_DEFINITION
    `);
    const index = new DocumentIndex(document);

    expect(index.hasDocumentDefinitions).to.equal(true);
    expect(index.hasTypeSystemDefinitions).to.equal(true);
    expect(index.hasRootOperationTypeDefinitions).to.equal(false);
    expect(index.getDocumentTypeNames()).to.include.members([
      'Query',
      'Mutation',
      'Subscription',
      'Node',
      'Resource',
      'Search',
      'Other',
      'Color',
      'Filter',
      'Date',
    ]);
    expect(index.getDocumentTypeNames()).to.equal(index.getDocumentTypeNames());
    expect(index.getDocumentTypeNameSet().has('Query')).to.equal(true);
    expect(index.hasDocumentTypeDefinition('Date')).to.equal(true);
    expect(index.hasDocumentTypeName('Date')).to.equal(true);
    expect(index.getDocumentTypeKinds('Query')).to.include(
      DocumentTypeKind.OBJECT,
    );
    expect(index.getDocumentTypeKindMap().get('Filter')).to.include(
      DocumentTypeKind.INPUT_OBJECT,
    );
    expect(index.getDocumentTypeNodes('Query')).to.have.lengthOf(2);

    expect(index.getDocumentTypeDefinitionName('Query')?.value).to.equal(
      'Query',
    );
    expect(index.getDocumentRootOperationTypes().get('query')).to.deep.include({
      typeName: 'Query',
      node: undefined,
    });
    expect(
      index.getDocumentRootOperationTypes().get('mutation'),
    ).to.deep.include({
      typeName: 'Mutation',
      node: undefined,
    });
    expect(
      index.getDocumentRootOperationTypes().get('subscription'),
    ).to.deep.include({
      typeName: 'Subscription',
      node: undefined,
    });
    expect(index.getExplicitDocumentRootOperationTypes().size).to.equal(0);

    expect(
      Array.from(index.getDocumentOutputFields('Query')?.keys() ?? []),
    ).to.deep.equal(['field', 'repeated', 'extra']);
    expect(
      Array.from(
        index.getDocumentImplementedInterfaceNames('Query')?.values() ?? [],
      ),
    ).to.deep.equal(['Node', 'Resource']);
    expect(
      index.getDocumentImplementedTypes().map(({ kind }) => kind),
    ).to.include.members([
      Kind.OBJECT_TYPE_DEFINITION,
      Kind.INTERFACE_TYPE_DEFINITION,
    ]);
    expect(
      Array.from(index.getDocumentUnionMembers('Search')?.keys() ?? []),
    ).to.deep.equal(['Query', 'Other']);
    expect(
      Array.from(index.getDocumentEnumValues('Color')?.keys() ?? []),
    ).to.deep.equal(['RED', 'BLUE']);
    expect(
      Array.from(index.getDocumentInputFields('Filter')?.keys() ?? []),
    ).to.deep.equal(['term', 'other']);
    expect(index.getDocumentInputObjectTypes()).to.have.lengthOf(2);
    expect(index.isOneOfInputObjectType('Filter')).to.equal(true);
    expect(index.getDocumentScalarType('Date')?.name).to.equal('Date');

    expect(index.getUniqueFieldDefinitionErrors()).to.have.lengthOf(2);
    expect(index.getUniqueArgumentDefinitionErrors()).to.have.lengthOf(1);
    expect(index.getUniqueEnumValueDefinitionErrors()).to.have.lengthOf(1);
    expect(index.getUniqueUnionMemberTypeErrors()).to.have.lengthOf(2);

    expect(index.getDocumentDirectiveNames()).to.deep.equal(['tag']);
    expect(index.getDocumentDirectiveNames()).to.equal(
      index.getDocumentDirectiveNames(),
    );
    expect(index.getDocumentDirectiveLocationSet('tag')).to.include.members([
      DirectiveLocation.FIELD,
      DirectiveLocation.FIELD_DEFINITION,
    ]);
    expect(index.isDocumentDirectiveRepeatable('tag')).to.equal(true);
    expect(index.getDocumentDirectiveDefinitionName('tag')?.value).to.equal(
      'tag',
    );
    expect(
      Array.from(index.getDocumentDirectiveArgumentMap('tag')?.keys() ?? []),
    ).to.deep.equal(['arg', 'label']);
  });

  it('indexes explicit schema operation types', () => {
    const document = parse(`
      schema {
        query: Root
      }

      extend schema {
        mutation: Mutations
      }

      type Query {
        ignoredBySchemaDefinition: String
      }

      type Root {
        field: String
      }

      type Mutations {
        field: String
      }
    `);
    const index = new DocumentIndex(document);

    expect(index.hasRootOperationTypeDefinitions).to.equal(true);
    expect(
      index.getDocumentRootOperationTypes().get('query')?.typeName,
    ).to.equal('Root');
    expect(
      index.getDocumentRootOperationTypes().get('query')?.node?.name.value,
    ).to.equal('Root');
    expect(
      index.getDocumentRootOperationTypes().get('mutation')?.typeName,
    ).to.equal('Mutations');
    expect(
      index.getExplicitDocumentRootOperationTypes().get('mutation')?.typeName,
    ).to.equal('Mutations');
    expect(index.getDocumentRootOperationTypes().has('subscription')).to.equal(
      false,
    );
  });

  it('indexes fragment signatures', () => {
    const document = parse(
      `
        type Query {
          id: ID
        }

        fragment WithVars($id: ID) on Query {
          id
        }

        fragment NoVars on Query {
          id
        }
      `,
      { experimentalFragmentArguments: true },
    );
    const index = new DocumentIndex(document);
    const getFragmentSignatureByName = index.getFragmentSignatureByName();

    expect(index.getFragmentSignatureByName()).to.equal(
      getFragmentSignatureByName,
    );
    expect(getFragmentSignatureByName('WithVars')?.definition.name.value).to.eq(
      'WithVars',
    );
    expect(
      getFragmentSignatureByName('WithVars')?.variableDefinitions.has('id'),
    ).to.equal(true);
    expect(
      getFragmentSignatureByName('NoVars')?.variableDefinitions.size,
    ).to.equal(0);
    expect(getFragmentSignatureByName('Missing')).to.equal(undefined);
  });

  it('filters SDL traversal to executable, directive, and default-value trees', () => {
    const document = parse(`
      directive @tag(value: Int = 1) on
        | SCHEMA
        | OBJECT
        | FIELD_DEFINITION
        | ARGUMENT_DEFINITION
        | INPUT_FIELD_DEFINITION
        | ENUM_VALUE

      directive @unused(value: Int) on FIELD

      schema @tag {
        query: Query
      }

      type Query @tag {
        keptByDefault(arg: Int = 1, plain: String): String
        keptByDirective(arg: Int @tag, plain: String): String
        pruned(arg: String): String
      }

      interface Node @tag {
        keptByDefault(arg: Int = 1, plain: String): String
        pruned(arg: String): String
      }

      input Input {
        keptByDefault: Int = 1
        keptByDirective: Int @tag
        pruned: String
      }

      enum Color {
        RED @tag
        BLUE
      }

      scalar Custom @tag
      union Search @tag = Query

      type Plain {
        field(arg: String): String
      }

      query Test($v: Int = 1) {
        keptByDefault(arg: $v)
      }
    `);
    const index = new DocumentIndex(document);
    const documentToTraverse = index.getDocumentToTraverse();

    expect(index.getDocumentToTraverse()).to.equal(documentToTraverse);
    expect(documentToTraverse.definitions.map((node) => node.kind)).to.eql([
      Kind.DIRECTIVE_DEFINITION,
      Kind.SCHEMA_DEFINITION,
      Kind.OBJECT_TYPE_DEFINITION,
      Kind.INTERFACE_TYPE_DEFINITION,
      Kind.INPUT_OBJECT_TYPE_DEFINITION,
      Kind.ENUM_TYPE_DEFINITION,
      Kind.SCALAR_TYPE_DEFINITION,
      Kind.UNION_TYPE_DEFINITION,
      Kind.OPERATION_DEFINITION,
    ]);

    const directiveDefinition = documentToTraverse.definitions[0];
    if (directiveDefinition.kind !== Kind.DIRECTIVE_DEFINITION) {
      throw new Error('Expected directive definition.');
    }
    expect(directiveDefinition.arguments?.map((arg) => arg.name.value)).to.eql([
      'value',
    ]);

    const queryType = documentToTraverse.definitions[2];
    if (queryType.kind !== Kind.OBJECT_TYPE_DEFINITION) {
      throw new Error('Expected object type definition.');
    }
    expect(queryType.fields?.map((field) => field.name.value)).to.eql([
      'keptByDefault',
      'keptByDirective',
    ]);
    expect(
      queryType.fields?.map((field) =>
        field.arguments?.map((arg) => arg.name.value),
      ),
    ).to.eql([['arg'], ['arg']]);

    const inputType = documentToTraverse.definitions[4];
    if (inputType.kind !== Kind.INPUT_OBJECT_TYPE_DEFINITION) {
      throw new Error('Expected input object type definition.');
    }
    expect(inputType.fields?.map((field) => field.name.value)).to.eql([
      'keptByDefault',
      'keptByDirective',
    ]);

    const enumType = documentToTraverse.definitions[5];
    if (enumType.kind !== Kind.ENUM_TYPE_DEFINITION) {
      throw new Error('Expected enum type definition.');
    }
    expect(enumType.values?.map((value) => value.name.value)).to.eql(['RED']);

    const operation = document.definitions.find(
      (definition) => definition.kind === Kind.OPERATION_DEFINITION,
    );
    expect(documentToTraverse.definitions.at(-1)).to.equal(operation);
  });

  it('filters empty SDL extensions from traversal', () => {
    const index = new DocumentIndex({
      kind: Kind.DOCUMENT,
      definitions: [
        {
          kind: Kind.SCHEMA_EXTENSION,
        },
        {
          kind: Kind.SCALAR_TYPE_EXTENSION,
          name: { kind: Kind.NAME, value: 'Scalar' },
        },
        {
          kind: Kind.UNION_TYPE_EXTENSION,
          name: { kind: Kind.NAME, value: 'Union' },
        },
        {
          kind: Kind.DIRECTIVE_EXTENSION,
          name: { kind: Kind.NAME, value: 'tag' },
        },
      ],
    });

    expect(index.getDocumentToTraverse().definitions).to.deep.equal([]);
  });
});
