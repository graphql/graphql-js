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
  GraphQLInt,
  GraphQLNonNull,
} from '../../type';
import {
  BreakingChangeType,
  DangerousChangeType,
  findBreakingChanges,
  findDangerousChanges,
  findFieldsThatChangedType,
  findRemovedTypes,
  findTypesRemovedFromUnions,
  findTypesThatChangedKind,
  findValuesRemovedFromEnums,
  findArgChanges,
} from '../findBreakingChanges';

describe('findBreakingChanges', () => {
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
    expect(findRemovedTypes(oldSchema, newSchema)).to.eql([
      {
        type: BreakingChangeType.TYPE_REMOVED,
        description: 'Type1 was removed.',
      }
    ]);
    expect(findRemovedTypes(oldSchema, oldSchema)).to.eql([]);
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
    expect(findTypesThatChangedKind(oldSchema, newSchema)).to.eql([
      {
        type: BreakingChangeType.TYPE_CHANGED_KIND,
        description: 'Type1 changed from an Interface type to a Union type.',
      }
    ]);
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
      {
        type: BreakingChangeType.FIELD_REMOVED,
        description: 'Type1.field2 was removed.',
      },
      {
        type: BreakingChangeType.FIELD_CHANGED_KIND,
        description: 'Type1.field3 changed type from String to Boolean.',
      },
      {
        type: BreakingChangeType.FIELD_CHANGED_KIND,
        description: 'Type1.field4 changed type from TypeA to TypeB.',
      },
    ];
    expect(findFieldsThatChangedType(oldSchema, newSchema)).to.eql(
      expectedFieldChanges
    );
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

    expect(findTypesRemovedFromUnions(oldSchema, newSchema)).to.eql([
      {
        type: BreakingChangeType.TYPE_REMOVED_FROM_UNION,
        description: 'Type2 was removed from union type UnionType1.',
      },
    ]);
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

    expect(findValuesRemovedFromEnums(oldSchema, newSchema)).to.eql([
      {
        type: BreakingChangeType.VALUE_REMOVED_FROM_ENUM,
        description: 'VALUE1 was removed from enum type EnumType1.',
      },
    ]);
  });

  it('should detect if a type argument was removed', () => {
    const oldType = new GraphQLObjectType({
      name: 'Type1',
      fields: {
        field1: {
          type: GraphQLString,
          args: {
            name: {
              type: GraphQLString,
            },
          },
        },
      },
    });

    const newType = new GraphQLObjectType({
      name: 'Type1',
      fields: {
        field1: {
          type: GraphQLString,
          args: {},
        },
      },
    });

    const oldSchema = new GraphQLSchema({
      query: queryType,
      types: [
        oldType,
      ]
    });

    const newSchema = new GraphQLSchema({
      query: queryType,
      types: [
        newType,
      ]
    });

    expect(
      findArgChanges(oldSchema, newSchema).breakingChanges
    ).to.eql([
      {
        type: BreakingChangeType.ARG_REMOVED,
        description: 'Type1.field1 arg name was removed',
      }
    ]);
  });

  it('should detect if a type argument has changed', () => {
    const oldType = new GraphQLObjectType({
      name: 'Type1',
      fields: {
        field1: {
          type: GraphQLString,
          args: {
            name: {
              type: GraphQLString,
            },
          },
        },
      },
    });

    const newType = new GraphQLObjectType({
      name: 'Type1',
      fields: {
        field1: {
          type: GraphQLString,
          args: {
            name: {
              type: GraphQLInt,
            },
          },
        },
      },
    });

    const oldSchema = new GraphQLSchema({
      query: queryType,
      types: [
        oldType,
      ]
    });

    const newSchema = new GraphQLSchema({
      query: queryType,
      types: [
        newType,
      ]
    });

    expect(
      findArgChanges(oldSchema, newSchema).breakingChanges
    ).to.eql([
      {
        type: BreakingChangeType.ARG_CHANGED_KIND,
        description: 'Type1.field1 arg name has changed type ' +
          'from String to Int',
      }
    ]);
  });

  it('should consider args that move away from NonNull as non-breaking', () => {
    const oldType = new GraphQLObjectType({
      name: 'Type1',
      fields: {
        field1: {
          type: GraphQLString,
          args: {
            name: {
              type: new GraphQLNonNull(GraphQLString),
            },
          },
        },
      },
    });

    const newType = new GraphQLObjectType({
      name: 'Type1',
      fields: {
        field1: {
          type: GraphQLString,
          args: {
            name: {
              type: GraphQLString,
            },
          },
        },
      },
    });

    const oldSchema = new GraphQLSchema({
      query: queryType,
      types: [
        oldType,
      ]
    });

    const newSchema = new GraphQLSchema({
      query: queryType,
      types: [
        newType,
      ]
    });

    expect(
      findArgChanges(oldSchema, newSchema).breakingChanges
    ).to.eql([]);
  });

  it('should detect all breaking changes', () => {
    const typeThatGetsRemoved = new GraphQLObjectType({
      name: 'TypeThatGetsRemoved',
      fields: {
        field1: { type: GraphQLString },
      }
    });

    const argThatChanges = new GraphQLObjectType({
      name: 'ArgThatChanges',
      fields: {
        field1: {
          type: GraphQLString,
          args: {
            id: { type: GraphQLInt },
          },
        },
      },
    });

    const argChanged = new GraphQLObjectType({
      name: 'ArgThatChanges',
      fields: {
        field1: {
          type: GraphQLString,
          args: {
            id: { type: GraphQLString },
          },
        },
      },
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
        argThatChanges
      ]
    });

    const newSchema = new GraphQLSchema({
      query: queryType,
      types: [
        typeThatChangesTypeNew,
        typeThatHasBreakingFieldChangesNew,
        unionTypeThatLosesATypeNew,
        enumTypeThatLosesAValueNew,
        argChanged,
      ]
    });

    const expectedBreakingChanges = [
      {
        type: BreakingChangeType.TYPE_REMOVED,
        description: 'TypeThatGetsRemoved was removed.',
      },
      {
        type: BreakingChangeType.TYPE_REMOVED,
        description: 'TypeInUnion2 was removed.',
      },
      {
        description: 'Int was removed.',
        type: BreakingChangeType.TYPE_REMOVED,
      },
      {
        type: BreakingChangeType.TYPE_CHANGED_KIND,
        description: 'TypeThatChangesType changed from an Object type to an ' +
          'Interface type.',
      },
      {
        type: BreakingChangeType.FIELD_REMOVED,
        description: 'TypeThatHasBreakingFieldChanges.field1 was removed.',
      },
      {
        type: BreakingChangeType.FIELD_CHANGED_KIND,
        description: 'TypeThatHasBreakingFieldChanges.field2 changed type ' +
          'from String to Boolean.',
      },
      {
        type: BreakingChangeType.TYPE_REMOVED_FROM_UNION,
        description: 'TypeInUnion2 was removed from union type ' +
          'UnionTypeThatLosesAType.',
      },
      {
        type: BreakingChangeType.VALUE_REMOVED_FROM_ENUM,
        description: 'VALUE0 was removed from enum type ' +
          'EnumTypeThatLosesAValue.',
      },
      {
        type: BreakingChangeType.ARG_CHANGED_KIND,
        description: 'ArgThatChanges.field1 arg id has changed ' +
          'type from Int to String',
      },
    ];
    expect(findBreakingChanges(oldSchema, newSchema)).to.eql(
      expectedBreakingChanges
    );
  });
});

describe('findDangerousChanges', () => {
  const queryType = new GraphQLObjectType({
    name: 'Query',
    fields: {
      field1: { type: GraphQLString },
    }
  });

  describe('findArgChanges', () => {
    it('should detect if an argument\'s defaultValue has changed', () => {
      const oldType = new GraphQLObjectType({
        name: 'Type1',
        fields: {
          field1: {
            type: GraphQLString,
            args: {
              name: {
                type: GraphQLString,
                defaultValue: 'test',
              },
            },
          },
        },
      });

      const newType = new GraphQLObjectType({
        name: 'Type1',
        fields: {
          field1: {
            type: GraphQLString,
            args: {
              name: {
                type: GraphQLString,
                defaultValue: 'Test',
              },
            },
          },
        },
      });

      const oldSchema = new GraphQLSchema({
        query: queryType,
        types: [
          oldType,
        ]
      });

      const newSchema = new GraphQLSchema({
        query: queryType,
        types: [
          newType,
        ]
      });

      expect(
        findArgChanges(oldSchema, newSchema).dangerousChanges
      ).to.eql([
        {
          type: DangerousChangeType.ARG_DEFAULT_VALUE_CHANGE,
          description: 'Type1.field1 arg name has changed defaultValue',
        }
      ]);
    });
  });

  it('should find all dangerous changes', () => {
    const oldType = new GraphQLObjectType({
      name: 'Type1',
      fields: {
        field1: {
          type: GraphQLString,
          args: {
            name: {
              type: GraphQLString,
              defaultValue: 'test',
            },
          },
        },
      },
    });

    const newType = new GraphQLObjectType({
      name: 'Type1',
      fields: {
        field1: {
          type: GraphQLString,
          args: {
            name: {
              type: GraphQLString,
              defaultValue: 'Test',
            },
          },
        },
      },
    });

    const oldSchema = new GraphQLSchema({
      query: queryType,
      types: [
        oldType,
      ]
    });

    const newSchema = new GraphQLSchema({
      query: queryType,
      types: [
        newType,
      ]
    });

    const expectedDangerousChanges = [
      {
        description: 'Type1.field1 arg name has changed defaultValue',
        type: 'ARG_DEFAULT_VALUE_CHANGE'
      }
    ];

    expect(findDangerousChanges(oldSchema, newSchema)).to.eql(
      expectedDangerousChanges
    );
  });
});
