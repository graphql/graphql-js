/**
 * Copyright (c) 2015-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, it } from 'mocha';
import { expect } from 'chai';
import dedent from '../../jsutils/dedent';
import { graphqlSync } from '../../graphql';
import { printSchema } from '../schemaPrinter';
import { buildSchema } from '../buildASTSchema';
import { buildClientSchema } from '../buildClientSchema';
import { getIntrospectionQuery } from '../introspectionQuery';
import { sortIntrospectionQuery } from '../sortIntrospection';

function sortSDL(sdl) {
  const schema = buildSchema(sdl);
  const result = graphqlSync(schema, getIntrospectionQuery());
  expect(result.errors).to.equal(undefined);
  const introspection = sortIntrospectionQuery(result.data);
  const sortedSchema = buildClientSchema(introspection);
  return printSchema(sortedSchema);
}

describe('sortIntrospectionSchema', () => {
  it('sort fields', () => {
    const sorted = sortSDL(dedent`
      input Bar {
        barB: String
        barA: String
        barC: String
      }

      interface FooInterface {
        fooB: String
        fooA: String
        fooC: String
      }

      type FooType implements FooInterface {
        fooC: String
        fooA: String
        fooB: String
      }

      type Query {
        dummy(arg: Bar): FooType
      }
    `);

    expect(sorted).to.equal(dedent`
      input Bar {
        barA: String
        barB: String
        barC: String
      }

      interface FooInterface {
        fooA: String
        fooB: String
        fooC: String
      }

      type FooType implements FooInterface {
        fooA: String
        fooB: String
        fooC: String
      }

      type Query {
        dummy(arg: Bar): FooType
      }
    `);
  });

  it('sort implemented interfaces', () => {
    const sorted = sortSDL(dedent`
      interface FooA {
        dummy: String
      }

      interface FooB {
        dummy: String
      }

      interface FooC {
        dummy: String
      }

      type Query implements FooB & FooA & FooC {
        dummy: String
      }
    `);

    expect(sorted).to.equal(dedent`
      interface FooA {
        dummy: String
      }

      interface FooB {
        dummy: String
      }

      interface FooC {
        dummy: String
      }

      type Query implements FooA, FooB, FooC {
        dummy: String
      }
    `);
  });

  it('sort types in union', () => {
    const sorted = sortSDL(dedent`
      type FooA {
        dummy: String
      }

      type FooB {
        dummy: String
      }

      type FooC {
        dummy: String
      }

      union FooUnion = FooB | FooA | FooC

      type Query {
        dummy: FooUnion
      }
    `);

    expect(sorted).to.equal(dedent`
      type FooA {
        dummy: String
      }

      type FooB {
        dummy: String
      }

      type FooC {
        dummy: String
      }

      union FooUnion = FooA | FooB | FooC

      type Query {
        dummy: FooUnion
      }
    `);
  });

  it('sort enum values', () => {
    const sorted = sortSDL(dedent`
      enum Foo {
        B
        C
        A
      }

      type Query {
        dummy: Foo
      }
    `);

    expect(sorted).to.equal(dedent`
      enum Foo {
        A
        B
        C
      }

      type Query {
        dummy: Foo
      }
    `);
  });

  it('sort field arguments', () => {
    const sorted = sortSDL(dedent`
      type Query {
        dummy(argB: Int, argA: String, argC: Float): ID
      }
    `);

    expect(sorted).to.equal(dedent`
      type Query {
        dummy(argA: String, argB: Int, argC: Float): ID
      }
    `);
  });

  it('sort types', () => {
    const sorted = sortSDL(dedent`
      type Query {
        dummy(arg1: FooF, arg2: FooA, arg3: FooG): FooD
      }

      type FooC implements FooE {
        dummy: String
      }

      enum FooG {
        enumValue
      }

      scalar FooA

      input FooF {
        dummy: String
      }

      union FooD = FooC | FooB

      interface FooE {
        dummy: String
      }

      type FooB {
        dummy: String
      }
    `);

    expect(sorted).to.equal(dedent`
      scalar FooA

      type FooB {
        dummy: String
      }

      type FooC implements FooE {
        dummy: String
      }

      union FooD = FooB | FooC

      interface FooE {
        dummy: String
      }

      input FooF {
        dummy: String
      }

      enum FooG {
        enumValue
      }

      type Query {
        dummy(arg1: FooF, arg2: FooA, arg3: FooG): FooD
      }
    `);
  });

  it('sort directive arguments', () => {
    const sorted = sortSDL(dedent`
      directive @test(argC: Float, argA: String, argB: Int) on FIELD

      type Query {
        dummy: String
      }
    `);

    expect(sorted).to.equal(dedent`
      directive @test(argA: String, argB: Int, argC: Float) on FIELD

      type Query {
        dummy: String
      }
    `);
  });

  it('sort directive locations', () => {
    const sorted = sortSDL(dedent`
      directive @test(argC: Float, argA: String, argB: Int) on UNION | FIELD | ENUM

      type Query {
        dummy: String
      }
    `);

    expect(sorted).to.equal(dedent`
      directive @test(argA: String, argB: Int, argC: Float) on ENUM | FIELD | UNION

      type Query {
        dummy: String
      }
    `);
  });

  it('sort directives', () => {
    const sorted = sortSDL(dedent`
      directive @fooC on FIELD

      directive @fooB on UNION

      directive @fooA on ENUM

      type Query {
        dummy: String
      }
    `);

    expect(sorted).to.equal(dedent`
      directive @fooA on ENUM

      directive @fooB on UNION

      directive @fooC on FIELD

      type Query {
        dummy: String
      }
    `);
  });
});
