/**
 *  Copyright (c) 2015, Facebook, Inc.
 *  All rights reserved.
 *
 *  This source code is licensed under the BSD-style license found in the
 *  LICENSE file in the root directory of this source tree. An additional grant
 *  of patent rights can be found in the PATENTS file in the same directory.
 */

// 80+ char lines are useful in describe/it, so ignore in this file.
/*eslint-disable max-len */

import { expect } from 'chai';
import { describe, it } from 'mocha';
import { execute } from '../executor';
import { parse } from '../../language';
import {
  GraphQLSchema,
  GraphQLObjectType,
  GraphQLInt,
  GraphQLList,
  GraphQLNonNull
} from '../../type';

var data = {
  list() { return [1, 2]; },
  listOfNonNull() { return [1, 2]; },
  nonNullList() { return [1, 2]; },
  nonNullListOfNonNull() { return [1, 2]; },
  listContainsNull() { return [1, null, 2]; },
  listOfNonNullContainsNull() { return [1, null, 2]; },
  nonNullListContainsNull() { return [1, null, 2]; },
  nonNullListOfNonNullContainsNull() { return [1, null, 2]; },
  listReturnsNull() { return null; },
  listOfNonNullReturnsNull() { return null; },
  nonNullListReturnsNull() { return null; },
  nonNullListOfNonNullReturnsNull() { return null; },
  nest() {
    return data;
  },
};

var dataType = new GraphQLObjectType({
  name: 'DataType',
  fields: () => ({
    list: {
      type: new GraphQLList(GraphQLInt)
    },
    listOfNonNull: {
      type: new GraphQLList(new GraphQLNonNull(GraphQLInt))
    },
    nonNullList: {
      type: new GraphQLNonNull(new GraphQLList(GraphQLInt))
    },
    nonNullListOfNonNull: {
      type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(GraphQLInt)))
    },
    listContainsNull: {
      type: new GraphQLList(GraphQLInt)
    },
    listOfNonNullContainsNull: {
      type: new GraphQLList(new GraphQLNonNull(GraphQLInt))
    },
    nonNullListContainsNull: {
      type: new GraphQLNonNull(new GraphQLList(GraphQLInt))
    },
    nonNullListOfNonNullContainsNull: {
      type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(GraphQLInt)))
    },
    listReturnsNull: {
      type: new GraphQLList(GraphQLInt)
    },
    listOfNonNullReturnsNull: {
      type: new GraphQLList(new GraphQLNonNull(GraphQLInt))
    },
    nonNullListReturnsNull: {
      type: new GraphQLNonNull(new GraphQLList(GraphQLInt))
    },
    nonNullListOfNonNullReturnsNull: {
      type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(GraphQLInt)))
    },
    nest: { type: dataType },
  })
});
var schema = new GraphQLSchema({
  query: dataType
});

describe('Execute: Handles list nullability', () => {

  it('handles lists when they return non-null values', () => {
    var doc = `
      query Q {
        nest {
          list,
        }
      }
    `;

    var ast = parse(doc);

    var expected = {
      data: {
        nest: {
          list: [1,2],
        }
      }
    };

    return expect(execute(schema, data, ast, 'Q', {}))
                  .to.become(expected);
  });

  it('handles lists of non-nulls when they return non-null values', () => {
    var doc = `
      query Q {
        nest {
          listOfNonNull,
        }
      }
    `;

    var ast = parse(doc);

    var expected = {
      data: {
        nest: {
          listOfNonNull: [1,2],
        }
      }
    };

    return expect(execute(schema, data, ast, 'Q', {}))
                  .to.become(expected);
  });

  it('handles non-null lists of when they return non-null values', () => {
    var doc = `
      query Q {
        nest {
          nonNullList,
        }
      }
    `;

    var ast = parse(doc);

    var expected = {
      data: {
        nest: {
          nonNullList: [1,2],
        }
      }
    };

    return expect(execute(schema, data, ast, 'Q', {}))
                  .to.become(expected);
  });

  it('handles non-null lists of non-nulls when they return non-null values', () => {
    var doc = `
      query Q {
        nest {
          nonNullListOfNonNull,
        }
      }
    `;

    var ast = parse(doc);

    var expected = {
      data: {
        nest: {
          nonNullListOfNonNull: [1,2],
        }
      }
    };

    return expect(execute(schema, data, ast, 'Q', {}))
                  .to.become(expected);
  });

  it('handles lists when they return null as a value', () => {
    var doc = `
      query Q {
        nest {
          listContainsNull,
        }
      }
    `;

    var ast = parse(doc);

    var expected = {
      data: {
        nest: {
          listContainsNull: [1,null,2],
        }
      }
    };

    return expect(execute(schema, data, ast, 'Q', {}))
                  .to.become(expected);
  });

  it('handles lists of non-nulls when they return null as a value', () => {
    var doc = `
      query Q {
        nest {
          listOfNonNullContainsNull,
        }
      }
    `;

    var ast = parse(doc);

    var expected = {
      data: {
        nest: {
          listOfNonNullContainsNull: null
        }
      },
      errors: [
        { message: 'Cannot return null for non-nullable type.',
          locations: [ { line: 4, column: 11 } ] }
      ]
    };

    return expect(execute(schema, data, ast, 'Q', {}))
                  .to.become(expected);
  });

  it('handles non-null lists of when they return null as a value', () => {
    var doc = `
      query Q {
        nest {
          nonNullListContainsNull,
        }
      }
    `;

    var ast = parse(doc);

    var expected = {
      data: {
        nest: {
          nonNullListContainsNull: [1,null,2],
        }
      }
    };

    return expect(execute(schema, data, ast, 'Q', {}))
                  .to.become(expected);
  });

  it('handles non-null lists of non-nulls when they return null as a value', () => {
    var doc = `
      query Q {
        nest {
          nonNullListOfNonNullContainsNull,
        }
      }
    `;

    var ast = parse(doc);

    var expected = {
      data: {
        nest: null
      },
      errors: [
        { message: 'Cannot return null for non-nullable type.',
          locations: [ { line: 4, column: 11 } ] }
      ]
    };

    return expect(execute(schema, data, ast, 'Q', {}))
                  .to.become(expected);
  });

  it('handles lists when they return null', () => {
    var doc = `
      query Q {
        nest {
          listReturnsNull,
        }
      }
    `;

    var ast = parse(doc);

    var expected = {
      data: {
        nest: {
          listReturnsNull: null
        }
      }
    };

    return expect(execute(schema, data, ast, 'Q', {}))
                  .to.become(expected);
  });

  it('handles lists of non-nulls when they return null', () => {
    var doc = `
      query Q {
        nest {
          listOfNonNullReturnsNull,
        }
      }
    `;

    var ast = parse(doc);

    var expected = {
      data: {
        nest: {
          listOfNonNullReturnsNull: null
        }
      }
    };

    return expect(execute(schema, data, ast, 'Q', {}))
                  .to.become(expected);
  });

  it('handles non-null lists of when they return null', () => {
    var doc = `
      query Q {
        nest {
          nonNullListReturnsNull,
        }
      }
    `;

    var ast = parse(doc);

    var expected = {
      data: {
        nest: null,
      },
      errors: [
        { message: 'Cannot return null for non-nullable type.',
          locations: [ { line: 4, column: 11 } ] }
      ]
    };

    return expect(execute(schema, data, ast, 'Q', {}))
                  .to.become(expected);
  });

  it('handles non-null lists of non-nulls when they return null', () => {
    var doc = `
      query Q {
        nest {
          nonNullListOfNonNullReturnsNull,
        }
      }
    `;

    var ast = parse(doc);

    var expected = {
      data: {
        nest: null
      },
      errors: [
        { message: 'Cannot return null for non-nullable type.',
          locations: [ { line: 4, column: 11 } ] }
      ]
    };

    return expect(execute(schema, data, ast, 'Q', {}))
                  .to.become(expected);
  });
});
