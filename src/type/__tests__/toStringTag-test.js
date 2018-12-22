/**
 * Copyright (c) 2018-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow strict
 */

import { describe, it } from 'mocha';
import { expect } from 'chai';
import {
  GraphQLDirective,
  GraphQLEnumType,
  GraphQLInputObjectType,
  GraphQLInterfaceType,
  GraphQLObjectType,
  GraphQLScalarType,
  GraphQLSchema,
  GraphQLUnionType,
  Source,
} from '../../';

describe('Check to see if Symbol.toStringTag is defined on types', () => {
  function hasSymbol(obj) {
    return Object.getOwnPropertySymbols(obj).includes(Symbol.toStringTag);
  }

  it('GraphQLDirective should have Symbol.toStringTag', () => {
    expect(hasSymbol(GraphQLDirective.prototype)).to.equal(true);
  });

  it('GraphQLEnumType should have Symbol.toStringTag', () => {
    expect(hasSymbol(GraphQLEnumType.prototype)).to.equal(true);
  });

  it('GraphQLInputObjectType should have Symbol.toStringTag', () => {
    expect(hasSymbol(GraphQLInputObjectType.prototype)).to.equal(true);
  });

  it('GraphQLInterfaceType should have Symbol.toStringTag', () => {
    expect(hasSymbol(GraphQLInterfaceType.prototype)).to.equal(true);
  });

  it('GraphQLObjectType should have Symbol.toStringTag', () => {
    expect(hasSymbol(GraphQLObjectType.prototype)).to.equal(true);
  });

  it('GraphQLScalarType should have Symbol.toStringTag', () => {
    expect(hasSymbol(GraphQLScalarType.prototype)).to.equal(true);
  });

  it('GraphQLSchema should have Symbol.toStringTag', () => {
    expect(hasSymbol(GraphQLSchema.prototype)).to.equal(true);
  });

  it('GraphQLUnionType should have Symbol.toStringTag', () => {
    expect(hasSymbol(GraphQLUnionType.prototype)).to.equal(true);
  });

  it('Source should have Symbol.toStringTag', () => {
    expect(hasSymbol(Source.prototype)).to.equal(true);
  });
});

describe('Check to see if Symbol.toStringTag tests on instances', () => {
  function typeOf(object) {
    return Object.prototype.toString
      .call(object)
      .replace(/^\[object /, '')
      .replace(/]$/, '');
  }

  it('should return the class name for GraphQLSchema instance', () => {
    const obj = Object.create(GraphQLSchema.prototype);
    expect(typeOf(obj)).to.equal(GraphQLSchema.name);
  });

  it('should return the class name for GraphQLScalarType instance', () => {
    const obj = Object.create(GraphQLScalarType.prototype);
    expect(typeOf(obj)).to.equal(GraphQLScalarType.name);
  });

  it('should return the class name for GraphQLObjectType instance', () => {
    const obj = Object.create(GraphQLObjectType.prototype);
    expect(typeOf(obj)).to.equal(GraphQLObjectType.name);
  });

  it('should return the class name for GraphQLInterfaceType instance', () => {
    const obj = Object.create(GraphQLInterfaceType.prototype);
    expect(typeOf(obj)).to.equal(GraphQLInterfaceType.name);
  });

  it('should return the class name for GraphQLUnionType instance', () => {
    const obj = Object.create(GraphQLUnionType.prototype);
    expect(typeOf(obj)).to.equal(GraphQLUnionType.name);
  });

  it('should return the class name for GraphQLEnumType instance', () => {
    const obj = Object.create(GraphQLEnumType.prototype);
    expect(typeOf(obj)).to.equal(GraphQLEnumType.name);
  });

  it('should return the class name for GraphQLInputObjectType instance', () => {
    const obj = Object.create(GraphQLInputObjectType.prototype);
    expect(typeOf(obj)).to.equal(GraphQLInputObjectType.name);
  });

  it('should return the class name for GraphQLDirective instance', () => {
    const obj = Object.create(GraphQLDirective.prototype);
    expect(typeOf(obj)).to.equal(GraphQLDirective.name);
  });

  it('should return the class name for Source instance', () => {
    const obj = Object.create(Source.prototype);
    expect(typeOf(obj)).to.equal(Source.name);
  });
});
