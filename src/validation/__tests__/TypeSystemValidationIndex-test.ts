import { describe, it } from 'node:test';

import { expect } from 'chai';

import { expectJSON } from '../../__testUtils__/expectJSON.ts';

import type { GraphQLError } from '../../error/GraphQLError.ts';

import type {
  DocumentNode,
  NamedTypeNode,
  ObjectTypeDefinitionNode,
  ObjectTypeExtensionNode,
} from '../../language/ast.ts';
import { DirectiveLocation } from '../../language/directiveLocation.ts';
import { Kind } from '../../language/kinds.ts';
import { parse, parseType, parseValue } from '../../language/parser.ts';

import {
  GraphQLEnumType,
  GraphQLInputObjectType,
  GraphQLInterfaceType,
  GraphQLNonNull,
  GraphQLObjectType,
  GraphQLScalarType,
  GraphQLUnionType,
} from '../../type/definition.ts';
import { GraphQLDirective } from '../../type/directives.ts';
import { GraphQLString } from '../../type/scalars.ts';
import { GraphQLSchema } from '../../type/schema.ts';

import { DocumentIndex } from '../DocumentIndex.ts';
import type { SchemaDirectiveUsageRecord } from '../TypeSystemValidationIndex.ts';
import { TypeSystemValidationIndex } from '../TypeSystemValidationIndex.ts';

describe('TypeSystemValidationIndex', () => {
  it('reports errors and filters empty nodes from node arrays', () => {
    const errors = new Array<unknown>();
    const index = createIndex(undefined, schemaWithQuery(), (error) => {
      errors.push(error);
    });

    const node = parse('type Query { field: String }', {
      noLocation: true,
    }).definitions[0];
    index.reportError('Single AST node error', node);
    index.reportError('Single node error', undefined);
    index.reportError('Filtered node error', [undefined]);
    index.reportError('Filtered AST node error', [undefined, node]);

    expectJSON(errors).toDeepEqual([
      { message: 'Single AST node error' },
      { message: 'Single node error' },
      { message: 'Filtered node error' },
      { message: 'Filtered AST node error' },
    ]);
  });

  it('indexes schema validation elements', () => {
    const Node = new GraphQLInterfaceType({
      name: 'Node',
      fields: {
        id: { type: GraphQLString },
      },
    });
    const Query = new GraphQLObjectType({
      name: 'Query',
      interfaces: [Node],
      fields: {
        field: {
          type: GraphQLString,
          args: {
            arg: {
              type: GraphQLString,
              default: { value: 'default' },
              deprecationReason: 'old',
            },
          },
          deprecationReason: 'old',
        },
      },
    });
    const Input = new GraphQLInputObjectType({
      name: 'Input',
      isOneOf: true,
      fields: {
        inputField: {
          type: GraphQLString,
          default: { value: 'default' },
          deprecationReason: 'old',
        },
      },
    });
    const Scalar = new GraphQLScalarType({
      name: 'Scalar',
      specifiedByURL: 'https://example.com/scalar',
    });
    const Color = new GraphQLEnumType({
      name: 'Color',
      values: {
        RED: { deprecationReason: 'old' },
      },
    });
    const Search = new GraphQLUnionType({
      name: 'Search',
      types: [Query],
    });
    const tagDirective = new GraphQLDirective({
      name: 'tag',
      locations: [DirectiveLocation.OBJECT],
      deprecationReason: 'old',
      args: {
        label: {
          type: GraphQLString,
          default: { value: 'default' },
        },
      },
    });
    const index = createIndex(
      undefined,
      new GraphQLSchema({
        query: Query,
        types: [Input, Scalar, Color, Search],
        directives: [tagDirective],
      }),
      (error) => {
        throw error;
      },
    );
    const schemaElements = index.getSchemaValidationElements();

    expect(schemaElements.rootTypes).to.have.lengthOf(1);
    expect(index.getFields('Query')).to.have.lengthOf(1);
    expect(
      index
        .getInputObjectFieldsForType(Input)
        ?.map((field) => index.getInputFieldName(field)),
    ).to.deep.equal(['inputField']);
    expect(schemaElements.scalarTypes.map((type) => type.name)).to.include(
      'String',
    );
    expect(schemaElements.objectTypes.map(({ type }) => type.name)).to.include(
      'Query',
    );
    expect(
      schemaElements.interfaceTypes.map(({ type }) => type.name),
    ).to.include('Node');
    expect(schemaElements.unionTypes.map(({ type }) => type.name)).to.include(
      'Search',
    );
    expect(schemaElements.enumTypes.map(({ type }) => type.name)).to.include(
      'Color',
    );
    expect(
      schemaElements.inputObjectTypes.map(({ type }) => type.name),
    ).to.include('Input');
    expect(schemaElements.directives).to.deep.equal([tagDirective]);
    expect(schemaElements.directiveLocations).to.have.lengthOf(1);
    expect(
      schemaElements.namedElements.map((element) => element.name),
    ).to.include.members([
      'tag',
      'Query',
      'field',
      'arg',
      'Node',
      'Color',
      'RED',
      'Input',
    ]);
    expect(
      schemaElements.outputTypes.map(({ field }) => field.name),
    ).to.include.members(['field', 'id']);
    expect(
      schemaElements.inputValues.map(({ inputValue }) => inputValue.name),
    ).to.include.members(['label', 'arg', 'inputField']);
    expect(
      schemaElements.defaultValues.map(({ inputValue }) => inputValue.name),
    ).to.include.members(['label', 'arg', 'inputField']);
    expect(
      schemaElements.deprecations.map(({ element }) => element.name),
    ).to.include.members(['field', 'arg', 'inputField']);
    expect(schemaElements.unionMembers).to.have.lengthOf(1);
    expect(index.isUnionType(Search)).to.equal(true);
    expect(
      schemaElements.directiveUsages.map(({ name }) => name),
    ).to.have.members([
      'deprecated',
      'deprecated',
      'deprecated',
      'deprecated',
      'deprecated',
      'specifiedBy',
      'oneOf',
    ]);
  });

  it('caches schema validation records with per-index arrays', () => {
    const schema = schemaWithQuery();
    const firstIndex = createIndex(undefined, schema, (error) => {
      throw error;
    });
    const firstSchemaElements = firstIndex.getSchemaValidationElements();
    const directiveUsages =
      firstSchemaElements.directiveUsages as Array<SchemaDirectiveUsageRecord>;
    const directiveUsageCount = directiveUsages.length;
    directiveUsages.push({ name: 'deprecated', element: schema });

    expect(
      firstIndex.getSchemaValidationElements().directiveUsages,
    ).to.have.lengthOf(directiveUsageCount + 1);

    const secondIndex = createIndex(undefined, schema, (error) => {
      throw error;
    });
    const secondSchemaElements = secondIndex.getSchemaValidationElements();

    expect(secondSchemaElements).to.not.equal(firstSchemaElements);
    expect(secondSchemaElements.directiveUsages).to.have.lengthOf(
      directiveUsageCount,
    );
  });

  it('caches input type and field references per index', () => {
    const Filter = new GraphQLInputObjectType({
      name: 'Filter',
      fields: {
        term: { type: new GraphQLNonNull(GraphQLString) },
      },
    });
    const index = createIndex(undefined, undefined, (error) => {
      throw error;
    });

    const nonNullFilter = new GraphQLNonNull(Filter);
    const firstTypeReference = index.getType(nonNullFilter);
    expect(index.getType(nonNullFilter)).to.equal(firstTypeReference);

    const firstInputObjectReference = index.getType(Filter);
    expect(index.getType(Filter)).to.equal(firstInputObjectReference);
    expect(firstInputObjectReference.kind).to.equal('inputObject');
    if (firstInputObjectReference.kind !== 'inputObject') {
      throw new Error('Expected input object reference.');
    }
    expect(firstInputObjectReference.fields).to.deep.equal([
      Filter.getFields().term,
    ]);

    const field = Filter.getFields().term;
    const firstFieldReference = index.getField(field);
    expect(index.getField(field)).to.equal(firstFieldReference);
    expect(firstFieldReference.name).to.equal('term');
  });

  it('indexes invalid schema object elements', () => {
    const schema = schemaWithQuery();
    const queryType = schema.getQueryType();
    const invalidType = {};
    const invalidDirective = {};
    const typeMap = Object.create({ InheritedType: invalidType }) as {
      [key: string]: unknown;
    };
    typeMap.Query = queryType;
    typeMap.InvalidType = invalidType;

    schema.getTypeMap = () =>
      typeMap as unknown as ReturnType<GraphQLSchema['getTypeMap']>;
    schema.getDirectives = () =>
      [invalidDirective] as unknown as ReturnType<
        GraphQLSchema['getDirectives']
      >;

    const index = createIndex(undefined, schema, (error) => {
      throw error;
    });
    const schemaElements = index.getSchemaValidationElements();

    expect(schemaElements.invalidNamedTypes).to.deep.equal([
      { type: invalidType },
    ]);
    expect(schemaElements.invalidDirectives).to.deep.equal([
      { directive: invalidDirective },
    ]);
    expect(index.getTypeNames()).to.not.include('InheritedType');
    expect(index.getObjectTypeNames()).to.include('Query');
    expect(index.getObjectTypeNames()).to.not.include('InheritedType');
  });

  it('merges schema definitions into root, directive, and uniqueness APIs', () => {
    const Existing = new GraphQLObjectType({
      name: 'Existing',
      fields: {
        field: { type: GraphQLString },
      },
    });
    const Input = new GraphQLInputObjectType({
      name: 'Input',
      fields: {
        field: { type: GraphQLString },
      },
    });
    const Color = new GraphQLEnumType({
      name: 'Color',
      values: {
        RED: {},
      },
    });
    const Search = new GraphQLUnionType({
      name: 'Search',
      types: [Existing],
    });
    const tagDirective = new GraphQLDirective({
      name: 'tag',
      locations: [DirectiveLocation.FIELD],
    });
    const schema = new GraphQLSchema({
      query: Existing,
      types: [Input, Color, Search],
      directives: [tagDirective],
    });
    const typeMap = Object.create({ InheritedType: Existing }) as {
      [key: string]: unknown;
    };
    Object.assign(typeMap, schema.getTypeMap());
    schema.getTypeMap = () =>
      typeMap as ReturnType<GraphQLSchema['getTypeMap']>;
    const document = parse(`
      type Existing {
        other: String
      }

      scalar String

      extend type Existing {
        field: String
      }

      extend input Input {
        field: String
      }

      extend enum Color {
        RED
      }

      extend union Search = Existing
      extend union Search = Existing

      directive @tag on FIELD
      directive @tag on FIELD
    `);
    const index = createIndex(document, schema, (error) => {
      throw error;
    });

    expect(index.getRootOperationTypes().get('query')?.typeName).to.equal(
      'Existing',
    );
    expect(index.getTypeNames()).to.include.members([
      'Existing',
      'Input',
      'Color',
      'Search',
      'String',
    ]);
    expect(index.getTypeNames()).not.to.include('InheritedType');
    expect(index.getUniqueTypeDefinitionErrors()).to.have.lengthOf(2);
    expect(index.getUniqueFieldDefinitionErrors()).to.have.lengthOf(2);
    expect(index.getUniqueEnumValueDefinitionErrors()).to.have.lengthOf(1);
    expect(index.getUniqueUnionMemberTypeErrors()).to.have.lengthOf(2);
    expect(index.getUniqueDirectiveDefinitionErrors()).to.have.lengthOf(2);
    expect(index.getUniqueTypeDefinitionErrors()).to.equal(
      index.getUniqueTypeDefinitionErrors(),
    );
    expect(index.getUniqueFieldDefinitionErrors()).to.equal(
      index.getUniqueFieldDefinitionErrors(),
    );
    expect(index.getUniqueEnumValueDefinitionErrors()).to.equal(
      index.getUniqueEnumValueDefinitionErrors(),
    );
    expect(index.getUniqueUnionMemberTypeErrors()).to.equal(
      index.getUniqueUnionMemberTypeErrors(),
    );
    expect(index.getUniqueDirectiveDefinitionErrors()).to.equal(
      index.getUniqueDirectiveDefinitionErrors(),
    );
    expect(index.getDirectiveNames()).to.deep.equal(['tag']);
    expect(index.getDirectiveLocationSet('tag')).to.include(
      DirectiveLocation.FIELD,
    );
    expect(index.getDirectiveArgumentMap('tag')).to.equal(undefined);
    expect(index.isDirectiveRepeatable('tag')).to.equal(false);
  });

  it('handles empty document extensions and invalid schema directives in merge APIs', () => {
    const Query = new GraphQLObjectType({
      name: 'Query',
      fields: {
        field: { type: GraphQLString },
      },
    });
    const Input = new GraphQLInputObjectType({
      name: 'Input',
      fields: {
        schemaField: { type: GraphQLString },
      },
    });
    const Color = new GraphQLEnumType({
      name: 'Color',
      values: {
        RED: {},
      },
    });
    const Search = new GraphQLUnionType({
      name: 'Search',
      types: [Query],
    });
    const tagDirective = new GraphQLDirective({
      name: 'tag',
      locations: [DirectiveLocation.FIELD],
    });
    const schema = new GraphQLSchema({
      query: Query,
      types: [Input, Color, Search],
      directives: [tagDirective],
    });
    schema.getDirectives = () =>
      [
        undefined as unknown as GraphQLDirective,
        tagDirective,
      ] as ReadonlyArray<GraphQLDirective>;
    const document = parse(`
      extend input Input @tag
      extend enum Color @tag
      extend enum Missing @tag
      extend union Search @tag
      extend union Missing @tag
    `);
    const index = createIndex(document, schema, (error) => {
      throw error;
    });

    expect(
      index
        .getInputObjectFieldsForType(Input)
        ?.map((field) => index.getInputFieldName(field)),
    ).to.deep.equal(['schemaField']);
    expect(index.getUniqueEnumValueDefinitionErrors()).to.deep.equal([]);
    expect(index.getUniqueUnionMemberTypeErrors()).to.deep.equal([]);
    expect(index.getDirectiveNames()).to.deep.equal(['tag']);
  });

  it('keeps document field duplicates not superseded by schema conflicts', () => {
    const Existing = new GraphQLObjectType({
      name: 'Existing',
      fields: {
        field: { type: GraphQLString },
      },
    });
    const Input = new GraphQLInputObjectType({
      name: 'Input',
      fields: {
        field: { type: GraphQLString },
      },
    });
    const schema = new GraphQLSchema({
      query: Existing,
      types: [Input],
    });
    const document = parse(`
      extend type Existing {
        field: String
      }

      extend type Existing {
        field: String
        other: String
      }

      extend type Existing {
        other: String
      }

      input Input {
        field: String
      }
    `);
    const index = createIndex(document, schema, (error) => {
      throw error;
    });
    const messages = index
      .getUniqueFieldDefinitionErrors()
      .map((error) => error.message);

    expect(messages).to.have.lengthOf(4);
    expect(
      messages.filter(
        (message) =>
          message ===
          'Field "Existing.field" already exists in the schema. It cannot also be defined in this type extension.',
      ),
    ).to.have.lengthOf(2);
    expect(messages).to.include(
      'Field "Existing.other" can only be defined once.',
    );
    expect(messages).to.include(
      'Field "Input.field" already exists in the schema. It cannot also be defined in this type extension.',
    );
  });

  it('lazily indexes document type-system accessor data', () => {
    const document = parse(`
      type Query {
        field(arg: String = "value"): Output
      }

      type Output {
        field: String
      }

      input Input {
        value: String
      }
    `);
    const queryDefinition = document.definitions[0];
    if (queryDefinition.kind !== 'ObjectTypeDefinition') {
      throw new Error('Expected object type definition.');
    }
    const fieldType = queryDefinition.fields?.[0].type;
    if (fieldType == null) {
      throw new Error('Expected field type.');
    }

    const index = createIndex(document, undefined, (error) => {
      throw error;
    });

    expect(index.isOutputType(fieldType)).to.equal(true);
    expect(index.isOutputType(fieldType)).to.equal(true);
    expect(index.getTypeNames()).to.include('Query');
    expect(index.getTypeNames()).to.include('Query');
    expect(index.isInputType(parseType('Missing'))).to.equal(false);
    expect(index.isOutputType(parseType('Missing'))).to.equal(false);
    expect(index.getFields('Missing')).to.equal(undefined);
    expect(index.hasUnionMember('Missing', 'Other')).to.equal(false);
    expect(index.hasOtherTypeKind('Missing', 'Object')).to.equal(false);
    expect(
      index
        .getInputObjectFieldsForType(parseType('Input'))
        ?.map((field) => index.getInputFieldName(field)),
    ).to.deep.equal(['value']);
  });

  it('indexes schema extension AST nodes and ambiguous type classifications', () => {
    const queryDefinition = parse('type Query { field: String }')
      .definitions[0] as ObjectTypeDefinitionNode;
    const queryExtension = parse('extend type Query { other: String }')
      .definitions[0] as ObjectTypeExtensionNode;
    const SchemaInput = new GraphQLInputObjectType({
      name: 'SchemaInput',
      fields: {
        value: { type: GraphQLString },
      },
    });
    const SchemaObject = new GraphQLObjectType({
      name: 'SchemaObject',
      fields: {
        value: { type: GraphQLString },
      },
    });
    const Query = new GraphQLObjectType({
      name: 'Query',
      fields: {
        field: { type: GraphQLString },
      },
      astNode: queryDefinition,
      extensionASTNodes: [queryExtension],
    });
    const schema = new GraphQLSchema({
      query: Query,
      types: [SchemaInput, SchemaObject],
    });
    const document = parse(`
      type SchemaInput {
        value: String
      }

      input SchemaObject {
        value: String
      }
    `);
    const index = createIndex(document, schema, (error) => {
      throw error;
    });

    expect(Query.astNode).to.equal(queryDefinition);
    expect(Query.extensionASTNodes).to.deep.equal([queryExtension]);
    expect(index.isInputType(parseType('SchemaInput'))).to.equal(true);
    expect(index.isOutputType(parseType('SchemaInput'))).to.equal(true);
    expect(index.hasNonInputType(parseType('SchemaInput'))).to.equal(true);
    expect(index.hasNonOutputType(parseType('SchemaInput'))).to.equal(true);
    expect(index.isInputType(parseType('SchemaObject'))).to.equal(true);
    expect(index.isOutputType(parseType('SchemaObject'))).to.equal(true);
    expect(index.hasNonInputType(parseType('SchemaObject'))).to.equal(true);
    expect(index.hasNonOutputType(parseType('SchemaObject'))).to.equal(true);
  });

  it('resolves schema and document type references through the index', () => {
    const SchemaObject = new GraphQLObjectType({
      name: 'SchemaObject',
      fields: {
        value: { type: GraphQLString },
      },
    });
    const SchemaInput = new GraphQLInputObjectType({
      name: 'SchemaInput',
      fields: {
        value: { type: GraphQLString },
      },
    });
    const Filter = new GraphQLInputObjectType({
      name: 'Filter',
      fields: {
        schemaOnly: { type: GraphQLString },
      },
    });
    const Query = new GraphQLObjectType({
      name: 'Query',
      fields: {
        schemaField: {
          type: SchemaObject,
          args: {
            input: { type: new GraphQLNonNull(SchemaInput) },
          },
        },
      },
    });
    const document = parse(`
      interface Node {
        id: String
      }

      interface Resource implements Node {
        id: String
        resource: String
      }

      type User implements Node & Resource {
        id: String
        resource: String
        name: String
      }

      type Photo implements Node {
        id: String
        url: String
      }

      union Search = User | Photo

      type Query {
        search: Search
        resource: Resource
        user: User
      }

      input Filter {
        term: String
      }

      enum Color {
        RED
        BLUE
      }
    `);
    const schema = new GraphQLSchema({
      query: Query,
      types: [Filter, SchemaInput, SchemaObject],
    });
    const index = createIndex(document, schema, (error) => {
      throw error;
    });

    expect(index.getTypeNames()).to.include.members(['SchemaInput', 'User']);
    expect(
      index.getFields('Query')?.map((field) => index.getFieldName(field)),
    ).to.include.members(['search', 'resource', 'user']);
    expect(
      index.typeToString(index.getNullableType(parseType('String!'))),
    ).to.equal('String');
    expect(index.getTypeReference(parseType('SchemaInput'))).to.equal(
      SchemaInput,
    );
    expect(index.getTypeReference(parseType('Missing'))).to.equal(undefined);
    expect(index.hasOutputType(parseType('SchemaInput'))).to.equal(false);
    expect(index.hasOutputType(parseType('[User]'))).to.equal(true);
    expect(
      index.typeToString(index.getNamedOutputType(parseType('[User!]'))),
    ).to.equal('User');
    expect(index.getNamedOutputTypeByName('SchemaObject')).to.equal(
      SchemaObject,
    );
    expect(index.isCompositeType(parseType('[User]'))).to.equal(false);
    expect(index.isUnionType(parseType('Search'))).to.equal(true);
    expect(index.getInputTypeReference(parseType('SchemaObject'))).to.equal(
      undefined,
    );
    expect(index.hasInputType(parseType('SchemaObject'))).to.equal(false);
    expect(
      index.typeToString(index.getNamedInputType(parseType('[Filter!]'))),
    ).to.equal('Filter');
    expect(
      index
        .getInputObjectFieldsForType(Filter)
        ?.map((field) => index.getInputFieldName(field)),
    ).to.deep.equal(['schemaOnly', 'term']);
    expect(index.isInputObjectType(parseType('[Filter]'))).to.equal(false);

    const schemaArg = Query.getFields().schemaField.args[0];
    expect(index.argumentToString(schemaArg)).to.equal(String(schemaArg));
    expect(index.isRequiredArgument(schemaArg)).to.equal(true);
    expect(index.getInputFieldDef(GraphQLString, 'field')).to.equal(undefined);
    const enumValueNames = index.getEnumValueNames(parseType('Color'));
    expect(
      enumValueNames == null ? undefined : Array.from(enumValueNames.keys()),
    ).to.deep.equal(['RED', 'BLUE']);
    expect(index.getLeafType(parseType('String'))).to.equal(GraphQLString);

    expect(
      index.isOutputTypeSubTypeOf(parseType('User'), parseType('User')),
    ).to.equal(true);
    expect(
      index.isOutputTypeSubTypeOf(parseType('User'), parseType('Search')),
    ).to.equal(true);
    expect(
      index.isOutputTypeSubTypeOf(parseType('User'), parseType('Node')),
    ).to.equal(true);
    expect(
      index.isOutputTypeSubTypeOf(parseType('User'), parseType('Query')),
    ).to.equal(false);
    expect(
      index.isInputTypeSubTypeOf(parseType('[String]!'), parseType('String!')),
    ).to.equal(false);
    expect(
      index.getSuggestedTypeNames(parseType('Resource'), 'id'),
    ).to.have.members(['User', 'Resource', 'Node']);

    const missingFieldDefinition = parse(
      'type Query { missing(arg: String!): Missing }',
    ).definitions[0];
    if (
      missingFieldDefinition.kind !== Kind.OBJECT_TYPE_DEFINITION ||
      missingFieldDefinition.fields == null
    ) {
      throw new Error('Expected object type definition.');
    }
    const missingField = missingFieldDefinition.fields[0];
    const missingArg = missingField.arguments?.[0];
    if (missingArg == null) {
      throw new Error('Expected argument definition.');
    }
    expect(index.getFieldType(missingField)).to.equal(missingField.type);
    expect(index.fieldToString(missingField)).to.equal('missing');
    expect(index.argumentToString(missingArg)).to.equal('arg:');
  });

  it('merges schema and document references without document wrappers', () => {
    const SchemaNode = new GraphQLInterfaceType({
      name: 'SchemaNode',
      fields: {
        id: { type: GraphQLString },
      },
    });
    const SchemaResource = new GraphQLInterfaceType({
      name: 'SchemaResource',
      interfaces: [SchemaNode],
      fields: {
        id: { type: GraphQLString },
        resource: { type: GraphQLString },
      },
    });
    const SchemaObject = new GraphQLObjectType({
      name: 'SchemaObject',
      interfaces: [SchemaNode, SchemaResource],
      fields: {
        id: { type: GraphQLString },
        resource: { type: GraphQLString },
        schemaField: { type: GraphQLString },
      },
    });
    const OtherSchemaObject = new GraphQLObjectType({
      name: 'OtherSchemaObject',
      interfaces: [SchemaNode],
      fields: {
        id: { type: GraphQLString },
        field: { type: GraphQLString },
      },
    });
    const EmptyInput = new GraphQLInputObjectType({
      name: 'EmptyInput',
      fields: {},
    });
    const SchemaInput = new GraphQLInputObjectType({
      name: 'SchemaInput',
      fields: {
        schemaField: { type: GraphQLString },
      },
    });
    const SchemaOneOf = new GraphQLInputObjectType({
      name: 'SchemaOneOf',
      isOneOf: true,
      fields: {
        value: { type: GraphQLString },
      },
    });
    const DocumentOneOf = new GraphQLInputObjectType({
      name: 'DocumentOneOf',
      fields: {
        value: { type: GraphQLString },
      },
    });
    const SchemaColor = new GraphQLEnumType({
      name: 'SchemaColor',
      values: {
        RED: {},
      },
    });
    const SchemaOnlyColor = new GraphQLEnumType({
      name: 'SchemaOnlyColor',
      values: {
        RED: {},
      },
    });
    const schema = new GraphQLSchema({
      query: SchemaObject,
      types: [
        EmptyInput,
        OtherSchemaObject,
        SchemaColor,
        SchemaInput,
        SchemaNode,
        SchemaObject,
        SchemaOneOf,
        DocumentOneOf,
        SchemaResource,
        SchemaOnlyColor,
      ],
    });
    const document = parse(`
      extend type SchemaObject {
        documentField: String
      }

      extend input EmptyInput {
        documentField: String
      }

      extend input SchemaInput {
        documentField: String
      }

      extend enum SchemaColor {
        BLUE
      }

      interface DocNode {
        id: String
      }

      type User implements DocNode {
        id: String
      }

      type Photo {
        url: String
      }

      union DocSearch = User | Photo | SchemaObject

      enum DocColor {
        RED
      }

      input DocumentOneOf @oneOf {
        value: String
      }
    `);
    const index = createIndex(document, schema, (error) => {
      throw error;
    });

    expect(index.hasNonOutputType(parseType('[SchemaInput]'))).to.equal(true);
    expect(index.isInterfaceType(parseType('DocNode'))).to.equal(true);
    expect(
      index
        .getInputObjectFieldsForType(EmptyInput)
        ?.map((field) => index.getInputFieldName(field)),
    ).to.deep.equal(['documentField']);
    expect(
      index.getInputFieldDef(parseType('SchemaInput'), 'schemaField')?.name,
    ).to.equal('schemaField');
    expect(
      index
        .getInputObjectFieldsForType(parseType('SchemaInput'))
        ?.map((field) => index.getInputFieldName(field)),
    ).to.include.members(['schemaField', 'documentField']);
    expect(index.getInputObjectFieldsForType(parseType('Missing'))).to.equal(
      undefined,
    );
    expect(index.isOneOfInputObjectType(parseType('SchemaOneOf'))).to.equal(
      true,
    );
    expect(index.isOneOfInputObjectType(DocumentOneOf)).to.equal(true);
    expect(index.getLeafType(SchemaInput)).to.equal(undefined);
    expect(
      index.getFieldDef(parseNamedType('SchemaObject'), 'schemaField')?.name,
    ).to.equal('schemaField');
    expect(
      index.getFields('SchemaNode')?.map((field) => index.getFieldName(field)),
    ).to.deep.equal(['id']);
    expect(
      index
        .getFields('SchemaObject')
        ?.map((field) => index.getFieldName(field)),
    ).to.include.members(['id', 'schemaField', 'documentField']);
    expect(
      Array.from(
        index.getEnumValueNames(parseType('SchemaColor'))?.keys() ?? [],
      ),
    ).to.deep.equal(['RED', 'BLUE']);
    expect(index.getEnumValueNames(parseType('SchemaOnlyColor'))).to.equal(
      undefined,
    );
    expect(
      index.doTypesOverlap(parseNamedType('User'), parseNamedType('User')),
    ).to.equal(true);
    expect(
      index.doTypesOverlap(parseNamedType('DocSearch'), parseNamedType('User')),
    ).to.equal(true);
    expect(
      index.doTypesOverlap(
        parseNamedType('SchemaObject'),
        parseNamedType('SchemaNode'),
      ),
    ).to.equal(true);
    expect(index.doTypesOverlap(SchemaObject, SchemaNode)).to.equal(true);
    expect(index.isOutputTypeSubTypeOf(OtherSchemaObject, SchemaNode)).to.equal(
      true,
    );
    expect(index.isOutputTypeSubTypeOf(SchemaResource, SchemaNode)).to.equal(
      true,
    );

    const errors = new Array<GraphQLError>();
    index.validateInputLiteral(
      parseValue('GREEN'),
      parseType('DocColor'),
      (error) => {
        errors.push(error);
      },
      undefined,
      undefined,
      true,
    );
    expect(errors.map((error) => error.message)).to.deep.equal([
      'Value "GREEN" does not exist in "DocColor" enum.',
    ]);
  });

  it('orders interface suggestions by subtype when usage is tied', () => {
    const document = parse(`
      interface Node {
        id: String
      }

      interface Resource implements Node {
        id: String
      }

      type User implements Resource & Node {
        id: String
      }
    `);
    const index = createIndex(document, undefined, (error) => {
      throw error;
    });

    expect(
      index.getSuggestedTypeNames(parseType('Resource'), 'id'),
    ).to.have.members(['User', 'Resource', 'Node']);
  });

  it('decides whether type-system validation rules should run', () => {
    const schema = schemaWithQuery();

    expect(
      createIndex(
        parse('{ field }'),
        schema,
      ).shouldRunTypeSystemValidationRules(),
    ).to.equal(false);
    expect(
      createIndex(
        parse('{ field }'),
        undefined,
      ).shouldRunTypeSystemValidationRules(),
    ).to.equal(true);
    expect(
      createIndex(
        parse('extend type Query { other: String }'),
        schema,
      ).shouldRunTypeSystemValidationRules(),
    ).to.equal(true);
    expect(
      createIndex(
        parse('{ field }'),
        schema,
        undefined,
        undefined,
        true,
      ).shouldRunTypeSystemValidationRules(),
    ).to.equal(true);
  });

  it('no-ops schema object accessors without required schema state', () => {
    const index = createIndex(undefined, undefined);

    expect(index.getSchemaValidationElements().rootTypes).to.deep.equal([]);
    expect(index.getDirectiveNames()).to.include('include');
    expect(index.getDirectiveLocationSet('include')).to.include(
      DirectiveLocation.FIELD,
    );
    expect(index.isDirectiveRepeatable('include')).to.equal(false);
    expect(index.getDirectiveArgumentMap('include')?.has('if')).to.equal(true);
    expect(index.getTypeReference(parseType('Missing'))).to.equal(undefined);
    expect(
      createIndex(parse('schema { query: Missing }'), undefined).getRootType(
        'query',
      ),
    ).to.equal(undefined);
    expect(() => index.reportError('Missing error handler')).to.throw();
  });
});

function createIndex(
  document: DocumentNode | undefined,
  schema: GraphQLSchema | undefined,
  onError?: (error: Error) => void,
  hideSuggestions?: boolean,
  includeExistingSchemaErrors?: boolean,
): TypeSystemValidationIndex {
  return new TypeSystemValidationIndex(
    new DocumentIndex(document),
    schema,
    onError,
    hideSuggestions,
    includeExistingSchemaErrors,
  );
}

function parseNamedType(typeName: string): NamedTypeNode {
  const type = parseType(typeName);
  if (type.kind !== Kind.NAMED_TYPE) {
    throw new Error('Expected named type.');
  }
  return type;
}

function schemaWithQuery(): GraphQLSchema {
  return new GraphQLSchema({
    query: new GraphQLObjectType({
      name: 'Query',
      fields: {
        field: { type: GraphQLString },
      },
    }),
  });
}
