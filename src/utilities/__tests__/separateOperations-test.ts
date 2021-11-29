import { expect } from 'chai';
import { describe, it } from 'mocha';

import { dedent } from '../../__testUtils__/dedent';

import { mapValue } from '../../jsutils/mapValue';

import { parse } from '../../language/parser';
import { print } from '../../language/printer';

import { separateOperations } from '../separateOperations';

describe('separateOperations', () => {
  it('separates one AST into multiple, maintaining document order', () => {
    const ast = parse(`
      {
        ...Y
        ...X
      }

      query One {
        foo
        bar
        ...A
        ...X
      }

      fragment A on T {
        field
        ...B
      }

      fragment X on T {
        fieldX
      }

      query Two {
        ...A
        ...Y
        baz
      }

      fragment Y on T {
        fieldY
      }

      fragment B on T {
        something
      }
    `);

    const separatedASTs = mapValue(separateOperations(ast), print);
    expect(separatedASTs).to.deep.equal({
      '': dedent`
        {
          ...Y
          ...X
        }

        fragment X on T {
          fieldX
        }

        fragment Y on T {
          fieldY
        }
      `,
      One: dedent`
        query One {
          foo
          bar
          ...A
          ...X
        }

        fragment A on T {
          field
          ...B
        }

        fragment X on T {
          fieldX
        }

        fragment B on T {
          something
        }
      `,
      Two: dedent`
        fragment A on T {
          field
          ...B
        }

        query Two {
          ...A
          ...Y
          baz
        }

        fragment Y on T {
          fieldY
        }

        fragment B on T {
          something
        }
      `,
    });
  });

  it('survives circular dependencies', () => {
    const ast = parse(`
      query One {
        ...A
      }

      fragment A on T {
        ...B
      }

      fragment B on T {
        ...A
      }

      query Two {
        ...B
      }
    `);

    const separatedASTs = mapValue(separateOperations(ast), print);
    expect(separatedASTs).to.deep.equal({
      One: dedent`
        query One {
          ...A
        }

        fragment A on T {
          ...B
        }

        fragment B on T {
          ...A
        }
      `,
      Two: dedent`
        fragment A on T {
          ...B
        }

        fragment B on T {
          ...A
        }

        query Two {
          ...B
        }
      `,
    });
  });

  it('distinguish query and fragment names', () => {
    const ast = parse(`
      {
        ...NameClash
      }

      fragment NameClash on T {
        oneField
      }

      query NameClash {
        ...ShouldBeSkippedInFirstQuery
      }

      fragment ShouldBeSkippedInFirstQuery on T {
        twoField
      }
    `);

    const separatedASTs = mapValue(separateOperations(ast), print);
    expect(separatedASTs).to.deep.equal({
      '': dedent`
        {
          ...NameClash
        }

        fragment NameClash on T {
          oneField
        }
      `,
      NameClash: dedent`
        query NameClash {
          ...ShouldBeSkippedInFirstQuery
        }

        fragment ShouldBeSkippedInFirstQuery on T {
          twoField
        }
      `,
    });
  });

  it('ignores type definitions', () => {
    const ast = parse(`
      query Foo {
        ...Bar
      }

      fragment Bar on T {
        baz
      }

      scalar Foo
      type Bar
    `);

    const separatedASTs = mapValue(separateOperations(ast), print);
    expect(separatedASTs).to.deep.equal({
      Foo: dedent`
        query Foo {
          ...Bar
        }

        fragment Bar on T {
          baz
        }
      `,
    });
  });

  it('handles unknown fragments', () => {
    const ast = parse(`
      {
        ...Unknown
        ...Known
      }

      fragment Known on T {
        someField
      }
    `);

    const separatedASTs = mapValue(separateOperations(ast), print);
    expect(separatedASTs).to.deep.equal({
      '': dedent`
        {
          ...Unknown
          ...Known
        }

        fragment Known on T {
          someField
        }
      `,
    });
  });
});
