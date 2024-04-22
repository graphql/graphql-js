import { describe, it } from 'mocha';

import { getIntrospectionQuery } from '../../utilities/getIntrospectionQuery.js';

import { MaxIntrospectionDepthRule } from '../rules/MaxIntrospectionDepthRule.js';

import { expectValidationErrors } from './harness.js';

function expectInvalid(queryStr: string) {
  return expectValidationErrors(
    MaxIntrospectionDepthRule,
    queryStr,
  ).toDeepEqual([
    {
      message: 'Maximum introspection depth exceeded',
    },
  ]);
}

function expectValid(queryStr: string) {
  expectValidationErrors(MaxIntrospectionDepthRule, queryStr).toDeepEqual([]);
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
    expectInvalid(`
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
    `);
  });

  it('3 interfaces deep introspection query from __schema', () => {
    expectInvalid(`
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
    `);
  });

  it('3 possibleTypes deep introspection query from __schema', () => {
    expectInvalid(`
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
    `);
  });

  it('3 possibleTypes deep introspection query from __schema', () => {
    expectInvalid(`
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
    `);
  });

  it('3 fields deep introspection query from multiple __schema', () => {
    expectInvalid(`
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
    `);
  });

  it('3 fields deep introspection query from __type', () => {
    expectInvalid(`
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
    `);
  });

  it('3 fields deep introspection query from multiple __type', () => {
    expectInvalid(`
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
    `);
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
    expectInvalid(`
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
    `);
  });

  it('3 fields deep introspection query with inline fragments', () => {
    expectInvalid(`
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
    `);
  });

  it('3 fields deep introspection query with fragments', () => {
    expectInvalid(`
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
    `);
  });
});
