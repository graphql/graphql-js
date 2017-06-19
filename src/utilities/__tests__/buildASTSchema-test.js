/**
 *  Copyright (c) 2015, Facebook, Inc.
 *  All rights reserved.
 *
 *  This source code is licensed under the BSD-style license found in the
 *  LICENSE file in the root directory of this source tree. An additional grant
 *  of patent rights can be found in the PATENTS file in the same directory.
 */

import { expect } from 'chai';
import { describe, it } from 'mocha';
import { parse } from '../../language';
import { printSchema } from '../schemaPrinter';
import { buildASTSchema, buildSchema } from '../buildASTSchema';
import dedent from '../../jsutils/dedent';
import {
  graphql,
  GraphQLSkipDirective,
  GraphQLIncludeDirective,
  GraphQLDeprecatedDirective,
} from '../../';

/**
 * This function does a full cycle of going from a
 * string with the contents of the DSL, parsed
 * in a schema AST, materializing that schema AST
 * into an in-memory GraphQLSchema, and then finally
 * printing that GraphQL into the DSL
 */
function cycleOutput(body) {
  const ast = parse(body);
  const schema = buildASTSchema(ast);
  return printSchema(schema);
}

describe('Schema Builder', () => {

  it('can use built schema for limited execution', async () => {
    const schema = buildASTSchema(parse(`
      schema { query: Query }
      type Query {
        str: String
      }
    `));

    const result = await graphql(
      schema,
      '{ str }',
      { str: 123 }
    );
    expect(result.data).to.deep.equal({ str: '123' });
  });

  it('can build a schema directly from the source', async () => {
    const schema = buildSchema(`
      type Query {
        add(x: Int, y: Int): Int
      }
    `);
    expect(await graphql(
      schema, '{ add(x: 34, y: 55) }', { add: ({x, y}) => x + y }
    )).to.deep.equal({ data: { add: 89 }});
  });

  it('Simple type', () => {
    const body = dedent`
      schema {
        query: HelloScalars
      }

      type HelloScalars {
        bool: Boolean
        float: Float
        id: ID
        int: Int
        str: String
      }
    `;
    const output = cycleOutput(body);
    expect(output).to.equal(body);
  });

  it('With directives', () => {
    const body = dedent`
      schema {
        query: Hello
      }

      directive @foo(arg: Int) on FIELD

      type Hello {
        str: String
      }
    `;
    const output = cycleOutput(body);
    expect(output).to.equal(body);
  });

  it('Supports descriptions', () => {
    const body = dedent`
      schema {
        query: Hello
      }

      # This is a directive
      directive @foo(
        # It has an argument
        arg: Int
      ) on FIELD

      # With an enum
      enum Color {
        RED

        # Not a creative color
        GREEN
        BLUE
      }

      # What a great type
      type Hello {
        # And a field to boot
        str: String
      }
    `;
    const output = cycleOutput(body);
    expect(output).to.equal(body);
  });

  it('Maintains @skip & @include', () => {
    const body = dedent`
      schema {
        query: Hello
      }

      type Hello {
        str: String
      }
    `;
    const schema = buildASTSchema(parse(body));
    expect(schema.getDirectives().length).to.equal(3);
    expect(schema.getDirective('skip')).to.equal(GraphQLSkipDirective);
    expect(schema.getDirective('include')).to.equal(GraphQLIncludeDirective);
    expect(
      schema.getDirective('deprecated')
    ).to.equal(GraphQLDeprecatedDirective);
  });

  it('Overriding directives excludes specified', () => {
    const body = dedent`
      schema {
        query: Hello
      }

      directive @skip on FIELD
      directive @include on FIELD
      directive @deprecated on FIELD_DEFINITION

      type Hello {
        str: String
      }
    `;
    const schema = buildASTSchema(parse(body));
    expect(schema.getDirectives().length).to.equal(3);
    expect(schema.getDirective('skip')).to.not.equal(GraphQLSkipDirective);
    expect(
      schema.getDirective('include')
    ).to.not.equal(GraphQLIncludeDirective);
    expect(
      schema.getDirective('deprecated')
    ).to.not.equal(GraphQLDeprecatedDirective);
  });

  it('Adding directives maintains @skip & @include', () => {
    const body = dedent`
      schema {
        query: Hello
      }

      directive @foo(arg: Int) on FIELD

      type Hello {
        str: String
      }
    `;
    const schema = buildASTSchema(parse(body));
    expect(schema.getDirectives().length).to.equal(4);
    expect(schema.getDirective('skip')).to.not.equal(undefined);
    expect(schema.getDirective('include')).to.not.equal(undefined);
    expect(schema.getDirective('deprecated')).to.not.equal(undefined);
  });

  it('Type modifiers', () => {
    const body = dedent`
      schema {
        query: HelloScalars
      }

      type HelloScalars {
        listOfNonNullStrs: [String!]
        listOfStrs: [String]
        nonNullListOfNonNullStrs: [String!]!
        nonNullListOfStrs: [String]!
        nonNullStr: String!
      }
    `;
    const output = cycleOutput(body);
    expect(output).to.equal(body);
  });


  it('Recursive type', () => {
    const body = dedent`
      schema {
        query: Recurse
      }

      type Recurse {
        recurse: Recurse
        str: String
      }
    `;
    const output = cycleOutput(body);
    expect(output).to.equal(body);
  });

  it('Two types circular', () => {
    const body = dedent`
      schema {
        query: TypeOne
      }

      type TypeOne {
        str: String
        typeTwo: TypeTwo
      }

      type TypeTwo {
        str: String
        typeOne: TypeOne
      }
    `;
    const output = cycleOutput(body);
    expect(output).to.equal(body);
  });

  it('Single argument field', () => {
    const body = dedent`
      schema {
        query: Hello
      }

      type Hello {
        booleanToStr(bool: Boolean): String
        floatToStr(float: Float): String
        idToStr(id: ID): String
        str(int: Int): String
        strToStr(bool: String): String
      }
    `;
    const output = cycleOutput(body);
    expect(output).to.equal(body);
  });

  it('Simple type with multiple arguments', () => {
    const body = dedent`
      schema {
        query: Hello
      }

      type Hello {
        str(int: Int, bool: Boolean): String
      }
    `;
    const output = cycleOutput(body, 'Hello');
    expect(output).to.equal(body);
  });

  it('Simple type with interface', () => {
    const body = dedent`
      schema {
        query: Hello
      }

      type Hello implements WorldInterface {
        str: String
      }

      interface WorldInterface {
        str: String
      }
    `;
    const output = cycleOutput(body, 'Hello');
    expect(output).to.equal(body);
  });

  it('Simple output enum', () => {
    const body = dedent`
      schema {
        query: OutputEnumRoot
      }

      enum Hello {
        WORLD
      }

      type OutputEnumRoot {
        hello: Hello
      }
    `;
    const output = cycleOutput(body);
    expect(output).to.equal(body);
  });

  it('Simple input enum', () => {
    const body = dedent`
      schema {
        query: InputEnumRoot
      }

      enum Hello {
        WORLD
      }

      type InputEnumRoot {
        str(hello: Hello): String
      }
    `;
    const output = cycleOutput(body);
    expect(output).to.equal(body);
  });

  it('Multiple value enum', () => {
    const body = dedent`
      schema {
        query: OutputEnumRoot
      }

      enum Hello {
        WO
        RLD
      }

      type OutputEnumRoot {
        hello: Hello
      }
    `;
    const output = cycleOutput(body);
    expect(output).to.equal(body);
  });

  it('Simple Union', () => {
    const body = dedent`
      schema {
        query: Root
      }

      union Hello = World

      type Root {
        hello: Hello
      }

      type World {
        str: String
      }
    `;
    const output = cycleOutput(body);
    expect(output).to.equal(body);
  });

  it('Multiple Union', () => {
    const body = dedent`
      schema {
        query: Root
      }

      union Hello = WorldOne | WorldTwo

      type Root {
        hello: Hello
      }

      type WorldOne {
        str: String
      }

      type WorldTwo {
        str: String
      }
    `;
    const output = cycleOutput(body);
    expect(output).to.equal(body);
  });

  it('Custom Scalar', () => {
    const body = dedent`
      schema {
        query: Root
      }

      scalar CustomScalar

      type Root {
        customScalar: CustomScalar
      }
    `;

    const output = cycleOutput(body);
    expect(output).to.equal(body);
  });

  it('Input Object', async() => {
    const body = dedent`
      schema {
        query: Root
      }

      input Input {
        int: Int
      }

      type Root {
        field(in: Input): String
      }
    `;

    const output = cycleOutput(body);
    expect(output).to.equal(body);
  });

  it('Simple argument field with default', () => {
    const body = dedent`
      schema {
        query: Hello
      }

      type Hello {
        str(int: Int = 2): String
      }
    `;
    const output = cycleOutput(body);
    expect(output).to.equal(body);
  });

  it('Simple type with mutation', () => {
    const body = dedent`
      schema {
        query: HelloScalars
        mutation: Mutation
      }

      type HelloScalars {
        bool: Boolean
        int: Int
        str: String
      }

      type Mutation {
        addHelloScalars(str: String, int: Int, bool: Boolean): HelloScalars
      }
    `;
    const output = cycleOutput(body);
    expect(output).to.equal(body);
  });

  it('Simple type with subscription', () => {
    const body = dedent`
      schema {
        query: HelloScalars
        subscription: Subscription
      }

      type HelloScalars {
        bool: Boolean
        int: Int
        str: String
      }

      type Subscription {
        sbscribeHelloScalars(str: String, int: Int, bool: Boolean): HelloScalars
      }
    `;
    const output = cycleOutput(body);
    expect(output).to.equal(body);
  });

  it('Unreferenced type implementing referenced interface', () => {
    const body = dedent`
      type Concrete implements Iface {
        key: String
      }

      interface Iface {
        key: String
      }

      type Query {
        iface: Iface
      }
    `;
    const output = cycleOutput(body);
    expect(output).to.equal(body);
  });

  it('Unreferenced type implementing referenced union', () => {
    const body = dedent`
      type Concrete {
        key: String
      }

      type Query {
        union: Union
      }

      union Union = Concrete
    `;
    const output = cycleOutput(body);
    expect(output).to.equal(body);
  });

  it('Supports @deprecated', () => {
    const body = dedent`
      enum MyEnum {
        VALUE
        OLD_VALUE @deprecated
        OTHER_VALUE @deprecated(reason: "Terrible reasons")
      }

      type Query {
        enum: MyEnum
        field1: String @deprecated
        field2: Int @deprecated(reason: "Because I said so")
      }
    `;
    const output = cycleOutput(body);
    expect(output).to.equal(body);

    const ast = parse(body);
    const schema = buildASTSchema(ast);

    expect(schema.getType('MyEnum').getValues()).to.deep.equal([
      {
        name: 'VALUE',
        description: '',
        isDeprecated: false,
        deprecationReason: null,
        value: 'VALUE'
      },
      {
        name: 'OLD_VALUE',
        description: '',
        isDeprecated: true,
        deprecationReason: 'No longer supported',
        value: 'OLD_VALUE'
      },
      {
        name: 'OTHER_VALUE',
        description: '',
        isDeprecated: true,
        deprecationReason: 'Terrible reasons',
        value: 'OTHER_VALUE'
      }
    ]);

    const rootFields = schema.getType('Query').getFields();
    expect(rootFields.field1.isDeprecated).to.equal(true);
    expect(rootFields.field1.deprecationReason).to.equal('No longer supported');

    expect(rootFields.field2.isDeprecated).to.equal(true);
    expect(rootFields.field2.deprecationReason).to.equal('Because I said so');
  });
});

describe('Failures', () => {

  it('Requires a schema definition or Query type', () => {
    const body = dedent`
      type Hello {
        bar: Bar
      }
    `;
    const doc = parse(body);
    expect(() => buildASTSchema(doc)).to.throw(
      'Must provide schema definition with query type or a type named Query.'
    );
  });

  it('Allows only a single schema definition', () => {
    const body = dedent`
      schema {
        query: Hello
      }

      schema {
        query: Hello
      }

      type Hello {
        bar: Bar
      }
    `;
    const doc = parse(body);
    expect(() => buildASTSchema(doc))
      .to.throw('Must provide only one schema definition.');
  });

  it('Requires a query type', () => {
    const body = dedent`
      schema {
        mutation: Hello
      }

      type Hello {
        bar: Bar
      }
    `;
    const doc = parse(body);
    expect(() => buildASTSchema(doc)).to.throw(
      'Must provide schema definition with query type or a type named Query.'
    );
  });

  it('Allows only a single query type', () => {
    const body = dedent`
      schema {
        query: Hello
        query: Yellow
      }

      type Hello {
        bar: Bar
      }

      type Yellow {
        isColor: Boolean
      }
    `;
    const doc = parse(body);
    expect(() => buildASTSchema(doc))
      .to.throw('Must provide only one query type in schema.');
  });

  it('Allows only a single mutation type', () => {
    const body = dedent`
      schema {
        query: Hello
        mutation: Hello
        mutation: Yellow
      }

      type Hello {
        bar: Bar
      }

      type Yellow {
        isColor: Boolean
      }
    `;
    const doc = parse(body);
    expect(() => buildASTSchema(doc))
      .to.throw('Must provide only one mutation type in schema.');
  });

  it('Allows only a single subscription type', () => {
    const body = dedent`
      schema {
        query: Hello
        subscription: Hello
        subscription: Yellow
      }

      type Hello {
        bar: Bar
      }

      type Yellow {
        isColor: Boolean
      }
    `;
    const doc = parse(body);
    expect(() => buildASTSchema(doc))
      .to.throw('Must provide only one subscription type in schema.');
  });

  it('Unknown type referenced', () => {
    const body = dedent`
      schema {
        query: Hello
      }

      type Hello {
        bar: Bar
      }
    `;
    const doc = parse(body);
    expect(() => buildASTSchema(doc))
      .to.throw('Type "Bar" not found in document.');
  });

  it('Unknown type in interface list', () => {
    const body = dedent`
      schema {
        query: Hello
      }

      type Hello implements Bar { }
    `;
    const doc = parse(body);
    expect(() => buildASTSchema(doc))
      .to.throw('Type "Bar" not found in document.');
  });

  it('Unknown type in union list', () => {
    const body = dedent`
      schema {
        query: Hello
      }

      union TestUnion = Bar
      type Hello { testUnion: TestUnion }
    `;
    const doc = parse(body);
    expect(() => buildASTSchema(doc))
      .to.throw('Type "Bar" not found in document.');
  });

  it('Unknown query type', () => {
    const body = dedent`
      schema {
        query: Wat
      }

      type Hello {
        str: String
      }
    `;
    const doc = parse(body);
    expect(() => buildASTSchema(doc))
      .to.throw('Specified query type "Wat" not found in document.');
  });

  it('Unknown mutation type', () => {
    const body = dedent`
      schema {
        query: Hello
        mutation: Wat
      }

      type Hello {
        str: String
      }
    `;
    const doc = parse(body);
    expect(() => buildASTSchema(doc))
      .to.throw('Specified mutation type "Wat" not found in document.');
  });

  it('Unknown subscription type', () => {
    const body = dedent`
      schema {
        query: Hello
        mutation: Wat
        subscription: Awesome
      }

      type Hello {
        str: String
      }

      type Wat {
        str: String
      }
    `;
    const doc = parse(body);
    expect(() => buildASTSchema(doc))
      .to.throw('Specified subscription type "Awesome" not found in document.');
  });

  it('Does not consider operation names', () => {
    const body = dedent`
      schema {
        query: Foo
      }

      query Foo { field }
    `;
    const doc = parse(body);
    expect(() => buildASTSchema(doc))
      .to.throw('Specified query type "Foo" not found in document.');
  });

  it('Does not consider fragment names', () => {
    const body = dedent`
      schema {
        query: Foo
      }

      fragment Foo on Type { field }
    `;
    const doc = parse(body);
    expect(() => buildASTSchema(doc))
      .to.throw('Specified query type "Foo" not found in document.');
  });

  it('Forbids duplicate type definitions', () => {
    const body = dedent`
      schema {
        query: Repeated
      }

      type Repeated {
        id: Int
      }

      type Repeated {
        id: String
      }
    `;
    const doc = parse(body);
    expect(() => buildASTSchema(doc))
      .to.throw('Type "Repeated" was defined more than once.');
  });
});
