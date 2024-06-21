import { describe, it } from 'mocha';

import { getIntrospectionQuery } from '../../utilities/getIntrospectionQuery.js';

import { MaxIntrospectionDepthRule } from '../rules/MaxIntrospectionDepthRule.js';

import { expectValidationErrors } from './harness.js';

function expectErrors(queryStr: string) {
  return expectValidationErrors(MaxIntrospectionDepthRule, queryStr);
}

function expectValid(queryStr: string) {
  expectErrors(queryStr).toDeepEqual([]);
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
});
