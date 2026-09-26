import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';
import url from 'node:url';

import { assert, expect } from 'chai';

import { expectJSON } from '../../../__testUtils__/expectJSON.ts';

import { parse } from '../../../language/parser.ts';

import {
  assertObjectType,
  assertScalarType,
  GraphQLInputObjectType,
  GraphQLNonNull,
  GraphQLObjectType,
  GraphQLScalarType,
  GraphQLSchema,
  GraphQLString,
} from '../../../type/index.ts';

import { buildSchema } from '../../../utilities/buildASTSchema.ts';

import type {
  CompiledExecution,
  CompiledSubscription,
} from '../../compile/index.ts';
import { compileExecution, compileSubscription } from '../../compile/index.ts';

import { generateExecution, generateSubscription } from '../index.ts';

describe('generateExecution', () => {
  it('generates a compiled execution module with matching behavior', async () => {
    const schema = buildSchema(`
      type Query {
        greeting(name: String!): String
        count: Int
      }
    `);
    const document = parse(`
      query GeneratedExecution($name: String!, $skipCount: Boolean!) {
        greeting(name: $name)
        count @skip(if: $skipCount)
      }
    `);
    const fieldResolver = (_source: unknown, args: { name?: string }) =>
      args.name ?? 3;

    const compiled = compileExecution({ schema, document, fieldResolver });
    assert('execute' in compiled);

    const generatedSource = generateExecution({
      schema,
      document,
      fieldResolver,
    });
    if (typeof generatedSource !== 'string') {
      throw generatedSource[0];
    }

    const generatedModule = await importGeneratedModule(generatedSource);
    const generated = generatedModule.createCompiledExecution({
      schema,
      fieldResolver,
    });
    if (!('execute' in generated)) {
      throw generated[0];
    }

    const runtimeArgs = {
      variableValues: { name: 'Ada', skipCount: false },
    };
    expectJSON(
      await Promise.resolve(generated.execute(runtimeArgs)),
    ).toDeepEqual(await Promise.resolve(compiled.execute(runtimeArgs)));
  });

  it('reports operations outside the static generation boundary', () => {
    const schema = buildSchema(`
      type Query {
        greeting: String
      }
    `);
    const document = parse(
      `
        {
          ...Greeting(enabled: true)
        }

        fragment Greeting($enabled: Boolean!) on Query {
          greeting @include(if: $enabled)
        }
      `,
      { experimentalFragmentArguments: true },
    );

    const generatedSource = generateExecution({ schema, document });
    if (typeof generatedSource === 'string') {
      throw new Error('Expected generation to fail.');
    }
    expect(generatedSource).to.have.lengthOf(1);
    expect(generatedSource[0]?.message).to.equal(
      'Operation cannot be fully represented as static generated source.',
    );
  });

  it('generates source for documents without location data', () => {
    const schema = buildSchema(`
      type Query {
        value: String
      }
    `);
    const generatedSource = generateExecution({
      schema,
      document: parse('{ value }', { noLocation: true }),
    });
    if (typeof generatedSource !== 'string') {
      throw generatedSource[0];
    }
    expect(generatedSource).to.contain('noLocation: true');
  });

  it('reports generation validation errors and incompatible operations', () => {
    const schema = buildSchema(`
      type Query {
        value: String
      }
    `);
    const executionErrors = generateExecution({
      schema,
      document: parse('query One { value } query Two { value }'),
    });
    expect(executionErrors).to.be.an('array');

    const subscriptionErrors = generateSubscription({
      schema,
      document: parse('query One { value } query Two { value }'),
    });
    expect(subscriptionErrors).to.be.an('array');

    const querySubscriptionSource = generateSubscription({
      schema,
      document: parse('query GeneratedExecution { value }'),
    });
    expect(querySubscriptionSource).to.be.an('array');
    assert(Array.isArray(querySubscriptionSource));
    expect(querySubscriptionSource[0]?.message).to.equal(
      'Expected subscription operation.',
    );

    const missingRootSource = generateExecution({
      schema,
      document: parse('mutation GeneratedExecution { value }'),
    });
    expect(missingRootSource).to.be.an('array');
    assert(Array.isArray(missingRootSource));
    expect(missingRootSource[0]?.message).to.equal(
      'Operation cannot be fully represented as static generated source.',
    );
  });

  it('reports dynamic generated planning cases', () => {
    const schema = buildSchema(`
      input FilterInput {
        required: Int!
        known: Int
      }

      type Query {
        a(arg: Int): String
        b: String
      required(value: Int!): String
      input(value: FilterInput): String
      int(value: Int): String
      item: Item
      node: Node
      items: [String]
      value: String
      values(value: [Int]): String
    }

      type Item {
        child: Item
        id: ID
      }

      interface Node {
        id: ID
      }

      type User implements Node {
        id: ID
        child: Item
      }
    `);
    const cases = [
      '{ a @include }',
      '{ a @include(if: 1) }',
      '{ a @include(if: null) }',
      'query($show: Boolean) { a @include(if: $show) }',
      'query($defer: Boolean!) { ... @defer(if: $defer) { a } }',
      '{ ... @defer(if: null) { a } }',
      '{ ... @defer { ... @defer { a } } }',
      '{ a ... @defer { a } }',
      '{ item { id ... @defer { id } } }',
      'query($defer: Boolean!) { ...Frag @defer(if: $defer) } fragment Frag on Query { a }',
      'query($label: String!) { ... @defer(label: $label) { a } }',
      '{ values @stream(if: null) }',
      '{ values @stream(if: 1) }',
      '{ values @stream(if: 1.5) }',
      '{ values @stream(if: "bad") }',
      'query($count: Int!) { values @stream(initialCount: $count) }',
      'query($label: String!) { values @stream(label: $label) }',
      '{ value @stream(initialCount: 0) }',
      '{ value { id } }',
      'query($value: Int!) { int(value: [$value]) }',
      'query($value: Int!) { values(value: [[$value]]) }',
      'query($value: Int!) { input(value: { required: $value, unknown: $value }) }',
      'query($value: Int!) { input(value: { known: $value }) }',
      'query($value: Int!) { input(value: { required: $value, known: RED }) }',
      'query($value: Int!) { input(value: { required: $value, known: { value: $value } }) }',
      '{ required }',
      '{ item @stream(initialCount: 0) { id } }',
      '{ items { id } }',
      '{ same: a same: b }',
      '{ same: a(arg: 1) same: a(arg: 2) }',
      'query($show: Boolean) { ...Frag @include(if: $show) } fragment Frag on Query { a }',
      '{ ...Frag } fragment Frag on Query { same: a same: b }',
      '{ ... on Query { same: a same: b } }',
      'query { ...Frag } fragment Frag($show: Boolean!) on Query { a }',
      '{ node { ... on User { id { missing } } } }',
      '{ item { same: id } item { same: child { id } } }',
      '{ node { ... on User { same: id } } node { ... on User { same: child { id } } } }',
      '{ same: node { ... on User { id } } same: item { id } }',
    ];

    for (const source of cases) {
      const generatedSource = generateExecution({
        schema,
        document: parse(source, { experimentalFragmentArguments: true }),
      });
      if (typeof generatedSource === 'string') {
        throw new Error(`Expected generation to fail for: ${source}`);
      }
      expect(generatedSource).to.have.lengthOf(1);
      expect(generatedSource[0]?.message).to.equal(
        'Operation cannot be fully represented as static generated source.',
      );
    }

    const missingFragmentSource = generateExecution({
      schema,
      document: parse('{ ...Missing }'),
    });
    expect(missingFragmentSource).to.be.a('string');
  });

  it('covers generated explicit nulls in dynamic input objects', async () => {
    const schema = buildSchema(`
      input FilterInput {
        required: Int!
        known: Int
      }

      type Query {
        input(value: FilterInput): String!
      }
    `);
    const document = parse(`
      query GeneratedExecution($value: Int!) {
        input(value: { required: $value, known: null })
      }
    `);
    const rootValue = {
      input({ value }: { value: { required: number; known: null } }) {
        expect(Object.getPrototypeOf(value)).to.equal(null);
        return `${value.required}:${String(value.known)}`;
      },
    };

    await expectGeneratedExecutionMatchesCompiled({
      schema,
      document,
      rootValue,
      variableValues: { value: 7 },
    });
  });

  it('covers generated mixed dynamic input literals', async () => {
    const schema = buildSchema(`
      input NestedInput {
        value: Int
      }

      input FilterInput {
        nested: NestedInput
        known: Int
        values: [Int]
      }

      type Query {
        input(value: FilterInput): String!
      }
    `);
    const document = parse(`
      query GeneratedExecution($value: Int!) {
        input(
          value: {
            known: $value
            nested: { value: $value }
            values: [1, $value, null]
          }
        )
      }
    `);
    const rootValue = {
      input({ value }: { value: { values: ReadonlyArray<number | null> } }) {
        expect(Object.getPrototypeOf(value)).to.equal(null);
        expect(value.values).to.deep.equal([1, 7, null]);
        return 'ok';
      },
    };

    const nonStaticSource = generateExecution({
      schema,
      document: parse(`
        query GeneratedExecution($value: Int!) {
          input(value: { known: "invalid", nested: { value: $value } })
        }
      `),
    });
    if (typeof nonStaticSource === 'string') {
      throw new Error('Expected generation to fail.');
    }
    expect(nonStaticSource).to.have.lengthOf(1);
    expect(nonStaticSource[0]?.message).to.equal(
      'Operation cannot be fully represented as static generated source.',
    );

    const wrongShapeSource = generateExecution({
      schema,
      document: parse(`
        query GeneratedExecution($value: Int!) {
          input(value: { nested: 1, values: [$value] })
        }
      `),
    });
    if (typeof wrongShapeSource === 'string') {
      throw new Error('Expected generation to fail.');
    }
    expect(wrongShapeSource).to.have.lengthOf(1);
    expect(wrongShapeSource[0]?.message).to.equal(
      'Operation cannot be fully represented as static generated source.',
    );

    await expectGeneratedExecutionMatchesCompiled({
      schema,
      document,
      rootValue,
      variableValues: { value: 7 },
    });
  });

  it('covers generated combined inclusion conditions', async () => {
    const schema = buildSchema(`
      type Query {
        value: String
      }
    `);
    const document = parse(`
      query GeneratedExecution($outer: Boolean!, $inner: Boolean!) {
        ...ValueFragment @include(if: $outer)
      }

      fragment ValueFragment on Query {
        value @include(if: $inner)
      }
    `);
    const rootValue = { value: 'included' };

    await expectGeneratedExecutionMatchesCompiled({
      schema,
      document,
      rootValue,
      variableValues: { inner: true, outer: true },
    });
  });

  it('covers generated disabled inclusion and defer directives', async () => {
    const schema = buildSchema(`
      type Query {
        value: String
      }
    `);
    const document = parse(`
      {
        skipped: value @include(if: false)
        ...SkippedFragment @skip(if: true)
        ... @defer(if: false) {
          included: value
        }
      }

      fragment SkippedFragment on Query {
        fragmentValue: value
      }
    `);
    const rootValue = { value: 'included' };

    await expectGeneratedExecutionMatchesCompiled({
      schema,
      document,
      rootValue,
    });
  });

  it('covers generated invalid nullable variables for non-null arguments', async () => {
    const schema = buildSchema(`
      type Query {
        check(id: ID!): String
      }
    `);
    const document = parse(`
      query GeneratedExecution($id: ID) {
        check(id: $id)
      }
    `);
    const rootValue = {
      check() {
        return 'unexpected';
      },
    };

    await expectGeneratedExecutionMatchesCompiled({
      schema,
      document,
      rootValue,
      variableValues: {},
    });
    await expectGeneratedExecutionMatchesCompiled({
      schema,
      document,
      rootValue,
      variableValues: { id: null },
    });
  });

  it('covers generated variable argument default values', async () => {
    const schema = buildSchema(`
      type Query {
        requiredWithDefault(value: String! = "required-default"): String!
        optionalWithDefault(value: String = "optional-default"): String!
      }
    `);
    const document = parse(`
      query GeneratedExecution($value: String) {
        requiredWithDefault(value: $value)
        optionalWithDefault(value: $value)
      }
    `);
    const rootValue = {
      requiredWithDefault(args: { value: string }) {
        expect(Object.getPrototypeOf(args)).to.equal(null);
        return args.value;
      },
      optionalWithDefault(args: { value: string | null }) {
        expect(Object.getPrototypeOf(args)).to.equal(null);
        return String(args.value);
      },
    };

    await expectGeneratedExecutionMatchesCompiled({
      schema,
      document,
      rootValue,
    });
  });

  it('covers serializable and non-serializable variable defaults', () => {
    function sourceForDefault(defaultLiteral: string, defaultValue: unknown) {
      const schema = buildSchema(`
        scalar DefaultScalar

        type Query {
          echo(value: DefaultScalar): String
        }
      `);
      const scalar = assertScalarType(schema.getType('DefaultScalar'));
      scalar.coerceInputLiteral = () => defaultValue;
      const generatedSource = generateExecution({
        schema,
        document: parse(`
          query GeneratedExecution($value: DefaultScalar = ${defaultLiteral}) {
            echo(value: $value)
          }
        `),
      });
      if (typeof generatedSource !== 'string') {
        throw generatedSource[0];
      }
      return generatedSource;
    }

    function sourceForThrowingDefault() {
      const schema = buildSchema(`
        scalar DefaultScalar

        type Query {
          echo(value: DefaultScalar): String
        }
      `);
      const scalar = assertScalarType(schema.getType('DefaultScalar'));
      scalar.coerceInputLiteral = () => {
        throw new Error('Bad default.');
      };
      const generatedSource = generateExecution({
        schema,
        document: parse(`
          query GeneratedExecution($value: DefaultScalar = "throw") {
            echo(value: $value)
          }
        `),
      });
      if (typeof generatedSource !== 'string') {
        throw generatedSource[0];
      }
      return generatedSource;
    }

    expect(sourceForDefault('"array"', [1, { two: 2 }])).to.be.a('string');
    expect(sourceForDefault('"object"', { 'a-b': 1 })).to.be.a('string');
    expect(sourceForThrowingDefault()).to.contain('getCompiledVariableValues');

    const customPrototype = Object.create({ inherited: true }) as {
      value?: string;
    };
    customPrototype.value = 'custom';
    const cyclic: { self?: unknown } = {};
    cyclic.self = cyclic;

    for (const [literal, value] of [
      ['"custom"', customPrototype],
      ['"cycle"', cyclic],
      ['"undefined"', { value: undefined }],
      ['"undefinedArray"', [undefined]],
      ['"bigint"', 1n],
    ] as const) {
      expect(sourceForDefault(literal, value)).to.contain(
        'getCompiledVariableValues',
      );
    }
  });

  it('covers generated planner fallbacks for variable and argument defaults', () => {
    const throwingDefaultScalar = new GraphQLScalarType({
      name: 'ThrowingDefaultScalar',
      coerceInputValue: (value) => value,
      coerceInputLiteral() {
        throw new Error('Bad default.');
      },
    });
    const throwingDefaultSchema = new GraphQLSchema({
      query: new GraphQLObjectType({
        name: 'Query',
        fields: {
          echo: {
            type: GraphQLString,
            args: { value: { type: throwingDefaultScalar } },
          },
        },
      }),
    });
    const throwingVariableDefaultSource = generateExecution({
      schema: throwingDefaultSchema,
      document: parse(`
        query GeneratedExecution($value: ThrowingDefaultScalar = "throw") {
          echo(value: $value)
        }
      `),
    });
    if (typeof throwingVariableDefaultSource !== 'string') {
      throw throwingVariableDefaultSource[0];
    }
    expect(throwingVariableDefaultSource).to.contain(
      'getCompiledVariableValues',
    );

    function expectNonStaticDefaultArgument(
      argType: GraphQLScalarType | GraphQLNonNull<GraphQLScalarType>,
      defaultValue: unknown,
    ) {
      const schema = new GraphQLSchema({
        query: new GraphQLObjectType({
          name: 'Query',
          fields: {
            echo: {
              type: GraphQLString,
              args: {
                value: {
                  type: argType,
                  defaultValue,
                },
              },
            },
          },
        }),
      });
      const generatedSource = generateExecution({
        schema,
        document: parse(`
          query GeneratedExecution($value: CustomDefaultScalar) {
            echo(value: $value)
          }
        `),
      });
      if (typeof generatedSource === 'string') {
        throw new Error('Expected generation to fail.');
      }
      expect(generatedSource).to.have.lengthOf(1);
      expect(generatedSource[0]?.message).to.equal(
        'Operation cannot be fully represented as static generated source.',
      );
    }

    const customDefaultScalar = new GraphQLScalarType({
      name: 'CustomDefaultScalar',
      coerceInputValue: (value) => value,
      coerceInputLiteral: () => undefined,
    });
    const customPrototype = Object.create({ inherited: true }) as {
      value?: string;
    };
    customPrototype.value = 'custom';
    expectNonStaticDefaultArgument(
      new GraphQLNonNull(customDefaultScalar),
      customPrototype,
    );
    expectNonStaticDefaultArgument(customDefaultScalar, customPrototype);

    const inputWithDefault = new GraphQLInputObjectType({
      name: 'InputWithDefault',
      fields: {
        known: { type: GraphQLString },
        omitted: {
          type: customDefaultScalar,
          defaultValue: customPrototype,
        },
      },
    });
    const inputDefaultSchema = new GraphQLSchema({
      query: new GraphQLObjectType({
        name: 'Query',
        fields: {
          input: {
            type: GraphQLString,
            args: { value: { type: inputWithDefault } },
          },
        },
      }),
    });
    const inputDefaultSource = generateExecution({
      schema: inputDefaultSchema,
      document: parse(`
        query GeneratedExecution($known: String!) {
          input(value: { known: $known })
        }
      `),
    });
    if (typeof inputDefaultSource === 'string') {
      throw new Error('Expected generation to fail.');
    }
    expect(inputDefaultSource).to.have.lengthOf(1);
    expect(inputDefaultSource[0]?.message).to.equal(
      'Operation cannot be fully represented as static generated source.',
    );
  });

  it('covers serializable and non-serializable constant argument values', () => {
    const serializableSource = generateExecution({
      schema: buildSchema(`
        type Query {
          echo(values: [Int]): String
        }
      `),
      document: parse('{ echo(values: [1, 2]) }'),
    });
    if (typeof serializableSource !== 'string') {
      throw serializableSource[0];
    }

    function sourceForArgument(defaultValue: unknown) {
      const schema = buildSchema(`
        scalar ArgumentScalar

        type Query {
          echo(value: ArgumentScalar): String
        }
      `);
      const scalar = assertScalarType(schema.getType('ArgumentScalar'));
      scalar.coerceInputLiteral = () => defaultValue;
      return generateExecution({
        schema,
        document: parse('{ echo(value: "literal") }'),
      });
    }

    const customPrototype = Object.create({ inherited: true }) as {
      value?: string;
    };
    customPrototype.value = 'custom';
    const nonStaticSource = sourceForArgument(customPrototype);
    if (typeof nonStaticSource === 'string') {
      throw new Error('Expected generation to fail.');
    }
    expect(nonStaticSource).to.have.lengthOf(1);
    expect(nonStaticSource[0]?.message).to.equal(
      'Operation cannot be fully represented as static generated source.',
    );
  });

  it('covers generated partial constant argument objects', async () => {
    const schema = buildSchema(`
      type Query {
        check(first: Int, second: Int): Boolean!
      }
    `);
    const document = parse('{ check(first: 1) }');
    const rootValue = {
      check(args: { first?: number; second?: number }) {
        expect(Object.getPrototypeOf(args)).to.equal(null);
        expect(Object.hasOwn(args, 'first')).to.equal(true);
        expect(Object.hasOwn(args, 'second')).to.equal(false);
        return args.first === 1 && args.second === undefined;
      },
    };

    const generatedSource = generateExecution({ schema, document });
    if (typeof generatedSource !== 'string') {
      throw generatedSource[0];
    }
    expect(generatedSource).to.contain('Object.freeze((() =>');

    await expectGeneratedExecutionMatchesCompiled({
      schema,
      document,
      rootValue,
    });
  });

  it('reports located errors from specialized root execution', async () => {
    const schema = buildSchema(`
      type Query {
        value(input: Int): Int
      }
    `);
    const document = parse('{ value(input: 1) }');
    const rootValue = {
      value() {
        throw new Error('broken');
      },
    };

    const generatedSource = generateExecution({ schema, document });
    if (typeof generatedSource !== 'string') {
      throw generatedSource[0];
    }

    const generatedModule = await importGeneratedModule(generatedSource);
    const generated = generatedModule.createCompiledExecution({ schema });
    if (!('execute' in generated)) {
      throw generated[0];
    }

    const result = await Promise.resolve(generated.execute({ rootValue }));
    expect(result.data).to.deep.equal({ value: null });
    expect(result.errors).to.have.lengthOf(1);
    expect(result.errors?.[0]?.message).to.equal('broken');
    expect(result.errors?.[0]?.path).to.deep.equal(['value']);
    expect(result.errors?.[0]?.locations).to.deep.equal([
      { line: 1, column: 3 },
    ]);
  });

  it('generates specialized nested object selection sets', async () => {
    const schema = buildSchema(`
      type Query {
        user: User
      }

      type User {
        tags: [String]
      }
    `);
    const document = parse(`
      {
        user {
          ...UserFields
          ... on User {
            name
          }
        }
      }

      fragment UserFields on User {
        id
      }
    `);
    const rootValue = { user: { id: null, name: 'Ada' } };

    const compiled = compileExecution({ schema, document });
    assert('execute' in compiled);

    const generatedSource = generateExecution({ schema, document });
    if (typeof generatedSource !== 'string') {
      throw generatedSource[0];
    }

    const generatedModule = await importGeneratedModule(generatedSource);
    const generated = generatedModule.createCompiledExecution({ schema });
    if (!('execute' in generated)) {
      throw generated[0];
    }

    expectJSON(
      await Promise.resolve(generated.execute({ rootValue })),
    ).toDeepEqual(await Promise.resolve(compiled.execute({ rootValue })));
  });

  it('generates specialized conditional fields with merged field nodes', async () => {
    const schema = buildSchema(`
      type Query {
        item: Item!
      }

      type Item {
        value: Int
        other: Int
      }
    `);
    const document = parse(`
      query GeneratedExecution($flag: Boolean!) {
        item {
          ...ItemFields
          ... on Item {
            value @include(if: $flag)
            other @skip(if: $flag)
          }
        }
      }

      fragment ItemFields on Item {
        value @include(if: $flag)
        other @skip(if: $flag)
      }
    `);
    const item = {
      value(
        _args: unknown,
        _contextValue: unknown,
        info: { fieldNodes: ReadonlyArray<unknown> },
      ) {
        return info.fieldNodes.length;
      },
      other(
        _args: unknown,
        _contextValue: unknown,
        info: { fieldNodes: ReadonlyArray<unknown> },
      ) {
        return info.fieldNodes.length;
      },
    };
    const rootValue = { item };

    const compiled = compileExecution({ schema, document });
    assert('execute' in compiled);

    const generatedSource = generateExecution({ schema, document });
    if (typeof generatedSource !== 'string') {
      throw generatedSource[0];
    }

    const generatedModule = await importGeneratedModule(generatedSource);
    const generated = generatedModule.createCompiledExecution({ schema });
    if (!('execute' in generated)) {
      throw generated[0];
    }

    const results = await Promise.all(
      [true, false].map(async (flag) => {
        const runtimeArgs = {
          rootValue,
          variableValues: { flag },
        };
        return {
          compiledResult: await Promise.resolve(compiled.execute(runtimeArgs)),
          generatedResult: await Promise.resolve(
            generated.execute(runtimeArgs),
          ),
        };
      }),
    );

    for (const { compiledResult, generatedResult } of results) {
      expectJSON(generatedResult).toDeepEqual(compiledResult);
    }
  });

  it('keeps skipped Object prototype response names absent', async () => {
    const schema = buildSchema(`
      type Query {
        item: Item!
      }

      type Item {
        value: String
      }
    `);
    const document = parse(`
      query GeneratedExecution($include: Boolean!) {
        item {
          value
          toString: value @include(if: $include)
        }
      }
    `);
    const rootValue = { item: { value: 'Ada' } };

    const compiled = compileExecution({ schema, document });
    assert('execute' in compiled);

    const generatedSource = generateExecution({ schema, document });
    if (typeof generatedSource !== 'string') {
      throw generatedSource[0];
    }

    const generatedModule = await importGeneratedModule(generatedSource);
    const generated = generatedModule.createCompiledExecution({ schema });
    if (!('execute' in generated)) {
      throw generated[0];
    }

    const skippedResult = await Promise.resolve(
      generated.execute({
        rootValue,
        variableValues: { include: false },
      }),
    );
    expectJSON(skippedResult).toDeepEqual(
      await Promise.resolve(
        compiled.execute({
          rootValue,
          variableValues: { include: false },
        }),
      ),
    );
    const skippedItem = (
      skippedResult.data as { item: { [key: string]: unknown } }
    ).item;
    expect(Object.getPrototypeOf(skippedItem)).to.equal(null);
    expect(Object.hasOwn(skippedItem, 'toString')).to.equal(false);
    expect(skippedItem.toString).to.equal(undefined);

    const includedResult = await Promise.resolve(
      generated.execute({
        rootValue,
        variableValues: { include: true },
      }),
    );
    const includedItem = (
      includedResult.data as { item: { [key: string]: unknown } }
    ).item;
    expect(Object.getPrototypeOf(includedItem)).to.equal(null);
    expect(Object.hasOwn(includedItem, 'toString')).to.equal(true);
    expect(includedItem.toString).to.equal('Ada');
  });

  it('keeps generated response maps null-prototype for ordinary field names', async () => {
    const schema = buildSchema(`
      type Query {
        item: Item
        items: [Item]
      }

      type Item {
        id: ID
        name: String
        nested: Nested
      }

      type Nested {
        label: String
      }
    `);
    const document = parse(`
      {
        item {
          id
          name
          nested {
            label
          }
        }
        items {
          id
          name
          nested {
            label
          }
        }
      }
    `);
    const rootValue = {
      item: { id: '1', name: 'Ada', nested: { label: 'primary' } },
      items: [{ id: '2', name: 'Grace', nested: { label: 'secondary' } }],
    };

    await expectGeneratedExecutionMatchesCompiled({
      schema,
      document,
      rootValue,
    });
  });

  it('keeps generated response maps null-prototype', async () => {
    const schema = buildSchema(`
      type Item {
        label: String
        child: Item
      }

      type Query {
        value: String
        slow: String
        fast: String
        item: Item
        items: [Item]
      }
    `);
    const document = parse(`
      {
        __proto__: value
        slow
        fast
        item {
          label
          child {
            label
          }
        }
        items {
          label
        }
      }
    `);
    const rootValue = {
      value: 'own proto',
      slow: Promise.resolve('slow'),
      fast: 'fast',
      item: { label: 'item', child: { label: 'child' } },
      items: [{ label: 'list item' }],
    };

    const generatedSource = generateExecution({ schema, document });
    if (typeof generatedSource !== 'string') {
      throw generatedSource[0];
    }

    const generatedModule = await importGeneratedModule(generatedSource);
    const generated = generatedModule.createCompiledExecution({ schema });
    if (!('execute' in generated)) {
      throw generated[0];
    }

    const result = await Promise.resolve(generated.execute({ rootValue }));
    const data = result.data as { [key: string]: unknown };
    expect(Object.getPrototypeOf(data)).to.equal(null);
    expect(Object.hasOwn(data, '__proto__')).to.equal(true);
    expect(Object.getOwnPropertyDescriptor(data, '__proto__')?.value).to.equal(
      'own proto',
    );
    expect(Object.keys(data)).to.deep.equal([
      '__proto__',
      'slow',
      'fast',
      'item',
      'items',
    ]);
    const item = data.item as { child: object };
    expect(Object.getPrototypeOf(item)).to.equal(null);
    expect(Object.getPrototypeOf(item.child)).to.equal(null);
    const items = data.items as ReadonlyArray<object>;
    expect(Object.getPrototypeOf(items[0])).to.equal(null);
  });

  it('keeps generated argument maps null-prototype for Object prototype names', async () => {
    const schema = buildSchema(`
      type Query {
        check(toString: ID): Boolean!
      }
    `);
    const document = parse(`
      query GeneratedExecution($id: ID!) {
        omitted: check
        constant: check(toString: "constant")
        runtime: check(toString: $id)
      }
    `);
    const rootValue = {
      check(args: { [key: string]: unknown }) {
        return (
          Object.getPrototypeOf(args) === null &&
          (Object.hasOwn(args, 'toString')
            ? typeof args.toString === 'string'
            : args.toString === undefined)
        );
      },
    };

    const generatedSource = generateExecution({ schema, document });
    if (typeof generatedSource !== 'string') {
      throw generatedSource[0];
    }
    expect(generatedSource).to.contain('Object.create(null)');

    const generatedModule = await importGeneratedModule(generatedSource);
    const generated = generatedModule.createCompiledExecution({ schema });
    if (!('execute' in generated)) {
      throw generated[0];
    }

    expectJSON(
      await Promise.resolve(
        generated.execute({
          rootValue,
          variableValues: { id: 'runtime' },
        }),
      ),
    ).toDeepEqual({
      data: {
        omitted: true,
        constant: true,
        runtime: true,
      },
    });
  });

  it('keeps generated argument maps null-prototype for ordinary argument names', async () => {
    const schema = buildSchema(`
      input NestedInput {
        value: String
      }

      input CheckInput {
        label: String
        nested: NestedInput
      }

      type Query {
        check(id: ID!, count: Int!, input: CheckInput): Boolean!
      }
    `);
    const document = parse(`
      query GeneratedExecution($id: ID!, $count: Int!, $input: CheckInput) {
        constant: check(
          id: "constant"
          count: 1
          input: { label: "constant", nested: { value: "nested" } }
        )
        runtime: check(id: $id, count: $count, input: $input)
      }
    `);
    const rootValue = {
      check(args: { input?: { nested?: object } }) {
        return (
          Object.getPrototypeOf(args) === null &&
          (args.input === undefined ||
            (Object.getPrototypeOf(args.input) === null &&
              (args.input.nested === undefined ||
                Object.getPrototypeOf(args.input.nested) === null)))
        );
      },
    };

    const generatedSource = generateExecution({ schema, document });
    if (typeof generatedSource !== 'string') {
      throw generatedSource[0];
    }

    const generatedModule = await importGeneratedModule(generatedSource);
    const generated = generatedModule.createCompiledExecution({ schema });
    if (!('execute' in generated)) {
      throw generated[0];
    }

    expectJSON(
      await Promise.resolve(
        generated.execute({
          rootValue,
          variableValues: {
            count: 2,
            id: 'runtime',
            input: { label: 'runtime', nested: { value: 'nested' } },
          },
        }),
      ),
    ).toDeepEqual({
      data: {
        constant: true,
        runtime: true,
      },
    });
  });

  it('keeps empty generated argument maps null-prototype', async () => {
    const schema = buildSchema(`
      type Query {
        check: Boolean!
      }
    `);
    const document = parse('{ check }');
    const rootValue = {
      check(args: object) {
        return Object.getPrototypeOf(args) === null;
      },
    };

    const generatedSource = generateExecution({ schema, document });
    if (typeof generatedSource !== 'string') {
      throw generatedSource[0];
    }

    const generatedModule = await importGeneratedModule(generatedSource);
    const generated = generatedModule.createCompiledExecution({ schema });
    if (!('execute' in generated)) {
      throw generated[0];
    }

    expectJSON(
      await Promise.resolve(generated.execute({ rootValue })),
    ).toDeepEqual({
      data: {
        check: true,
      },
    });
  });

  it('keeps generated variable maps null-prototype', async () => {
    const schema = buildSchema(`
      type Query {
        check(value: String): Boolean!
      }
    `);
    const document = parse(`
      query GeneratedExecution($value: String = "default") {
        check(value: $value)
      }
    `);
    const rootValue = {
      check(
        _args: unknown,
        _context: unknown,
        info: { variableValues: { coerced: object; sources: object } },
      ) {
        return (
          Object.getPrototypeOf(info.variableValues.coerced) === null &&
          Object.getPrototypeOf(info.variableValues.sources) === null
        );
      },
    };

    const generatedSource = generateExecution({ schema, document });
    if (typeof generatedSource !== 'string') {
      throw generatedSource[0];
    }

    const generatedModule = await importGeneratedModule(generatedSource);
    const generated = generatedModule.createCompiledExecution({ schema });
    if (!('execute' in generated)) {
      throw generated[0];
    }

    expectJSON(
      await Promise.resolve(
        generated.execute({
          rootValue,
          variableValues: { value: 'runtime' },
        }),
      ),
    ).toDeepEqual({
      data: {
        check: true,
      },
    });
    expectJSON(
      await Promise.resolve(generated.execute({ rootValue })),
    ).toDeepEqual({
      data: {
        check: true,
      },
    });
  });

  it('generates specialized object list completion', async () => {
    const schema = buildSchema(`
      type Query {
        users: [User!]!
      }

      type User {
        id: ID!
        name: String
      }
    `);
    const document = parse(`
      {
        users {
          tags
        }
      }
    `);
    const users = [{ tags: ['math', 'language'] }, { tags: ['compiler'] }];
    const rootValue = { users: new Set(users) };

    const compiled = compileExecution({ schema, document });
    assert('execute' in compiled);

    const generatedSource = generateExecution({ schema, document });
    if (typeof generatedSource !== 'string') {
      throw generatedSource[0];
    }

    const generatedModule = await importGeneratedModule(generatedSource);
    const generated = generatedModule.createCompiledExecution({ schema });
    if (!('execute' in generated)) {
      throw generated[0];
    }

    const runtimeArgs = { rootValue };
    expectJSON(
      await Promise.resolve(generated.execute(runtimeArgs)),
    ).toDeepEqual(await Promise.resolve(compiled.execute(runtimeArgs)));
  });

  it('covers generated empty child selection sets', async () => {
    const schema = buildSchema(`
      interface Node {
        id: ID!
      }

      type Item {
        id: ID!
      }

      type User implements Node {
        id: ID!
      }

      type Query {
        item: Item
        requiredItem: Item!
        node: Node
        items: [Item]
        nodes: [Node]
      }
    `);
    const document = parse(`
      {
        item {
          id @skip(if: true)
        }
        requiredItem {
          id @skip(if: true)
        }
        node {
          ... on User {
            id @skip(if: true)
          }
        }
        items {
          id @skip(if: true)
        }
        nodes {
          ... on User {
            id @skip(if: true)
          }
        }
      }
    `);
    const rootValue = {
      item: { id: '1' },
      requiredItem: { id: '2' },
      node: { __typename: 'User', id: '3' },
      items: [{ id: '4' }],
      nodes: [{ __typename: 'User', id: '5' }],
    };

    await expectGeneratedExecutionMatchesCompiled({
      schema,
      document,
      rootValue,
    });
  });

  it('reports generated object list item child errors at the item path', async () => {
    const schema = buildSchema(`
      type Query {
        items: [Item]
      }

      type Item {
        id: ID!
      }
    `);
    const document = parse('{ items { id } }');
    const rootValue = {
      items: [
        {
          get id() {
            throw new Error('bad id');
          },
        },
      ],
    };

    await expectGeneratedExecutionMatchesCompiled({
      schema,
      document,
      rootValue,
    });
  });

  it('generates specialized serial mutation execution', async () => {
    const schema = buildSchema(`
      type Query {
        noop: Int
      }

      type Mutation {
        first: Int
        second: Int
      }
    `);
    const document = parse(`
      mutation {
        first
        second
      }
    `);
    const order: Array<string> = [];
    const rootValue = {
      async first() {
        order.push('first:start');
        await Promise.resolve();
        order.push('first:end');
        return 1;
      },
      second() {
        order.push('second');
        return 2;
      },
    };

    const compiled = compileExecution({ schema, document });
    assert('execute' in compiled);

    const generatedSource = generateExecution({ schema, document });
    if (typeof generatedSource !== 'string') {
      throw generatedSource[0];
    }

    const generatedModule = await importGeneratedModule(generatedSource);
    const generated = generatedModule.createCompiledExecution({ schema });
    if (!('execute' in generated)) {
      throw generated[0];
    }

    const generatedResult = await Promise.resolve(
      generated.execute({ rootValue }),
    );
    expectJSON(generatedResult).toDeepEqual(
      await Promise.resolve(compiled.execute({ rootValue })),
    );
    expect(order).to.deep.equal([
      'first:start',
      'first:end',
      'second',
      'first:start',
      'first:end',
      'second',
    ]);
  });

  it('generates specialized abstract object completion', async () => {
    const schema = buildSchema(`
      interface Node {
        id: ID!
      }

      type User implements Node {
        id: ID!
        name: String
      }

      type Post implements Node {
        id: ID!
        title: String
      }

      type Profile {
        name: String
      }

      type Query {
        node: Node
        results: [Node!]!
        profile: Profile
        profiles: [Profile!]!
      }
    `);
    const userType = assertObjectType(schema.getType('User'));
    const postType = assertObjectType(schema.getType('Post'));
    const profileType = assertObjectType(schema.getType('Profile'));
    userType.isTypeOf = (value) =>
      Promise.resolve(
        typeof value === 'object' &&
          value !== null &&
          '__typename' in value &&
          value.__typename === 'User',
      );
    postType.isTypeOf = (value) =>
      Promise.resolve(
        typeof value === 'object' &&
          value !== null &&
          '__typename' in value &&
          value.__typename === 'Post',
      );
    profileType.isTypeOf = (value) =>
      Promise.resolve(
        typeof value === 'object' && value !== null && 'name' in value,
      );
    const document = parse(`
      {
        node {
          __typename
          id
          ... on User {
            name
          }
          ... on Post {
            title
          }
        }
        results {
          __typename
          id
        }
        profile {
          name
        }
        profiles {
          name
        }
      }
    `);
    const rootValue = {
      node: { __typename: 'User', id: '1', name: 'Ada' },
      results: [
        { __typename: 'User', id: '1', name: 'Ada' },
        { __typename: 'Post', id: '2', title: 'Notes' },
      ],
      profile: { name: 'Ada' },
      profiles: [{ name: 'Ada' }, { name: 'Grace' }],
    };

    const compiled = compileExecution({ schema, document });
    assert('execute' in compiled);

    const generatedSource = generateExecution({ schema, document });
    if (typeof generatedSource !== 'string') {
      throw generatedSource[0];
    }

    const generatedModule = await importGeneratedModule(generatedSource);
    const generated = generatedModule.createCompiledExecution({ schema });
    if (!('execute' in generated)) {
      throw generated[0];
    }

    const runtimeArgs = { rootValue };
    expectJSON(
      await Promise.resolve(generated.execute(runtimeArgs)),
    ).toDeepEqual(await Promise.resolve(compiled.execute(runtimeArgs)));
  });

  it('keeps custom scalar variables on the planned variable path', async () => {
    const schema = buildSchema(`
      scalar Odd

      type Query {
        echo(value: Odd!): Odd!
      }
    `);
    const oddType = assertScalarType(schema.getType('Odd'));
    oddType.coerceInputValue = (value) => {
      if (typeof value !== 'number' || value % 2 === 0) {
        throw new Error('Expected odd integer.');
      }
      return value;
    };
    oddType.coerceOutputValue = oddType.coerceInputValue;
    const document = parse(`
      query GeneratedExecution($value: Odd!) {
        echo(value: $value)
      }
    `);
    const rootValue = {
      echo({ value }: { value: number }) {
        return value;
      },
    };

    const compiled = compileExecution({ schema, document });
    assert('execute' in compiled);

    const generatedSource = generateExecution({ schema, document });
    if (typeof generatedSource !== 'string') {
      throw generatedSource[0];
    }

    const generatedModule = await importGeneratedModule(generatedSource);
    const generated = generatedModule.createCompiledExecution({ schema });
    if (!('execute' in generated)) {
      throw generated[0];
    }

    const runtimeArgs = { rootValue, variableValues: { value: 7 } };
    expectJSON(
      await Promise.resolve(generated.execute(runtimeArgs)),
    ).toDeepEqual(await Promise.resolve(compiled.execute(runtimeArgs)));
  });

  it('covers built-in scalar variables on the planned variable path', async () => {
    const schema = buildSchema(`
      type Query {
        requiredArgs(
          bool: Boolean!
          float: Float!
          id: ID!
          int: Int!
          string: String!
        ): String!
        optionalArg(id: ID): String!
      }
    `);
    const document = parse(`
      query GeneratedExecution(
        $bool: Boolean!
        $float: Float!
        $id: ID!
        $int: Int!
        $string: String!
        $optionalId: ID
      ) {
        requiredArgs(
          bool: $bool
          float: $float
          id: $id
          int: $int
          string: $string
        )
        optionalArg(id: $optionalId)
      }
    `);
    const rootValue = {
      requiredArgs(args: {
        bool: boolean;
        float: number;
        id: string;
        int: number;
        string: string;
      }) {
        expect(Object.getPrototypeOf(args)).to.equal(null);
        return [
          String(args.bool),
          String(args.float),
          args.id,
          String(args.int),
          args.string,
        ].join(':');
      },
      optionalArg(args: { id?: string | null }) {
        expect(Object.getPrototypeOf(args)).to.equal(null);
        return String(args.id);
      },
    };

    await expectGeneratedExecutionMatchesCompiled({
      schema,
      document,
      rootValue,
      variableValues: {
        bool: true,
        float: 1.25,
        id: 123,
        int: 7,
        optionalId: null,
        string: 'value',
      },
    });
  });

  it('covers generated scalar and list completion variants', async () => {
    const schema = buildSchema(`
      scalar Odd

      type Builtins {
        bool: Boolean!
        float: Float!
        id: ID!
        int: Int!
        string: String!
      }

      type Thing {
        id: ID!
        value: String
      }

      type Query {
        builtins: Builtins!
        odd: Odd!
        ints: [Int]!
        requiredInts: [Int!]
        things: [Thing]!
        asyncThings: [Thing!]!
      }
    `);
    const oddType = assertScalarType(schema.getType('Odd'));
    oddType.coerceOutputValue = (value) => {
      if (typeof value !== 'number' || value % 2 === 0) {
        throw new Error('Expected odd integer.');
      }
      return value;
    };
    const document = parse(`
      {
        builtins {
          bool
          float
          id
          int
          string
        }
        odd
        ints
        requiredInts
        things {
          id
          value
        }
        asyncThings {
          id
          value
        }
      }
    `);
    const rootValue = {
      builtins: {
        bool: true,
        float: 1.5,
        id: 123,
        int: 7,
        string: 'value',
      },
      odd: 9,
      ints: new Set([1, null, 3]),
      requiredInts: [1, null, 3],
      things: [{ id: '1', value: 'one' }, null, { id: '3', value: 'three' }],
      asyncThings() {
        return asyncThings();
      },
    };
    async function* asyncThings() {
      yield { id: 'a', value: 'A' };
      yield Promise.resolve({ id: 'b', value: 'B' });
    }

    await expectGeneratedExecutionMatchesCompiled({
      schema,
      document,
      rootValue,
    });
  });

  it('covers generated abstract completion without isTypeOf', async () => {
    const schema = buildSchema(`
      interface Result {
        id: ID!
      }

      type Book implements Result {
        id: ID!
        title: String
      }

      type Movie implements Result {
        id: ID!
        title: String
      }

      type Query {
        result: Result
        results: [Result!]!
      }
    `);
    const document = parse(`
      {
        result {
          __typename
          id
          ... on Book {
            title
          }
          ... on Movie {
            title
          }
        }
        results {
          __typename
          id
          ... on Book {
            title
          }
          ... on Movie {
            title
          }
        }
      }
    `);
    const rootValue = {
      result: { __typename: 'Book', id: '1', title: 'Compiler Notes' },
      results: [
        { __typename: 'Book', id: '1', title: 'Compiler Notes' },
        { __typename: 'Movie', id: '2', title: 'Runtime' },
      ],
    };

    await expectGeneratedExecutionMatchesCompiled({
      schema,
      document,
      rootValue,
    });
  });

  it('covers generated abstract field plan merging', async () => {
    const schema = buildSchema(`
      interface Node {
        id: ID!
      }

      type User implements Node {
        id: ID!
        name: String
      }

      type Query {
        node: Node
      }
    `);
    const document = parse(`
      {
        node {
          ... on User {
            id
          }
        }
        node {
          ... on User {
            name
          }
        }
      }
    `);
    const rootValue = {
      node: {
        __typename: 'User',
        id: '1',
        name: 'Ada',
      },
    };

    await expectGeneratedExecutionMatchesCompiled({
      schema,
      document,
      rootValue,
    });
  });

  it('covers generated introspection meta fields', async () => {
    const schema = buildSchema(`
      type Query {
        value: String
      }
    `);
    const document = parse(`
      {
        __schema {
          queryType {
            name
          }
        }
        __type(name: "Query") {
          name
        }
      }
    `);

    await expectGeneratedExecutionMatchesCompiled({ schema, document });
  });

  it('covers generated complex input values and compiled variable values', async () => {
    const schema = buildSchema(`
      input NestedInput {
        limit: Int = 3
        marker: String = "default-marker"
      }

      input FilterInput {
        tags: [String!]!
        nested: NestedInput = {}
        alias: String = "default-alias"
      }

      type Query {
        search(filter: FilterInput!): String!
        literal(filter: FilterInput!): String!
      }
    `);
    const document = parse(`
      query GeneratedExecution($filter: FilterInput!, $tag: String! = "literal") {
        search(filter: $filter)
        literal(filter: { tags: [$tag], nested: { limit: 2 } })
      }
    `);
    const rootValue = {
      search({ filter }: { filter: FilterInputValue }) {
        return formatFilter(filter);
      },
      literal(args: { filter: FilterInputValue }) {
        const { filter } = args;
        return [
          Object.getPrototypeOf(args) === null,
          Object.getPrototypeOf(filter) === null,
          Object.getPrototypeOf(filter.nested) === null,
          formatFilter(filter),
        ].join(':');
      },
    };

    const generatedSource = generateExecution({ schema, document });
    if (typeof generatedSource !== 'string') {
      throw generatedSource[0];
    }
    expect(generatedSource).not.to.contain('return compileExecution');
    expect(generatedSource).to.contain('compileVariableValues');

    await expectGeneratedExecutionMatchesCompiled({
      schema,
      document,
      rootValue,
      variableValues: {
        filter: {
          tags: ['runtime'],
          nested: { marker: 'runtime-marker' },
        },
      },
    });
  });

  it('covers generated static defer execution groups', async () => {
    const schema = buildSchema(`
      type Hero {
        id: ID!
        name: String
      }

      type Query {
        hero: Hero
      }
    `);
    const document = parse(`
      {
        hero {
          id
          ...HeroName @defer(if: true, label: "HeroName")
        }
      }

      fragment HeroName on Hero {
        name
      }
    `);
    const rootValue = {
      hero: {
        id: '1',
        name: 'Ada',
      },
    };

    const compiled = compileExecution({ schema, document });
    assert('experimentalExecuteIncrementally' in compiled);

    const generatedSource = generateExecution({ schema, document });
    if (typeof generatedSource !== 'string') {
      throw generatedSource[0];
    }
    expect(generatedSource).not.to.contain('return compileExecution');
    expect(generatedSource).to.contain('deferPreplannedExecutionGroup');

    const generatedModule = await importGeneratedModule(generatedSource);
    const generated = generatedModule.createCompiledExecution({ schema });
    if (!('experimentalExecuteIncrementally' in generated)) {
      throw generated[0];
    }

    const compiledResult = await Promise.resolve(
      compiled.experimentalExecuteIncrementally({ rootValue }),
    );
    const generatedResult = await Promise.resolve(
      generated.experimentalExecuteIncrementally({ rootValue }),
    );
    assert('initialResult' in compiledResult);
    assert('initialResult' in generatedResult);
    expectJSON(generatedResult.initialResult).toDeepEqual(
      compiledResult.initialResult,
    );
    expectResponseDataMapsNullPrototype(generatedResult.initialResult.data);

    const generatedSubsequentResults = await collectAsyncIterable(
      generatedResult.subsequentResults,
    );
    expectJSON(generatedSubsequentResults).toDeepEqual(
      await collectAsyncIterable(compiledResult.subsequentResults),
    );
    for (const subsequentResult of generatedSubsequentResults) {
      expectIncrementalDataMapsNullPrototype(subsequentResult);
    }
  });

  it('covers generated static defer below abstract selections', async () => {
    const schema = buildSchema(`
      interface Node {
        id: ID!
      }

      type User implements Node {
        id: ID!
      }

      type Query {
        node: Node
      }
    `);
    const document = parse(`
      {
        node {
          ... on User {
            ... @defer(label: "UserId") {
              id
            }
          }
        }
      }
    `);
    const rootValue = {
      node: {
        __typename: 'User',
        id: '1',
      },
    };

    const compiled = compileExecution({ schema, document });
    assert('experimentalExecuteIncrementally' in compiled);

    const generatedSource = generateExecution({ schema, document });
    if (typeof generatedSource !== 'string') {
      throw generatedSource[0];
    }

    const generatedModule = await importGeneratedModule(generatedSource);
    const generated = generatedModule.createCompiledExecution({ schema });
    if (!('experimentalExecuteIncrementally' in generated)) {
      throw generated[0];
    }

    const compiledResult = await Promise.resolve(
      compiled.experimentalExecuteIncrementally({ rootValue }),
    );
    const generatedResult = await Promise.resolve(
      generated.experimentalExecuteIncrementally({ rootValue }),
    );
    assert('initialResult' in compiledResult);
    assert('initialResult' in generatedResult);
    expectJSON(generatedResult.initialResult).toDeepEqual(
      compiledResult.initialResult,
    );
    expectResponseDataMapsNullPrototype(generatedResult.initialResult.data);

    const generatedSubsequentResults = await collectAsyncIterable(
      generatedResult.subsequentResults,
    );
    expectJSON(generatedSubsequentResults).toDeepEqual(
      await collectAsyncIterable(compiledResult.subsequentResults),
    );
    for (const subsequentResult of generatedSubsequentResults) {
      expectIncrementalDataMapsNullPrototype(subsequentResult);
    }
  });

  it('covers generated stream item completion', async () => {
    const schema = buildSchema(`
      type Item {
        id: ID!
        label: String
      }

      type Query {
        items: [Item!]!
      }
    `);
    const document = parse(`
      {
        items @stream(initialCount: 1, label: "lateItems") {
          id
          label
        }
      }
    `);
    const rootValue = {
      items: [
        { id: '1', label: 'one' },
        Promise.resolve({ id: '2', label: 'two' }),
        { id: '3', label: 'three' },
      ],
    };

    const compiled = compileExecution({ schema, document });
    assert('experimentalExecuteIncrementally' in compiled);

    const generatedSource = generateExecution({ schema, document });
    if (typeof generatedSource !== 'string') {
      throw generatedSource[0];
    }
    expect(generatedSource).not.to.contain('return compileExecution');
    expect(generatedSource).to.contain('handleStream');

    const generatedModule = await importGeneratedModule(generatedSource);
    const generated = generatedModule.createCompiledExecution({ schema });
    if (!('experimentalExecuteIncrementally' in generated)) {
      throw generated[0];
    }

    const runtimeArgs = { rootValue };
    const compiledResult = await Promise.resolve(
      compiled.experimentalExecuteIncrementally(runtimeArgs),
    );
    const generatedResult = await Promise.resolve(
      generated.experimentalExecuteIncrementally(runtimeArgs),
    );
    assert('initialResult' in compiledResult);
    assert('initialResult' in generatedResult);
    expectJSON(generatedResult.initialResult).toDeepEqual(
      compiledResult.initialResult,
    );
    expectResponseDataMapsNullPrototype(generatedResult.initialResult.data);

    const generatedSubsequentResults = await collectAsyncIterable(
      generatedResult.subsequentResults,
    );
    expectJSON(generatedSubsequentResults).toDeepEqual(
      await collectAsyncIterable(compiledResult.subsequentResults),
    );
    for (const subsequentResult of generatedSubsequentResults) {
      expectIncrementalDataMapsNullPrototype(subsequentResult);
    }
  });

  it('covers generated nullable object stream completion', async () => {
    const schema = buildSchema(`
      type Item {
        id: ID!
        label: String
      }

      type Query {
        syncItems: [Item]
        asyncItems: [Item]
      }
    `);
    const document = parse(`
      {
        syncItems @stream(initialCount: 1, label: "syncNullableItems") {
          id
          label
        }
        asyncItems @stream(initialCount: 1, label: "asyncNullableItems") {
          id
          label
        }
      }
    `);
    const rootValue = {
      syncItems: [
        { id: '1', label: 'one' },
        Promise.resolve({ id: '2', label: 'two' }),
        null,
      ],
      async asyncItems() {
        await Promise.resolve();
        return (async function* asyncItems() {
          await Promise.resolve();
          yield { id: '3', label: 'three' };
          yield { id: '4', label: 'four' };
        })();
      },
    };

    const compiled = compileExecution({ schema, document });
    assert('experimentalExecuteIncrementally' in compiled);

    const generatedSource = generateExecution({ schema, document });
    if (typeof generatedSource !== 'string') {
      throw generatedSource[0];
    }
    expect(generatedSource).not.to.contain('return compileExecution');
    expect(generatedSource).to.contain('readAsyncListInitial');

    const generatedModule = await importGeneratedModule(generatedSource);
    const generated = generatedModule.createCompiledExecution({ schema });
    if (!('experimentalExecuteIncrementally' in generated)) {
      throw generated[0];
    }

    const runtimeArgs = { rootValue };
    const compiledResult = await Promise.resolve(
      compiled.experimentalExecuteIncrementally(runtimeArgs),
    );
    const generatedResult = await Promise.resolve(
      generated.experimentalExecuteIncrementally(runtimeArgs),
    );
    assert('initialResult' in compiledResult);
    assert('initialResult' in generatedResult);
    expectJSON(generatedResult.initialResult).toDeepEqual(
      compiledResult.initialResult,
    );
    expectResponseDataMapsNullPrototype(generatedResult.initialResult.data);

    const generatedSubsequentResults = await collectAsyncIterable(
      generatedResult.subsequentResults,
    );
    expectJSON(generatedSubsequentResults).toDeepEqual(
      await collectAsyncIterable(compiledResult.subsequentResults),
    );
    for (const subsequentResult of generatedSubsequentResults) {
      expectIncrementalDataMapsNullPrototype(subsequentResult);
    }
  });

  it('covers generated leaf stream item completion', async () => {
    const schema = buildSchema(`
      type Query {
        values: [String]!
      }
    `);
    const document = parse(`
      {
        values @stream(initialCount: 1, label: "lateValues")
      }
    `);
    const rootValue = {
      values: ['one', Promise.resolve('two'), 'three'],
    };

    const compiled = compileExecution({ schema, document });
    assert('experimentalExecuteIncrementally' in compiled);

    const generatedSource = generateExecution({ schema, document });
    if (typeof generatedSource !== 'string') {
      throw generatedSource[0];
    }
    expect(generatedSource).not.to.contain('return compileExecution');
    expect(generatedSource).to.contain('StreamItem');

    const generatedModule = await importGeneratedModule(generatedSource);
    const generated = generatedModule.createCompiledExecution({ schema });
    if (!('experimentalExecuteIncrementally' in generated)) {
      throw generated[0];
    }

    const runtimeArgs = { rootValue };
    const compiledResult = await Promise.resolve(
      compiled.experimentalExecuteIncrementally(runtimeArgs),
    );
    const generatedResult = await Promise.resolve(
      generated.experimentalExecuteIncrementally(runtimeArgs),
    );
    assert('initialResult' in compiledResult);
    assert('initialResult' in generatedResult);
    expectJSON(generatedResult.initialResult).toDeepEqual(
      compiledResult.initialResult,
    );
    expectResponseDataMapsNullPrototype(generatedResult.initialResult.data);

    const generatedSubsequentResults = await collectAsyncIterable(
      generatedResult.subsequentResults,
    );
    expectJSON(generatedSubsequentResults).toDeepEqual(
      await collectAsyncIterable(compiledResult.subsequentResults),
    );
    for (const subsequentResult of generatedSubsequentResults) {
      expectIncrementalDataMapsNullPrototype(subsequentResult);
    }
  });

  it('covers generated conditional stream directives', async () => {
    const schema = buildSchema(`
      type Query {
        values: [String]!
      }
    `);
    const document = parse(`
      query GeneratedExecution($enabled: Boolean!) {
        disabled: values @stream(if: false, initialCount: 1)
        conditional: values @stream(
          if: $enabled
          initialCount: 1
          label: "conditionalValues"
        )
      }
    `);
    const rootValue = {
      values: ['one', 'two', 'three'],
    };

    const compiled = compileExecution({ schema, document });
    assert('experimentalExecuteIncrementally' in compiled);

    const generatedSource = generateExecution({ schema, document });
    if (typeof generatedSource !== 'string') {
      throw generatedSource[0];
    }
    expect(generatedSource).not.to.contain('return compileExecution');
    expect(generatedSource).to.contain('coerced["enabled"] !== false');

    const generatedModule = await importGeneratedModule(generatedSource);
    const generated = generatedModule.createCompiledExecution({ schema });
    if (!('experimentalExecuteIncrementally' in generated)) {
      throw generated[0];
    }

    const runtimeArgs = { rootValue, variableValues: { enabled: true } };
    const compiledResult = await Promise.resolve(
      compiled.experimentalExecuteIncrementally(runtimeArgs),
    );
    const generatedResult = await Promise.resolve(
      generated.experimentalExecuteIncrementally(runtimeArgs),
    );
    assert('initialResult' in compiledResult);
    assert('initialResult' in generatedResult);
    expectJSON(generatedResult.initialResult).toDeepEqual(
      compiledResult.initialResult,
    );
    expectResponseDataMapsNullPrototype(generatedResult.initialResult.data);

    const generatedSubsequentResults = await collectAsyncIterable(
      generatedResult.subsequentResults,
    );
    expectJSON(generatedSubsequentResults).toDeepEqual(
      await collectAsyncIterable(compiledResult.subsequentResults),
    );
    for (const subsequentResult of generatedSubsequentResults) {
      expectIncrementalDataMapsNullPrototype(subsequentResult);
    }
  });

  it('covers generated async stream completion for abstract lists', async () => {
    const schema = buildSchema(`
      interface Result {
        id: ID!
      }

      type Book implements Result {
        id: ID!
        title: String
      }

      type Movie implements Result {
        id: ID!
        title: String
      }

      type Query {
        results: [Result!]!
      }
    `);
    const document = parse(`
      {
        results @stream(initialCount: 1, label: "lateResults") {
          __typename
          id
          ... on Book {
            title
          }
          ... on Movie {
            title
          }
        }
      }
    `);
    const rootValue = {
      async *results() {
        yield { __typename: 'Book', id: '1', title: 'Compiler Notes' };
        yield Promise.resolve({
          __typename: 'Movie',
          id: '2',
          title: 'Runtime',
        });
      },
    };

    const compiled = compileExecution({ schema, document });
    assert('experimentalExecuteIncrementally' in compiled);

    const generatedSource = generateExecution({ schema, document });
    if (typeof generatedSource !== 'string') {
      throw generatedSource[0];
    }
    expect(generatedSource).not.to.contain('return compileExecution');
    expect(generatedSource).to.contain('readAsyncListInitial');

    const generatedModule = await importGeneratedModule(generatedSource);
    const generated = generatedModule.createCompiledExecution({ schema });
    if (!('experimentalExecuteIncrementally' in generated)) {
      throw generated[0];
    }

    const compiledResult = await Promise.resolve(
      compiled.experimentalExecuteIncrementally({ rootValue }),
    );
    const generatedResult = await Promise.resolve(
      generated.experimentalExecuteIncrementally({ rootValue }),
    );
    assert('initialResult' in compiledResult);
    assert('initialResult' in generatedResult);
    expectJSON(generatedResult.initialResult).toDeepEqual(
      compiledResult.initialResult,
    );
    expectResponseDataMapsNullPrototype(generatedResult.initialResult.data);

    const generatedSubsequentResults = await collectAsyncIterable(
      generatedResult.subsequentResults,
    );
    expectJSON(generatedSubsequentResults).toDeepEqual(
      await collectAsyncIterable(compiledResult.subsequentResults),
    );
    for (const subsequentResult of generatedSubsequentResults) {
      expectIncrementalDataMapsNullPrototype(subsequentResult);
    }
  });
});

interface FilterInputValue {
  tags: ReadonlyArray<string>;
  nested: {
    limit: number;
    marker: string;
  };
  alias: string;
}

describe('generateSubscription', () => {
  it('generates a specialized compiled subscription module', async () => {
    const schema = buildSchema(`
      type Query {
        noop: String
      }

      type Subscription {
        message(prefix: String!): String
      }
    `);
    const subscriptionType = schema.getSubscriptionType();
    assert(subscriptionType != null);
    subscriptionType.getFields().message.subscribe =
      async function* generatedMessageEvents(
        _source: unknown,
        args: { prefix: string },
      ) {
        await Promise.resolve();
        yield { message: `${args.prefix}:one` };
      };
    const document = parse(`
      subscription GeneratedSubscription($enabled: Boolean!, $prefix: String!) {
        message(prefix: $prefix) @include(if: $enabled)
      }
    `);

    const compiled = compileSubscription({ schema, document });
    assert('subscribe' in compiled);

    const generatedSource = generateSubscription({ schema, document });
    if (typeof generatedSource !== 'string') {
      throw generatedSource[0];
    }
    expect(generatedSource).to.contain('if (coerced["enabled"] === true)');

    const unconditionalSource = generateSubscription({
      schema,
      document: parse(`
        subscription GeneratedSubscription($prefix: String!) {
          message(prefix: $prefix)
        }
      `),
    });
    if (typeof unconditionalSource !== 'string') {
      throw unconditionalSource[0];
    }

    const generatedModule =
      await importGeneratedModule<GeneratedSubscriptionModule>(generatedSource);
    const generated = generatedModule.createCompiledSubscription({ schema });
    if (!('subscribe' in generated)) {
      throw generated[0];
    }

    const runtimeArgs = {
      variableValues: { enabled: true, prefix: 'event' },
    };
    const compiledFirst = await firstSubscriptionResult(
      compiled.subscribe(runtimeArgs),
    );
    const generatedFirst = await firstSubscriptionResult(
      generated.subscribe(runtimeArgs),
    );
    expectJSON(generatedFirst).toDeepEqual(compiledFirst);
    expectResponseDataMapsNullPrototype(
      (generatedFirst as { data?: unknown }).data,
    );
  });

  it('reports subscriptions outside the static generation boundary', () => {
    const schema = buildSchema(`
      type Query {
        noop: String
      }

      type Subscription {
        message: String
      }
    `);
    const document = parse(
      `
        subscription {
          ...Message(enabled: true)
        }

        fragment Message($enabled: Boolean!) on Subscription {
          message @include(if: $enabled)
        }
      `,
      { experimentalFragmentArguments: true },
    );

    const generatedSource = generateSubscription({ schema, document });
    if (typeof generatedSource === 'string') {
      throw new Error('Expected generation to fail.');
    }
    expect(generatedSource).to.have.lengthOf(1);
    expect(generatedSource[0]?.message).to.equal(
      'Operation cannot be fully represented as static generated source.',
    );
  });
});

interface GeneratedExecutionModule {
  createCompiledExecution: (
    args: unknown,
  ) => ReadonlyArray<unknown> | CompiledExecution;
}

interface GeneratedSubscriptionModule {
  createCompiledSubscription: (
    args: unknown,
  ) => ReadonlyArray<unknown> | CompiledSubscription;
}

async function expectGeneratedExecutionMatchesCompiled({
  schema,
  document,
  rootValue,
  variableValues,
}: {
  schema: ReturnType<typeof buildSchema>;
  document: ReturnType<typeof parse>;
  rootValue?: unknown;
  variableValues?: { readonly [key: string]: unknown };
}): Promise<void> {
  const compiled = compileExecution({ schema, document });
  assert('execute' in compiled);

  const generatedSource = generateExecution({ schema, document });
  if (typeof generatedSource !== 'string') {
    throw generatedSource[0];
  }
  expect(generatedSource).not.to.contain('return compileExecution');

  const generatedModule = await importGeneratedModule(generatedSource);
  const generated = generatedModule.createCompiledExecution({ schema });
  if (!('execute' in generated)) {
    throw generated[0];
  }

  const runtimeArgs = { rootValue, variableValues };
  const generatedResult = await Promise.resolve(generated.execute(runtimeArgs));
  expectJSON(generatedResult).toDeepEqual(
    await Promise.resolve(compiled.execute(runtimeArgs)),
  );
  expectResponseDataMapsNullPrototype(generatedResult.data);
}

function expectResponseDataMapsNullPrototype(value: unknown): void {
  if (value == null) {
    return;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      expectResponseDataMapsNullPrototype(item);
    }
    return;
  }

  if (typeof value !== 'object') {
    return;
  }

  expect(Object.getPrototypeOf(value)).to.equal(null);
  for (const nestedValue of Object.values(value)) {
    expectResponseDataMapsNullPrototype(nestedValue);
  }
}

function expectIncrementalDataMapsNullPrototype(value: unknown): void {
  if (value == null || typeof value !== 'object') {
    return;
  }

  const result = value as {
    incremental?: ReadonlyArray<{
      data?: unknown;
      items?: ReadonlyArray<unknown>;
    }>;
  };
  for (const incremental of result.incremental ?? []) {
    expectResponseDataMapsNullPrototype(incremental.data);
    expectResponseDataMapsNullPrototype(incremental.items);
  }
}

function formatFilter(filter: FilterInputValue): string {
  return [
    filter.tags.join(','),
    filter.nested.limit,
    filter.nested.marker,
    filter.alias,
  ].join(':');
}

async function collectAsyncIterable(
  iterable: AsyncIterable<unknown>,
): Promise<ReadonlyArray<unknown>> {
  const values = [];
  for await (const value of iterable) {
    values.push(value);
  }
  return values;
}

async function importGeneratedModule<T = GeneratedExecutionModule>(
  source: string,
): Promise<T> {
  const tmpDir = fs.mkdtempSync(
    path.join(os.tmpdir(), 'graphql-js-generated-'),
  );
  const tmpFile = path.join(tmpDir, 'generated.mjs');
  const srcRootURL = new URL('../../../', import.meta.url);
  const localSource = source
    .replaceAll("from 'graphql/", `from '${srcRootURL.href}`)
    .replaceAll(".js';", ".ts';");

  fs.writeFileSync(tmpFile, localSource);
  try {
    return (await import(url.pathToFileURL(tmpFile).href)) as T;
  } finally {
    fs.rmSync(tmpDir, { force: true, recursive: true });
  }
}

async function firstSubscriptionResult(
  result: ReturnType<CompiledSubscription['subscribe']>,
): Promise<unknown> {
  const stream = await Promise.resolve(result);
  assert(Symbol.asyncIterator in Object(stream));
  const iterator = stream as AsyncGenerator<unknown, void, void>;
  const next = await iterator.next();
  await iterator.return?.();
  return next.value;
}
