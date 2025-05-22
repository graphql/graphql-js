import { assert, expect } from 'chai';
import { describe, it } from 'mocha';

import { parse, parseValue } from '../../language/parser.js';
import { print } from '../../language/printer.js';
import { visit } from '../../language/visitor.js';

import { getNamedType, isCompositeType } from '../../type/definition.js';
import { GraphQLSchema } from '../../type/schema.js';

import { buildSchema } from '../buildASTSchema.js';
import { TypeInfo, visitWithTypeInfo } from '../TypeInfo.js';

const testSchema = buildSchema(`
  interface Pet {
    name: String
  }

  type Dog implements Pet {
    name: String
  }

  type Cat implements Pet {
    name: String
  }

  type Human {
    name: String
    pets: [Pet]
  }

  type Alien {
    name(surname: Boolean): String
  }

  union HumanOrAlien = Human | Alien

  type QueryRoot {
    human(id: ID): Human
    alien: Alien
    humanOrAlien: HumanOrAlien
    pet: Pet
  }

  schema {
    query: QueryRoot
  }
`);

describe('TypeInfo', () => {
  const schema = new GraphQLSchema({});

  it('can be Object.toStringified', () => {
    const typeInfo = new TypeInfo(schema);

    expect(Object.prototype.toString.call(typeInfo)).to.equal(
      '[object TypeInfo]',
    );
  });

  it('allow all methods to be called before entering any node', () => {
    const typeInfo = new TypeInfo(schema);

    expect(typeInfo.getType()).to.equal(undefined);
    expect(typeInfo.getParentType()).to.equal(undefined);
    expect(typeInfo.getInputType()).to.equal(undefined);
    expect(typeInfo.getParentInputType()).to.equal(undefined);
    expect(typeInfo.getFieldDef()).to.equal(undefined);
    expect(typeInfo.getDefaultValue()).to.equal(undefined);
    expect(typeInfo.getDirective()).to.equal(null);
    expect(typeInfo.getFragmentSignature()).to.equal(null);
    expect(typeInfo.getFragmentSignatureByName()('')).to.equal(null);
    expect(typeInfo.getFragmentArgument()).to.equal(null);
    expect(typeInfo.getArgument()).to.equal(null);
    expect(typeInfo.getEnumValue()).to.equal(null);
  });
});

describe('visitWithTypeInfo', () => {
  it('supports different operation types', () => {
    const schema = buildSchema(`
      schema {
        query: QueryRoot
        mutation: MutationRoot
        subscription: SubscriptionRoot
      }

      type QueryRoot {
        foo: String
      }

      type MutationRoot {
        bar: String
      }

      type SubscriptionRoot {
        baz: String
      }
    `);
    const ast = parse(`
      query { foo }
      mutation { bar }
      subscription { baz }
    `);
    const typeInfo = new TypeInfo(schema);

    const rootTypes: any = {};
    visit(
      ast,
      visitWithTypeInfo(typeInfo, {
        OperationDefinition(node) {
          rootTypes[node.operation] = String(typeInfo.getType());
        },
      }),
    );

    expect(rootTypes).to.deep.equal({
      query: 'QueryRoot',
      mutation: 'MutationRoot',
      subscription: 'SubscriptionRoot',
    });
  });

  it('provide exact same arguments to wrapped visitor', () => {
    const ast = parse(
      '{ human(id: 4) { name, pets { ... { name } }, unknown } }',
    );

    const visitorArgs: Array<any> = [];
    visit(ast, {
      enter(...args) {
        visitorArgs.push(['enter', ...args]);
      },
      leave(...args) {
        visitorArgs.push(['leave', ...args]);
      },
    });

    const wrappedVisitorArgs: Array<any> = [];
    const typeInfo = new TypeInfo(testSchema);
    visit(
      ast,
      visitWithTypeInfo(typeInfo, {
        enter(...args) {
          wrappedVisitorArgs.push(['enter', ...args]);
        },
        leave(...args) {
          wrappedVisitorArgs.push(['leave', ...args]);
        },
      }),
    );

    expect(visitorArgs).to.deep.equal(wrappedVisitorArgs);
  });

  it('supports introspection fields', () => {
    const typeInfo = new TypeInfo(testSchema);

    const ast = parse(`
      {
        __typename
        __type(name: "Cat") { __typename }
        __schema {
          __typename # in object type
        }
        humanOrAlien {
          __typename # in union type
        }
        pet {
          __typename # in interface type
        }
        someUnknownType {
          __typename # unknown
        }
        pet {
          __type # unknown
          __schema # unknown
        }
      }
    `);

    const visitedFields: Array<[string | undefined, string | undefined]> = [];
    visit(
      ast,
      visitWithTypeInfo(typeInfo, {
        Field() {
          const typeName = typeInfo.getParentType()?.name;
          const fieldName = typeInfo.getFieldDef()?.name;
          visitedFields.push([typeName, fieldName]);
        },
      }),
    );

    expect(visitedFields).to.deep.equal([
      ['QueryRoot', '__typename'],
      ['QueryRoot', '__type'],
      ['__Type', '__typename'],
      ['QueryRoot', '__schema'],
      ['__Schema', '__typename'],
      ['QueryRoot', 'humanOrAlien'],
      ['HumanOrAlien', '__typename'],
      ['QueryRoot', 'pet'],
      ['Pet', '__typename'],
      ['QueryRoot', undefined],
      [undefined, undefined],
      ['QueryRoot', 'pet'],
      ['Pet', undefined],
      ['Pet', undefined],
    ]);
  });

  it('maintains type info during visit', () => {
    const visited: Array<any> = [];

    const typeInfo = new TypeInfo(testSchema);

    const ast = parse(
      '{ human(id: 4) { name, pets { ... { name } }, unknown } }',
    );

    visit(
      ast,
      visitWithTypeInfo(typeInfo, {
        enter(node) {
          const parentType = typeInfo.getParentType();
          const type = typeInfo.getType();
          const inputType = typeInfo.getInputType();
          visited.push([
            'enter',
            node.kind,
            node.kind === 'Name' ? node.value : null,
            parentType ? String(parentType) : null,
            type ? String(type) : null,
            inputType ? String(inputType) : null,
          ]);
        },
        leave(node) {
          const parentType = typeInfo.getParentType();
          const type = typeInfo.getType();
          const inputType = typeInfo.getInputType();
          visited.push([
            'leave',
            node.kind,
            node.kind === 'Name' ? node.value : null,
            parentType ? String(parentType) : null,
            type ? String(type) : null,
            inputType ? String(inputType) : null,
          ]);
        },
      }),
    );

    expect(visited).to.deep.equal([
      ['enter', 'Document', null, null, null, null],
      ['enter', 'OperationDefinition', null, null, 'QueryRoot', null],
      ['enter', 'SelectionSet', null, 'QueryRoot', 'QueryRoot', null],
      ['enter', 'Field', null, 'QueryRoot', 'Human', null],
      ['enter', 'Name', 'human', 'QueryRoot', 'Human', null],
      ['leave', 'Name', 'human', 'QueryRoot', 'Human', null],
      ['enter', 'Argument', null, 'QueryRoot', 'Human', 'ID'],
      ['enter', 'Name', 'id', 'QueryRoot', 'Human', 'ID'],
      ['leave', 'Name', 'id', 'QueryRoot', 'Human', 'ID'],
      ['enter', 'IntValue', null, 'QueryRoot', 'Human', 'ID'],
      ['leave', 'IntValue', null, 'QueryRoot', 'Human', 'ID'],
      ['leave', 'Argument', null, 'QueryRoot', 'Human', 'ID'],
      ['enter', 'SelectionSet', null, 'Human', 'Human', null],
      ['enter', 'Field', null, 'Human', 'String', null],
      ['enter', 'Name', 'name', 'Human', 'String', null],
      ['leave', 'Name', 'name', 'Human', 'String', null],
      ['leave', 'Field', null, 'Human', 'String', null],
      ['enter', 'Field', null, 'Human', '[Pet]', null],
      ['enter', 'Name', 'pets', 'Human', '[Pet]', null],
      ['leave', 'Name', 'pets', 'Human', '[Pet]', null],
      ['enter', 'SelectionSet', null, 'Pet', '[Pet]', null],
      ['enter', 'InlineFragment', null, 'Pet', 'Pet', null],
      ['enter', 'SelectionSet', null, 'Pet', 'Pet', null],
      ['enter', 'Field', null, 'Pet', 'String', null],
      ['enter', 'Name', 'name', 'Pet', 'String', null],
      ['leave', 'Name', 'name', 'Pet', 'String', null],
      ['leave', 'Field', null, 'Pet', 'String', null],
      ['leave', 'SelectionSet', null, 'Pet', 'Pet', null],
      ['leave', 'InlineFragment', null, 'Pet', 'Pet', null],
      ['leave', 'SelectionSet', null, 'Pet', '[Pet]', null],
      ['leave', 'Field', null, 'Human', '[Pet]', null],
      ['enter', 'Field', null, 'Human', null, null],
      ['enter', 'Name', 'unknown', 'Human', null, null],
      ['leave', 'Name', 'unknown', 'Human', null, null],
      ['leave', 'Field', null, 'Human', null, null],
      ['leave', 'SelectionSet', null, 'Human', 'Human', null],
      ['leave', 'Field', null, 'QueryRoot', 'Human', null],
      ['leave', 'SelectionSet', null, 'QueryRoot', 'QueryRoot', null],
      ['leave', 'OperationDefinition', null, null, 'QueryRoot', null],
      ['leave', 'Document', null, null, null, null],
    ]);
  });

  it('maintains type info during edit', () => {
    const visited: Array<any> = [];
    const typeInfo = new TypeInfo(testSchema);

    const ast = parse('{ human(id: 4) { name, pets }, alien }');
    const editedAST = visit(
      ast,
      visitWithTypeInfo(typeInfo, {
        enter(node) {
          const parentType = typeInfo.getParentType();
          const type = typeInfo.getType();
          const inputType = typeInfo.getInputType();
          visited.push([
            'enter',
            node.kind,
            node.kind === 'Name' ? node.value : null,
            parentType ? String(parentType) : null,
            type ? String(type) : null,
            inputType ? String(inputType) : null,
          ]);

          // Make a query valid by adding missing selection sets.
          if (
            node.kind === 'Field' &&
            !node.selectionSet &&
            isCompositeType(getNamedType(type))
          ) {
            return {
              ...node,
              selectionSet: {
                kind: 'SelectionSet',
                selections: [
                  {
                    kind: 'Field',
                    name: { kind: 'Name', value: '__typename' },
                  },
                ],
              },
            };
          }
        },
        leave(node) {
          const parentType = typeInfo.getParentType();
          const type = typeInfo.getType();
          const inputType = typeInfo.getInputType();
          visited.push([
            'leave',
            node.kind,
            node.kind === 'Name' ? node.value : null,
            parentType ? String(parentType) : null,
            type ? String(type) : null,
            inputType ? String(inputType) : null,
          ]);
        },
      }),
    );

    expect(print(ast)).to.deep.equal(
      print(parse('{ human(id: 4) { name, pets }, alien }')),
    );

    expect(print(editedAST)).to.deep.equal(
      print(
        parse(
          '{ human(id: 4) { name, pets { __typename } }, alien { __typename } }',
        ),
      ),
    );

    expect(visited).to.deep.equal([
      ['enter', 'Document', null, null, null, null],
      ['enter', 'OperationDefinition', null, null, 'QueryRoot', null],
      ['enter', 'SelectionSet', null, 'QueryRoot', 'QueryRoot', null],
      ['enter', 'Field', null, 'QueryRoot', 'Human', null],
      ['enter', 'Name', 'human', 'QueryRoot', 'Human', null],
      ['leave', 'Name', 'human', 'QueryRoot', 'Human', null],
      ['enter', 'Argument', null, 'QueryRoot', 'Human', 'ID'],
      ['enter', 'Name', 'id', 'QueryRoot', 'Human', 'ID'],
      ['leave', 'Name', 'id', 'QueryRoot', 'Human', 'ID'],
      ['enter', 'IntValue', null, 'QueryRoot', 'Human', 'ID'],
      ['leave', 'IntValue', null, 'QueryRoot', 'Human', 'ID'],
      ['leave', 'Argument', null, 'QueryRoot', 'Human', 'ID'],
      ['enter', 'SelectionSet', null, 'Human', 'Human', null],
      ['enter', 'Field', null, 'Human', 'String', null],
      ['enter', 'Name', 'name', 'Human', 'String', null],
      ['leave', 'Name', 'name', 'Human', 'String', null],
      ['leave', 'Field', null, 'Human', 'String', null],
      ['enter', 'Field', null, 'Human', '[Pet]', null],
      ['enter', 'Name', 'pets', 'Human', '[Pet]', null],
      ['leave', 'Name', 'pets', 'Human', '[Pet]', null],
      ['enter', 'SelectionSet', null, 'Pet', '[Pet]', null],
      ['enter', 'Field', null, 'Pet', 'String!', null],
      ['enter', 'Name', '__typename', 'Pet', 'String!', null],
      ['leave', 'Name', '__typename', 'Pet', 'String!', null],
      ['leave', 'Field', null, 'Pet', 'String!', null],
      ['leave', 'SelectionSet', null, 'Pet', '[Pet]', null],
      ['leave', 'Field', null, 'Human', '[Pet]', null],
      ['leave', 'SelectionSet', null, 'Human', 'Human', null],
      ['leave', 'Field', null, 'QueryRoot', 'Human', null],
      ['enter', 'Field', null, 'QueryRoot', 'Alien', null],
      ['enter', 'Name', 'alien', 'QueryRoot', 'Alien', null],
      ['leave', 'Name', 'alien', 'QueryRoot', 'Alien', null],
      ['enter', 'SelectionSet', null, 'Alien', 'Alien', null],
      ['enter', 'Field', null, 'Alien', 'String!', null],
      ['enter', 'Name', '__typename', 'Alien', 'String!', null],
      ['leave', 'Name', '__typename', 'Alien', 'String!', null],
      ['leave', 'Field', null, 'Alien', 'String!', null],
      ['leave', 'SelectionSet', null, 'Alien', 'Alien', null],
      ['leave', 'Field', null, 'QueryRoot', 'Alien', null],
      ['leave', 'SelectionSet', null, 'QueryRoot', 'QueryRoot', null],
      ['leave', 'OperationDefinition', null, null, 'QueryRoot', null],
      ['leave', 'Document', null, null, null, null],
    ]);
  });

  it('supports traversals of input values', () => {
    const schema = buildSchema(`
      input ComplexInput {
        stringListField: [String]
      }
    `);
    const ast = parseValue('{ stringListField: ["foo"] }');
    const complexInputType = schema.getType('ComplexInput');
    assert(complexInputType != null);

    const typeInfo = new TypeInfo(schema, complexInputType);

    const visited: Array<any> = [];
    visit(
      ast,
      visitWithTypeInfo(typeInfo, {
        enter(node) {
          const type = typeInfo.getInputType();
          visited.push([
            'enter',
            node.kind,
            node.kind === 'Name' ? node.value : null,
            String(type),
          ]);
        },
        leave(node) {
          const type = typeInfo.getInputType();
          visited.push([
            'leave',
            node.kind,
            node.kind === 'Name' ? node.value : null,
            String(type),
          ]);
        },
      }),
    );

    expect(visited).to.deep.equal([
      ['enter', 'ObjectValue', null, 'ComplexInput'],
      ['enter', 'ObjectField', null, '[String]'],
      ['enter', 'Name', 'stringListField', '[String]'],
      ['leave', 'Name', 'stringListField', '[String]'],
      ['enter', 'ListValue', null, 'String'],
      ['enter', 'StringValue', null, 'String'],
      ['leave', 'StringValue', null, 'String'],
      ['leave', 'ListValue', null, 'String'],
      ['leave', 'ObjectField', null, '[String]'],
      ['leave', 'ObjectValue', null, 'ComplexInput'],
    ]);
  });

  it('supports traversals of selection sets', () => {
    const humanType = testSchema.getType('Human');
    assert(humanType != null);

    const typeInfo = new TypeInfo(testSchema, humanType);

    const ast = parse('{ name, pets { name } }');
    const operationNode = ast.definitions[0];
    assert(operationNode.kind === 'OperationDefinition');

    const visited: Array<any> = [];
    visit(
      operationNode.selectionSet,
      visitWithTypeInfo(typeInfo, {
        enter(node) {
          const parentType = typeInfo.getParentType();
          const type = typeInfo.getType();
          visited.push([
            'enter',
            node.kind,
            node.kind === 'Name' ? node.value : null,
            String(parentType),
            String(type),
          ]);
        },
        leave(node) {
          const parentType = typeInfo.getParentType();
          const type = typeInfo.getType();
          visited.push([
            'leave',
            node.kind,
            node.kind === 'Name' ? node.value : null,
            String(parentType),
            String(type),
          ]);
        },
      }),
    );

    expect(visited).to.deep.equal([
      ['enter', 'SelectionSet', null, 'Human', 'Human'],
      ['enter', 'Field', null, 'Human', 'String'],
      ['enter', 'Name', 'name', 'Human', 'String'],
      ['leave', 'Name', 'name', 'Human', 'String'],
      ['leave', 'Field', null, 'Human', 'String'],
      ['enter', 'Field', null, 'Human', '[Pet]'],
      ['enter', 'Name', 'pets', 'Human', '[Pet]'],
      ['leave', 'Name', 'pets', 'Human', '[Pet]'],
      ['enter', 'SelectionSet', null, 'Pet', '[Pet]'],
      ['enter', 'Field', null, 'Pet', 'String'],
      ['enter', 'Name', 'name', 'Pet', 'String'],
      ['leave', 'Name', 'name', 'Pet', 'String'],
      ['leave', 'Field', null, 'Pet', 'String'],
      ['leave', 'SelectionSet', null, 'Pet', '[Pet]'],
      ['leave', 'Field', null, 'Human', '[Pet]'],
      ['leave', 'SelectionSet', null, 'Human', 'Human'],
    ]);
  });

  it('supports traversals of fragment arguments', () => {
    const typeInfo = new TypeInfo(testSchema);

    const ast = parse(
      `
        query {
          ...Foo(x: 4)
          ...Bar
        }
        fragment Foo(
          $x: ID!
        ) on QueryRoot {
          human(id: $x) { name }
        }
      `,
      { experimentalFragmentArguments: true },
    );

    const visited: Array<any> = [];
    visit(
      ast,
      visitWithTypeInfo(typeInfo, {
        enter(node) {
          const type = typeInfo.getType();
          const inputType = typeInfo.getInputType();
          visited.push([
            'enter',
            node.kind,
            node.kind === 'Name' ? node.value : null,
            String(type),
            String(inputType),
          ]);
        },
        leave(node) {
          const type = typeInfo.getType();
          const inputType = typeInfo.getInputType();
          visited.push([
            'leave',
            node.kind,
            node.kind === 'Name' ? node.value : null,
            String(type),
            String(inputType),
          ]);
        },
      }),
    );

    expect(visited).to.deep.equal([
      ['enter', 'Document', null, 'undefined', 'undefined'],
      ['enter', 'OperationDefinition', null, 'QueryRoot', 'undefined'],
      ['enter', 'SelectionSet', null, 'QueryRoot', 'undefined'],
      ['enter', 'FragmentSpread', null, 'QueryRoot', 'undefined'],
      ['enter', 'Name', 'Foo', 'QueryRoot', 'undefined'],
      ['leave', 'Name', 'Foo', 'QueryRoot', 'undefined'],
      ['enter', 'FragmentArgument', null, 'QueryRoot', 'ID!'],
      ['enter', 'Name', 'x', 'QueryRoot', 'ID!'],
      ['leave', 'Name', 'x', 'QueryRoot', 'ID!'],
      ['enter', 'IntValue', null, 'QueryRoot', 'ID!'],
      ['leave', 'IntValue', null, 'QueryRoot', 'ID!'],
      ['leave', 'FragmentArgument', null, 'QueryRoot', 'ID!'],
      ['leave', 'FragmentSpread', null, 'QueryRoot', 'undefined'],
      ['enter', 'FragmentSpread', null, 'QueryRoot', 'undefined'],
      ['enter', 'Name', 'Bar', 'QueryRoot', 'undefined'],
      ['leave', 'Name', 'Bar', 'QueryRoot', 'undefined'],
      ['leave', 'FragmentSpread', null, 'QueryRoot', 'undefined'],
      ['leave', 'SelectionSet', null, 'QueryRoot', 'undefined'],
      ['leave', 'OperationDefinition', null, 'QueryRoot', 'undefined'],
      ['enter', 'FragmentDefinition', null, 'QueryRoot', 'undefined'],
      ['enter', 'Name', 'Foo', 'QueryRoot', 'undefined'],
      ['leave', 'Name', 'Foo', 'QueryRoot', 'undefined'],
      ['enter', 'VariableDefinition', null, 'QueryRoot', 'ID!'],
      ['enter', 'Variable', null, 'QueryRoot', 'ID!'],
      ['enter', 'Name', 'x', 'QueryRoot', 'ID!'],
      ['leave', 'Name', 'x', 'QueryRoot', 'ID!'],
      ['leave', 'Variable', null, 'QueryRoot', 'ID!'],
      ['enter', 'NonNullType', null, 'QueryRoot', 'ID!'],
      ['enter', 'NamedType', null, 'QueryRoot', 'ID!'],
      ['enter', 'Name', 'ID', 'QueryRoot', 'ID!'],
      ['leave', 'Name', 'ID', 'QueryRoot', 'ID!'],
      ['leave', 'NamedType', null, 'QueryRoot', 'ID!'],
      ['leave', 'NonNullType', null, 'QueryRoot', 'ID!'],
      ['leave', 'VariableDefinition', null, 'QueryRoot', 'ID!'],
      ['enter', 'NamedType', null, 'QueryRoot', 'undefined'],
      ['enter', 'Name', 'QueryRoot', 'QueryRoot', 'undefined'],
      ['leave', 'Name', 'QueryRoot', 'QueryRoot', 'undefined'],
      ['leave', 'NamedType', null, 'QueryRoot', 'undefined'],
      ['enter', 'SelectionSet', null, 'QueryRoot', 'undefined'],
      ['enter', 'Field', null, 'Human', 'undefined'],
      ['enter', 'Name', 'human', 'Human', 'undefined'],
      ['leave', 'Name', 'human', 'Human', 'undefined'],
      ['enter', 'Argument', null, 'Human', 'ID'],
      ['enter', 'Name', 'id', 'Human', 'ID'],
      ['leave', 'Name', 'id', 'Human', 'ID'],
      ['enter', 'Variable', null, 'Human', 'ID'],
      ['enter', 'Name', 'x', 'Human', 'ID'],
      ['leave', 'Name', 'x', 'Human', 'ID'],
      ['leave', 'Variable', null, 'Human', 'ID'],
      ['leave', 'Argument', null, 'Human', 'ID'],
      ['enter', 'SelectionSet', null, 'Human', 'undefined'],
      ['enter', 'Field', null, 'String', 'undefined'],
      ['enter', 'Name', 'name', 'String', 'undefined'],
      ['leave', 'Name', 'name', 'String', 'undefined'],
      ['leave', 'Field', null, 'String', 'undefined'],
      ['leave', 'SelectionSet', null, 'Human', 'undefined'],
      ['leave', 'Field', null, 'Human', 'undefined'],
      ['leave', 'SelectionSet', null, 'QueryRoot', 'undefined'],
      ['leave', 'FragmentDefinition', null, 'QueryRoot', 'undefined'],
      ['leave', 'Document', null, 'undefined', 'undefined'],
    ]);
  });

  it('supports traversals of fragment arguments with default-value', () => {
    const typeInfo = new TypeInfo(testSchema);

    const ast = parse(
      `
          query {
            ...Foo(x: null)
          }
          fragment Foo(
            $x: ID = 4
          ) on QueryRoot {
            human(id: $x) { name }
          }
        `,
      { experimentalFragmentArguments: true },
    );

    const visited: Array<any> = [];
    visit(
      ast,
      visitWithTypeInfo(typeInfo, {
        enter(node) {
          const type = typeInfo.getType();
          const inputType = typeInfo.getInputType();
          visited.push([
            'enter',
            node.kind,
            node.kind === 'Name' ? node.value : null,
            String(type),
            String(inputType),
          ]);
        },
        leave(node) {
          const type = typeInfo.getType();
          const inputType = typeInfo.getInputType();
          visited.push([
            'leave',
            node.kind,
            node.kind === 'Name' ? node.value : null,
            String(type),
            String(inputType),
          ]);
        },
      }),
    );

    expect(visited).to.deep.equal([
      ['enter', 'Document', null, 'undefined', 'undefined'],
      ['enter', 'OperationDefinition', null, 'QueryRoot', 'undefined'],
      ['enter', 'SelectionSet', null, 'QueryRoot', 'undefined'],
      ['enter', 'FragmentSpread', null, 'QueryRoot', 'undefined'],
      ['enter', 'Name', 'Foo', 'QueryRoot', 'undefined'],
      ['leave', 'Name', 'Foo', 'QueryRoot', 'undefined'],
      ['enter', 'FragmentArgument', null, 'QueryRoot', 'ID'],
      ['enter', 'Name', 'x', 'QueryRoot', 'ID'],
      ['leave', 'Name', 'x', 'QueryRoot', 'ID'],
      ['enter', 'NullValue', null, 'QueryRoot', 'ID'],
      ['leave', 'NullValue', null, 'QueryRoot', 'ID'],
      ['leave', 'FragmentArgument', null, 'QueryRoot', 'ID'],
      ['leave', 'FragmentSpread', null, 'QueryRoot', 'undefined'],
      ['leave', 'SelectionSet', null, 'QueryRoot', 'undefined'],
      ['leave', 'OperationDefinition', null, 'QueryRoot', 'undefined'],
      ['enter', 'FragmentDefinition', null, 'QueryRoot', 'undefined'],
      ['enter', 'Name', 'Foo', 'QueryRoot', 'undefined'],
      ['leave', 'Name', 'Foo', 'QueryRoot', 'undefined'],
      ['enter', 'VariableDefinition', null, 'QueryRoot', 'ID'],
      ['enter', 'Variable', null, 'QueryRoot', 'ID'],
      ['enter', 'Name', 'x', 'QueryRoot', 'ID'],
      ['leave', 'Name', 'x', 'QueryRoot', 'ID'],
      ['leave', 'Variable', null, 'QueryRoot', 'ID'],
      ['enter', 'NamedType', null, 'QueryRoot', 'ID'],
      ['enter', 'Name', 'ID', 'QueryRoot', 'ID'],
      ['leave', 'Name', 'ID', 'QueryRoot', 'ID'],
      ['leave', 'NamedType', null, 'QueryRoot', 'ID'],
      ['enter', 'IntValue', null, 'QueryRoot', 'ID'],
      ['leave', 'IntValue', null, 'QueryRoot', 'ID'],
      ['leave', 'VariableDefinition', null, 'QueryRoot', 'ID'],
      ['enter', 'NamedType', null, 'QueryRoot', 'undefined'],
      ['enter', 'Name', 'QueryRoot', 'QueryRoot', 'undefined'],
      ['leave', 'Name', 'QueryRoot', 'QueryRoot', 'undefined'],
      ['leave', 'NamedType', null, 'QueryRoot', 'undefined'],
      ['enter', 'SelectionSet', null, 'QueryRoot', 'undefined'],
      ['enter', 'Field', null, 'Human', 'undefined'],
      ['enter', 'Name', 'human', 'Human', 'undefined'],
      ['leave', 'Name', 'human', 'Human', 'undefined'],
      ['enter', 'Argument', null, 'Human', 'ID'],
      ['enter', 'Name', 'id', 'Human', 'ID'],
      ['leave', 'Name', 'id', 'Human', 'ID'],
      ['enter', 'Variable', null, 'Human', 'ID'],
      ['enter', 'Name', 'x', 'Human', 'ID'],
      ['leave', 'Name', 'x', 'Human', 'ID'],
      ['leave', 'Variable', null, 'Human', 'ID'],
      ['leave', 'Argument', null, 'Human', 'ID'],
      ['enter', 'SelectionSet', null, 'Human', 'undefined'],
      ['enter', 'Field', null, 'String', 'undefined'],
      ['enter', 'Name', 'name', 'String', 'undefined'],
      ['leave', 'Name', 'name', 'String', 'undefined'],
      ['leave', 'Field', null, 'String', 'undefined'],
      ['leave', 'SelectionSet', null, 'Human', 'undefined'],
      ['leave', 'Field', null, 'Human', 'undefined'],
      ['leave', 'SelectionSet', null, 'QueryRoot', 'undefined'],
      ['leave', 'FragmentDefinition', null, 'QueryRoot', 'undefined'],
      ['leave', 'Document', null, 'undefined', 'undefined'],
    ]);
  });
});
