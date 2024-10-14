import { expect } from 'chai';
import { describe, it } from 'mocha';

import { buildSchema } from '../buildASTSchema.js';
import { findSchemaChanges, SafeChangeType } from '../findSchemaChanges.js';

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
});
