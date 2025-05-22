import { expect } from 'chai';
import { describe, it } from 'mocha';

import type {
  GraphQLEnumType,
  GraphQLInputObjectType,
  GraphQLObjectType,
} from '../../type/definition.js';
import type { GraphQLDirective } from '../../type/directives.js';

import { buildSchema } from '../buildASTSchema.js';
import { resolveSchemaCoordinate } from '../resolveSchemaCoordinate.js';

describe('resolveSchemaCoordinate', () => {
  const schema = buildSchema(`
    type Query {
      searchBusiness(criteria: SearchCriteria!): [Business]
    }

    input SearchCriteria {
      name: String
      filter: SearchFilter
    }

    enum SearchFilter {
      OPEN_NOW
      DELIVERS_TAKEOUT
      VEGETARIAN_MENU
    }

    type Business {
      id: ID
      name: String
      email: String @private(scope: "loggedIn")
    }

    directive @private(scope: String!) on FIELD_DEFINITION
  `);

  it('resolves a Named Type', () => {
    expect(resolveSchemaCoordinate(schema, 'Business')).to.deep.equal({
      kind: 'NamedType',
      type: schema.getType('Business'),
    });

    expect(resolveSchemaCoordinate(schema, 'String')).to.deep.equal({
      kind: 'NamedType',
      type: schema.getType('String'),
    });

    expect(resolveSchemaCoordinate(schema, 'private')).to.deep.equal(undefined);

    expect(resolveSchemaCoordinate(schema, 'Unknown')).to.deep.equal(undefined);
  });

  it('resolves a Type Field', () => {
    const type = schema.getType('Business') as GraphQLObjectType;
    const field = type.getFields().name;
    expect(resolveSchemaCoordinate(schema, 'Business.name')).to.deep.equal({
      kind: 'Field',
      type,
      field,
    });

    expect(resolveSchemaCoordinate(schema, 'Business.unknown')).to.deep.equal(
      undefined,
    );

    expect(resolveSchemaCoordinate(schema, 'Unknown.field')).to.deep.equal(
      undefined,
    );

    expect(resolveSchemaCoordinate(schema, 'String.field')).to.deep.equal(
      undefined,
    );
  });

  it('does not resolve meta-fields', () => {
    expect(
      resolveSchemaCoordinate(schema, 'Business.__typename'),
    ).to.deep.equal(undefined);
  });

  it('resolves a Input Field', () => {
    const type = schema.getType('SearchCriteria') as GraphQLInputObjectType;
    const inputField = type.getFields().filter;
    expect(
      resolveSchemaCoordinate(schema, 'SearchCriteria.filter'),
    ).to.deep.equal({
      kind: 'InputField',
      type,
      inputField,
    });

    expect(
      resolveSchemaCoordinate(schema, 'SearchCriteria.unknown'),
    ).to.deep.equal(undefined);
  });

  it('resolves a Enum Value', () => {
    const type = schema.getType('SearchFilter') as GraphQLEnumType;
    const enumValue = type.getValue('OPEN_NOW');
    expect(
      resolveSchemaCoordinate(schema, 'SearchFilter.OPEN_NOW'),
    ).to.deep.equal({
      kind: 'EnumValue',
      type,
      enumValue,
    });

    expect(
      resolveSchemaCoordinate(schema, 'SearchFilter.UNKNOWN'),
    ).to.deep.equal(undefined);
  });

  it('resolves a Field Argument', () => {
    const type = schema.getType('Query') as GraphQLObjectType;
    const field = type.getFields().searchBusiness;
    const fieldArgument = field.args.find((arg) => arg.name === 'criteria');
    expect(
      resolveSchemaCoordinate(schema, 'Query.searchBusiness(criteria:)'),
    ).to.deep.equal({
      kind: 'FieldArgument',
      type,
      field,
      fieldArgument,
    });

    expect(
      resolveSchemaCoordinate(schema, 'Business.name(unknown:)'),
    ).to.deep.equal(undefined);

    expect(
      resolveSchemaCoordinate(schema, 'Unknown.field(arg:)'),
    ).to.deep.equal(undefined);

    expect(
      resolveSchemaCoordinate(schema, 'Business.unknown(arg:)'),
    ).to.deep.equal(undefined);

    expect(
      resolveSchemaCoordinate(schema, 'SearchCriteria.name(arg:)'),
    ).to.deep.equal(undefined);
  });

  it('resolves a Directive', () => {
    expect(resolveSchemaCoordinate(schema, '@private')).to.deep.equal({
      kind: 'Directive',
      directive: schema.getDirective('private'),
    });

    expect(resolveSchemaCoordinate(schema, '@deprecated')).to.deep.equal({
      kind: 'Directive',
      directive: schema.getDirective('deprecated'),
    });

    expect(resolveSchemaCoordinate(schema, '@unknown')).to.deep.equal(
      undefined,
    );

    expect(resolveSchemaCoordinate(schema, '@Business')).to.deep.equal(
      undefined,
    );
  });

  it('resolves a Directive Argument', () => {
    const directive = schema.getDirective('private') as GraphQLDirective;
    const directiveArgument = directive.args.find(
      (arg) => arg.name === 'scope',
    );
    expect(resolveSchemaCoordinate(schema, '@private(scope:)')).to.deep.equal({
      kind: 'DirectiveArgument',
      directive,
      directiveArgument,
    });

    expect(resolveSchemaCoordinate(schema, '@private(unknown:)')).to.deep.equal(
      undefined,
    );

    expect(resolveSchemaCoordinate(schema, '@unknown(arg:)')).to.deep.equal(
      undefined,
    );
  });
});
