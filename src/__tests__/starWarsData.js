/**
 *  Copyright (c) 2015, Facebook, Inc.
 *  All rights reserved.
 *  LICENSE file in the root directory of this source tree. An additional grant
 *  of patent rights can be found in the PATENTS file in the same directory.
 */

/**
 * This defines a basic set of data for our Star Wars Schema.
 *
 * This data is hard coded for the sake of the demo, but you could imagine
 * fetching this data from a backend service rather than from hardcoded
 * JSON objects in a more complex demo.
 */

/**
 * We export luke directly because the schema returns him
 * from a root field, and hence needs to reference him.
 */
export var luke = {
  id: '1000',
  name: 'Luke Skywalker',
  friends: ['1002', '1003', '2000', '2001'],
  appearsIn: [4, 5, 6],
  homePlanet: 'Tatooine',
};

var vader = {
  id: '1001',
  name: 'Darth Vader',
  friends: ['1004'],
  appearsIn: [4, 5, 6],
  homePlanet: 'Tatooine',
};

var han = {
  id: '1002',
  name: 'Han Solo',
  friends: ['1000', '1003', '2001'],
  appearsIn: [4, 5, 6],
};

var leia = {
  id: '1003',
  name: 'Leia Organa',
  friends: ['1000', '1002', '2000', '2001'],
  appearsIn: [4, 5, 6],
  homePlanet: 'Alderaan',
};

var tarkin = {
  id: '1004',
  name: 'Wilhuff Tarkin',
  friends: ['1001'],
  appearsIn: [4],
};

var humanData = {
  1000: luke,
  1001: vader,
  1002: han,
  1003: leia,
  1004: tarkin,
};

var threepio = {
  id: '2000',
  name: 'C-3PO',
  friends: ['1000', '1002', '1003', '2001'],
  appearsIn: [4, 5, 6],
  primaryFunction: 'Protocol',
};

/**
 * We export artoo directly because the schema returns him
 * from a root field, and hence needs to reference him.
 */
export var artoo = {
  id: '2001',
  name: 'R2-D2',
  friends: ['1000', '1002', '1003'],
  appearsIn: [4, 5, 6],
  primaryFunction: 'Astromech',
};

var droidData = {
  2000: threepio,
  2001: artoo,
};

/**
 * Helper function to get a character by ID.
 */
function getCharacter(id) {
  // Returning a promise just to illustrate GraphQL.js's support.
  return Promise.resolve(humanData[id] || droidData[id]);
}

/**
 * Allows us to query for a character's friends.
 */
export function getFriends(character) {
  return character.friends.map(id => getCharacter(id));
}

export var starWarsData = {
  Humans: humanData,
  Droids: droidData,
};
