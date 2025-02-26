import { expect } from 'chai';
import { describe, it } from 'mocha';

import { buildSchema } from '../buildASTSchema.js';
import {
  BreakingChangeType,
  DangerousChangeType,
  findSchemaChanges,
  SafeChangeType,
} from '../findSchemaChanges.js';

describe('findSchemaChanges', () => {
  it('should detect if a type was added', () => {
    const newSchema = buildSchema(`
      type Type1
      type Type2
    `);

    const oldSchema = buildSchema(`
      type Type1
    `);
    expect(findSchemaChanges(oldSchema, newSchema)).to.deep.equal([
      {
        type: SafeChangeType.TYPE_ADDED,
        description: 'Type2 was added.',
      },
    ]);
  });

  it('should detect a type changing description', () => {
    const newSchema = buildSchema(`
      "New Description"
      type Type1
    `);

    const oldSchema = buildSchema(`
      type Type1
    `);
    expect(findSchemaChanges(oldSchema, newSchema)).to.deep.equal([
      {
        type: SafeChangeType.DESCRIPTION_CHANGED,
        description: 'Description of Type1 has changed to "New Description".',
      },
    ]);
  });

  it('should detect if a field was added', () => {
    const oldSchema = buildSchema(`
      type Query {
        foo: String
      }
    `);

    const newSchema = buildSchema(`
      type Query {
        foo: String
        bar: String
      }
    `);
    expect(findSchemaChanges(oldSchema, newSchema)).to.deep.equal([
      {
        type: SafeChangeType.FIELD_ADDED,
        description: 'Field Query.bar was added.',
      },
    ]);
  });

  it('should detect a field changing description', () => {
    const oldSchema = buildSchema(`
      type Query {
        foo: String
        bar: String
      }
    `);

    const newSchema = buildSchema(`
      type Query {
        foo: String
        "New Description"
        bar: String
      }
    `);
    expect(findSchemaChanges(oldSchema, newSchema)).to.deep.equal([
      {
        type: SafeChangeType.DESCRIPTION_CHANGED,
        description:
          'Description of field Query.bar has changed to "New Description".',
      },
    ]);
  });

  it('should detect if a default value was added', () => {
    const oldSchema = buildSchema(`
      type Query {
        foo(x: String): String
      }
    `);

    const newSchema = buildSchema(`
      type Query {
        foo(x: String = "bar"): String
      }
    `);
    expect(findSchemaChanges(oldSchema, newSchema)).to.deep.equal([
      {
        type: SafeChangeType.ARG_DEFAULT_VALUE_ADDED,
        description: 'Query.foo(x:) added a defaultValue "bar".',
      },
    ]);
  });

  it('should detect if an arg value changes safely', () => {
    const oldSchema = buildSchema(`
      type Query {
        foo(x: String!): String
      }
    `);

    const newSchema = buildSchema(`
      type Query {
        foo(x: String): String
      }
    `);
    expect(findSchemaChanges(oldSchema, newSchema)).to.deep.equal([
      {
        type: SafeChangeType.ARG_CHANGED_KIND_SAFE,
        description:
          'Argument Query.foo(x:) has changed type from String! to String.',
      },
    ]);
  });

  it('should detect if an arg value changes description', () => {
    const oldSchema = buildSchema(`
      type Query {
        foo(x: String!): String
      }
    `);

    const newSchema = buildSchema(`
      type Query {
        foo(
          "New Description"
          x: String!
        ): String
      }
    `);
    expect(findSchemaChanges(oldSchema, newSchema)).to.deep.equal([
      {
        type: SafeChangeType.DESCRIPTION_CHANGED,
        description:
          'Description of argument Query.foo(x:) has changed to "New Description".',
      },
    ]);
  });

  it('should detect if a directive was added', () => {
    const oldSchema = buildSchema(`
      type Query {
        foo: String
      }
    `);

    const newSchema = buildSchema(`
      directive @Foo on FIELD_DEFINITION

      type Query {
        foo: String
      }
    `);
    expect(findSchemaChanges(oldSchema, newSchema)).to.deep.equal([
      {
        description: 'Directive @Foo was added.',
        type: SafeChangeType.DIRECTIVE_ADDED,
      },
    ]);
  });

  it('should detect if a changes argument safely', () => {
    const oldSchema = buildSchema(`
      directive @Foo(foo: String!) on FIELD_DEFINITION

      type Query {
        foo: String
      }
    `);

    const newSchema = buildSchema(`
      directive @Foo(foo: String) on FIELD_DEFINITION

      type Query {
        foo: String
      }
    `);
    expect(findSchemaChanges(oldSchema, newSchema)).to.deep.equal([
      {
        description:
          'Argument @Foo(foo:) has changed type from String! to String.',
        type: SafeChangeType.ARG_CHANGED_KIND_SAFE,
      },
    ]);
  });

  it('should detect if a default value is added to an argument', () => {
    const oldSchema = buildSchema(`
      directive @Foo(foo: String) on FIELD_DEFINITION

      type Query {
        foo: String
      }
    `);

    const newSchema = buildSchema(`
      directive @Foo(foo: String = "Foo") on FIELD_DEFINITION

      type Query {
        foo: String
      }
    `);
    expect(findSchemaChanges(oldSchema, newSchema)).to.deep.equal([
      {
        description: '@Foo(foo:) added a defaultValue "Foo".',
        type: SafeChangeType.ARG_DEFAULT_VALUE_ADDED,
      },
    ]);
  });

  it('should detect if a default value is removed from an argument', () => {
    const newSchema = buildSchema(`
      directive @Foo(foo: String) on FIELD_DEFINITION

      type Query {
        foo: String
      }
    `);

    const oldSchema = buildSchema(`
      directive @Foo(foo: String = "Foo") on FIELD_DEFINITION

      type Query {
        foo: String
      }
    `);
    expect(findSchemaChanges(oldSchema, newSchema)).to.deep.equal([
      {
        description: '@Foo(foo:) defaultValue was removed.',
        type: DangerousChangeType.ARG_DEFAULT_VALUE_CHANGE,
      },
    ]);
  });

  it('should detect if a default value is changed in an argument', () => {
    const oldSchema = buildSchema(`
      directive @Foo(foo: String = "Bar") on FIELD_DEFINITION

      type Query {
        foo: String
      }
    `);

    const newSchema = buildSchema(`
      directive @Foo(foo: String = "Foo") on FIELD_DEFINITION

      type Query {
        foo: String
      }
    `);
    expect(findSchemaChanges(oldSchema, newSchema)).to.deep.equal([
      {
        description: '@Foo(foo:) has changed defaultValue from "Bar" to "Foo".',
        type: DangerousChangeType.ARG_DEFAULT_VALUE_CHANGE,
      },
    ]);
  });

  it('should detect if a directive argument does a breaking change', () => {
    const oldSchema = buildSchema(`
      directive @Foo(foo: String) on FIELD_DEFINITION

      type Query {
        foo: String
      }
    `);

    const newSchema = buildSchema(`
      directive @Foo(foo: String!) on FIELD_DEFINITION

      type Query {
        foo: String
      }
    `);
    expect(findSchemaChanges(oldSchema, newSchema)).to.deep.equal([
      {
        description:
          'Argument @Foo(foo:) has changed type from String to String!.',
        type: BreakingChangeType.ARG_CHANGED_KIND,
      },
    ]);
  });

  it('should not detect if a directive argument default value does not change', () => {
    const oldSchema = buildSchema(`
      directive @Foo(foo: String = "FOO") on FIELD_DEFINITION

      type Query {
        foo: String
      }
    `);

    const newSchema = buildSchema(`
      directive @Foo(foo: String = "FOO") on FIELD_DEFINITION

      type Query {
        foo: String
      }
    `);
    expect(findSchemaChanges(oldSchema, newSchema)).to.deep.equal([]);
  });

  it('should detect if a directive changes description', () => {
    const oldSchema = buildSchema(`
      directive @Foo on FIELD_DEFINITION

      type Query {
        foo: String
      }
    `);

    const newSchema = buildSchema(`
      "New Description"
      directive @Foo on FIELD_DEFINITION

      type Query {
        foo: String
      }
    `);
    expect(findSchemaChanges(oldSchema, newSchema)).to.deep.equal([
      {
        description: 'Description of @Foo has changed to "New Description".',
        type: SafeChangeType.DESCRIPTION_CHANGED,
      },
    ]);
  });

  it('should detect if a directive becomes repeatable', () => {
    const oldSchema = buildSchema(`
      directive @Foo on FIELD_DEFINITION

      type Query {
        foo: String
      }
    `);

    const newSchema = buildSchema(`
      directive @Foo repeatable on FIELD_DEFINITION

      type Query {
        foo: String
      }
    `);
    expect(findSchemaChanges(oldSchema, newSchema)).to.deep.equal([
      {
        description: 'Repeatable flag was added to @Foo.',
        type: SafeChangeType.DIRECTIVE_REPEATABLE_ADDED,
      },
    ]);
  });

  it('should detect if a directive adds locations', () => {
    const oldSchema = buildSchema(`
      directive @Foo on FIELD_DEFINITION

      type Query {
        foo: String
      }
    `);

    const newSchema = buildSchema(`
      directive @Foo on FIELD_DEFINITION | QUERY

      type Query {
        foo: String
      }
    `);
    expect(findSchemaChanges(oldSchema, newSchema)).to.deep.equal([
      {
        description: 'QUERY was added to @Foo.',
        type: SafeChangeType.DIRECTIVE_LOCATION_ADDED,
      },
    ]);
  });

  it('should detect if a directive arg gets added', () => {
    const oldSchema = buildSchema(`
      directive @Foo on FIELD_DEFINITION

      type Query {
        foo: String
      }
    `);

    const newSchema = buildSchema(`
      directive @Foo(arg1: String) on FIELD_DEFINITION

      type Query {
        foo: String
      }
    `);
    expect(findSchemaChanges(oldSchema, newSchema)).to.deep.equal([
      {
        description: 'An optional argument @Foo(arg1:) was added.',
        type: SafeChangeType.OPTIONAL_DIRECTIVE_ARG_ADDED,
      },
    ]);
  });

  it('should detect if a directive arg changes description', () => {
    const oldSchema = buildSchema(`
      directive @Foo(
        arg1: String
      ) on FIELD_DEFINITION

      type Query {
        foo: String
      }
    `);

    const newSchema = buildSchema(`
      directive @Foo(
        "New Description"
        arg1: String
      ) on FIELD_DEFINITION

      type Query {
        foo: String
      }
    `);
    expect(findSchemaChanges(oldSchema, newSchema)).to.deep.equal([
      {
        description:
          'Description of @Foo(Foo) has changed to "New Description".',
        type: SafeChangeType.DESCRIPTION_CHANGED,
      },
    ]);
  });

  it('should detect if an enum member changes description', () => {
    const oldSchema = buildSchema(`
      enum Foo {
        TEST
      }

      type Query {
        foo: String
      }
    `);

    const newSchema = buildSchema(`
      enum Foo {
        "New Description"
        TEST
      }

      type Query {
        foo: String
      }
    `);
    expect(findSchemaChanges(oldSchema, newSchema)).to.deep.equal([
      {
        description:
          'Description of enum value Foo.TEST has changed to "New Description".',
        type: SafeChangeType.DESCRIPTION_CHANGED,
      },
    ]);
  });

  it('should detect if an input field changes description', () => {
    const oldSchema = buildSchema(`
      input Foo {
        x: String
      }

      type Query {
        foo: String
      }
    `);

    const newSchema = buildSchema(`
      input Foo {
        "New Description"
        x: String
      }

      type Query {
        foo: String
      }
    `);
    expect(findSchemaChanges(oldSchema, newSchema)).to.deep.equal([
      {
        description:
          'Description of input-field Foo.x has changed to "New Description".',
        type: SafeChangeType.DESCRIPTION_CHANGED,
      },
    ]);
  });
});
