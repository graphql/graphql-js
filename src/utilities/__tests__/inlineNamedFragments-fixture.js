/**
 *  Copyright (c) Facebook, Inc. and its affiliates.
 *
 *  This source code is licensed under the MIT license found in the
 *  LICENSE file in the root directory of this source tree.
 *
 * @flow strict
 *
 */

export const fixtures = [
  {
    desc: 'does not modify query with no fragments',
    query: `
      {
        id
      }`,
    resultQuery: `
      {
        id
      }
      `,
  },
  {
    desc: 'inlines simple nested fragment',
    query: `
      {
        ...Fragment1
      }

      fragment Fragment1 on Test {
        id
      }`,
    resultQuery: `
      {
        ... on Test {
          id
        }
      }
      `,
  },
  {
    desc: 'inlines triple nested fragment',
    query: `
      {
        ...Fragment1
      }
      
      fragment Fragment1 on Test {
        ...Fragment2
      }
      
      fragment Fragment2 on Test {
        ...Fragment3
      }
      
      fragment Fragment3 on Test {
        id
      }`,
    resultQuery: `
      {
        ... on Test {
          ... on Test {
            ... on Test {
              id
            }
          }
        }
      }
      `,
  },
  {
    desc: 'inlines multiple fragments',
    query: `
      {
        ...Fragment1
        ...Fragment2
        ...Fragment3
      }

      fragment Fragment1 on Test {
        id
      }

      fragment Fragment2 on Test {
        id
      }

      fragment Fragment3 on Test {
        id
      }`,
    resultQuery: `
      {
        ... on Test {
          id
        }
        ... on Test {
          id
        }
        ... on Test {
          id
        }
      }
      `,
  },
  {
    desc: 'inlines multiple fragments on multiple queries',
    query: `
      {
        ...Fragment4
        ...Fragment5
      }

      fragment Fragment5 on Test1 {
        ...Fragment4
      }

      fragment Fragment4 on Test1 {
        id
      }`,
    resultQuery: `
      {
        ... on Test1 {
          id
        }
        ... on Test1 {
          ... on Test1 {
            id
          }
        }
      }
      `,
  },
  {
    desc: 'reuses the same fragment',
    query: `
      fragment ProfileInfo on Person {
        name
        title
        phone
      }

      {
        person {
          ...ProfileInfo
          friend {
            ...ProfileInfo
          }
        }
      }`,
    resultQuery: `
      {
        person {
          ... on Person {
            name
            title
            phone
          }
          friend {
            ... on Person {
              name
              title
              phone
            }
          }
        }
      }
      `,
  },
  {
    desc: 'removes duplicate fragment spreads',
    query: `
      {
        ...Fragment1
        ...Fragment1
      }

      fragment Fragment1 on Test {
        id
      }`,
    resultQuery: `
      {
        ... on Test {
          id
        }
      }
      `,
  },
];
