/**
 *  Copyright (c) 2015, Facebook, Inc.
 *  All rights reserved.
 *
 *  This source code is licensed under the BSD-style license found in the
 *  LICENSE file in the root directory of this source tree. An additional grant
 *  of patent rights can be found in the PATENTS file in the same directory.
 */

// 80+ char lines are useful in describe/it, so ignore in this file.
/* eslint-disable max-len */

import { describe, it } from 'mocha';
import { expect } from 'chai';
import {
  GraphQLSchema,
  GraphQLScalarType,
  GraphQLObjectType,
  GraphQLInterfaceType,
  GraphQLUnionType,
  GraphQLEnumType,
  GraphQLInputObjectType,
  GraphQLList,
  GraphQLNonNull,
  GraphQLString,
} from '../../';


const SomeScalarType = new GraphQLScalarType({
  name: 'SomeScalar',
  serialize() {},
  parseValue() {},
  parseLiteral() {}
});

const SomeObjectType = new GraphQLObjectType({
  name: 'SomeObject',
  fields: { f: { type: GraphQLString } }
});

const ObjectWithIsTypeOf = new GraphQLObjectType({
  name: 'ObjectWithIsTypeOf',
  isTypeOf: () => true,
  fields: { f: { type: GraphQLString} }
});

const SomeUnionType = new GraphQLUnionType({
  name: 'SomeUnion',
  resolveType: () => null,
  types: [ SomeObjectType ]
});

const SomeInterfaceType = new GraphQLInterfaceType({
  name: 'SomeInterface',
  resolveType: () => null,
  fields: { f: { type: GraphQLString } }
});

const SomeEnumType = new GraphQLEnumType({
  name: 'SomeEnum',
  values: {
    ONLY: {}
  }
});

const SomeInputObjectType = new GraphQLInputObjectType({
  name: 'SomeInputObject',
  fields: {
    val: { type: GraphQLString, defaultValue: 'hello' }
  }
});

function withModifiers(types) {
  return types
    .concat(types.map(type => new GraphQLList(type)))
    .concat(types.map(type => new GraphQLNonNull(type)))
    .concat(types.map(type => new GraphQLNonNull(new GraphQLList(type))));
}

const outputTypes = withModifiers([
  GraphQLString,
  SomeScalarType,
  SomeEnumType,
  SomeObjectType,
  SomeUnionType,
  SomeInterfaceType,
]);

const notOutputTypes = withModifiers([
  SomeInputObjectType,
]).concat(String);

const inputTypes = withModifiers([
  GraphQLString,
  SomeScalarType,
  SomeEnumType,
  SomeInputObjectType,
]);

const notInputTypes = withModifiers([
  SomeObjectType,
  SomeUnionType,
  SomeInterfaceType,
]).concat(String);

function schemaWithFieldType(type) {
  return new GraphQLSchema({
    query: new GraphQLObjectType({
      name: 'Query',
      fields: { f: { type } }
    })
  });
}


describe('Type System: A Schema must have Object root types', () => {

  it('accepts a Schema whose query type is an object type', () => {
    expect(
      () => new GraphQLSchema({
        query: SomeObjectType
      })
    ).not.to.throw();
  });

  it('accepts a Schema whose query and mutation types are object types', () => {
    expect(() => {
      const MutationType = new GraphQLObjectType({
        name: 'Mutation',
        fields: { edit: { type: GraphQLString } }
      });

      return new GraphQLSchema({
        query: SomeObjectType,
        mutation: MutationType
      });
    }).not.to.throw();
  });

  it('accepts a Schema whose query and subscription types are object types', () => {
    expect(() => {
      const SubscriptionType = new GraphQLObjectType({
        name: 'Subscription',
        fields: { subscribe: { type: GraphQLString } }
      });

      return new GraphQLSchema({
        query: SomeObjectType,
        subscription: SubscriptionType
      });
    }).not.to.throw();
  });

  it('rejects a Schema without a query type', () => {
    expect(
      () => new GraphQLSchema({ })
    ).to.throw(
      'Schema query must be Object Type but got: undefined.'
    );
  });

  it('rejects a Schema whose query type is an input type', () => {
    expect(
      () => new GraphQLSchema({ query: SomeInputObjectType })
    ).to.throw(
      'Schema query must be Object Type but got: SomeInputObject.'
    );
  });

  it('rejects a Schema whose mutation type is an input type', () => {
    expect(
      () => new GraphQLSchema({
        query: SomeObjectType,
        mutation: SomeInputObjectType
      })
    ).to.throw(
      'Schema mutation must be Object Type if provided but got: SomeInputObject.'
    );
  });

  it('rejects a Schema whose subscription type is an input type', () => {
    expect(
      () => new GraphQLSchema({
        query: SomeObjectType,
        subscription: SomeInputObjectType
      })
    ).to.throw(
      'Schema subscription must be Object Type if provided but got: SomeInputObject.'
    );
  });

  it('rejects a Schema whose directives are incorrectly typed', () => {
    expect(
      () => new GraphQLSchema({
        query: SomeObjectType,
        directives: [ 'somedirective' ]
      })
    ).to.throw(
      'Schema directives must be Array<GraphQLDirective> if provided but got: somedirective.'
    );
  });

});

describe('Type System: A Schema must contain uniquely named types', () => {

  it('rejects a Schema which redefines a built-in type', () => {
    expect(() => {
      const FakeString = new GraphQLScalarType({
        name: 'String',
        serialize: () => null,
      });

      const QueryType = new GraphQLObjectType({
        name: 'Query',
        fields: {
          normal: { type: GraphQLString },
          fake: { type: FakeString },
        }
      });

      return new GraphQLSchema({ query: QueryType });
    }).to.throw(
      'Schema must contain unique named types but contains multiple types ' +
      'named "String".'
    );
  });

  it('rejects a Schema which defines an object type twice', () => {
    expect(() => {
      const A = new GraphQLObjectType({
        name: 'SameName',
        fields: { f: { type: GraphQLString } },
      });

      const B = new GraphQLObjectType({
        name: 'SameName',
        fields: { f: { type: GraphQLString } },
      });

      const QueryType = new GraphQLObjectType({
        name: 'Query',
        fields: {
          a: { type: A },
          b: { type: B }
        }
      });

      return new GraphQLSchema({ query: QueryType });
    }).to.throw(
      'Schema must contain unique named types but contains multiple types ' +
      'named "SameName".'
    );
  });

  it('rejects a Schema which have same named objects implementing an interface', () => {
    expect(() => {
      const AnotherInterface = new GraphQLInterfaceType({
        name: 'AnotherInterface',
        resolveType: () => null,
        fields: { f: { type: GraphQLString } },
      });

      /* eslint-disable no-unused-vars */

      // Automatically included in Interface
      const FirstBadObject = new GraphQLObjectType({
        name: 'BadObject',
        interfaces: [ AnotherInterface ],
        fields: { f: { type: GraphQLString } },
      });

      // Automatically included in Interface
      const SecondBadObject = new GraphQLObjectType({
        name: 'BadObject',
        interfaces: [ AnotherInterface ],
        fields: { f: { type: GraphQLString } },
      });

      /* eslint-enable no-unused-vars */

      const QueryType = new GraphQLObjectType({
        name: 'Query',
        fields: {
          iface: { type: AnotherInterface },
        }
      });

      return new GraphQLSchema({ query: QueryType });
    }).to.throw(
      'Schema must contain unique named types but contains multiple types ' +
      'named "BadObject".'
    );
  });

});

describe('Type System: Objects must have fields', () => {

  it('accepts an Object type with fields object', () => {
    expect(
      () => schemaWithFieldType(new GraphQLObjectType({
        name: 'SomeObject',
        fields: {
          f: { type: GraphQLString }
        }
      }))
    ).not.to.throw();
  });

  it('accepts an Object type with a field function', () => {
    expect(
      () => schemaWithFieldType(new GraphQLObjectType({
        name: 'SomeObject',
        fields() {
          return {
            f: { type: GraphQLString }
          };
        }
      }))
    ).not.to.throw();
  });

  it('rejects an Object type with missing fields', () => {
    expect(
      () => schemaWithFieldType(new GraphQLObjectType({
        name: 'SomeObject',
      }))
    ).to.throw(
      'SomeObject fields must be an object with field names as keys or a ' +
      'function which returns such an object.'
    );
  });

  it('rejects an Object type with incorrectly named fields', () => {
    expect(
      () => schemaWithFieldType(new GraphQLObjectType({
        name: 'SomeObject',
        fields: { 'bad-name-with-dashes': { type: GraphQLString } }
      }))
    ).to.throw(
      'Names must match /^[_a-zA-Z][_a-zA-Z0-9]*$/ but "bad-name-with-dashes" does not.'
    );
  });

  it('rejects an Object type with incorrectly typed fields', () => {
    expect(
      () => schemaWithFieldType(new GraphQLObjectType({
        name: 'SomeObject',
        fields: [
          { field: GraphQLString }
        ]
      }))
    ).to.throw(
      'SomeObject fields must be an object with field names as keys or a ' +
      'function which returns such an object.'
    );
  });

  it('rejects an Object type with empty fields', () => {
    expect(
      () => schemaWithFieldType(new GraphQLObjectType({
        name: 'SomeObject',
        fields: {}
      }))
    ).to.throw(
      'SomeObject fields must be an object with field names as keys or a ' +
      'function which returns such an object.'
    );
  });

  it('rejects an Object type with a field function that returns nothing', () => {
    expect(
      () => schemaWithFieldType(new GraphQLObjectType({
        name: 'SomeObject',
        fields() {
          return;
        }
      }))
    ).to.throw(
      'SomeObject fields must be an object with field names as keys or a ' +
      'function which returns such an object.'
    );
  });

  it('rejects an Object type with a field function that returns empty', () => {
    expect(
      () => schemaWithFieldType(new GraphQLObjectType({
        name: 'SomeObject',
        fields() {
          return {};
        }
      }))
    ).to.throw(
      'SomeObject fields must be an object with field names as keys or a ' +
      'function which returns such an object.'
    );
  });

});


describe('Type System: Fields args must be properly named', () => {

  it('accepts field args with valid names', () => {
    expect(
      () => schemaWithFieldType(new GraphQLObjectType({
        name: 'SomeObject',
        fields: {
          goodField: {
            type: GraphQLString,
            args: {
              goodArg: { type: GraphQLString }
            }
          }
        }
      }))
    ).not.to.throw();
  });

  it('rejects field arg with invalid names', () => {
    expect(
      () => {
        const QueryType = new GraphQLObjectType({
          name: 'SomeObject',
          fields: {
            badField: {
              type: GraphQLString,
              args: {
                'bad-name-with-dashes': { type: GraphQLString }
              }
            }
          }
        });
        return new GraphQLSchema({ query: QueryType });
      }).to.throw(
      'Names must match /^[_a-zA-Z][_a-zA-Z0-9]*$/ but "bad-name-with-dashes" does not.'
    );
  });

});


describe('Type System: Fields args must be objects', () => {

  it('accepts an Object type with field args', () => {
    expect(
      () => schemaWithFieldType(new GraphQLObjectType({
        name: 'SomeObject',
        fields: {
          goodField: {
            type: GraphQLString,
            args: {
              goodArg: { type: GraphQLString }
            }
          }
        }
      }))
    ).not.to.throw();
  });

  it('rejects an Object type with incorrectly typed field args', () => {
    expect(
      () => schemaWithFieldType(new GraphQLObjectType({
        name: 'SomeObject',
        fields: {
          badField: {
            type: GraphQLString,
            args: [
              { badArg: GraphQLString }
            ]
          }
        }
      }))
    ).to.throw(
      'SomeObject.badField args must be an object with argument names as keys.'
    );
  });

});


describe('Type System: Object interfaces must be array', () => {

  it('accepts an Object type with array interfaces', () => {
    expect(() => {
      const AnotherInterfaceType = new GraphQLInterfaceType({
        name: 'AnotherInterface',
        resolveType: () => null,
        fields: { f: { type: GraphQLString } }
      });

      schemaWithFieldType(new GraphQLObjectType({
        name: 'SomeObject',
        interfaces: [ AnotherInterfaceType ],
        fields: { f: { type: GraphQLString } }
      }));
    }).not.to.throw();
  });

  it('accepts an Object type with interfaces as a function returning an array', () => {
    expect(() => {
      const AnotherInterfaceType = new GraphQLInterfaceType({
        name: 'AnotherInterface',
        resolveType: () => null,
        fields: { f: { type: GraphQLString } }
      });

      schemaWithFieldType(new GraphQLObjectType({
        name: 'SomeObject',
        interfaces() {
          return [ AnotherInterfaceType ];
        },
        fields: { f: { type: GraphQLString } }
      }));
    }).not.to.throw();
  });

  it('rejects an Object type with incorrectly typed interfaces', () => {
    expect(
      () => schemaWithFieldType(new GraphQLObjectType({
        name: 'SomeObject',
        interfaces: {},
        fields: { f: { type: GraphQLString } }
      }))
    ).to.throw(
      'SomeObject interfaces must be an Array or a function which returns an Array.'
    );
  });

  it('rejects an Object type with interfaces as a function returning an incorrect type', () => {
    expect(
      () => schemaWithFieldType(new GraphQLObjectType({
        name: 'SomeObject',
        interfaces() {
          return {};
        },
        fields: { f: { type: GraphQLString } }
      }))
    ).to.throw(
      'SomeObject interfaces must be an Array or a function which returns an Array.'
    );
  });
});


describe('Type System: Union types must be array', () => {

  it('accepts a Union type with array types', () => {
    expect(
      () => schemaWithFieldType(new GraphQLUnionType({
        name: 'SomeUnion',
        resolveType: () => null,
        types: [ SomeObjectType ],
      }))
    ).not.to.throw();
  });

  it('rejects a Union type without types', () => {
    expect(
      () => schemaWithFieldType(new GraphQLUnionType({
        name: 'SomeUnion',
        resolveType: () => null,
      }))
    ).to.throw(
      'Must provide Array of types for Union SomeUnion.'
    );
  });

  it('rejects a Union type with empty types', () => {
    expect(
      () => schemaWithFieldType(new GraphQLUnionType({
        name: 'SomeUnion',
        resolveType: () => null,
        types: []
      }))
    ).to.throw(
      'Must provide Array of types for Union SomeUnion.'
    );
  });

  it('rejects a Union type with incorrectly typed types', () => {
    expect(
      () => schemaWithFieldType(new GraphQLUnionType({
        name: 'SomeUnion',
        resolveType: () => null,
        types: {
          SomeObjectType
        },
      }))
    ).to.throw(
      'Must provide Array of types for Union SomeUnion.'
    );
  });

});


describe('Type System: Input Objects must have fields', () => {

  function schemaWithInputObject(inputObjectType) {
    return new GraphQLSchema({
      query: new GraphQLObjectType({
        name: 'Query',
        fields: {
          f: {
            type: GraphQLString,
            args: {
              badArg: { type: inputObjectType }
            }
          }
        }
      })
    });
  }

  it('accepts an Input Object type with fields', () => {
    expect(
      () => schemaWithInputObject(new GraphQLInputObjectType({
        name: 'SomeInputObject',
        fields: {
          f: { type: GraphQLString }
        }
      }))
    ).not.to.throw();
  });

  it('accepts an Input Object type with a field function', () => {
    expect(
      () => schemaWithInputObject(new GraphQLInputObjectType({
        name: 'SomeInputObject',
        fields() {
          return {
            f: { type: GraphQLString }
          };
        }
      }))
    ).not.to.throw();
  });

  it('rejects an Input Object type with missing fields', () => {
    expect(
      () => schemaWithInputObject(new GraphQLInputObjectType({
        name: 'SomeInputObject',
      }))
    ).to.throw(
      'SomeInputObject fields must be an object with field names as keys or a ' +
      'function which returns such an object.'
    );
  });

  it('rejects an Input Object type with incorrectly typed fields', () => {
    expect(
      () => schemaWithInputObject(new GraphQLInputObjectType({
        name: 'SomeInputObject',
        fields: [
          { field: GraphQLString }
        ]
      }))
    ).to.throw(
      'SomeInputObject fields must be an object with field names as keys or a ' +
      'function which returns such an object.'
    );
  });

  it('rejects an Input Object type with empty fields', () => {
    expect(
      () => schemaWithInputObject(new GraphQLInputObjectType({
        name: 'SomeInputObject',
        fields: {}
      }))
    ).to.throw(
      'SomeInputObject fields must be an object with field names as keys or a ' +
      'function which returns such an object.'
    );
  });

  it('rejects an Input Object type with a field function that returns nothing', () => {
    expect(
      () => schemaWithInputObject(new GraphQLInputObjectType({
        name: 'SomeInputObject',
        fields() {
          return;
        }
      }))
    ).to.throw(
      'SomeInputObject fields must be an object with field names as keys or a ' +
      'function which returns such an object.'
    );
  });

  it('rejects an Input Object type with a field function that returns empty', () => {
    expect(
      () => schemaWithInputObject(new GraphQLInputObjectType({
        name: 'SomeInputObject',
        fields() {
          return {};
        }
      }))
    ).to.throw(
      'SomeInputObject fields must be an object with field names as keys or a ' +
      'function which returns such an object.'
    );
  });

});


describe('Type System: Object types must be assertable', () => {

  it('accepts an Object type with an isTypeOf function', () => {
    expect(() => {
      schemaWithFieldType(new GraphQLObjectType({
        name: 'AnotherObject',
        isTypeOf: () => true,
        fields: { f: { type: GraphQLString } }
      }));
    }).not.to.throw();
  });

  it('rejects an Object type with an incorrect type for isTypeOf', () => {
    expect(() => {
      schemaWithFieldType(new GraphQLObjectType({
        name: 'AnotherObject',
        isTypeOf: {},
        fields: { f: { type: GraphQLString } }
      }));
    }).to.throw(
      'AnotherObject must provide "isTypeOf" as a function.'
    );
  });

});


describe('Type System: Interface types must be resolvable', () => {

  it('accepts an Interface type defining resolveType', () => {
    expect(() => {
      const AnotherInterfaceType = new GraphQLInterfaceType({
        name: 'AnotherInterface',
        resolveType: () => null,
        fields: { f: { type: GraphQLString } }
      });

      schemaWithFieldType(new GraphQLObjectType({
        name: 'SomeObject',
        interfaces: [ AnotherInterfaceType ],
        fields: { f: { type: GraphQLString } }
      }));
    }).not.to.throw();
  });

  it('accepts an Interface with implementing type defining isTypeOf', () => {
    expect(() => {
      const InterfaceTypeWithoutResolveType = new GraphQLInterfaceType({
        name: 'InterfaceTypeWithoutResolveType',
        fields: { f: { type: GraphQLString } }
      });

      schemaWithFieldType(new GraphQLObjectType({
        name: 'SomeObject',
        isTypeOf: () => true,
        interfaces: [ InterfaceTypeWithoutResolveType ],
        fields: { f: { type: GraphQLString } }
      }));
    }).not.to.throw();
  });

  it('accepts an Interface type defining resolveType with implementing type defining isTypeOf', () => {
    expect(() => {
      const AnotherInterfaceType = new GraphQLInterfaceType({
        name: 'AnotherInterface',
        resolveType: () => null,
        fields: { f: { type: GraphQLString } }
      });

      schemaWithFieldType(new GraphQLObjectType({
        name: 'SomeObject',
        isTypeOf: () => true,
        interfaces: [ AnotherInterfaceType ],
        fields: { f: { type: GraphQLString } }
      }));
    }).not.to.throw();
  });

  it('rejects an Interface type with an incorrect type for resolveType', () => {
    expect(() =>
      new GraphQLInterfaceType({
        name: 'AnotherInterface',
        resolveType: {},
        fields: { f: { type: GraphQLString } }
      })
    ).to.throw(
      'AnotherInterface must provide "resolveType" as a function.'
    );
  });

  it('rejects an Interface type not defining resolveType with implementing type not defining isTypeOf', () => {
    expect(() => {
      const InterfaceTypeWithoutResolveType = new GraphQLInterfaceType({
        name: 'InterfaceTypeWithoutResolveType',
        fields: { f: { type: GraphQLString } }
      });

      schemaWithFieldType(new GraphQLObjectType({
        name: 'SomeObject',
        interfaces: [ InterfaceTypeWithoutResolveType ],
        fields: { f: { type: GraphQLString } }
      }));
    }).to.throw(
      'Interface Type InterfaceTypeWithoutResolveType does not provide a ' +
      '"resolveType" function and implementing Type SomeObject does not ' +
      'provide a "isTypeOf" function. ' +
      'There is no way to resolve this implementing type during execution.'
    );
  });

});


describe('Type System: Union types must be resolvable', () => {

  it('accepts a Union type defining resolveType', () => {
    expect(() =>
      schemaWithFieldType(new GraphQLUnionType({
        name: 'SomeUnion',
        resolveType: () => null,
        types: [ SomeObjectType ],
      }))
    ).not.to.throw();
  });

  it('accepts a Union of Object types defining isTypeOf', () => {
    expect(() =>
      schemaWithFieldType(new GraphQLUnionType({
        name: 'SomeUnion',
        types: [ ObjectWithIsTypeOf ],
      }))
    ).not.to.throw();
  });

  it('accepts a Union type defining resolveType of Object types defining isTypeOf', () => {
    expect(() =>
      schemaWithFieldType(new GraphQLUnionType({
        name: 'SomeUnion',
        resolveType: () => null,
        types: [ ObjectWithIsTypeOf ],
      }))
    ).not.to.throw();
  });

  it('rejects an Interface type with an incorrect type for resolveType', () => {
    expect(() =>
      schemaWithFieldType(new GraphQLUnionType({
        name: 'SomeUnion',
        resolveType: {},
        types: [ ObjectWithIsTypeOf ],
      }))
    ).to.throw(
      'SomeUnion must provide "resolveType" as a function.'
    );
  });

  it('rejects a Union type not defining resolveType of Object types not defining isTypeOf', () => {
    expect(() =>
      schemaWithFieldType(new GraphQLUnionType({
        name: 'SomeUnion',
        types: [ SomeObjectType ],
      }))
    ).to.throw(
      'Union Type SomeUnion does not provide a "resolveType" function and ' +
      'possible Type SomeObject does not provide a "isTypeOf" function. ' +
      'There is no way to resolve this possible type during execution.'
    );
  });

});


describe('Type System: Scalar types must be serializable', () => {

  it('accepts a Scalar type defining serialize', () => {
    expect(() =>
      schemaWithFieldType(new GraphQLScalarType({
        name: 'SomeScalar',
        serialize: () => null,
      }))
    ).not.to.throw();
  });

  it('rejects a Scalar type not defining serialize', () => {
    expect(() =>
      schemaWithFieldType(new GraphQLScalarType({
        name: 'SomeScalar',
      }))
    ).to.throw(
      'SomeScalar must provide "serialize" function. If this custom Scalar ' +
      'is also used as an input type, ensure "parseValue" and "parseLiteral" ' +
      'functions are also provided.'
    );
  });

  it('rejects a Scalar type defining serialize with an incorrect type', () => {
    expect(() =>
      schemaWithFieldType(new GraphQLScalarType({
        name: 'SomeScalar',
        serialize: {}
      }))
    ).to.throw(
      'SomeScalar must provide "serialize" function. If this custom Scalar ' +
      'is also used as an input type, ensure "parseValue" and "parseLiteral" ' +
      'functions are also provided.'
    );
  });

  it('accepts a Scalar type defining parseValue and parseLiteral', () => {
    expect(() =>
      schemaWithFieldType(new GraphQLScalarType({
        name: 'SomeScalar',
        serialize: () => null,
        parseValue: () => null,
        parseLiteral: () => null,
      }))
    ).not.to.throw();
  });

  it('rejects a Scalar type defining parseValue but not parseLiteral', () => {
    expect(() =>
      schemaWithFieldType(new GraphQLScalarType({
        name: 'SomeScalar',
        serialize: () => null,
        parseValue: () => null,
      }))
    ).to.throw(
      'SomeScalar must provide both "parseValue" and "parseLiteral" functions.'
    );
  });

  it('rejects a Scalar type defining parseLiteral but not parseValue', () => {
    expect(() =>
      schemaWithFieldType(new GraphQLScalarType({
        name: 'SomeScalar',
        serialize: () => null,
        parseLiteral: () => null,
      }))
    ).to.throw(
      'SomeScalar must provide both "parseValue" and "parseLiteral" functions.'
    );
  });

  it('rejects a Scalar type defining parseValue and parseLiteral with an incorrect type', () => {
    expect(() =>
      schemaWithFieldType(new GraphQLScalarType({
        name: 'SomeScalar',
        serialize: () => null,
        parseValue: {},
        parseLiteral: {},
      }))
    ).to.throw(
      'SomeScalar must provide both "parseValue" and "parseLiteral" functions.'
    );
  });

});


describe('Type System: Enum types must be well defined', () => {

  it('accepts a well defined Enum type with empty value definition', () => {
    expect(() =>
      new GraphQLEnumType({
        name: 'SomeEnum',
        values: {
          FOO: {},
          BAR: {},
        }
      })
    ).not.to.throw();
  });

  it('accepts a well defined Enum type with internal value definition', () => {
    expect(() =>
      new GraphQLEnumType({
        name: 'SomeEnum',
        values: {
          FOO: { value: 10 },
          BAR: { value: 20 },
        }
      })
    ).not.to.throw();
  });

  it('rejects an Enum type without values', () => {
    expect(() =>
      new GraphQLEnumType({
        name: 'SomeEnum',
      })
    ).to.throw(
      'SomeEnum values must be an object with value names as keys.'
    );
  });

  it('rejects an Enum type with empty values', () => {
    expect(() =>
      new GraphQLEnumType({
        name: 'SomeEnum',
        values: {}
      })
    ).to.throw(
      'SomeEnum values must be an object with value names as keys.'
    );
  });

  it('rejects an Enum type with incorrectly typed values', () => {
    expect(() =>
      new GraphQLEnumType({
        name: 'SomeEnum',
        values: [
          { FOO: 10 }
        ]
      })
    ).to.throw(
      'SomeEnum values must be an object with value names as keys.'
    );
  });

  it('rejects an Enum type with missing value definition', () => {
    expect(() =>
      new GraphQLEnumType({
        name: 'SomeEnum',
        values: {
          FOO: null
        }
      })
    ).to.throw(
      'SomeEnum.FOO must refer to an object with a "value" key representing ' +
      'an internal value but got: null.'
    );
  });

  it('rejects an Enum type with incorrectly typed value definition', () => {
    expect(() =>
      new GraphQLEnumType({
        name: 'SomeEnum',
        values: {
          FOO: 10
        }
      })
    ).to.throw(
      'SomeEnum.FOO must refer to an object with a "value" key representing ' +
      'an internal value but got: 10.'
    );
  });

});


describe('Type System: Object fields must have output types', () => {

  function schemaWithObjectFieldOfType(fieldType) {
    const BadObjectType = new GraphQLObjectType({
      name: 'BadObject',
      fields: {
        badField: { type: fieldType }
      }
    });

    return new GraphQLSchema({
      query: new GraphQLObjectType({
        name: 'Query',
        fields: {
          f: { type: BadObjectType }
        }
      })
    });
  }

  outputTypes.forEach(type => {
    it(`accepts an output type as an Object field type: ${type}`, () => {
      expect(() => schemaWithObjectFieldOfType(type)).not.to.throw();
    });
  });

  it('rejects an empty Object field type', () => {
    expect(() => schemaWithObjectFieldOfType(undefined)).to.throw(
      'BadObject.badField field type must be Output Type but got: undefined.'
    );
  });

  notOutputTypes.forEach(type => {
    it(`rejects a non-output type as an Object field type: ${type}`, () => {
      expect(() => schemaWithObjectFieldOfType(type)).to.throw(
        `BadObject.badField field type must be Output Type but got: ${type}.`
      );
    });
  });

});


describe('Type System: Objects can only implement interfaces', () => {

  function schemaWithObjectImplementingType(implementedType) {
    const BadObjectType = new GraphQLObjectType({
      name: 'BadObject',
      interfaces: [ implementedType ],
      fields: { f: { type: GraphQLString } }
    });

    return new GraphQLSchema({
      query: new GraphQLObjectType({
        name: 'Query',
        fields: {
          f: { type: BadObjectType }
        }
      })
    });
  }

  it('accepts an Object implementing an Interface', () => {
    expect(() => {
      const AnotherInterfaceType = new GraphQLInterfaceType({
        name: 'AnotherInterface',
        resolveType: () => null,
        fields: { f: { type: GraphQLString } }
      });

      schemaWithObjectImplementingType(AnotherInterfaceType);
    }).not.to.throw();
  });

  const notInterfaceTypes = withModifiers([
    SomeScalarType,
    SomeEnumType,
    SomeObjectType,
    SomeUnionType,
    SomeInputObjectType,
  ]);

  notInterfaceTypes.forEach(type => {
    it(`rejects an Object implementing a non-Interface type: ${type}`, () => {
      expect(() => schemaWithObjectImplementingType(type)).to.throw(
        `BadObject may only implement Interface types, it cannot implement: ${type}.`
      );
    });
  });

});


describe('Type System: Unions must represent Object types', () => {

  function schemaWithUnionOfType(type) {
    const BadUnionType = new GraphQLUnionType({
      name: 'BadUnion',
      resolveType: () => null,
      types: [ type ],
    });

    return new GraphQLSchema({
      query: new GraphQLObjectType({
        name: 'Query',
        fields: {
          f: { type: BadUnionType }
        }
      })
    });
  }

  it('accepts a Union of an Object Type', () => {
    expect(() =>
      schemaWithUnionOfType(SomeObjectType)
    ).not.to.throw();
  });

  const notObjectTypes = withModifiers([
    SomeScalarType,
    SomeEnumType,
    SomeInterfaceType,
    SomeUnionType,
    SomeInputObjectType,
  ]);

  notObjectTypes.forEach(type => {
    it(`rejects a Union of a non-Object type: ${type}`, () => {
      expect(() => schemaWithUnionOfType(type)).to.throw(
        `BadUnion may only contain Object types, it cannot contain: ${type}.`
      );
    });
  });

});


describe('Type System: Interface fields must have output types', () => {

  function schemaWithInterfaceFieldOfType(fieldType) {
    const BadInterfaceType = new GraphQLInterfaceType({
      name: 'BadInterface',
      fields: {
        badField: { type: fieldType }
      }
    });

    return new GraphQLSchema({
      query: new GraphQLObjectType({
        name: 'Query',
        fields: {
          f: { type: BadInterfaceType }
        }
      })
    });
  }

  outputTypes.forEach(type => {
    it(`accepts an output type as an Interface field type: ${type}`, () => {
      expect(() => schemaWithInterfaceFieldOfType(type)).not.to.throw();
    });
  });

  it('rejects an empty Interface field type', () => {
    expect(() => schemaWithInterfaceFieldOfType(undefined)).to.throw(
      'BadInterface.badField field type must be Output Type but got: undefined.'
    );
  });

  notOutputTypes.forEach(type => {
    it(`rejects a non-output type as an Interface field type: ${type}`, () => {
      expect(() => schemaWithInterfaceFieldOfType(type)).to.throw(
        `BadInterface.badField field type must be Output Type but got: ${type}.`
      );
    });
  });

});


describe('Type System: Field arguments must have input types', () => {

  function schemaWithArgOfType(argType) {
    const BadObjectType = new GraphQLObjectType({
      name: 'BadObject',
      fields: {
        badField: {
          type: GraphQLString,
          args: {
            badArg: { type: argType }
          }
        }
      }
    });

    return new GraphQLSchema({
      query: new GraphQLObjectType({
        name: 'Query',
        fields: {
          f: { type: BadObjectType }
        }
      })
    });
  }

  inputTypes.forEach(type => {
    it(`accepts an input type as a field arg type: ${type}`, () => {
      expect(() => schemaWithArgOfType(type)).not.to.throw();
    });
  });

  it('rejects an empty field arg type', () => {
    expect(() => schemaWithArgOfType(undefined)).to.throw(
      'BadObject.badField(badArg:) argument type must be Input Type but got: undefined.'
    );
  });

  notInputTypes.forEach(type => {
    it(`rejects a non-input type as a field arg type: ${type}`, () => {
      expect(() => schemaWithArgOfType(type)).to.throw(
        `BadObject.badField(badArg:) argument type must be Input Type but got: ${type}.`
      );
    });
  });

});


describe('Type System: Input Object fields must have input types', () => {

  function schemaWithInputFieldOfType(inputFieldType) {
    const BadInputObjectType = new GraphQLInputObjectType({
      name: 'BadInputObject',
      fields: {
        badField: { type: inputFieldType }
      }
    });

    return new GraphQLSchema({
      query: new GraphQLObjectType({
        name: 'Query',
        fields: {
          f: {
            type: GraphQLString,
            args: {
              badArg: { type: BadInputObjectType }
            }
          }
        }
      })
    });
  }

  inputTypes.forEach(type => {
    it(`accepts an input type as an input field type: ${type}`, () => {
      expect(() => schemaWithInputFieldOfType(type)).not.to.throw();
    });
  });

  it('rejects an empty input field type', () => {
    expect(() => schemaWithInputFieldOfType(undefined)).to.throw(
      'BadInputObject.badField field type must be Input Type but got: undefined.'
    );
  });

  notInputTypes.forEach(type => {
    it(`rejects a non-input type as an input field type: ${type}`, () => {
      expect(() => schemaWithInputFieldOfType(type)).to.throw(
        `BadInputObject.badField field type must be Input Type but got: ${type}.`
      );
    });
  });

});


describe('Type System: List must accept GraphQL types', () => {

  const types = withModifiers([
    GraphQLString,
    SomeScalarType,
    SomeObjectType,
    SomeUnionType,
    SomeInterfaceType,
    SomeEnumType,
    SomeInputObjectType,
  ]);

  const notTypes = [
    {},
    String,
    undefined,
    null,
  ];

  types.forEach(type => {
    it(`accepts an type as item type of list: ${type}`, () => {
      expect(() => new GraphQLList(type)).not.to.throw();
    });
  });

  notTypes.forEach(type => {
    it(`rejects a non-type as item type of list: ${type}`, () => {
      expect(() => new GraphQLList(type)).to.throw(
        `Can only create List of a GraphQLType but got: ${type}.`
      );
    });
  });

});


describe('Type System: NonNull must accept GraphQL types', () => {

  const nullableTypes = [
    GraphQLString,
    SomeScalarType,
    SomeObjectType,
    SomeUnionType,
    SomeInterfaceType,
    SomeEnumType,
    SomeInputObjectType,
    new GraphQLList(GraphQLString),
    new GraphQLList(new GraphQLNonNull(GraphQLString)),
  ];

  const notNullableTypes = [
    new GraphQLNonNull(GraphQLString),
    {},
    String,
    undefined,
    null,
  ];

  nullableTypes.forEach(type => {
    it(`accepts an type as nullable type of non-null: ${type}`, () => {
      expect(() => new GraphQLNonNull(type)).not.to.throw();
    });
  });

  notNullableTypes.forEach(type => {
    it(`rejects a non-type as nullable type of non-null: ${type}`, () => {
      expect(() => new GraphQLNonNull(type)).to.throw(
        `Can only create NonNull of a Nullable GraphQLType but got: ${type}.`
      );
    });
  });

});


describe('Objects must adhere to Interface they implement', () => {

  it('accepts an Object which implements an Interface', () => {
    expect(() => {
      const AnotherInterface = new GraphQLInterfaceType({
        name: 'AnotherInterface',
        resolveType: () => null,
        fields: {
          field: {
            type: GraphQLString,
            args: {
              input: { type: GraphQLString }
            }
          }
        }
      });

      const AnotherObject = new GraphQLObjectType({
        name: 'AnotherObject',
        interfaces: [ AnotherInterface ],
        fields: {
          field: {
            type: GraphQLString,
            args: {
              input: { type: GraphQLString }
            }
          }
        }
      });

      return schemaWithFieldType(AnotherObject);
    }).not.to.throw();
  });

  it('accepts an Object which implements an Interface along with more fields', () => {
    expect(() => {
      const AnotherInterface = new GraphQLInterfaceType({
        name: 'AnotherInterface',
        resolveType: () => null,
        fields: {
          field: {
            type: GraphQLString,
            args: {
              input: { type: GraphQLString },
            }
          }
        }
      });

      const AnotherObject = new GraphQLObjectType({
        name: 'AnotherObject',
        interfaces: [ AnotherInterface ],
        fields: {
          field: {
            type: GraphQLString,
            args: {
              input: { type: GraphQLString },
            }
          },
          anotherfield: { type: GraphQLString }
        }
      });

      return schemaWithFieldType(AnotherObject);
    }).not.to.throw();
  });

  it('accepts an Object which implements an Interface field along with additional optional arguments', () => {
    expect(() => {
      const AnotherInterface = new GraphQLInterfaceType({
        name: 'AnotherInterface',
        resolveType: () => null,
        fields: {
          field: {
            type: GraphQLString,
            args: {
              input: { type: GraphQLString },
            }
          }
        }
      });

      const AnotherObject = new GraphQLObjectType({
        name: 'AnotherObject',
        interfaces: [ AnotherInterface ],
        fields: {
          field: {
            type: GraphQLString,
            args: {
              input: { type: GraphQLString },
              anotherInput: { type: GraphQLString },
            }
          }
        }
      });

      return schemaWithFieldType(AnotherObject);
    }).not.to.throw();
  });

  it('rejects an Object which implements an Interface field along with additional required arguments', () => {
    expect(() => {
      const AnotherInterface = new GraphQLInterfaceType({
        name: 'AnotherInterface',
        resolveType: () => null,
        fields: {
          field: {
            type: GraphQLString,
            args: {
              input: { type: GraphQLString },
            }
          }
        }
      });

      const AnotherObject = new GraphQLObjectType({
        name: 'AnotherObject',
        interfaces: [ AnotherInterface ],
        fields: {
          field: {
            type: GraphQLString,
            args: {
              input: { type: GraphQLString },
              anotherInput: { type: new GraphQLNonNull(GraphQLString) },
            }
          }
        }
      });

      return schemaWithFieldType(AnotherObject);
    }).to.throw(
      'AnotherObject.field(anotherInput:) is of required type "String!" but ' +
      'is not also provided by the interface AnotherInterface.field.'
    );
  });

  it('rejects an Object missing an Interface field', () => {
    expect(() => {
      const AnotherInterface = new GraphQLInterfaceType({
        name: 'AnotherInterface',
        resolveType: () => null,
        fields: {
          field: {
            type: GraphQLString,
            args: {
              input: { type: GraphQLString },
            }
          }
        }
      });

      const AnotherObject = new GraphQLObjectType({
        name: 'AnotherObject',
        interfaces: [ AnotherInterface ],
        fields: {
          anotherfield: { type: GraphQLString }
        }
      });

      return schemaWithFieldType(AnotherObject);
    }).to.throw(
      '"AnotherInterface" expects field "field" but ' +
      '"AnotherObject" does not provide it.'
    );
  });

  it('rejects an Object with an incorrectly typed Interface field', () => {
    expect(() => {
      const AnotherInterface = new GraphQLInterfaceType({
        name: 'AnotherInterface',
        resolveType: () => null,
        fields: {
          field: { type: GraphQLString }
        }
      });

      const AnotherObject = new GraphQLObjectType({
        name: 'AnotherObject',
        interfaces: [ AnotherInterface ],
        fields: {
          field: { type: SomeScalarType }
        }
      });

      return schemaWithFieldType(AnotherObject);
    }).to.throw(
      'AnotherInterface.field expects type "String" but ' +
      'AnotherObject.field provides type "SomeScalar".'
    );
  });

  it('rejects an Object with a differently typed Interface field', () => {
    expect(() => {
      const TypeA = new GraphQLObjectType({
        name: 'A',
        fields: {
          foo: { type: GraphQLString }
        }
      });

      const TypeB = new GraphQLObjectType({
        name: 'B',
        fields: {
          foo: { type: GraphQLString }
        }
      });

      const AnotherInterface = new GraphQLInterfaceType({
        name: 'AnotherInterface',
        resolveType: () => null,
        fields: {
          field: { type: TypeA }
        }
      });

      const AnotherObject = new GraphQLObjectType({
        name: 'AnotherObject',
        interfaces: [ AnotherInterface ],
        fields: {
          field: { type: TypeB }
        }
      });

      return schemaWithFieldType(AnotherObject);
    }).to.throw(
      'AnotherInterface.field expects type "A" but ' +
      'AnotherObject.field provides type "B".'
    );
  });

  it('accepts an Object with a subtyped Interface field (interface)', () => {
    expect(() => {
      const AnotherInterface = new GraphQLInterfaceType({
        name: 'AnotherInterface',
        resolveType: () => null,
        fields: () => ({
          field: { type: AnotherInterface }
        })
      });

      const AnotherObject = new GraphQLObjectType({
        name: 'AnotherObject',
        interfaces: [ AnotherInterface ],
        fields: () => ({
          field: { type: AnotherObject }
        })
      });

      return schemaWithFieldType(AnotherObject);
    }).not.to.throw();
  });

  it('accepts an Object with a subtyped Interface field (union)', () => {
    expect(() => {
      const AnotherInterface = new GraphQLInterfaceType({
        name: 'AnotherInterface',
        resolveType: () => null,
        fields: {
          field: { type: SomeUnionType }
        }
      });

      const AnotherObject = new GraphQLObjectType({
        name: 'AnotherObject',
        interfaces: [ AnotherInterface ],
        fields: {
          field: { type: SomeObjectType }
        }
      });

      return schemaWithFieldType(AnotherObject);
    }).not.to.throw();
  });

  it('rejects an Object missing an Interface argument', () => {
    expect(() => {
      const AnotherInterface = new GraphQLInterfaceType({
        name: 'AnotherInterface',
        resolveType: () => null,
        fields: {
          field: {
            type: GraphQLString,
            args: {
              input: { type: GraphQLString },
            }
          }
        }
      });

      const AnotherObject = new GraphQLObjectType({
        name: 'AnotherObject',
        interfaces: [ AnotherInterface ],
        fields: {
          field: {
            type: GraphQLString,
          }
        }
      });

      return schemaWithFieldType(AnotherObject);
    }).to.throw(
      'AnotherInterface.field expects argument "input" but ' +
      'AnotherObject.field does not provide it.'
    );
  });

  it('rejects an Object with an incorrectly typed Interface argument', () => {
    expect(() => {
      const AnotherInterface = new GraphQLInterfaceType({
        name: 'AnotherInterface',
        resolveType: () => null,
        fields: {
          field: {
            type: GraphQLString,
            args: {
              input: { type: GraphQLString },
            }
          }
        }
      });

      const AnotherObject = new GraphQLObjectType({
        name: 'AnotherObject',
        interfaces: [ AnotherInterface ],
        fields: {
          field: {
            type: GraphQLString,
            args: {
              input: { type: SomeScalarType },
            }
          }
        }
      });

      return schemaWithFieldType(AnotherObject);
    }).to.throw(
      'AnotherInterface.field(input:) expects type "String" but ' +
      'AnotherObject.field(input:) provides type "SomeScalar".'
    );
  });

  it('accepts an Object with an equivalently modified Interface field type', () => {
    expect(() => {
      const AnotherInterface = new GraphQLInterfaceType({
        name: 'AnotherInterface',
        resolveType: () => null,
        fields: {
          field: { type: new GraphQLNonNull(new GraphQLList(GraphQLString)) }
        }
      });

      const AnotherObject = new GraphQLObjectType({
        name: 'AnotherObject',
        interfaces: [ AnotherInterface ],
        fields: {
          field: { type: new GraphQLNonNull(new GraphQLList(GraphQLString)) }
        }
      });

      return schemaWithFieldType(AnotherObject);
    }).not.to.throw();
  });

  it('rejects an Object with a non-list Interface field list type', () => {
    expect(() => {
      const AnotherInterface = new GraphQLInterfaceType({
        name: 'AnotherInterface',
        resolveType: () => null,
        fields: {
          field: { type: new GraphQLList(GraphQLString) }
        }
      });

      const AnotherObject = new GraphQLObjectType({
        name: 'AnotherObject',
        interfaces: [ AnotherInterface ],
        fields: {
          field: { type: GraphQLString }
        }
      });

      return schemaWithFieldType(AnotherObject);
    }).to.throw(
      'AnotherInterface.field expects type "[String]" but ' +
      'AnotherObject.field provides type "String".'
    );
  });

  it('rejects an Object with a list Interface field non-list type', () => {
    expect(() => {
      const AnotherInterface = new GraphQLInterfaceType({
        name: 'AnotherInterface',
        resolveType: () => null,
        fields: {
          field: { type: GraphQLString }
        }
      });

      const AnotherObject = new GraphQLObjectType({
        name: 'AnotherObject',
        interfaces: [ AnotherInterface ],
        fields: {
          field: { type: new GraphQLList(GraphQLString) }
        }
      });

      return schemaWithFieldType(AnotherObject);
    }).to.throw(
      'AnotherInterface.field expects type "String" but ' +
      'AnotherObject.field provides type "[String]".'
    );
  });

  it('accepts an Object with a subset non-null Interface field type', () => {
    expect(() => {
      const AnotherInterface = new GraphQLInterfaceType({
        name: 'AnotherInterface',
        resolveType: () => null,
        fields: {
          field: { type: GraphQLString }
        }
      });

      const AnotherObject = new GraphQLObjectType({
        name: 'AnotherObject',
        interfaces: [ AnotherInterface ],
        fields: {
          field: { type: new GraphQLNonNull(GraphQLString) }
        }
      });

      return schemaWithFieldType(AnotherObject);
    }).not.to.throw();
  });

  it('rejects an Object with a superset nullable Interface field type', () => {
    expect(() => {
      const AnotherInterface = new GraphQLInterfaceType({
        name: 'AnotherInterface',
        resolveType: () => null,
        fields: {
          field: { type: new GraphQLNonNull(GraphQLString) }
        }
      });

      const AnotherObject = new GraphQLObjectType({
        name: 'AnotherObject',
        interfaces: [ AnotherInterface ],
        fields: {
          field: { type: GraphQLString }
        }
      });

      return schemaWithFieldType(AnotherObject);
    }).to.throw(
      'AnotherInterface.field expects type "String!" but ' +
      'AnotherObject.field provides type "String".'
    );
  });

  it('does not allow isDeprecated without deprecationReason on field', () => {
    expect(() => {
      const OldObject = new GraphQLObjectType({
        name: 'OldObject',
        fields: {
          field: {
            type: GraphQLString,
            isDeprecated: true
          }
        }
      });

      return schemaWithFieldType(OldObject);
    }).to.throw(
      'OldObject.field should provide "deprecationReason" instead ' +
      'of "isDeprecated".'
    );
  });

  it('does not allow isDeprecated without deprecationReason on enum', () => {
    expect(() =>
      new GraphQLEnumType({
        name: 'SomeEnum',
        values: {
          value: { isDeprecated: true }
        }
      })
    ).to.throw(
      'SomeEnum.value should provide "deprecationReason" instead ' +
      'of "isDeprecated".'
    );
  });

});
