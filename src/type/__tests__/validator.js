/**
 *  Copyright (c) 2015, Facebook, Inc.
 *  All rights reserved.
 *
 *  This source code is licensed under the BSD-style license found in the
 *  LICENSE file in the root directory of this source tree. An additional grant
 *  of patent rights can be found in the PATENTS file in the same directory.
 */

import { __Schema } from '../introspection';

import { GraphQLSchema } from '../schema';

import {
  GraphQLInputObjectType,
  GraphQLInterfaceType,
  GraphQLList,
  GraphQLNonNull,
  GraphQLObjectType,
  GraphQLUnionType
} from '../definition';

import { GraphQLFloat } from '../scalars';

import { validateSchema } from '../validator';

import InterfacePossibleTypesMustImplementTheInterface
  from '../rules/InterfacePossibleTypesMustImplementTheInterface';
import NoInputTypesAsOutputFields from '../rules/NoInputTypesAsOutputFields';
import NoOutputTypesAsInputArgs from '../rules/NoOutputTypesAsInputArgs';
import TypesInterfacesMustShowThemAsPossible
  from '../rules/TypesInterfacesMustShowThemAsPossible';

import { describe, it } from 'mocha';
import { expect } from 'chai';

var SomeInputType = new GraphQLInputObjectType({
  name: 'SomeInputType',
  fields: {
    val: { type: GraphQLFloat, defaultValue: 42 }
  }
});

describe('Type System Validator', () => {
  it('passes on the introspection schema', () => {
    var validationErrors = validateSchema(new GraphQLSchema({
      query: __Schema
    }));
    expect(validationErrors).to.have.length(0);
  });
});

function expectToAcceptSchemaWithNormalInputArg(rule) {
  let SomeOutputType = new GraphQLObjectType({
    name: 'SomeOutputType',
    fields: {
      fieldWithArg: {
        args: { someArg: { type: SomeInputType } },
        type: GraphQLFloat
      }
    }
  });
  var schema = new GraphQLSchema({ query: SomeOutputType });
  var validationErrors = validateSchema(schema, [ rule ]);
  expect(validationErrors).to.have.length(0);
}

describe('Rule: NoInputTypesAsOutputFields', () => {
  function expectedError(operationType) {
    return `Schema ${operationType} type SomeInputType must be an object type!`;
  }

  function checkValidationResult(validationErrors, operationType) {
    expect(validationErrors).to.have.length(1);
    expect(validationErrors[0].message).to.equal(
      expectedError(operationType)
    );
  }

  it('rejects a schema whose query or mutation type is an input type', () => {
    let schema = new GraphQLSchema({ query: SomeInputType });
    let validationErrors = validateSchema(
      schema,
      [ NoInputTypesAsOutputFields ]
    );
    checkValidationResult(validationErrors, 'query');

    schema = new GraphQLSchema({ mutation: SomeInputType });
    validationErrors = validateSchema(schema, [ NoInputTypesAsOutputFields ]);
    checkValidationResult(validationErrors, 'mutation');
  });

  it('rejects a schema that uses an input type as a field', () => {
    [ GraphQLObjectType, GraphQLInterfaceType ].forEach((kind) => {
      var SomeOutputType = new kind({
        name: 'SomeOutputType',
        fields: {
          sneaky: { type: SomeInputType }
        }
      });

      var schema = new GraphQLSchema({ query: SomeOutputType });
      var validationErrors = validateSchema(
        schema,
        [ NoInputTypesAsOutputFields ]
      );
      expect(validationErrors).to.have.length(1);
      expect(validationErrors[0].message).to.equal(
        'Field SomeOutputType.sneaky is of type SomeInputType, which is an ' +
          'input type, but field types must be output types!'
      );
    });
  });

  it('accepts a schema that simply has an input type as a field arg', () => {
    expectToAcceptSchemaWithNormalInputArg(NoInputTypesAsOutputFields);
  });
});



describe('Rule: NoOutputTypesAsInputArgs', () => {

  function schemaWithFieldArgOfType(argType) {
    var SomeIncorrectInputType = new GraphQLInputObjectType({
      name: 'SomeIncorrectInputType',
      fields: {
        val: { type: argType }
      }
    });
    var QueryType = new GraphQLObjectType({
      name: 'QueryType',
      fields: {
        f2: {
          type: GraphQLFloat,
          args: { arg: { type: SomeIncorrectInputType } }
        }
      }
    });

    return new GraphQLSchema({ query: QueryType });
  }

  function expectRejectionBecauseFieldIsNotInputType(
    validationErrors,
    fieldTypeName
  ) {
    expect(validationErrors).to.have.length(1);
    expect(validationErrors[0].message).to.equal(
      `Input field SomeIncorrectInputType.val has type ${fieldTypeName}, ` +
      'which is not an input type!'
    );
  }

  function testAcceptingFieldArgOfType(fieldArgType) {
    var schema = schemaWithFieldArgOfType(fieldArgType);
    var validationErrors = validateSchema(schema, [ NoOutputTypesAsInputArgs ]);
    expect(validationErrors).to.have.length(0);
  }

  function testRejectingFieldArgOfType(fieldArgType) {
    var schema = schemaWithFieldArgOfType(fieldArgType);
    var validationErrors = validateSchema(schema, [ NoOutputTypesAsInputArgs ]);
    expectRejectionBecauseFieldIsNotInputType(
      validationErrors,
      fieldArgType
    );
  }

  it('accepts a schema that simply has an input type as a field arg', () => {
    expectToAcceptSchemaWithNormalInputArg(NoOutputTypesAsInputArgs);
  });

  it('rejects a schema with an object type as an input field arg', () => {
    var SomeOutputType = new GraphQLObjectType({
      name: 'SomeOutputType',
      fields: { f: { type: GraphQLFloat } }
    });
    testRejectingFieldArgOfType(SomeOutputType);
  });

  it('rejects a schema with a union type as an input field arg', () => {
    var UnionType = new GraphQLUnionType({
      name: 'UnionType',
      types: [
        new GraphQLObjectType({
          name: 'SomeOutputType',
          fields: { f: { type: GraphQLFloat } }
        })
      ]
    });
    testRejectingFieldArgOfType(UnionType);
  });

  it('rejects a schema with an interface type as an input field arg', () => {
    var InterfaceType = new GraphQLInterfaceType({
      name: 'InterfaceType',
      fields: []
    });
    testRejectingFieldArgOfType(InterfaceType);
  });

  it('rejects a schema with a list of objects as an input field arg', () => {
    var ListOfObjects = new GraphQLList(new GraphQLObjectType({
      name: 'SomeOutputType',
      fields: { f: { type: GraphQLFloat } }
    }));
    testRejectingFieldArgOfType(ListOfObjects);
  });

  it('rejects a schema with a nonnull object as an input field arg', () => {
    var NonNullObject = new GraphQLNonNull(new GraphQLObjectType({
      name: 'SomeOutputType',
      fields: { f: { type: GraphQLFloat } }
    }));
    testRejectingFieldArgOfType(NonNullObject);
  });

  it('accepts a schema with a list of input type as an input field arg', () => {
    testAcceptingFieldArgOfType(new GraphQLList(new GraphQLInputObjectType({
      name: 'SomeInputType'
    })));
  });

  it('accepts a schema with a nonnull input type as an input field arg', () => {
    testAcceptingFieldArgOfType(new GraphQLNonNull(new GraphQLInputObjectType({
      name: 'SomeInputType'
    })));
  });
});


function testAcceptingAnInterfaceWithANormalSubtype(rule) {
  var InterfaceType = new GraphQLInterfaceType({
    name: 'InterfaceType',
    fields: {}
  });
  var SubType = new GraphQLObjectType({
    name: 'SubType',
    fields: {},
    interfaces: [ InterfaceType ]
  });

  var schema = new GraphQLSchema({
    query: InterfaceType,
    mutation: SubType
  });
  var validationErrors = validateSchema(
    schema,
    [ rule ]
  );
  expect(validationErrors).to.have.length(0);
}

describe('Rule: InterfacePossibleTypesMustImplementTheInterface', () => {
  it('accepts an interface with a subtype declared using our infra', () => {
    testAcceptingAnInterfaceWithANormalSubtype(
      InterfacePossibleTypesMustImplementTheInterface
    );
  });

  it('rejects when a possible type does not implement the interface', () => {
    var InterfaceType = new GraphQLInterfaceType({
      name: 'InterfaceType',
      fields: {}
    });
    var SubType = new GraphQLObjectType({
      name: 'SubType',
      fields: {},
      interfaces: []
    });

    InterfaceType._implementations.push(SubType);
    // Sanity check.
    expect(InterfaceType.getPossibleTypes().length).to.equal(1);
    expect(InterfaceType.getPossibleTypes()[0]).to.equal(SubType);

    var schema = new GraphQLSchema({ query: InterfaceType });
    var validationErrors = validateSchema(
      schema,
      [ InterfacePossibleTypesMustImplementTheInterface ]
    );
    expect(validationErrors).to.have.length(1);
    expect(validationErrors[0].message).to.equal(
      'SubType is a possible type of interface InterfaceType but does not ' +
      'implement it!'
    );
  });
});


describe('Rule: TypesInterfacesMustShowThemAsPossible', () => {
  it('accepts an interface with a subtype declared using our infra', () => {
    testAcceptingAnInterfaceWithANormalSubtype(
      TypesInterfacesMustShowThemAsPossible
    );
  });

  it('rejects when an implementation is not a possible type', () => {
    var InterfaceType = new GraphQLInterfaceType({
      name: 'InterfaceType',
      fields: {}
    });
    var SubType = new GraphQLObjectType({
      name: 'SubType',
      fields: {},
      interfaces: []
    });

    SubType._typeConfig.interfaces.push(InterfaceType);
    // Sanity check the test.
    expect(SubType.getInterfaces()).to.eql([ InterfaceType ]);
    expect(InterfaceType.isPossibleType(SubType)).to.equal(false);

    var schema = new GraphQLSchema({
      query: InterfaceType,
      // Need to make sure SubType is in the schema! We rely on
      // possibleTypes to be able to see it unless it's explicitly used.
      mutation: SubType
    });
    // Another sanity check.
    expect(schema.getTypeMap().SubType).to.equal(SubType);

    var validationErrors = validateSchema(
      schema,
      [ TypesInterfacesMustShowThemAsPossible ]
    );
    expect(validationErrors).to.have.length(1);
    expect(validationErrors[0].message).to.equal(
      'SubType implements interface InterfaceType, but InterfaceType does ' +
      'not list it as possible!'
    );
  });
});
