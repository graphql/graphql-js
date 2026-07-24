import { describe, it } from 'node:test';

import { expect } from 'chai';

import {
  GraphQLList,
  GraphQLNonNull,
  GraphQLObjectType,
} from '../../../../type/definition.ts';
import { GraphQLInt, GraphQLString } from '../../../../type/scalars.ts';

import { doTypesConflict } from '../doTypesConflict.ts';

describe('doTypesConflict', () => {
  it('accepts the same leaf type', () => {
    expect(doTypesConflict(GraphQLString, GraphQLString)).to.equal(false);
  });

  it('rejects different leaf types', () => {
    expect(doTypesConflict(GraphQLString, GraphQLInt)).to.equal(true);
  });

  it('accepts matching list shapes', () => {
    expect(
      doTypesConflict(
        new GraphQLList(GraphQLString),
        new GraphQLList(GraphQLString),
      ),
    ).to.equal(false);
  });

  it('rejects different list item types', () => {
    expect(
      doTypesConflict(
        new GraphQLList(GraphQLString),
        new GraphQLList(GraphQLInt),
      ),
    ).to.equal(true);
  });

  it('rejects a list and non-list in either order', () => {
    expect(
      doTypesConflict(new GraphQLList(GraphQLString), GraphQLString),
    ).to.equal(true);
    expect(
      doTypesConflict(GraphQLString, new GraphQLList(GraphQLString)),
    ).to.equal(true);
  });

  it('accepts matching non-null shapes', () => {
    expect(
      doTypesConflict(
        new GraphQLNonNull(GraphQLString),
        new GraphQLNonNull(GraphQLString),
      ),
    ).to.equal(false);
  });

  it('rejects different non-null inner types', () => {
    expect(
      doTypesConflict(
        new GraphQLNonNull(GraphQLString),
        new GraphQLNonNull(GraphQLInt),
      ),
    ).to.equal(true);
  });

  it('rejects nullable and non-null types in either order', () => {
    expect(
      doTypesConflict(new GraphQLNonNull(GraphQLString), GraphQLString),
    ).to.equal(true);
    expect(
      doTypesConflict(GraphQLString, new GraphQLNonNull(GraphQLString)),
    ).to.equal(true);
  });

  it('accepts distinct composite types', () => {
    const object1 = new GraphQLObjectType({
      name: 'Object1',
      fields: { value: { type: GraphQLString } },
    });
    const object2 = new GraphQLObjectType({
      name: 'Object2',
      fields: { value: { type: GraphQLInt } },
    });

    expect(doTypesConflict(object1, object2)).to.equal(false);
  });
});
