import { describe, it } from 'mocha';

import { UniqueArgumentDefinitionNamesRule } from '../rules/UniqueArgumentDefinitionNamesRule';

import { expectSDLValidationErrors } from './harness';

function expectSDLErrors(sdlStr: string) {
  return expectSDLValidationErrors(
    undefined,
    UniqueArgumentDefinitionNamesRule,
    sdlStr,
  );
}

function expectValidSDL(sdlStr: string) {
  expectSDLErrors(sdlStr).toDeepEqual([]);
}

describe('Validate: Unique argument definition names', () => {
  it('no args', () => {
    expectValidSDL(`
      type SomeObject {
        someField: String
      }

      interface SomeInterface {
        someField: String
      }

      directive @someDirective on QUERY
    `);
  });

  it('one argument', () => {
    expectValidSDL(`
      type SomeObject {
        someField(foo: String): String
      }

      interface SomeInterface {
        someField(foo: String): String
      }

      extend type SomeObject {
        anotherField(foo: String): String
      }

      extend interface SomeInterface {
        anotherField(foo: String): String
      }

      directive @someDirective(foo: String) on QUERY
    `);
  });

  it('multiple arguments', () => {
    expectValidSDL(`
      type SomeObject {
        someField(
          foo: String
          bar: String
        ): String
      }

      interface SomeInterface {
        someField(
          foo: String
          bar: String
        ): String
      }

      extend type SomeObject {
        anotherField(
          foo: String
          bar: String
        ): String
      }

      extend interface SomeInterface {
        anotherField(
          foo: String
          bar: String
        ): String
      }

      directive @someDirective(
        foo: String
        bar: String
      ) on QUERY
    `);
  });

  it('duplicating arguments', () => {
    expectSDLErrors(`
      type SomeObject {
        someField(
          foo: String
          bar: String
          foo: String
        ): String
      }

      interface SomeInterface {
        someField(
          foo: String
          bar: String
          foo: String
        ): String
      }

      extend type SomeObject {
        anotherField(
          foo: String
          bar: String
          bar: String
        ): String
      }

      extend interface SomeInterface {
        anotherField(
          bar: String
          foo: String
          foo: String
        ): String
      }

      directive @someDirective(
        foo: String
        bar: String
        foo: String
      ) on QUERY
    `).toDeepEqual([
      {
        message:
          'Argument "SomeObject.someField(foo:)" can only be defined once.',
        locations: [
          { line: 4, column: 11 },
          { line: 6, column: 11 },
        ],
      },
      {
        message:
          'Argument "SomeInterface.someField(foo:)" can only be defined once.',
        locations: [
          { line: 12, column: 11 },
          { line: 14, column: 11 },
        ],
      },
      {
        message:
          'Argument "SomeObject.anotherField(bar:)" can only be defined once.',
        locations: [
          { line: 21, column: 11 },
          { line: 22, column: 11 },
        ],
      },
      {
        message:
          'Argument "SomeInterface.anotherField(foo:)" can only be defined once.',
        locations: [
          { line: 29, column: 11 },
          { line: 30, column: 11 },
        ],
      },
      {
        message: 'Argument "@someDirective(foo:)" can only be defined once.',
        locations: [
          { line: 35, column: 9 },
          { line: 37, column: 9 },
        ],
      },
    ]);
  });
});
