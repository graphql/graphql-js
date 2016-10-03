/**
 *  Copyright (c) 2016, Facebook, Inc.
 *  All rights reserved.
 *
 *  This source code is licensed under the BSD-style license found in the
 *  LICENSE file in the root directory of this source tree. An additional grant
 *  of patent rights can be found in the PATENTS file in the same directory.
 */

import { expect } from 'chai';
import { describe, it } from 'mocha';
import {
  GraphQLBoolean,
  GraphQLEnumType,
  GraphQLInterfaceType,
  GraphQLObjectType,
  GraphQLSchema,
  GraphQLString,
  GraphQLUnionType,
} from '../../type';
import {
  findBreakingChanges,
  findBreakingFieldChanges,
  findRemovedTypes,
  findTypesRemovedFromUnions,
  findTypesThatChangedType,
  findValuesRemovedFromEnums,
} from '../schemaComparisons';

describe('CheckSchemaBackwardsCompatibility', () => {
  const queryType = new GraphQLObjectType({
    name: 'Query',
    fields: {
      field1: { type: GraphQLString },
    }
  });

  it('should detect if a type was removed or not', () => {
    const type1 = new GraphQLObjectType({
      name: 'Type1',
      fields: {
        field1: { type: GraphQLString },
      }
    });
    const type2 = new GraphQLObjectType({
      name: 'Type2',
      fields: {
        field1: { type: GraphQLString },
      }
    });

    const oldSchema = new GraphQLSchema({
      query: queryType,
      types: [
        type1,
        type2,
      ]
    });
    const newSchema = new GraphQLSchema({
      query: queryType,
      types: [
        type2,
      ]
    });
    expect(Array.from(findRemovedTypes(oldSchema, newSchema)))
      .to.eql([ 'Type1 was removed' ]);
    expect(Array.from(findRemovedTypes(oldSchema, oldSchema))).to.eql([]);
  });

  it('should detect if a type changed its type', () => {
    const objectType = new GraphQLObjectType({
      name: 'ObjectType',
      fields: {
        field1: { type: GraphQLString },
      }
    });

    const interfaceType1 = new GraphQLInterfaceType({
      name: 'Type1',
      fields: {
        field1: { type: GraphQLString },
      }
    });
    const unionType1 = new GraphQLUnionType({
      name: 'Type1',
      types: [ objectType ],
      resolveType: () => null,
    });

    const oldSchema = new GraphQLSchema({
      query: queryType,
      types: [
        interfaceType1,
      ]
    });
    const newSchema = new GraphQLSchema({
      query: queryType,
      types: [
        unionType1,
      ]
    });
    expect(Array.from(findTypesThatChangedType(oldSchema, newSchema))).to.eql(
      [ 'Type1 changed from a GraphQLInterfaceType to a GraphQLUnionType' ]
    );
  });

  it('should detect if a field on a type was deleted or changed type', () => {
    const TypeA = new GraphQLObjectType({
      name: 'TypeA',
      fields: {
        field1: { type: GraphQLString },
      }
    });
    // logically equivalent to TypeA; findBreakingFieldChanges shouldn't
    // treat this as differnt than TypeA
    const TypeA2 = new GraphQLObjectType({
      name: 'TypeA',
      fields: {
        field1: { type: GraphQLString },
      }
    });
    const TypeB = new GraphQLObjectType({
      name: 'TypeB',
      fields: {
        field1: { type: GraphQLString },
      }
    });

    const oldType1 = new GraphQLInterfaceType({
      name: 'Type1',
      fields: {
        field1: { type: TypeA },
        field2: { type: GraphQLString },
        field3: { type: GraphQLString },
        field4: { type: TypeA },
      }
    });
    const newType1 = new GraphQLInterfaceType({
      name: 'Type1',
      fields: {
        field1: { type: TypeA2 },
        field3: { type: GraphQLBoolean },
        field4: { type: TypeB },
        field5: { type: GraphQLString },
      }
    });

    const oldSchema = new GraphQLSchema({
      query: queryType,
      types: [
        oldType1,
      ]
    });
    const newSchema = new GraphQLSchema({
      query: queryType,
      types: [
        newType1,
      ]
    });

    const expectedFieldChanges = [
      'Type1.field2 was removed',
      'Type1.field3 changed type from String to Boolean',
      'Type1.field4 changed type from TypeA to TypeB',
    ];
    expect(Array.from(findBreakingFieldChanges(oldSchema, newSchema)))
      .to.eql(expectedFieldChanges);
  });

  it('should detect if a type was removed from a union type', () => {
    const type1 = new GraphQLObjectType({
      name: 'Type1',
      fields: {
        field1: { type: GraphQLString },
      }
    });
    // logially equivalent to type1; findTypesRemovedFromUnions should not
    // treat this as different than type1
    const type1a = new GraphQLObjectType({
      name: 'Type1',
      fields: {
        field1: { type: GraphQLString },
      }
    });
    const type2 = new GraphQLObjectType({
      name: 'Type2',
      fields: {
        field1: { type: GraphQLString },
      }
    });
    const type3 = new GraphQLObjectType({
      name: 'Type3',
      fields: {
        field1: { type: GraphQLString },
      }
    });

    const oldUnionType = new GraphQLUnionType({
      name: 'UnionType1',
      types: [ type1, type2 ],
      resolveType: () => null,
    });
    const newUnionType = new GraphQLUnionType({
      name: 'UnionType1',
      types: [ type1a, type3 ],
      resolveType: () => null,
    });

    const oldSchema = new GraphQLSchema({
      query: queryType,
      types: [
        oldUnionType,
      ]
    });
    const newSchema = new GraphQLSchema({
      query: queryType,
      types: [
        newUnionType,
      ]
    });

    expect(Array.from(findTypesRemovedFromUnions(oldSchema, newSchema)))
      .to.eql([ 'Type2 was removed from union type UnionType1' ]);
  });

  it('should detect if a value was removed from an enum type', () => {
    const oldEnumType = new GraphQLEnumType({
      name: 'EnumType1',
      values: {
        VALUE0: { value: 0 },
        VALUE1: { value: 1 },
        VALUE2: { value: 2 },
      }
    });
    const newEnumType = new GraphQLEnumType({
      name: 'EnumType1',
      values: {
        VALUE0: { value: 0 },
        VALUE2: { value: 2 },
        VALUE3: { value: 3 },
      }
    });

    const oldSchema = new GraphQLSchema({
      query: queryType,
      types: [
        oldEnumType,
      ]
    });
    const newSchema = new GraphQLSchema({
      query: queryType,
      types: [
        newEnumType,
      ]
    });

    expect(Array.from(findValuesRemovedFromEnums(oldSchema, newSchema)))
      .to.eql([ 'VALUE1 was removed from enum type EnumType1' ]);
  });

  it('should detect all breaking changes', () => {
    const typeThatGetsRemoved = new GraphQLObjectType({
      name: 'TypeThatGetsRemoved',
      fields: {
        field1: { type: GraphQLString },
      }
    });

    const typeThatChangesTypeOld = new GraphQLObjectType({
      name: 'TypeThatChangesType',
      fields: {
        field1: { type: GraphQLString },
      }
    });
    const typeThatChangesTypeNew = new GraphQLInterfaceType({
      name: 'TypeThatChangesType',
      fields: {
        field1: { type: GraphQLString },
      }
    });

    const typeThatHasBreakingFieldChangesOld = new GraphQLInterfaceType({
      name: 'TypeThatHasBreakingFieldChanges',
      fields: {
        field1: { type: GraphQLString },
        field2: { type: GraphQLString },
      }
    });
    const typeThatHasBreakingFieldChangesNew = new GraphQLInterfaceType({
      name: 'TypeThatHasBreakingFieldChanges',
      fields: {
        field2: { type: GraphQLBoolean },
      }
    });

    const typeInUnion1 = new GraphQLObjectType({
      name: 'TypeInUnion1',
      fields: {
        field1: { type: GraphQLString },
      }
    });
    const typeInUnion2 = new GraphQLObjectType({
      name: 'TypeInUnion2',
      fields: {
        field1: { type: GraphQLString },
      }
    });
    const unionTypeThatLosesATypeOld = new GraphQLUnionType({
      name: 'UnionTypeThatLosesAType',
      types: [ typeInUnion1, typeInUnion2 ],
      resolveType: () => null,
    });
    const unionTypeThatLosesATypeNew = new GraphQLUnionType({
      name: 'UnionTypeThatLosesAType',
      types: [ typeInUnion1 ],
      resolveType: () => null,
    });

    const enumTypeThatLosesAValueOld = new GraphQLEnumType({
      name: 'EnumTypeThatLosesAValue',
      values: {
        VALUE0: { value: 0 },
        VALUE1: { value: 1 },
        VALUE2: { value: 2 },
      }
    });
    const enumTypeThatLosesAValueNew = new GraphQLEnumType({
      name: 'EnumTypeThatLosesAValue',
      values: {
        VALUE1: { value: 1 },
        VALUE2: { value: 2 },
      }
    });

    const oldSchema = new GraphQLSchema({
      query: queryType,
      types: [
        typeThatGetsRemoved,
        typeThatChangesTypeOld,
        typeThatHasBreakingFieldChangesOld,
        unionTypeThatLosesATypeOld,
        enumTypeThatLosesAValueOld,
      ]
    });
    const newSchema = new GraphQLSchema({
      query: queryType,
      types: [
        typeThatChangesTypeNew,
        typeThatHasBreakingFieldChangesNew,
        unionTypeThatLosesATypeNew,
        enumTypeThatLosesAValueNew,
      ]
    });

    const expectedBreakingChanges = [
      'TypeThatGetsRemoved was removed',
      'TypeInUnion2 was removed',
      'TypeThatChangesType changed from a GraphQLObjectType ' +
        'to a GraphQLInterfaceType',
      'TypeThatHasBreakingFieldChanges.field1 was removed',
      'TypeThatHasBreakingFieldChanges.field2 changed type ' +
        'from String to Boolean',
      'TypeInUnion2 was removed from union type UnionTypeThatLosesAType',
      'VALUE0 was removed from enum type EnumTypeThatLosesAValue',
    ];

    expect(Array.from(findBreakingChanges(oldSchema, newSchema)))
      .to.eql(expectedBreakingChanges);
  });
});
