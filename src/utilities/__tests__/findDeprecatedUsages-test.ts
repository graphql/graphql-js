import { expect } from 'chai';
import { describe, it } from 'mocha';

import { parse } from '../../language/parser';

import { buildSchema } from '../buildASTSchema';
import { findDeprecatedUsages } from '../findDeprecatedUsages';

describe('findDeprecatedUsages', () => {
  const schema = buildSchema(`
    enum EnumType {
      NORMAL_VALUE
      DEPRECATED_VALUE @deprecated(reason: "Some enum reason.")
    }

    type Query {
      normalField(enumArg: [EnumType]): String
      deprecatedField: String @deprecated(reason: "Some field reason.")
    }
  `);

  it('should report empty set for no deprecated usages', () => {
    const errors = findDeprecatedUsages(
      schema,
      parse('{ normalField(enumArg: [NORMAL_VALUE]) }'),
    );

    expect(errors.length).to.equal(0);
  });

  it('should ignore unknown stuff', () => {
    const errors = findDeprecatedUsages(
      schema,
      parse(`
        {
          unknownField(unknownArg: UNKNOWN_VALUE)
          normalField(enumArg: UNKNOWN_VALUE)
        }
      `),
    );

    expect(errors.length).to.equal(0);
  });

  it('should report usage of deprecated fields', () => {
    const errors = findDeprecatedUsages(
      schema,
      parse('{ normalField, deprecatedField }'),
    );

    const errorMessages = errors.map((err) => err.message);

    expect(errorMessages).to.deep.equal([
      'The field "Query.deprecatedField" is deprecated. Some field reason.',
    ]);
  });

  it('should report usage of deprecated enums', () => {
    const errors = findDeprecatedUsages(
      schema,
      parse(`
        {
           normalField(enumArg: [NORMAL_VALUE, DEPRECATED_VALUE])
        }
      `),
    );

    const errorMessages = errors.map((err) => err.message);

    expect(errorMessages).to.deep.equal([
      'The enum value "EnumType.DEPRECATED_VALUE" is deprecated. Some enum reason.',
    ]);
  });
});
