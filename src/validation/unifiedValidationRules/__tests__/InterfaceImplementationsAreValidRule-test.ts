import { describe, it } from 'node:test';

import { expect } from 'chai';

import { expectJSON } from '../../../__testUtils__/expectJSON.ts';

import type {
  InterfaceTypeDefinitionNode,
  ObjectTypeDefinitionNode,
  ObjectTypeExtensionNode,
} from '../../../language/ast.ts';
import { parse } from '../../../language/parser.ts';

import {
  GraphQLInputObjectType,
  GraphQLInterfaceType,
  GraphQLList,
  GraphQLNonNull,
  GraphQLObjectType,
  GraphQLUnionType,
} from '../../../type/definition.ts';
import { GraphQLInt, GraphQLString } from '../../../type/scalars.ts';
import { GraphQLSchema } from '../../../type/schema.ts';

import { buildSchema } from '../../../utilities/buildASTSchema.ts';

import { validateWithRules } from '../../index.ts';

import { InterfaceImplementationsAreValidTypeSystemValidation } from '../InterfaceImplementationsAreValidRule.ts';

import { expectSchemaErrors } from './harness.ts';

function validateSDLMessages(sdlStr: string, schema?: GraphQLSchema) {
  const doc = parse(sdlStr, { noLocation: true });
  return validateWithRules({
    documentAST: doc,
    typeSystemRules: [InterfaceImplementationsAreValidTypeSystemValidation],
    schema,
  }).map((error) => error.message);
}

function expectSDLErrorsWithLocations(sdlStr: string, schema?: GraphQLSchema) {
  const doc = parse(sdlStr);
  const errors = validateWithRules({
    documentAST: doc,
    typeSystemRules: [InterfaceImplementationsAreValidTypeSystemValidation],
    schema,
  });
  return expectJSON(errors);
}

describe('Validate: InterfaceImplementationsAreValidRule', () => {
  it('rejects invalid SDL interface implementations', () => {
    const messages = validateSDLMessages(`
      directive @tag on SCALAR | SCHEMA

      schema {
        query: Query
      }

      scalar Custom
      extend scalar Custom @tag

      enum Enum {
        VALUE
      }
      extend enum Enum {
        OTHER
      }

      input Input {
        field: String
      }
      extend input Input {
        other: String
      }

      type Output {
        field: String
      }

      interface Node {
        id(arg: String): String
        deprecatedField: String
      }

      interface Transitive {
        transitive: String
      }

      interface ExtendedBase {
        base: String
      }
      extend interface ExtendedBase implements Transitive {
        base: String
        transitive: String
      }

      interface Parent implements Transitive {
        parent: String
      }

      interface A implements B {
        a: String
      }

      interface B implements A {
        b: String
      }

      interface Wrapper {
        nonNull: String!
        wrappedNonNull: String!
        nullable: String
        list: [String]
        missing: Node
      }

      interface Target {
        target: String
      }

      interface NeedsTarget {
        value: Target
      }

      interface NeedsInterfaceTarget {
        value: Target
      }

      type BadType implements Output {
        field: String
      }

      interface Self implements Self {
        field: String
      }

      type Duplicate implements Node & Node {
        id(arg: String): String
        deprecatedField: String
      }

      type MissingTransitive implements Parent {
        parent: String
      }

      type CompleteTransitive implements Parent & Transitive {
        parent: String
        transitive: String
      }

      type UnknownImpl implements UnknownInterface {
        field: String
      }

      type MissingField implements Node {
        deprecatedField: String
      }

      type BadFieldType implements Node {
        id(arg: String): [String]
        deprecatedField: String
      }

      type MissingArg implements Node {
        id: String
        deprecatedField: String
      }

      type BadArgType implements Node {
        id(arg: Int): String
        deprecatedField: String
      }

      type ExtraRequiredArg implements Node {
        id(arg: String, extra: String!): String
        deprecatedField: String
      }

      type DeprecatedImplementation implements Node {
        id(arg: String): String
        deprecatedField: String @deprecated
      }

      type BadWrapper implements Wrapper {
        nonNull: String
        wrappedNonNull: Int!
        nullable: String!
        list: [String!]
        missing: Missing
      }

      type UsesA implements NeedsTarget {
        value: A
      }

      union TargetUnion = Output

      type UsesTargetUnion implements NeedsInterfaceTarget {
        value: TargetUnion
      }

      interface ChainA {
        field: String
      }

      interface ChainB implements ChainA {
        field: String
      }

      type ChainC implements ChainB {
        field: String
      }

      interface HasChainA {
        value: ChainA
      }

      type UsesChainC implements HasChainA {
        value: ChainC
      }

      union SDLUnion = BadFieldType
      extend union SDLUnion = MissingField
      union EmptyUnion
      type EmptyObject
      interface EmptyInterface

      query {
        __typename
      }

      fragment Fragment on Query {
        __typename
      }
    `);

    expect(messages).to.include.members([
      'Type A cannot implement B because it would create a circular reference.',
      'Type B cannot implement A because it would create a circular reference.',
      'Type BadType must only implement Interface types, it cannot implement Output.',
      'Type Self cannot implement itself because it would create a circular reference.',
      'Type Duplicate can only implement Node once.',
      'Type MissingTransitive must implement Transitive because it is implemented by Parent.',
      'Interface field Node.id expected but MissingField does not provide it.',
      'Interface field Node.id expects type String but BadFieldType.id is type [String].',
      'Interface field argument Node.id(arg:) expected but MissingArg.id does not provide it.',
      'Interface field argument Node.id(arg:) expects type String but BadArgType.id(arg:) is type Int.',
      'Argument "ExtraRequiredArg.id(extra:)" must not be required type "String!" if not provided by the Interface field "Node.id".',
      'Interface field Node.deprecatedField is not deprecated, so implementation field DeprecatedImplementation.deprecatedField must not be deprecated.',
      'Interface field Wrapper.nonNull expects type String! but BadWrapper.nonNull is type String.',
      'Interface field Wrapper.wrappedNonNull expects type String! but BadWrapper.wrappedNonNull is type Int!.',
      'Interface field NeedsTarget.value expects type Target but UsesA.value is type A.',
      'Interface field NeedsInterfaceTarget.value expects type Target but UsesTargetUnion.value is type TargetUnion.',
    ]);
  });

  it('ignores SDL interface comparisons with invalid field or argument types', () => {
    expect(
      validateSDLMessages(`
        input Input {
          field: String
        }

        type Output {
          field: String
        }

        interface Node {
          value(arg: Output): Input
        }

        type Query implements Node {
          value(arg: String): String
        }
      `),
    ).to.deep.equal([]);
  });

  it('uses the last duplicate SDL interface field candidate', () => {
    expect(
      validateSDLMessages(`
        interface Node {
          value: String
          value: Int
        }

        type Query implements Node {
          value: Int
        }
      `),
    ).to.deep.equal([]);
  });

  it('uses the last duplicate SDL implementation field candidate', () => {
    expect(
      validateSDLMessages(`
        interface Node {
          value: String
        }

        type Query implements Node {
          value: Int
          value: String
        }
      `),
    ).to.deep.equal([]);
  });

  it('uses the last duplicate SDL implementation argument candidate', () => {
    expect(
      validateSDLMessages(`
        interface Node {
          field(arg: String): String
        }

        type Query implements Node {
          field(arg: Int, arg: String): String
        }
      `),
    ).to.deep.equal([]);
  });

  it('ignores schema interface comparisons with invalid field or argument types', () => {
    const Input = new GraphQLInputObjectType({
      name: 'Input',
      fields: {
        field: { type: GraphQLString },
      },
    });
    const Output = new GraphQLObjectType({
      name: 'Output',
      fields: {
        field: { type: GraphQLString },
      },
    });
    const Node = new GraphQLInterfaceType({
      name: 'Node',
      fields: {
        value: {
          // @ts-expect-error Testing defensive validation of invalid config.
          type: Input,
          args: {
            // @ts-expect-error Testing defensive validation of invalid config.
            arg: { type: Output },
          },
        },
      },
    });
    const Query = new GraphQLObjectType({
      name: 'Query',
      interfaces: [Node],
      fields: {
        value: {
          type: GraphQLString,
          args: {
            arg: { type: GraphQLString },
          },
        },
      },
    });
    const schema = new GraphQLSchema({ query: Query });
    expectSchemaErrors(
      schema,
      InterfaceImplementationsAreValidTypeSystemValidation,
    ).toDeepEqual([]);
  });

  it('rejects invalid schema interface implementations', () => {
    const Output = new GraphQLObjectType({
      name: 'Output',
      fields: {
        field: { type: GraphQLString },
      },
    });
    const Transitive = new GraphQLInterfaceType({
      name: 'Transitive',
      fields: {
        transitive: { type: GraphQLString },
      },
    });
    const Parent = new GraphQLInterfaceType({
      name: 'Parent',
      interfaces: [Transitive],
      fields: {
        parent: { type: GraphQLString },
        transitive: { type: GraphQLString },
      },
    });
    // eslint-disable-next-line prefer-const
    let InterfaceA: GraphQLInterfaceType;
    const InterfaceB: GraphQLInterfaceType = new GraphQLInterfaceType({
      name: 'B',
      interfaces: () => [InterfaceA],
      fields: {
        a: { type: GraphQLString },
        b: { type: GraphQLString },
      },
    });
    InterfaceA = new GraphQLInterfaceType({
      name: 'A',
      interfaces: [InterfaceB],
      fields: {
        a: { type: GraphQLString },
        b: { type: GraphQLString },
      },
    });
    const nodeDefinition = parse(
      'interface Node { id(arg: String): String deprecatedField: String }',
      { noLocation: true },
    ).definitions[0] as InterfaceTypeDefinitionNode;
    const nodeIdFieldNode = nodeDefinition.fields?.[0];
    const nodeIdArgNode = nodeIdFieldNode?.arguments?.[0];
    const nodeDeprecatedFieldNode = nodeDefinition.fields?.[1];

    const badTypeDefinition = parse('type BadType { field: String }', {
      noLocation: true,
    }).definitions[0] as ObjectTypeDefinitionNode;

    const badFieldTypeDefinition = parse(
      'type BadFieldType implements Node { id(arg: String): [String] deprecatedField: String }',
      { noLocation: true },
    ).definitions[0] as ObjectTypeDefinitionNode;
    const badFieldTypeIdFieldNode = badFieldTypeDefinition.fields?.[0];
    const badFieldTypeIdArgNode = badFieldTypeIdFieldNode?.arguments?.[0];

    const badArgTypeDefinition = parse(
      'type BadArgType implements Node { id(arg: Int): String deprecatedField: String }',
      { noLocation: true },
    ).definitions[0] as ObjectTypeDefinitionNode;
    const badArgTypeIdFieldNode = badArgTypeDefinition.fields?.[0];
    const badArgTypeIdArgNode = badArgTypeIdFieldNode?.arguments?.[0];

    const deprecatedImplementationDefinition = parse(
      'type DeprecatedImplementation implements Node { id(arg: String): String deprecatedField: String @deprecated }',
      { noLocation: true },
    ).definitions[0] as ObjectTypeDefinitionNode;
    const deprecatedImplementationFieldNode =
      deprecatedImplementationDefinition.fields?.[1];

    if (
      nodeIdFieldNode == null ||
      nodeIdArgNode == null ||
      nodeDeprecatedFieldNode == null ||
      badFieldTypeIdFieldNode == null ||
      badFieldTypeIdArgNode == null ||
      badArgTypeIdFieldNode == null ||
      badArgTypeIdArgNode == null ||
      deprecatedImplementationFieldNode == null
    ) {
      throw new Error('Expected parsed field and argument nodes.');
    }

    const Node = new GraphQLInterfaceType({
      name: 'Node',
      astNode: nodeDefinition,
      fields: {
        id: {
          type: GraphQLString,
          astNode: nodeIdFieldNode,
          args: { arg: { type: GraphQLString, astNode: nodeIdArgNode } },
        },
        deprecatedField: {
          type: GraphQLString,
          astNode: nodeDeprecatedFieldNode,
        },
      },
    });
    const Self: GraphQLInterfaceType = new GraphQLInterfaceType({
      name: 'Self',
      interfaces: () => [Self],
      fields: {
        field: { type: GraphQLString },
      },
    });
    const BadType = new GraphQLObjectType({
      name: 'BadType',
      astNode: { ...badTypeDefinition, interfaces: undefined },
      // @ts-expect-error Testing validation of an invalid constructed schema.
      interfaces: [Output],
      fields: {
        field: { type: GraphQLString },
      },
    });
    const Duplicate = new GraphQLObjectType({
      name: 'Duplicate',
      interfaces: [Node, Node],
      astNode: parse(
        'type Duplicate implements Node & Node { id(arg: String): String deprecatedField: String }',
      ).definitions[0] as ObjectTypeDefinitionNode,
      fields: {
        id: {
          type: GraphQLString,
          args: { arg: { type: GraphQLString } },
        },
        deprecatedField: { type: GraphQLString },
      },
    });
    const MissingTransitive = new GraphQLObjectType({
      name: 'MissingTransitive',
      interfaces: [Parent],
      fields: {
        parent: { type: GraphQLString },
        transitive: { type: GraphQLString },
      },
    });
    const MissingField = new GraphQLObjectType({
      name: 'MissingField',
      interfaces: [Node],
      fields: {
        deprecatedField: { type: GraphQLString },
      },
    });
    const BadFieldType = new GraphQLObjectType({
      name: 'BadFieldType',
      interfaces: [Node],
      fields: {
        id: {
          type: new GraphQLList(GraphQLString),
          astNode: badFieldTypeIdFieldNode,
          args: {
            arg: { type: GraphQLString, astNode: badFieldTypeIdArgNode },
          },
        },
        deprecatedField: { type: GraphQLString },
      },
    });
    const MissingArg = new GraphQLObjectType({
      name: 'MissingArg',
      interfaces: [Node],
      fields: {
        id: { type: GraphQLString },
        deprecatedField: { type: GraphQLString },
      },
    });
    const BadArgType = new GraphQLObjectType({
      name: 'BadArgType',
      interfaces: [Node],
      fields: {
        id: {
          type: GraphQLString,
          astNode: badArgTypeIdFieldNode,
          args: { arg: { type: GraphQLInt, astNode: badArgTypeIdArgNode } },
        },
        deprecatedField: { type: GraphQLString },
      },
    });
    const ExtraRequiredArg = new GraphQLObjectType({
      name: 'ExtraRequiredArg',
      interfaces: [Node],
      fields: {
        id: {
          type: GraphQLString,
          args: {
            arg: { type: GraphQLString },
            extra: { type: new GraphQLNonNull(GraphQLString) },
          },
        },
        deprecatedField: { type: GraphQLString },
      },
    });
    const DeprecatedImplementation = new GraphQLObjectType({
      name: 'DeprecatedImplementation',
      interfaces: [Node],
      fields: {
        id: {
          type: GraphQLString,
          args: { arg: { type: GraphQLString } },
        },
        deprecatedField: {
          type: GraphQLString,
          deprecationReason: 'Deprecated on implementation only.',
          astNode: deprecatedImplementationFieldNode,
        },
      },
    });

    const schema = new GraphQLSchema({
      query: MissingField,
      types: [
        BadType,
        Self,
        Duplicate,
        MissingTransitive,
        BadFieldType,
        MissingArg,
        BadArgType,
        ExtraRequiredArg,
        DeprecatedImplementation,
        InterfaceA,
      ],
    });

    const messages = validateWithRules({
      schema,
      typeSystemRules: [InterfaceImplementationsAreValidTypeSystemValidation],
    }).map((error) => error.message);

    expect(messages).to.include.members([
      'Type BadType must only implement Interface types, it cannot implement Output.',
      'Type Self cannot implement itself because it would create a circular reference.',
      'Type Duplicate can only implement Node once.',
      'Type MissingTransitive must implement Transitive because it is implemented by Parent.',
      'Type A cannot implement B because it would create a circular reference.',
      'Interface field Node.id expected but MissingField does not provide it.',
      'Interface field Node.id expects type String but BadFieldType.id is type [String].',
      'Interface field argument Node.id(arg:) expected but MissingArg.id does not provide it.',
      'Interface field argument Node.id(arg:) expects type String but BadArgType.id(arg:) is type Int.',
      'Argument "ExtraRequiredArg.id(extra:)" must not be required type "String!" if not provided by the Interface field "Node.id".',
      'Interface field Node.deprecatedField is not deprecated, so implementation field DeprecatedImplementation.deprecatedField must not be deprecated.',
    ]);
  });

  it('uses existing schema interfaces and union members for SDL subtype checks', () => {
    const Node = new GraphQLInterfaceType({
      name: 'Node',
      fields: {
        id: {
          type: new GraphQLNonNull(GraphQLString),
          args: {
            filter: { type: new GraphQLList(GraphQLString) },
          },
        },
      },
    });

    const Query = new GraphQLObjectType({
      name: 'Query',
      interfaces: [Node],
      fields: {
        id: {
          type: new GraphQLNonNull(GraphQLString),
          args: {
            filter: { type: new GraphQLList(GraphQLString) },
          },
        },
      },
    });

    const Result = new GraphQLUnionType({
      name: 'Result',
      types: [Query],
    });

    const schema = new GraphQLSchema({
      query: Query,
      types: [Result],
    });

    expect(
      validateSDLMessages(
        `
          interface HasNode {
            node: Node
          }

          type NodeHolder implements HasNode {
            node: Query
          }

          interface HasResult {
            result: Result
          }

          type ResultHolder implements HasResult {
            result: Query
          }
        `,
        schema,
      ),
    ).to.deep.equal([]);
  });

  it('accepts SDL extensions that satisfy existing interface implementations', () => {
    const Node = new GraphQLInterfaceType({
      name: 'Node',
      fields: {
        id: { type: GraphQLString },
      },
    });

    const Query = new GraphQLObjectType({
      name: 'Query',
      interfaces: [Node],
      fields: {},
    });

    const schema = new GraphQLSchema({ query: Query });

    expect(
      validateSDLMessages(
        `
          extend type Query {
            id: String
          }
        `,
        schema,
      ),
    ).to.deep.equal([]);
  });

  it('loads existing schema implementations when validating SDL interface extensions', () => {
    const Node = new GraphQLInterfaceType({
      name: 'Node',
      fields: {
        id: { type: GraphQLString },
      },
    });

    const Resource = new GraphQLInterfaceType({
      name: 'Resource',
      interfaces: [Node],
      fields: {
        id: { type: GraphQLString },
      },
    });

    const Query = new GraphQLObjectType({
      name: 'Query',
      interfaces: [Node, Resource],
      fields: {
        id: { type: GraphQLString },
      },
    });

    const schema = new GraphQLSchema({ query: Query, types: [Resource] });

    expect(
      validateSDLMessages(
        `
          extend interface Node {
            name: String
          }

          extend interface Resource {
            name: String
          }

          extend type Query {
            name: String
          }
        `,
        schema,
      ),
    ).to.deep.equal([]);
  });

  it('reports SDL interface implementation errors on the related fields and arguments', () => {
    expectSDLErrorsWithLocations(`
      interface Node {
        id(arg: String): String
        deprecatedField: String
      }

      type Bad implements Node {
        id(extra: String!): [String] @deprecated
      }
    `).toDeepEqual([
      {
        message:
          'Interface field Node.id expects type String but Bad.id is type [String].',
        locations: [
          { line: 3, column: 26 },
          { line: 8, column: 29 },
        ],
      },
      {
        message:
          'Interface field argument Node.id(arg:) expected but Bad.id does not provide it.',
        locations: [
          { line: 3, column: 12 },
          { line: 8, column: 9 },
        ],
      },
      {
        message:
          'Argument "Bad.id(extra:)" must not be required type "String!" if not provided by the Interface field "Node.id".',
        locations: [
          { line: 8, column: 12 },
          { line: 3, column: 9 },
        ],
      },
      {
        message:
          'Interface field Node.id is not deprecated, so implementation field Bad.id must not be deprecated.',
        locations: [
          { line: 8, column: 38 },
          { line: 3, column: 9 },
        ],
      },
      {
        message:
          'Interface field Node.deprecatedField expected but Bad does not provide it.',
        locations: [{ line: 4, column: 9 }],
      },
    ]);
  });

  it('uses AST nodes from an existing schema when available', () => {
    const schema = buildSchema(`
      interface Node {
        id(filter: [String]): String!
      }

      type Query implements Node {
        id(filter: [String]): String!
      }
    `);

    expect(
      validateSDLMessages(
        `
          type Other implements Node {
            id(filter: [String]): String!
          }
        `,
        schema,
      ),
    ).to.deep.equal([]);
  });

  it('reports schema interface implementation nodes from extensions', () => {
    const nodeDefinition = parse('interface Node { id: String }')
      .definitions[0] as InterfaceTypeDefinitionNode;
    const implDefinition = parse('type Impl implements Node { id: String }')
      .definitions[0] as ObjectTypeDefinitionNode;
    const emptyExtension = parse('extend type Impl @deprecated')
      .definitions[0] as ObjectTypeExtensionNode;
    const implExtension = parse('extend type Impl implements Node')
      .definitions[0] as ObjectTypeExtensionNode;
    const Node = new GraphQLInterfaceType({
      name: 'Node',
      fields: {
        id: { type: GraphQLString },
      },
      astNode: nodeDefinition,
    });
    const Impl = new GraphQLObjectType({
      name: 'Impl',
      interfaces: [Node, Node],
      fields: {
        id: { type: GraphQLString },
      },
      astNode: implDefinition,
      extensionASTNodes: [emptyExtension, implExtension],
    });

    expectSchemaErrors(
      new GraphQLSchema({ query: Impl }),
      InterfaceImplementationsAreValidTypeSystemValidation,
    ).toDeepEqual([
      {
        message: 'Type Impl can only implement Node once.',
        locations: [
          { line: 1, column: 22 },
          { line: 1, column: 29 },
        ],
      },
    ]);
  });

  it('reports SDL errors from existing schema interfaces without AST nodes', () => {
    const Node = new GraphQLInterfaceType({
      name: 'Node',
      fields: {
        id: { type: GraphQLString },
      },
    });

    const Query = new GraphQLObjectType({
      name: 'Query',
      fields: {
        field: { type: GraphQLString },
      },
    });

    const schema = new GraphQLSchema({
      query: Query,
      types: [Node],
    });

    expect(
      validateSDLMessages(
        `
          type Bad implements Node {
            other: String
          }
        `,
        schema,
      ),
    ).to.deep.equal([
      'Interface field Node.id expected but Bad does not provide it.',
    ]);
  });

  it('ignores existing schema implementation errors without AST nodes', () => {
    const Node = new GraphQLInterfaceType({
      name: 'Node',
      fields: {
        id: { type: GraphQLString },
      },
    });

    const BadObject = new GraphQLObjectType({
      name: 'BadObject',
      interfaces: [Node],
      fields: {},
    });

    const Query = new GraphQLObjectType({
      name: 'Query',
      fields: {
        field: { type: GraphQLString },
      },
    });

    const schema = new GraphQLSchema({
      query: Query,
      types: [BadObject],
    });

    expect(
      validateSDLMessages('directive @tag on SCHEMA', schema),
    ).to.deep.equal([]);
  });
});
