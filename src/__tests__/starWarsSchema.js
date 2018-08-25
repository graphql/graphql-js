/**
 * Copyright (c) 2015-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow strict
 */

import { buildSchema } from '../utilities/buildASTSchema';
import { getCharacter, getHero, getHuman, getDroid } from './starWarsData';
import type { CharacterData, HumanData, DroidData } from './starWarsData';

/**
 * This is designed to be an end-to-end test, demonstrating
 * the full GraphQL stack.
 *
 * We will create a GraphQL schema that describes the major
 * characters in the original Star Wars trilogy.
 *
 * NOTE: This may contain spoilers for the original Star Wars trilogy.
 */

export const StarWarsSchema = buildSchema(`
  """One of the films in the Star Wars Trilogy"""
  enum Episode {
    """Released in 1977."""
    NEWHOPE,
    """Released in 1980."""
    EMPIRE,
    """Released in 1983."""
    JEDI
  }

  """A character in the Star Wars Trilogy"""
  interface Character {
    """The id of the character."""
    id: String!
    """The name of the character."""
    name: String
    """The friends of the character, or an empty list if they have none."""
    friends: [Character]
    """Which movies they appear in."""
    appearsIn: [Episode]
    """All secrets about their past."""
    secretBackstory: String
  }

  """A humanoid creature in the Star Wars universe."""
  type Human implements Character {
    """The id of the human."""
    id: String!
    """The name of the human."""
    name: String
    """The friends of the human, or an empty list if they have none."""
    friends: [Character]
    """Which movies they appear in."""
    appearsIn: [Episode]
    """The home planet of the human, or null if unknown."""
    homePlanet: String
    """Where are they from and how they came to be who they are."""
    secretBackstory: String
  }

  """A mechanical creature in the Star Wars universe."""
  type Droid implements Character {
    """The id of the droid."""
    id: String!
    """The name of the droid."""
    name: String
    """The friends of the droid, or an empty list if they have none."""
    friends: [Character]
    """Which movies they appear in."""
    appearsIn: [Episode]
    """Construction date and the name of the designer."""
    secretBackstory: String
    """The primary function of the droid."""
    primaryFunction: String
  }

  type Query {
    hero(
      """If omitted, returns the hero of the whole saga. If provided, returns the hero of that particular episode."""
      episode: Episode
    ): Character

    human(
      """id of the human"""
      id: String!
    ): Human

    droid(
      """id of the droid"""
      id: String!
    ): Droid
  }
`);

// FIXME: Patch enum defined in SDL, should be possible to do without hacks :(
const episodeEnum = (StarWarsSchema.getType('Episode'): any);
episodeEnum.getValue('NEWHOPE').value = 4;
episodeEnum.getValue('EMPIRE').value = 5;
episodeEnum.getValue('JEDI').value = 6;
for (const enumValue of episodeEnum.getValues()) {
  episodeEnum._valueLookup.set(enumValue.value, enumValue);
}

class Character {
  id: string;
  name: string;
  appearsIn: Array<number>;
  _friends: Array<string>;

  constructor(data: CharacterData) {
    this.id = data.id;
    this.name = data.name;
    this.appearsIn = data.appearsIn;
    this._friends = data.friends;
  }

  friends() {
    // Notice that GraphQL accepts Arrays of Promises.
    return this._friends.map(async id => {
      const data = await getCharacter(id);
      return makeCharacterObj(data);
    });
  }

  secretBackstory() {
    throw new Error('secretBackstory is secret.');
  }
}

class Human extends Character {
  homePlanet: string;

  constructor(data: HumanData) {
    super(data);
    this.homePlanet = data.homePlanet;
  }

  get __typename(): string {
    return 'Human';
  }
}

class Droid extends Character {
  primaryFunction: string;

  constructor(data: DroidData) {
    super(data);
    this.primaryFunction = data.primaryFunction;
  }

  get __typename(): string {
    return 'Droid';
  }
}

function makeCharacterObj(data: CharacterData) {
  switch (data.type) {
    case 'Human':
      return new Human(data);
    case 'Droid':
      return new Droid(data);
  }
}

/**
 * This is the type that will be the root of our query, and the
 * entry point into our schema. It gives us the ability to fetch
 * objects by their IDs, as well as to fetch the undisputed hero
 * of the Star Wars trilogy, R2-D2, directly.
 */
export class Query {
  hero(args: { episode: number }) {
    const data = getHero(args.episode);
    return data ? makeCharacterObj(data) : null;
  }

  human(args: { id: string }) {
    const data = getHuman(args.id);
    return data ? new Human(data) : null;
  }

  droid(args: { id: string }) {
    const data = getDroid(args.id);
    return data ? new Droid(data) : null;
  }
}
