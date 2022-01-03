import { expect } from 'chai';
import { describe, it } from 'mocha';

import { dedent } from '../../__testUtils__/dedent';

import { buildSchema } from '../buildASTSchema';
import { lexicographicSortSchema } from '../lexicographicSortSchema';
import { printSchema } from '../printSchema';

function sortSDL(sdl: string): string {
  const schema = buildSchema(sdl);
  return printSchema(lexicographicSortSchema(schema));
}

describe('lexicographicSortSchema', () => {
  it('sort fields', () => {
    const sorted = sortSDL(`
      input Bar {
        barB: String!
        barA: String
        barC: [String]
      }

      interface FooInterface {
        fooB: String!
        fooA: String
        fooC: [String]
      }

      type FooType implements FooInterface {
        fooC: [String]
        fooA: String
        fooB: String!
      }

      type Query {
        dummy(arg: Bar): FooType
      }
    `);

    expect(sorted).to.equal(dedent`
      input Bar {
        barA: String
        barB: String!
        barC: [String]
      }

      interface FooInterface {
        fooA: String
        fooB: String!
        fooC: [String]
      }

      type FooType implements FooInterface {
        fooA: String
        fooB: String!
        fooC: [String]
      }

      type Query {
        dummy(arg: Bar): FooType
      }
    `);
  });

  it('sort implemented interfaces', () => {
    const sorted = sortSDL(`
      interface FooA {
        dummy: String
      }

      interface FooB {
        dummy: String
      }

      interface FooC implements FooB & FooA {
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

      interface FooC implements FooA & FooB {
        dummy: String
      }

      type Query implements FooA & FooB & FooC {
        dummy: String
      }
    `);
  });

  it('sort types in union', () => {
    const sorted = sortSDL(`
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
    const sorted = sortSDL(`
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
    const sorted = sortSDL(`
      type Query {
        dummy(argB: Int!, argA: String, argC: [Float]): ID
      }
    `);

    expect(sorted).to.equal(dedent`
      type Query {
        dummy(argA: String, argB: Int!, argC: [Float]): ID
      }
    `);
  });

  it('sort types', () => {
    const sorted = sortSDL(`
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
    const sorted = sortSDL(`
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
    const sorted = sortSDL(`
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
    const sorted = sortSDL(`
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

  it('sort recursive types', () => {
    const sorted = sortSDL(`
      interface FooC {
        fooB: FooB
        fooA: FooA
        fooC: FooC
      }

      type FooB implements FooC {
        fooB: FooB
        fooA: FooA
      }

      type FooA implements FooC {
        fooB: FooB
        fooA: FooA
      }

      type Query {
        fooC: FooC
        fooB: FooB
        fooA: FooA
      }
    `);

    expect(sorted).to.equal(dedent`
      type FooA implements FooC {
        fooA: FooA
        fooB: FooB
      }

      type FooB implements FooC {
        fooA: FooA
        fooB: FooB
      }

      interface FooC {
        fooA: FooA
        fooB: FooB
        fooC: FooC
      }

      type Query {
        fooA: FooA
        fooB: FooB
        fooC: FooC
      }
    `);
  });
});
