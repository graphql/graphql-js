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

function typeOf(object) {
  return /(\b\w+\b)\]/.exec(Object.prototype.toString.call(object))[1];
}

describe('Check to see if Symbol.toStringTag is defined on types', () => {
  const s = Symbol.toStringTag;
  const hasSymbol = o => Object.getOwnPropertySymbols(o).includes(s);

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
  // variables _interface and _enum have preceding underscores due to being
  // reserved keywords in JavaScript

  const schema = Object.create(GraphQLSchema.prototype);
  const scalar = Object.create(GraphQLScalarType.prototype);
  const object = Object.create(GraphQLObjectType.prototype);
  const _interface = Object.create(GraphQLInterfaceType.prototype);
  const union = Object.create(GraphQLUnionType.prototype);
  const _enum = Object.create(GraphQLEnumType.prototype);
  const inputType = Object.create(GraphQLInputObjectType.prototype);
  const directive = Object.create(GraphQLDirective.prototype);
  const source = Object.create(Source.prototype);

  it('should return the class name for GraphQLSchema instance', () => {
    expect(typeOf(schema)).to.equal(GraphQLSchema.name);
  });

  it('should return the class name for GraphQLScalarType instance', () => {
    expect(typeOf(scalar)).to.equal(GraphQLScalarType.name);
  });

  it('should return the class name for GraphQLObjectType instance', () => {
    expect(typeOf(object)).to.equal(GraphQLObjectType.name);
  });

  it('should return the class name for GraphQLInterfaceType instance', () => {
    expect(typeOf(_interface)).to.equal(GraphQLInterfaceType.name);
  });

  it('should return the class name for GraphQLUnionType instance', () => {
    expect(typeOf(union)).to.equal(GraphQLUnionType.name);
  });

  it('should return the class name for GraphQLEnumType instance', () => {
    expect(typeOf(_enum)).to.equal(GraphQLEnumType.name);
  });

  it('should return the class name for GraphQLInputObjectType instance', () => {
    expect(typeOf(inputType)).to.equal(GraphQLInputObjectType.name);
  });

  it('should return the class name for GraphQLDirective instance', () => {
    expect(typeOf(directive)).to.equal(GraphQLDirective.name);
  });

  it('should return the class name for Source instance', () => {
    expect(typeOf(source)).to.equal(Source.name);
  });
});
