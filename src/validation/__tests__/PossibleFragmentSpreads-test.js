// @flow strict

import { describe, it } from 'mocha';

import { PossibleFragmentSpreads } from '../rules/PossibleFragmentSpreads';

import { expectValidationErrors } from './harness';

function expectErrors(queryStr) {
  return expectValidationErrors(PossibleFragmentSpreads, queryStr);
}

function expectValid(queryStr) {
  expectErrors(queryStr).to.deep.equal([]);
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

  it('ignores unknown fragments (caught by KnownFragmentNames)', () => {
    expectValid(`
      fragment petFragment on Pet { ...UnknownFragment }
    `);
  });

  it('different object into object', () => {
    expectErrors(`
      fragment invalidObjectWithinObject on Cat { ...dogFragment }
      fragment dogFragment on Dog { barkVolume }
    `).to.deep.equal([
      {
        message:
          'Fragment "dogFragment" cannot be spread here as objects of type "Cat" can never be of type "Dog".',
        locations: [{ line: 2, column: 51 }],
      },
    ]);
  });

  it('different object into object in inline fragment', () => {
    expectErrors(`
      fragment invalidObjectWithinObjectAnon on Cat {
        ... on Dog { barkVolume }
      }
    `).to.deep.equal([
      {
        message:
          'Fragment cannot be spread here as objects of type "Cat" can never be of type "Dog".',
        locations: [{ line: 3, column: 9 }],
      },
    ]);
  });

  it('object into not implementing interface', () => {
    expectErrors(`
      fragment invalidObjectWithinInterface on Pet { ...humanFragment }
      fragment humanFragment on Human { pets { name } }
    `).to.deep.equal([
      {
        message:
          'Fragment "humanFragment" cannot be spread here as objects of type "Pet" can never be of type "Human".',
        locations: [{ line: 2, column: 54 }],
      },
    ]);
  });

  it('object into not containing union', () => {
    expectErrors(`
      fragment invalidObjectWithinUnion on CatOrDog { ...humanFragment }
      fragment humanFragment on Human { pets { name } }
    `).to.deep.equal([
      {
        message:
          'Fragment "humanFragment" cannot be spread here as objects of type "CatOrDog" can never be of type "Human".',
        locations: [{ line: 2, column: 55 }],
      },
    ]);
  });

  it('union into not contained object', () => {
    expectErrors(`
      fragment invalidUnionWithinObject on Human { ...catOrDogFragment }
      fragment catOrDogFragment on CatOrDog { __typename }
    `).to.deep.equal([
      {
        message:
          'Fragment "catOrDogFragment" cannot be spread here as objects of type "Human" can never be of type "CatOrDog".',
        locations: [{ line: 2, column: 52 }],
      },
    ]);
  });

  it('union into non overlapping interface', () => {
    expectErrors(`
      fragment invalidUnionWithinInterface on Pet { ...humanOrAlienFragment }
      fragment humanOrAlienFragment on HumanOrAlien { __typename }
    `).to.deep.equal([
      {
        message:
          'Fragment "humanOrAlienFragment" cannot be spread here as objects of type "Pet" can never be of type "HumanOrAlien".',
        locations: [{ line: 2, column: 53 }],
      },
    ]);
  });

  it('union into non overlapping union', () => {
    expectErrors(`
      fragment invalidUnionWithinUnion on CatOrDog { ...humanOrAlienFragment }
      fragment humanOrAlienFragment on HumanOrAlien { __typename }
    `).to.deep.equal([
      {
        message:
          'Fragment "humanOrAlienFragment" cannot be spread here as objects of type "CatOrDog" can never be of type "HumanOrAlien".',
        locations: [{ line: 2, column: 54 }],
      },
    ]);
  });

  it('interface into non implementing object', () => {
    expectErrors(`
      fragment invalidInterfaceWithinObject on Cat { ...intelligentFragment }
      fragment intelligentFragment on Intelligent { iq }
    `).to.deep.equal([
      {
        message:
          'Fragment "intelligentFragment" cannot be spread here as objects of type "Cat" can never be of type "Intelligent".',
        locations: [{ line: 2, column: 54 }],
      },
    ]);
  });

  it('interface into non overlapping interface', () => {
    expectErrors(`
      fragment invalidInterfaceWithinInterface on Pet {
        ...intelligentFragment
      }
      fragment intelligentFragment on Intelligent { iq }
    `).to.deep.equal([
      {
        message:
          'Fragment "intelligentFragment" cannot be spread here as objects of type "Pet" can never be of type "Intelligent".',
        locations: [{ line: 3, column: 9 }],
      },
    ]);
  });

  it('interface into non overlapping interface in inline fragment', () => {
    expectErrors(`
      fragment invalidInterfaceWithinInterfaceAnon on Pet {
        ...on Intelligent { iq }
      }
    `).to.deep.equal([
      {
        message:
          'Fragment cannot be spread here as objects of type "Pet" can never be of type "Intelligent".',
        locations: [{ line: 3, column: 9 }],
      },
    ]);
  });

  it('interface into non overlapping union', () => {
    expectErrors(`
      fragment invalidInterfaceWithinUnion on HumanOrAlien { ...petFragment }
      fragment petFragment on Pet { name }
    `).to.deep.equal([
      {
        message:
          'Fragment "petFragment" cannot be spread here as objects of type "HumanOrAlien" can never be of type "Pet".',
        locations: [{ line: 2, column: 62 }],
      },
    ]);
  });
});
