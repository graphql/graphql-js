import { expect } from 'chai';
import { describe, it } from 'mocha';

import { invariant } from '../../jsutils/invariant';

import { GraphQLSchema } from '../schema';
import { GraphQLDirective } from '../directives';
import {
  GraphQLScalarType,
  GraphQLObjectType,
  GraphQLInterfaceType,
  GraphQLUnionType,
  GraphQLEnumType,
  GraphQLInputObjectType,
} from '../definition';

const dummyType = new GraphQLScalarType({ name: 'DummyScalar' });

function expectObjMap(value: mixed) {
  invariant(value != null && typeof value === 'object');
  expect(Object.getPrototypeOf(value)).to.equal(null);
  return expect(value);
}

describe('Type System: Extensions', () => {
  describe('GraphQLScalarType', () => {
    it('without extensions', () => {
      const someScalar = new GraphQLScalarType({ name: 'SomeScalar' });
      expect(someScalar.extensions).to.equal(undefined);

      const config = someScalar.toConfig();
      expect(config.extensions).to.equal(undefined);
    });

    it('with extensions', () => {
      const scalarExtensions = Object.freeze({ SomeScalarExt: 'scalar' });
      const someScalar = new GraphQLScalarType({
        name: 'SomeScalar',
        extensions: scalarExtensions,
      });

      expectObjMap(someScalar.extensions).to.deep.equal(scalarExtensions);

      const config = someScalar.toConfig();
      expectObjMap(config.extensions).to.deep.equal(scalarExtensions);
    });
  });

  describe('GraphQLObjectType', () => {
    it('without extensions', () => {
      const someObject = new GraphQLObjectType({
        name: 'SomeObject',
        fields: {
          someField: {
            type: dummyType,
            args: {
              someArg: {
                type: dummyType,
              },
            },
          },
        },
      });

      expect(someObject.extensions).to.equal(undefined);
      const someField = someObject.getFields().someField;
      expect(someField.extensions).to.equal(undefined);
      const someArg = someField.args[0];
      expect(someArg.extensions).to.equal(undefined);

      const config = someObject.toConfig();
      expect(config.extensions).to.equal(undefined);
      const someFieldConfig = config.fields.someField;
      expect(someFieldConfig.extensions).to.equal(undefined);
      invariant(someFieldConfig.args);
      const someArgConfig = someFieldConfig.args.someArg;
      expect(someArgConfig.extensions).to.equal(undefined);
    });

    it('with extensions', () => {
      const objectExtensions = Object.freeze({ SomeObjectExt: 'object' });
      const fieldExtensions = Object.freeze({ SomeFieldExt: 'field' });
      const argExtensions = Object.freeze({ SomeArgExt: 'arg' });

      const someObject = new GraphQLObjectType({
        name: 'SomeObject',
        fields: {
          someField: {
            type: dummyType,
            args: {
              someArg: {
                type: dummyType,
                extensions: argExtensions,
              },
            },
            extensions: fieldExtensions,
          },
        },
        extensions: objectExtensions,
      });

      expectObjMap(someObject.extensions).to.deep.equal(objectExtensions);
      const someField = someObject.getFields().someField;
      expectObjMap(someField.extensions).to.deep.equal(fieldExtensions);
      const someArg = someField.args[0];
      expectObjMap(someArg.extensions).to.deep.equal(argExtensions);

      const config = someObject.toConfig();
      expectObjMap(config.extensions).to.deep.equal(objectExtensions);
      const someFieldConfig = config.fields.someField;
      expectObjMap(someFieldConfig.extensions).to.deep.equal(fieldExtensions);
      invariant(someFieldConfig.args);
      const someArgConfig = someFieldConfig.args.someArg;
      expectObjMap(someArgConfig.extensions).to.deep.equal(argExtensions);
    });
  });

  describe('GraphQLInterfaceType', () => {
    it('without extensions', () => {
      const someInterface = new GraphQLInterfaceType({
        name: 'SomeInterface',
        fields: {
          someField: {
            type: dummyType,
            args: {
              someArg: {
                type: dummyType,
              },
            },
          },
        },
      });

      expect(someInterface.extensions).to.equal(undefined);
      const someField = someInterface.getFields().someField;
      expect(someField.extensions).to.equal(undefined);
      const someArg = someField.args[0];
      expect(someArg.extensions).to.equal(undefined);

      const config = someInterface.toConfig();
      expect(config.extensions).to.equal(undefined);
      const someFieldConfig = config.fields.someField;
      expect(someFieldConfig.extensions).to.equal(undefined);
      invariant(someFieldConfig.args);
      const someArgConfig = someFieldConfig.args.someArg;
      expect(someArgConfig.extensions).to.equal(undefined);
    });

    it('with extensions', () => {
      const interfaceExtensions = Object.freeze({
        SomeInterfaceExt: 'interface',
      });
      const fieldExtensions = Object.freeze({ SomeFieldExt: 'field' });
      const argExtensions = Object.freeze({ SomeArgExt: 'arg' });

      const someInterface = new GraphQLInterfaceType({
        name: 'SomeInterface',
        fields: {
          someField: {
            type: dummyType,
            args: {
              someArg: {
                type: dummyType,
                extensions: argExtensions,
              },
            },
            extensions: fieldExtensions,
          },
        },
        extensions: interfaceExtensions,
      });

      expectObjMap(someInterface.extensions).to.deep.equal(interfaceExtensions);
      const someField = someInterface.getFields().someField;
      expectObjMap(someField.extensions).to.deep.equal(fieldExtensions);
      const someArg = someField.args[0];
      expectObjMap(someArg.extensions).to.deep.equal(argExtensions);

      const config = someInterface.toConfig();
      expectObjMap(config.extensions).to.deep.equal(interfaceExtensions);
      const someFieldConfig = config.fields.someField;
      expectObjMap(someFieldConfig.extensions).to.deep.equal(fieldExtensions);
      invariant(someFieldConfig.args);
      const someArgConfig = someFieldConfig.args.someArg;
      expectObjMap(someArgConfig.extensions).to.deep.equal(argExtensions);
    });
  });

  describe('GraphQLUnionType', () => {
    it('without extensions', () => {
      const someUnion = new GraphQLUnionType({
        name: 'SomeUnion',
        types: [],
      });

      expect(someUnion.extensions).to.equal(undefined);

      const config = someUnion.toConfig();
      expect(config.extensions).to.equal(undefined);
    });

    it('with extensions', () => {
      const unionExtensions = Object.freeze({ SomeUnionExt: 'union' });

      const someUnion = new GraphQLUnionType({
        name: 'SomeUnion',
        types: [],
        extensions: unionExtensions,
      });

      expectObjMap(someUnion.extensions).to.deep.equal(unionExtensions);

      const config = someUnion.toConfig();
      expectObjMap(config.extensions).to.deep.equal(unionExtensions);
    });
  });

  describe('GraphQLEnumType', () => {
    it('without extensions', () => {
      const someEnum = new GraphQLEnumType({
        name: 'SomeEnum',
        values: {
          SOME_VALUE: {},
        },
      });

      expect(someEnum.extensions).to.equal(undefined);
      const someValue = someEnum.getValues()[0];
      expect(someValue.extensions).to.equal(undefined);

      const config = someEnum.toConfig();
      expect(config.extensions).to.equal(undefined);
      const someValueConfig = config.values.SOME_VALUE;
      expect(someValueConfig.extensions).to.equal(undefined);
    });

    it('with extensions', () => {
      const enumExtensions = Object.freeze({ SomeEnumExt: 'enum' });
      const valueExtensions = Object.freeze({ SomeValueExt: 'value' });

      const someEnum = new GraphQLEnumType({
        name: 'SomeEnum',
        values: {
          SOME_VALUE: {
            extensions: valueExtensions,
          },
        },
        extensions: enumExtensions,
      });

      expectObjMap(someEnum.extensions).to.deep.equal(enumExtensions);
      const someValue = someEnum.getValues()[0];
      expectObjMap(someValue.extensions).to.deep.equal(valueExtensions);

      const config = someEnum.toConfig();
      expectObjMap(config.extensions).to.deep.equal(enumExtensions);
      const someValueConfig = config.values.SOME_VALUE;
      expectObjMap(someValueConfig.extensions).to.deep.equal(valueExtensions);
    });
  });

  describe('GraphQLInputObjectType', () => {
    it('without extensions', () => {
      const someInputObject = new GraphQLInputObjectType({
        name: 'SomeInputObject',
        fields: {
          someInputField: {
            type: dummyType,
          },
        },
      });

      expect(someInputObject.extensions).to.equal(undefined);
      const someInputField = someInputObject.getFields().someInputField;
      expect(someInputField.extensions).to.equal(undefined);

      const config = someInputObject.toConfig();
      expect(config.extensions).to.equal(undefined);
      const someInputFieldConfig = config.fields.someInputField;
      expect(someInputFieldConfig.extensions).to.equal(undefined);
    });

    it('with extensions', () => {
      const inputObjectExtensions = Object.freeze({
        SomeInputObjectExt: 'inputObject',
      });
      const inputFieldExtensions = Object.freeze({
        SomeInputFieldExt: 'inputField',
      });

      const someInputObject = new GraphQLInputObjectType({
        name: 'SomeInputObject',
        fields: {
          someInputField: {
            type: dummyType,
            extensions: inputFieldExtensions,
          },
        },
        extensions: inputObjectExtensions,
      });

      expectObjMap(someInputObject.extensions).to.deep.equal(
        inputObjectExtensions,
      );
      const someInputField = someInputObject.getFields().someInputField;
      expectObjMap(someInputField.extensions).to.deep.equal(
        inputFieldExtensions,
      );

      const config = someInputObject.toConfig();
      expectObjMap(config.extensions).to.deep.equal(inputObjectExtensions);
      const someInputFieldConfig = config.fields.someInputField;
      expectObjMap(someInputFieldConfig.extensions).to.deep.equal(
        inputFieldExtensions,
      );
    });
  });

  describe('GraphQLDirective', () => {
    it('without extensions', () => {
      const someDirective = new GraphQLDirective({
        name: 'SomeDirective',
        args: {
          someArg: {
            type: dummyType,
          },
        },
        locations: [],
      });

      expect(someDirective.extensions).to.equal(undefined);
      const someArg = someDirective.args[0];
      expect(someArg.extensions).to.equal(undefined);

      const config = someDirective.toConfig();
      expect(config.extensions).to.equal(undefined);
      const someArgConfig = config.args.someArg;
      expect(someArgConfig.extensions).to.equal(undefined);
    });

    it('with extensions', () => {
      const directiveExtensions = Object.freeze({
        SomeDirectiveExt: 'directive',
      });
      const argExtensions = Object.freeze({ SomeArgExt: 'arg' });

      const someDirective = new GraphQLDirective({
        name: 'SomeDirective',
        args: {
          someArg: {
            type: dummyType,
            extensions: argExtensions,
          },
        },
        locations: [],
        extensions: directiveExtensions,
      });

      expectObjMap(someDirective.extensions).to.deep.equal(directiveExtensions);
      const someArg = someDirective.args[0];
      expectObjMap(someArg.extensions).to.deep.equal(argExtensions);

      const config = someDirective.toConfig();
      expectObjMap(config.extensions).to.deep.equal(directiveExtensions);
      const someArgConfig = config.args.someArg;
      expectObjMap(someArgConfig.extensions).to.deep.equal(argExtensions);
    });
  });

  describe('GraphQLSchema', () => {
    it('without extensions', () => {
      const schema = new GraphQLSchema({});

      expect(schema.extensions).to.equal(undefined);

      const config = schema.toConfig();
      expect(config.extensions).to.equal(undefined);
    });

    it('with extensions', () => {
      const schemaExtensions = Object.freeze({
        schemaExtension: 'schema',
      });

      const schema = new GraphQLSchema({ extensions: schemaExtensions });

      expectObjMap(schema.extensions).to.deep.equal(schemaExtensions);

      const config = schema.toConfig();
      expectObjMap(config.extensions).to.deep.equal(schemaExtensions);
    });
  });
});
