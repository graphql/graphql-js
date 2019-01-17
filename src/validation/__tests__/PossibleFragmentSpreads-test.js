/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow strict
 */

import { describe, it } from 'mocha';
import { expectValidationErrors } from './harness';
import {
  PossibleFragmentSpreads,
  typeIncompatibleSpreadMessage,
  typeIncompatibleAnonSpreadMessage,
} from '../rules/PossibleFragmentSpreads';

function expectErrors(queryStr) {
  return expectValidationErrors(PossibleFragmentSpreads, queryStr);
}

function expectValid(queryStr) {
  expectErrors(queryStr).to.deep.equal([]);
}

function error(fragName, parentType, fragType, line, column) {
  return {
    message: typeIncompatibleSpreadMessage(fragName, parentType, fragType),
    locations: [{ line, column }],
  };
}

function errorAnon(parentType, fragType, line, column) {
  return {
    message: typeIncompatibleAnonSpreadMessage(parentType, fragType),
    locations: [{ line, column }],
  };
}

describe('Validate: Possible fragment spreads', () => {
  it('of the same object', () => {
    expectValid(`
      fragment objectWithinObject on Dog { ...dogFragment }
      fragment dogFragment on Dog { barkVolume }
    `);
  });

  it('of the same object with inline fragment', () => {
    expectValid(`
      fragment objectWithinObjectAnon on Dog { ... on Dog { barkVolume } }
    `);
  });

  it('object into an implemented interface', () => {
    expectValid(`
      fragment objectWithinInterface on Pet { ...dogFragment }
      fragment dogFragment on Dog { barkVolume }
    `);
  });

  it('object into containing union', () => {
    expectValid(`
      fragment objectWithinUnion on CatOrDog { ...dogFragment }
      fragment dogFragment on Dog { barkVolume }
    `);
  });

  it('union into contained object', () => {
    expectValid(`
      fragment unionWithinObject on Dog { ...catOrDogFragment }
      fragment catOrDogFragment on CatOrDog { __typename }
    `);
  });

  it('union into overlapping interface', () => {
    expectValid(`
      fragment unionWithinInterface on Pet { ...catOrDogFragment }
      fragment catOrDogFragment on CatOrDog { __typename }
    `);
  });

  it('union into overlapping union', () => {
    expectValid(`
      fragment unionWithinUnion on DogOrHuman { ...catOrDogFragment }
      fragment catOrDogFragment on CatOrDog { __typename }
    `);
  });

  it('interface into implemented object', () => {
    expectValid(`
      fragment interfaceWithinObject on Dog { ...petFragment }
      fragment petFragment on Pet { name }
    `);
  });

  it('interface into overlapping interface', () => {
    expectValid(`
      fragment interfaceWithinInterface on Pet { ...beingFragment }
      fragment beingFragment on Being { name }
    `);
  });

  it('interface into overlapping interface in inline fragment', () => {
    expectValid(`
      fragment interfaceWithinInterface on Pet { ... on Being { name } }
    `);
  });

  it('interface into overlapping union', () => {
    expectValid(`
      fragment interfaceWithinUnion on CatOrDog { ...petFragment }
      fragment petFragment on Pet { name }
    `);
  });

  it('ignores incorrect type (caught by FragmentsOnCompositeTypes)', () => {
    expectValid(`
      fragment petFragment on Pet { ...badInADifferentWay }
      fragment badInADifferentWay on String { name }
    `);
  });

  it('different object into object', () => {
    expectErrors(`
      fragment invalidObjectWithinObject on Cat { ...dogFragment }
      fragment dogFragment on Dog { barkVolume }
    `).to.deep.equal([error('dogFragment', 'Cat', 'Dog', 2, 51)]);
  });

  it('different object into object in inline fragment', () => {
    expectErrors(`
      fragment invalidObjectWithinObjectAnon on Cat {
        ... on Dog { barkVolume }
      }
    `).to.deep.equal([errorAnon('Cat', 'Dog', 3, 9)]);
  });

  it('object into not implementing interface', () => {
    expectErrors(`
      fragment invalidObjectWithinInterface on Pet { ...humanFragment }
      fragment humanFragment on Human { pets { name } }
    `).to.deep.equal([error('humanFragment', 'Pet', 'Human', 2, 54)]);
  });

  it('object into not containing union', () => {
    expectErrors(`
      fragment invalidObjectWithinUnion on CatOrDog { ...humanFragment }
      fragment humanFragment on Human { pets { name } }
    `).to.deep.equal([error('humanFragment', 'CatOrDog', 'Human', 2, 55)]);
  });

  it('union into not contained object', () => {
    expectErrors(`
      fragment invalidUnionWithinObject on Human { ...catOrDogFragment }
      fragment catOrDogFragment on CatOrDog { __typename }
    `).to.deep.equal([error('catOrDogFragment', 'Human', 'CatOrDog', 2, 52)]);
  });

  it('union into non overlapping interface', () => {
    expectErrors(`
      fragment invalidUnionWithinInterface on Pet { ...humanOrAlienFragment }
      fragment humanOrAlienFragment on HumanOrAlien { __typename }
    `).to.deep.equal([
      error('humanOrAlienFragment', 'Pet', 'HumanOrAlien', 2, 53),
    ]);
  });

  it('union into non overlapping union', () => {
    expectErrors(`
      fragment invalidUnionWithinUnion on CatOrDog { ...humanOrAlienFragment }
      fragment humanOrAlienFragment on HumanOrAlien { __typename }
    `).to.deep.equal([
      error('humanOrAlienFragment', 'CatOrDog', 'HumanOrAlien', 2, 54),
    ]);
  });

  it('interface into non implementing object', () => {
    expectErrors(`
      fragment invalidInterfaceWithinObject on Cat { ...intelligentFragment }
      fragment intelligentFragment on Intelligent { iq }
    `).to.deep.equal([
      error('intelligentFragment', 'Cat', 'Intelligent', 2, 54),
    ]);
  });

  it('interface into non overlapping interface', () => {
    expectErrors(`
      fragment invalidInterfaceWithinInterface on Pet {
        ...intelligentFragment
      }
      fragment intelligentFragment on Intelligent { iq }
    `).to.deep.equal([
      error('intelligentFragment', 'Pet', 'Intelligent', 3, 9),
    ]);
  });

  it('interface into non overlapping interface in inline fragment', () => {
    expectErrors(`
      fragment invalidInterfaceWithinInterfaceAnon on Pet {
        ...on Intelligent { iq }
      }
    `).to.deep.equal([errorAnon('Pet', 'Intelligent', 3, 9)]);
  });

  it('interface into non overlapping union', () => {
    expectErrors(`
      fragment invalidInterfaceWithinUnion on HumanOrAlien { ...petFragment }
      fragment petFragment on Pet { name }
    `).to.deep.equal([error('petFragment', 'HumanOrAlien', 'Pet', 2, 62)]);
  });
});
