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

describe('Validate: Max introspection depth rule', () => {
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

  it('3 fields depth introspection query', () => {
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
      },
    ]);
  });

  it('malicious introspection query', () => {
    expectErrors(`
    query test {
      __schema {
        types {
          ...F1
        }
      }
    }

    fragment F1 on __Type {
      fields {
        type {
          ...F2
        }
      }
      ofType {
        ...F2
      }
    }

    fragment F2 on __Type {
      fields {
        type {
          ...F3
        }
      }
      ofType {
        ...F3
      }
    }

    fragment F3 on __Type {
      fields {
        type {
          ...F4
        }
      }
      ofType {
        ...F4
      }
    }

    fragment F4 on __Type {
      fields {
        type {
          ...F5
        }
      }
      ofType {
        ...F5
      }
    }

    fragment F5 on __Type {
      fields {
        type {
          ...F6
        }
      }
      ofType {
        ...F6
      }
    }

    fragment F6 on __Type {
      fields {
        type {
          ...F7
        }
      }
      ofType {
        ...F7
      }
    }

    fragment F7 on __Type {
      fields {
        type {
          ...F8
        }
      }
      ofType {
        ...F8
      }
    }

    fragment F8 on __Type {
      fields {
        type {
          ...F9
        }
      }
      ofType {
        ...F9
      }
    }

    fragment F9 on __Type {
      fields {
        type {
          ...F10
        }
      }
      ofType {
        ...F10
      }
    }

    fragment F10 on __Type {
      fields {
        type {
          ...F11
        }
      }
      ofType {
        ...F11
      }
    }

    fragment F11 on __Type {
      fields {
        type {
          ...F12
        }
      }
      ofType {
        ...F12
      }
    }

    fragment F12 on __Type {
      fields {
        type {
          ...F13
        }
      }
      ofType {
        ...F13
      }
    }

    fragment F13 on __Type {
      fields {
        type {
          ...F14
        }
      }
      ofType {
        ...F14
      }
    }

    fragment F14 on __Type {
      fields {
        type {
          ...F15
        }
      }
      ofType {
        ...F15
      }
    }

    fragment F15 on __Type {
      fields {
        type {
          ...F16
        }
      }
      ofType {
        ...F16
      }
    }

    fragment F16 on __Type {
      fields {
        type {
          ...F17
        }
      }
      ofType {
        ...F17
      }
    }

    fragment F17 on __Type {
      fields {
        type {
          ...F18
        }
      }
      ofType {
        ...F18
      }
    }

    fragment F18 on __Type {
      fields {
        type {
          ...F19
        }
      }
      ofType {
        ...F19
      }
    }

    fragment F19 on __Type {
      fields {
        type {
          ...F20
        }
      }
      ofType {
        ...F20
      }
    }

    fragment F20 on __Type {
      fields {
        type {
          ...F21
        }
      }
      ofType {
        ...F21
      }
    }

    fragment F21 on __Type {
      fields {
        type {
          ...F22
        }
      }
      ofType {
        ...F22
      }
    }

    fragment F22 on __Type {
      fields {
        type {
          ...F23
        }
      }
      ofType {
        ...F23
      }
    }

    fragment F23 on __Type {
      fields {
        type {
          ...F24
        }
      }
      ofType {
        ...F24
      }
    }

    fragment F24 on __Type {
      fields {
        type {
          ...F25
        }
      }
      ofType {
        ...F25
      }
    }

    fragment F25 on __Type {
      fields {
        type {
          name
        }
      }
    }
    `).toDeepEqual([
      {
        message: 'Maximum introspection depth exceeded',
      },
    ]);
  });
});
