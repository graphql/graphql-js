/**
 *  Copyright (c) 2015, Facebook, Inc.
 *  All rights reserved.
 *
 *  This source code is licensed under the BSD-style license found in the
 *  LICENSE file in the root directory of this source tree. An additional grant
 *  of patent rights can be found in the PATENTS file in the same directory.
 */

import { describe, it } from 'mocha';
import { expectPassesRule, expectFailsRule } from './harness';
import {
  PossibleFragmentSpreads,
  typeIncompatibleSpreadMessage,
  typeIncompatibleAnonSpreadMessage,
} from '../rules/PossibleFragmentSpreads';


function error(fragName, parentType, fragType, line, column) {
  return {
    message: typeIncompatibleSpreadMessage(fragName, parentType, fragType),
    locations: [ { line, column } ],
  };
}

function errorAnon(parentType, fragType, line, column) {
  return {
    message: typeIncompatibleAnonSpreadMessage(parentType, fragType),
    locations: [ { line, column } ],
  };
}

describe('Validate: Possible fragment spreads', () => {

  it('of the same object', () => {
    expectPassesRule(PossibleFragmentSpreads, `
      fragment objectWithinObject on Dog { ...dogFragment }
      fragment dogFragment on Dog { barkVolume }
    `);
  });

  it('of the same object with inline fragment', () => {
    expectPassesRule(PossibleFragmentSpreads, `
      fragment objectWithinObjectAnon on Dog { ... on Dog { barkVolume } }
    `);
  });

  it('object into an implemented interface', () => {
    expectPassesRule(PossibleFragmentSpreads, `
      fragment objectWithinInterface on Pet { ...dogFragment }
      fragment dogFragment on Dog { barkVolume }
    `);
  });

  it('object into containing union', () => {
    expectPassesRule(PossibleFragmentSpreads, `
      fragment objectWithinUnion on CatOrDog { ...dogFragment }
      fragment dogFragment on Dog { barkVolume }
    `);
  });

  it('union into contained object', () => {
    expectPassesRule(PossibleFragmentSpreads, `
      fragment unionWithinObject on Dog { ...catOrDogFragment }
      fragment catOrDogFragment on CatOrDog { __typename }
    `);
  });

  it('union into overlapping interface', () => {
    expectPassesRule(PossibleFragmentSpreads, `
      fragment unionWithinInterface on Pet { ...catOrDogFragment }
      fragment catOrDogFragment on CatOrDog { __typename }
    `);
  });

  it('union into overlapping union', () => {
    expectPassesRule(PossibleFragmentSpreads, `
      fragment unionWithinUnion on DogOrHuman { ...catOrDogFragment }
      fragment catOrDogFragment on CatOrDog { __typename }
    `);
  });

  it('interface into implemented object', () => {
    expectPassesRule(PossibleFragmentSpreads, `
      fragment interfaceWithinObject on Dog { ...petFragment }
      fragment petFragment on Pet { name }
    `);
  });

  it('interface into overlapping interface', () => {
    expectPassesRule(PossibleFragmentSpreads, `
      fragment interfaceWithinInterface on Pet { ...beingFragment }
      fragment beingFragment on Being { name }
    `);
  });

  it('interface into overlapping interface in inline fragment', () => {
    expectPassesRule(PossibleFragmentSpreads, `
      fragment interfaceWithinInterface on Pet { ... on Being { name } }
    `);
  });

  it('interface into overlapping union', () => {
    expectPassesRule(PossibleFragmentSpreads, `
      fragment interfaceWithinUnion on CatOrDog { ...petFragment }
      fragment petFragment on Pet { name }
    `);
  });

  it('different object into object', () => {
    expectFailsRule(PossibleFragmentSpreads, `
      fragment invalidObjectWithinObject on Cat { ...dogFragment }
      fragment dogFragment on Dog { barkVolume }
    `, [ error('dogFragment', 'Cat', 'Dog', 2, 51) ]);
  });

  it('different object into object in inline fragment', () => {
    expectFailsRule(PossibleFragmentSpreads, `
      fragment invalidObjectWithinObjectAnon on Cat {
        ... on Dog { barkVolume }
      }
    `, [ errorAnon('Cat', 'Dog', 3, 9) ]);
  });

  it('object into not implementing interface', () => {
    expectFailsRule(PossibleFragmentSpreads, `
      fragment invalidObjectWithinInterface on Pet { ...humanFragment }
      fragment humanFragment on Human { pets { name } }
    `, [ error('humanFragment', 'Pet', 'Human', 2, 54) ]);
  });

  it('object into not containing union', () => {
    expectFailsRule(PossibleFragmentSpreads, `
      fragment invalidObjectWithinUnion on CatOrDog { ...humanFragment }
      fragment humanFragment on Human { pets { name } }
    `, [ error('humanFragment', 'CatOrDog', 'Human', 2, 55) ]);
  });

  it('union into not contained object', () => {
    expectFailsRule(PossibleFragmentSpreads, `
      fragment invalidUnionWithinObject on Human { ...catOrDogFragment }
      fragment catOrDogFragment on CatOrDog { __typename }
    `, [ error('catOrDogFragment', 'Human', 'CatOrDog', 2, 52) ]);
  });

  it('union into non overlapping interface', () => {
    expectFailsRule(PossibleFragmentSpreads, `
      fragment invalidUnionWithinInterface on Pet { ...humanOrAlienFragment }
      fragment humanOrAlienFragment on HumanOrAlien { __typename }
    `, [ error('humanOrAlienFragment', 'Pet', 'HumanOrAlien', 2, 53) ]);
  });

  it('union into non overlapping union', () => {
    expectFailsRule(PossibleFragmentSpreads, `
      fragment invalidUnionWithinUnion on CatOrDog { ...humanOrAlienFragment }
      fragment humanOrAlienFragment on HumanOrAlien { __typename }
    `, [ error('humanOrAlienFragment', 'CatOrDog', 'HumanOrAlien', 2, 54) ]);
  });

  it('interface into non implementing object', () => {
    expectFailsRule(PossibleFragmentSpreads, `
      fragment invalidInterfaceWithinObject on Cat { ...intelligentFragment }
      fragment intelligentFragment on Intelligent { iq }
    `, [ error('intelligentFragment', 'Cat', 'Intelligent', 2, 54) ]);
  });

  it('interface into non overlapping interface', () => {
    expectFailsRule(PossibleFragmentSpreads, `
      fragment invalidInterfaceWithinInterface on Pet {
        ...intelligentFragment
      }
      fragment intelligentFragment on Intelligent { iq }
    `, [ error('intelligentFragment', 'Pet', 'Intelligent', 3, 9) ]);
  });

  it('interface into non overlapping interface in inline fragment', () => {
    expectFailsRule(PossibleFragmentSpreads, `
      fragment invalidInterfaceWithinInterfaceAnon on Pet {
        ...on Intelligent { iq }
      }
    `, [ errorAnon('Pet', 'Intelligent', 3, 9) ]);
  });

  it('interface into non overlapping union', () => {
    expectFailsRule(PossibleFragmentSpreads, `
      fragment invalidInterfaceWithinUnion on HumanOrAlien { ...petFragment }
      fragment petFragment on Pet { name }
    `, [ error('petFragment', 'HumanOrAlien', 'Pet', 2, 62) ]);
  });

});
