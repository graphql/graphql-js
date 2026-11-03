import { expect } from 'chai';
import { describe, it } from 'mocha';

import { getIntrospectionQuery } from '../../utilities/getIntrospectionQuery';

import { MaxIntrospectionDepthRule } from '../rules/MaxIntrospectionDepthRule';

import { expectValidationErrors } from './harness';

function expectErrors(queryStr: string) {
  return expectValidationErrors(MaxIntrospectionDepthRule, queryStr);
}

function expectValid(queryStr: string) {
  expectErrors(queryStr).toDeepEqual([]);
}

function expectErrorsLookingUpFragments(
  queryStr: string,
  lookedUpFragments: Array<string>,
) {
  return expectValidationErrors(
    (context) =>
      // eslint-disable-next-line new-cap
      MaxIntrospectionDepthRule(
        Object.assign(Object.create(context), {
          getFragment(name: string) {
            lookedUpFragments.push(name);
            return context.getFragment(name);
          },
        }),
      ),
    queryStr,
  );
}

function expectValidLookingUpFragments(
  queryStr: string,
  lookedUpFragments: Array<string>,
) {
  expectErrorsLookingUpFragments(queryStr, lookedUpFragments).toDeepEqual([]);
}

describe('Validate: Max introspection nodes rule', () => {
  it('default introspection query', () => {
    expectValid(getIntrospectionQuery());
  });

  it('all options introspection query', () => {
    expectValid(
      getIntrospectionQuery({
        descriptions: true,
        specifiedByUrl: true,
        directiveIsRepeatable: true,
        schemaDescription: true,
        inputValueDeprecation: true,
      }),
    );
  });

  it('3 flat fields introspection query', () => {
    expectValid(`
    {
      __type(name: "Query") {
        trueFields: fields(includeDeprecated: true) {
          name
        }
        falseFields: fields(includeDeprecated: false) {
          name
        }
        omittedFields: fields {
          name
        }
      }
    }
    `);
  });

  it('3 fields deep introspection query from __schema', () => {
    expectErrors(`
    {
      __schema {
        types {
          fields {
            type {
              fields {
                type {
                  fields {
                    name
                  }
                }
              }
            }
          }
        }
      }
    }
    `).toDeepEqual([
      {
        message: 'Maximum introspection depth exceeded',
        locations: [
          {
            column: 7,
            line: 3,
          },
        ],
      },
    ]);
  });

  it('3 interfaces deep introspection query from __schema', () => {
    expectErrors(`
    {
      __schema {
        types {
          interfaces {
            interfaces {
              interfaces {
                name
              }
            }
          }
        }
      }
    }
    `).toDeepEqual([
      {
        message: 'Maximum introspection depth exceeded',
        locations: [
          {
            column: 7,
            line: 3,
          },
        ],
      },
    ]);
  });

  it('3 possibleTypes deep introspection query from __schema', () => {
    expectErrors(`
    {
      __schema {
        types {
          possibleTypes {
            possibleTypes {
              possibleTypes {
                name
              }
            }
          }
        }
      }
    }
    `).toDeepEqual([
      {
        message: 'Maximum introspection depth exceeded',
        locations: [
          {
            column: 7,
            line: 3,
          },
        ],
      },
    ]);
  });

  it('3 inputFields deep introspection query from __schema', () => {
    expectErrors(`
    {
      __schema {
        types {
          inputFields {
            type {
              inputFields {
                type {
                  inputFields {
                    type {
                      name
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
    `).toDeepEqual([
      {
        message: 'Maximum introspection depth exceeded',
        locations: [
          {
            column: 7,
            line: 3,
          },
        ],
      },
    ]);
  });

  it('3 fields deep introspection query from multiple __schema', () => {
    expectErrors(`
    {
      one: __schema {
        types {
          fields {
            type {
              fields {
                type {
                  fields {
                    name
                  }
                }
              }
            }
          }
        }
      }
      two: __schema {
        types {
          fields {
            type {
              fields {
                type {
                  fields {
                    name
                  }
                }
              }
            }
          }
        }
      }
      three: __schema {
        types {
          fields {
            type {
              fields {
                type {
                  fields {
                    name
                  }
                }
              }
            }
          }
        }
      }
    }
    `).toDeepEqual([
      {
        message: 'Maximum introspection depth exceeded',
        locations: [
          {
            column: 7,
            line: 3,
          },
        ],
      },
      {
        locations: [
          {
            column: 7,
            line: 18,
          },
        ],
        message: 'Maximum introspection depth exceeded',
      },
      {
        locations: [
          {
            column: 7,
            line: 33,
          },
        ],
        message: 'Maximum introspection depth exceeded',
      },
    ]);
  });

  it('3 fields deep introspection query from __type', () => {
    expectErrors(`
    {
      __type(name: "Query") {
        types {
          fields {
            type {
              fields {
                type {
                  fields {
                    name
                  }
                }
              }
            }
          }
        }
      }
    }
    `).toDeepEqual([
      {
        message: 'Maximum introspection depth exceeded',
        locations: [
          {
            column: 7,
            line: 3,
          },
        ],
      },
    ]);
  });

  it('3 fields deep introspection query from multiple __type', () => {
    expectErrors(`
    {
      one: __type(name: "Query") {
        types {
          fields {
            type {
              fields {
                type {
                  fields {
                    name
                  }
                }
              }
            }
          }
        }
      }
      two: __type(name: "Query") {
        types {
          fields {
            type {
              fields {
                type {
                  fields {
                    name
                  }
                }
              }
            }
          }
        }
      }
      three: __type(name: "Query") {
        types {
          fields {
            type {
              fields {
                type {
                  fields {
                    name
                  }
                }
              }
            }
          }
        }
      }
    }
    `).toDeepEqual([
      {
        message: 'Maximum introspection depth exceeded',
        locations: [
          {
            column: 7,
            line: 3,
          },
        ],
      },
      {
        locations: [
          {
            column: 7,
            line: 18,
          },
        ],
        message: 'Maximum introspection depth exceeded',
      },
      {
        locations: [
          {
            column: 7,
            line: 33,
          },
        ],
        message: 'Maximum introspection depth exceeded',
      },
    ]);
  });

  it('1 fields deep with 3 fields introspection query', () => {
    expectValid(`
    {
      __schema {
        types {
          fields {
            type {
              oneFields: fields {
                name
              }
              twoFields: fields {
                name
              }
              threeFields: fields {
                name
              }
            }
          }
        }
      }
    }
    `);
  });

  it('3 fields deep from varying parents introspection query', () => {
    expectErrors(`
    {
      __schema {
        types {
          fields {
            type {
              fields {
                type {
                  ofType {
                    fields {
                      name
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
    `).toDeepEqual([
      {
        message: 'Maximum introspection depth exceeded',
        locations: [
          {
            column: 7,
            line: 3,
          },
        ],
      },
    ]);
  });

  it('3 fields deep introspection query with inline fragments', () => {
    expectErrors(`
    query test {
      __schema {
        types {
          ... on __Type {
            fields {
              type {
                ... on __Type {
                  ofType {
                    fields {
                      type {
                        ... on __Type {
                          fields {
                            name
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
    `).toDeepEqual([
      {
        message: 'Maximum introspection depth exceeded',
        locations: [
          {
            column: 7,
            line: 3,
          },
        ],
      },
    ]);
  });

  it('3 fields deep introspection query with fragments', () => {
    expectErrors(`
    query test {
      __schema {
        types {
          ...Three
          ...One
        }
      }
    }

    fragment One on __Type {
      fields {
        type {
          ...Two
        }
      }
    }

    fragment Two on __Type {
      fields {
        type {
          ...Three
        }
      }
    }

    fragment Three on __Type {
      fields {
        name
      }
    }
    `).toDeepEqual([
      {
        message: 'Maximum introspection depth exceeded',
        locations: [
          {
            column: 7,
            line: 3,
          },
        ],
      },
    ]);
  });

  it('3 fields deep inside inline fragment on query', () => {
    expectErrors(`
    {
      ... {
        __schema { types { fields { type { fields { type { fields { name } } } } } } }
      }
    }
    `).toDeepEqual([
      {
        message: 'Maximum introspection depth exceeded',
        locations: [
          {
            column: 9,
            line: 4,
          },
        ],
      },
    ]);
  });

  it('opts out if fragment is missing', () => {
    expectValid(`
    query test {
      __schema {
        types {
          ...Missing
        }
      }
    }
    `);
  });

  it("doesn't infinitely recurse on fragment cycle", () => {
    expectValid(`
    query test {
      __schema {
        types {
          ...Cycle
        }
      }
    }
    fragment Cycle on __Type {
      ...Cycle
    }
    `);
  });

  it('reuses a successful fragment check', () => {
    const lookedUpFragments: Array<string> = [];
    expectValidLookingUpFragments(
      `
      {
        first: __type(name: "Query") { ...Shared }
        second: __type(name: "Query") { ...Shared }
      }
      fragment Shared on __Type {
        interfaces { name }
      }
    `,
      lookedUpFragments,
    );
    expect(lookedUpFragments).to.deep.equal(['Shared']);
  });

  it('reuses a fragment check exceeding the depth', () => {
    const lookedUpFragments: Array<string> = [];
    expectErrorsLookingUpFragments(
      `
      {
        first: __type(name: "Query") { ...Shared }
        second: __type(name: "Query") { ...Shared }
      }
      fragment Shared on __Type {
        interfaces { interfaces { interfaces { name } } }
      }
    `,
      lookedUpFragments,
    ).toDeepEqual([
      {
        message: 'Maximum introspection depth exceeded',
        locations: [{ line: 3, column: 9 }],
      },
      {
        message: 'Maximum introspection depth exceeded',
        locations: [{ line: 4, column: 9 }],
      },
    ]);
    expect(lookedUpFragments).to.deep.equal(['Shared']);
  });

  it('checks shared fragments at different depths', () => {
    expectErrors(`
      {
        first: __type(name: "Query") { ...Fields }
        second: __type(name: "Query") { interfaces { ...Fields } }
        third: __type(name: "Query") { ...Fields }
        fourth: __type(name: "Query") { interfaces { interfaces { ...Fields } } }
        fifth: __type(name: "Query") { interfaces { interfaces { ...Fields } } }
      }
      fragment Fields on __Type {
        fields {
          name
        }
      }
    `).toDeepEqual([
      {
        message: 'Maximum introspection depth exceeded',
        locations: [{ line: 6, column: 9 }],
      },
      {
        message: 'Maximum introspection depth exceeded',
        locations: [{ line: 7, column: 9 }],
      },
    ]);
  });

  it('reuses fragment checks from fields exceeding the depth', () => {
    const lookedUpFragments: Array<string> = [];
    expectErrorsLookingUpFragments(
      `
      {
        first: __type(name: "Query") {
          ...Shared
          fields { fields { fields { name } } }
        }
        second: __type(name: "Query") {
          ...Shared
          fields { fields { fields { name } } }
        }
      }
      fragment Shared on __Type {
        ...Leaf
      }
      fragment Leaf on __Type {
        name
      }
    `,
      lookedUpFragments,
    ).toDeepEqual([
      {
        message: 'Maximum introspection depth exceeded',
        locations: [{ line: 3, column: 9 }],
      },
      {
        message: 'Maximum introspection depth exceeded',
        locations: [{ line: 7, column: 9 }],
      },
    ]);
    expect(lookedUpFragments).to.deep.equal(['Shared', 'Leaf']);
  });

  it('reuses fragment checks exceeding the depth', () => {
    const lookedUpFragments: Array<string> = [];
    expectErrorsLookingUpFragments(
      `
      {
        first: __type(name: "Query") { ...Outer }
        second: __type(name: "Query") { interfaces { ...Outer } }
        third: __type(name: "Query") { name }
      }
      fragment Outer on __Type {
        ...Inner
      }
      fragment Inner on __Type {
        fields { fields { fields { name } } }
      }
    `,
      lookedUpFragments,
    ).toDeepEqual([
      {
        message: 'Maximum introspection depth exceeded',
        locations: [{ line: 3, column: 9 }],
      },
      {
        message: 'Maximum introspection depth exceeded',
        locations: [{ line: 4, column: 9 }],
      },
    ]);
    expect(lookedUpFragments).to.deep.equal(['Outer', 'Inner']);
  });

  it('reuses fragment checks completed inside a fragment cycle', () => {
    expectErrors(`
      {
        first: __type(name: "Query") { ...Outer }
        second: __type(name: "Query") { ...Inner }
      }
      fragment Outer on __Type {
        ...Inner
        fields { fields { fields { name } } }
      }
      fragment Inner on __Type {
        ...Outer
      }
    `).toDeepEqual([
      {
        message: 'Maximum introspection depth exceeded',
        locations: [{ line: 3, column: 9 }],
      },
    ]);
  });
});
