import { describe, it } from 'mocha';

import { buildSchema } from '../../utilities/buildASTSchema';

import { PossibleFragmentSpreadsRule } from '../rules/PossibleFragmentSpreadsRule';

import { expectValidationErrorsWithSchema } from './harness';

function expectErrors(queryStr: string) {
  return expectValidationErrorsWithSchema(
    testSchema,
    PossibleFragmentSpreadsRule,
    queryStr,
  );
}

function expectValid(queryStr: string) {
  expectErrors(queryStr).toDeepEqual([]);
}

const testSchema = buildSchema(`
  interface Being {
    name: String
  }

  interface Pet implements Being {
    name: String
  }

  type Dog implements Being & Pet {
    name: String
    barkVolume: Int
  }

  type Cat implements Being & Pet {
    name: String
    meowVolume: Int
  }

  type Bird implements Being & Pet {
    name: String
    chirpVolume: Int
  }

  union CatOrDog = Cat | Dog

  union CatOrBird = Cat | Bird

  intersection CatOrDogPet = CatOrDog & Being & Pet

  intersection CatOrBirdPet = CatOrBird & Being & Pet

  interface Intelligent {
    iq: Int
  }

  type Human implements Being & Intelligent {
    name: String
    pets: [Pet]
    iq: Int
  }

  type Alien implements Being & Intelligent {
    name: String
    iq: Int
  }

  union DogOrHuman = Dog | Human

  union HumanOrAlien = Human | Alien

  intersection HumanOrAlienIntelligent = HumanOrAlien & Intelligent

  type Query {
    catOrDog: CatOrDog
    dogOrHuman: DogOrHuman
    humanOrAlien: HumanOrAlien
  }
`);

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

  it('object into containing intersection', () => {
    expectValid(`
      fragment objectWithinIntersection on CatOrDogPet { ...dogFragment }
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

  it('intersection into contained object', () => {
    expectValid(`
      fragment intersectionWithinObject on Dog { ...catOrDogPetFragment }
      fragment catOrDogPetFragment on CatOrDogPet { __typename }
    `);
  });

  it('intersection into overlapping interface', () => {
    expectValid(`
      fragment intersectionWithinInterface on Pet { ...catOrDogPetFragment }
      fragment catOrDogPetFragment on CatOrDogPet { __typename }
    `);
  });

  it('intersection into overlapping union', () => {
    expectValid(`
      fragment intersectionWithinUnion on DogOrHuman { ...catOrDogPetFragment }
      fragment catOrDogPetFragment on CatOrDogPet { __typename }
    `);
  });

  it('intersection into overlapping intersection', () => {
    expectValid(`
      fragment intersectionWithinIntersection on CatOrBirdPet { ...catOrDogPetFragment }
      fragment catOrDogPetFragment on CatOrDogPet { __typename }
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

  it('interface into overlapping intersection', () => {
    expectValid(`
      fragment interfaceWithinIntersection on CatOrDogPet { ...petFragment }
      fragment petFragment on Pet { name }
    `);
  });

  it('ignores incorrect type (caught by FragmentsOnCompositeTypesRule)', () => {
    expectValid(`
      fragment petFragment on Pet { ...badInADifferentWay }
      fragment badInADifferentWay on String { name }
    `);
  });

  it('ignores unknown fragments (caught by KnownFragmentNamesRule)', () => {
    expectValid(`
      fragment petFragment on Pet { ...UnknownFragment }
    `);
  });

  it('different object into object', () => {
    expectErrors(`
      fragment invalidObjectWithinObject on Cat { ...dogFragment }
      fragment dogFragment on Dog { barkVolume }
    `).toDeepEqual([
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
    `).toDeepEqual([
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
    `).toDeepEqual([
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
    `).toDeepEqual([
      {
        message:
          'Fragment "humanFragment" cannot be spread here as objects of type "CatOrDog" can never be of type "Human".',
        locations: [{ line: 2, column: 55 }],
      },
    ]);
  });

  it('object into not containing intersection', () => {
    expectErrors(`
      fragment invalidObjectWithinIntersection on CatOrDogPet { ...humanFragment }
      fragment humanFragment on Human { pets { name } }
    `).toDeepEqual([
      {
        message:
          'Fragment "humanFragment" cannot be spread here as objects of type "CatOrDogPet" can never be of type "Human".',
        locations: [{ line: 2, column: 65 }],
      },
    ]);
  });

  it('union into not contained object', () => {
    expectErrors(`
      fragment invalidUnionWithinObject on Human { ...catOrDogFragment }
      fragment catOrDogFragment on CatOrDog { __typename }
    `).toDeepEqual([
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
    `).toDeepEqual([
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
    `).toDeepEqual([
      {
        message:
          'Fragment "humanOrAlienFragment" cannot be spread here as objects of type "CatOrDog" can never be of type "HumanOrAlien".',
        locations: [{ line: 2, column: 54 }],
      },
    ]);
  });

  it('intersection into not contained object', () => {
    expectErrors(`
      fragment invalidIntersectionWithinObject on Human { ...catOrDogPetFragment }
      fragment catOrDogPetFragment on CatOrDogPet { __typename }
    `).toDeepEqual([
      {
        message:
          'Fragment "catOrDogPetFragment" cannot be spread here as objects of type "Human" can never be of type "CatOrDogPet".',
        locations: [{ line: 2, column: 59 }],
      },
    ]);
  });

  it('intersection into non overlapping interface', () => {
    expectErrors(`
      fragment invalidIntersectionWithinInterface on Intelligent { ...catOrDogPetFragment }
      fragment catOrDogPetFragment on CatOrDogPet { __typename }
    `).toDeepEqual([
      {
        message:
          'Fragment "catOrDogPetFragment" cannot be spread here as objects of type "Intelligent" can never be of type "CatOrDogPet".',
        locations: [{ line: 2, column: 68 }],
      },
    ]);
  });

  it('intersection into non overlapping union', () => {
    expectErrors(`
      fragment invalidIntersectionWithinUnion on HumanOrAlien { ...catOrDogPetFragment }
      fragment catOrDogPetFragment on CatOrDogPet { __typename }
    `).toDeepEqual([
      {
        message:
          'Fragment "catOrDogPetFragment" cannot be spread here as objects of type "HumanOrAlien" can never be of type "CatOrDogPet".',
        locations: [{ line: 2, column: 65 }],
      },
    ]);
  });

  it('intersection into non overlapping intersection', () => {
    expectErrors(`
      fragment invalidIntersectionWithinIntersection on HumanOrAlienIntelligent { ...catOrDogPetFragment }
      fragment catOrDogPetFragment on CatOrDogPet { __typename }
    `).toDeepEqual([
      {
        message:
          'Fragment "catOrDogPetFragment" cannot be spread here as objects of type "HumanOrAlienIntelligent" can never be of type "CatOrDogPet".',
        locations: [{ line: 2, column: 83 }],
      },
    ]);
  });

  it('interface into non implementing object', () => {
    expectErrors(`
      fragment invalidInterfaceWithinObject on Cat { ...intelligentFragment }
      fragment intelligentFragment on Intelligent { iq }
    `).toDeepEqual([
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
    `).toDeepEqual([
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
    `).toDeepEqual([
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
    `).toDeepEqual([
      {
        message:
          'Fragment "petFragment" cannot be spread here as objects of type "HumanOrAlien" can never be of type "Pet".',
        locations: [{ line: 2, column: 62 }],
      },
    ]);
  });

  it('interface into non overlapping intersection', () => {
    expectErrors(`
      fragment invalidInterfaceWithinIntersection on HumanOrAlien { ...catOrDogPetFragment }
      fragment catOrDogPetFragment on CatOrDogPet { name }
    `).toDeepEqual([
      {
        message:
          'Fragment "catOrDogPetFragment" cannot be spread here as objects of type "HumanOrAlien" can never be of type "CatOrDogPet".',
        locations: [{ line: 2, column: 69 }],
      },
    ]);
  });
});
