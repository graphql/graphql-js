import { assert, expect } from 'chai';
import { describe, it } from 'mocha';

import type {
  GraphQLEnumType,
  GraphQLField,
  GraphQLInputObjectType,
  GraphQLObjectType,
} from '../../type/definition.js';
import type { GraphQLDirective } from '../../type/directives.js';

import { buildSchema } from '../buildASTSchema.js';
import { resolveSchemaCoordinate } from '../resolveSchemaCoordinate.js';

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

describe('resolveSchemaCoordinate', () => {
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

    expect(() => resolveSchemaCoordinate(schema, 'Unknown.field')).to.throw(
      'Expected "Unknown" to be defined as a type in the schema.',
    );

    expect(() => resolveSchemaCoordinate(schema, 'String.field')).to.throw(
      'Expected "String" to be an Enum, Input Object, Object or Interface type.',
    );
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

    expect(() =>
      resolveSchemaCoordinate(schema, 'Unknown.field(arg:)'),
    ).to.throw('Expected "Unknown" to be defined as a type in the schema.');

    expect(() =>
      resolveSchemaCoordinate(schema, 'Business.unknown(arg:)'),
    ).to.throw(
      'Expected "unknown" to exist as a field of type "Business" in the schema.',
    );

    expect(() =>
      resolveSchemaCoordinate(schema, 'SearchCriteria.name(arg:)'),
    ).to.throw(
      'Expected "SearchCriteria" to be an object type or interface type.',
    );
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

    expect(() => resolveSchemaCoordinate(schema, '@unknown(arg:)')).to.throw(
      'Expected "unknown" to be defined as a directive in the schema.',
    );
  });
});

/*
 * NOTE: the following are not required for spec compliance; resolution
 * of meta-fields is implementation-defined.
 *
 * These tests are here to ensure a change of behavior will only be made
 * in a semver-major release of GraphQL.js.
 */
describe('resolveSchemaCoordinate (meta-fields and introspection types)', () => {
  it('resolves a meta-field', () => {
    const type = schema.getType('Business') as GraphQLObjectType;
    const field = schema.getField(type, '__typename');
    assert.ok(field);
    expect(
      resolveSchemaCoordinate(schema, 'Business.__typename'),
    ).to.deep.equal({
      kind: 'Field',
      type,
      field,
    });
  });

  it('resolves a meta-field argument', () => {
    const type = schema.getType('Query') as GraphQLObjectType;
    const field = schema.getField(type, '__type') as GraphQLField;
    const fieldArgument = field.args.find((arg) => arg.name === 'name');
    expect(
      resolveSchemaCoordinate(schema, 'Query.__type(name:)'),
    ).to.deep.equal({
      kind: 'FieldArgument',
      type,
      field,
      fieldArgument,
    });
  });

  it('resolves an Introspection Type', () => {
    expect(resolveSchemaCoordinate(schema, '__Type')).to.deep.equal({
      kind: 'NamedType',
      type: schema.getType('__Type'),
    });
  });

  it('resolves an Introspection Type Field', () => {
    const type = schema.getType('__Directive') as GraphQLObjectType;
    const field = type.getFields().name;
    expect(resolveSchemaCoordinate(schema, '__Directive.name')).to.deep.equal({
      kind: 'Field',
      type,
      field,
    });
  });

  it('resolves an Introspection Type Enum Value', () => {
    const type = schema.getType('__DirectiveLocation') as GraphQLEnumType;
    const enumValue = type.getValue('INLINE_FRAGMENT');
    expect(
      resolveSchemaCoordinate(schema, '__DirectiveLocation.INLINE_FRAGMENT'),
    ).to.deep.equal({
      kind: 'EnumValue',
      type,
      enumValue,
    });
  });
});
