import { expect } from 'chai';
import { describe, it } from 'mocha';

import type {
  ListNullabilityNode,
  NullabilityDesignatorNode,
} from '../../language/ast';
import { Kind } from '../../language/kinds';

import { GraphQLList, GraphQLNonNull } from '../../type/definition';
import { GraphQLInt } from '../../type/scalars';

import { applyRequiredStatus } from '../applyRequiredStatus';

describe('astFromValue', () => {
  it('applyRequiredStatus smoke test', () => {
    const type = GraphQLInt;
    const nullabilityNode = undefined;
    const outputType = applyRequiredStatus(type, nullabilityNode);
    const expectedOutputType = GraphQLInt;

    expect(outputType).to.deep.equal(expectedOutputType);
  });

  it('applyRequiredStatus produces correct output types with no overrides', () => {
    // [[[!]]!]!
    const type = new GraphQLNonNull(
      new GraphQLList(
        new GraphQLNonNull(
          new GraphQLList(new GraphQLList(new GraphQLNonNull(GraphQLInt))),
        ),
      ),
    );

    // [[[]]]
    const nullabilityNode: NullabilityDesignatorNode | ListNullabilityNode = {
      kind: Kind.LIST_NULLABILITY,
      element: {
        kind: Kind.LIST_NULLABILITY,
        element: {
          kind: Kind.LIST_NULLABILITY,
          element: undefined,
        },
      },
    };

    const outputType = applyRequiredStatus(type, nullabilityNode);
    // [[[!]]!]!
    const expectedOutputType = new GraphQLNonNull(
      new GraphQLList(
        new GraphQLNonNull(
          new GraphQLList(new GraphQLList(new GraphQLNonNull(GraphQLInt))),
        ),
      ),
    );

    expect(outputType).to.deep.equal(expectedOutputType);
  });

  it('applyRequiredStatus produces correct output types with required overrides', () => {
    // [[[!]]!]!
    const type = new GraphQLNonNull(
      new GraphQLList(
        new GraphQLNonNull(
          new GraphQLList(new GraphQLList(new GraphQLNonNull(GraphQLInt))),
        ),
      ),
    );

    // [[[!]!]!]!
    const nullabilityNode: NullabilityDesignatorNode | ListNullabilityNode = {
      kind: Kind.REQUIRED_DESIGNATOR,
      element: {
        kind: Kind.LIST_NULLABILITY,
        element: {
          kind: Kind.REQUIRED_DESIGNATOR,
          element: {
            kind: Kind.LIST_NULLABILITY,
            element: {
              kind: Kind.REQUIRED_DESIGNATOR,
              element: {
                kind: Kind.LIST_NULLABILITY,
                element: {
                  kind: Kind.REQUIRED_DESIGNATOR,
                  element: undefined,
                },
              },
            },
          },
        },
      },
    };

    const outputType = applyRequiredStatus(type, nullabilityNode);
    // [[[!]!]!]!
    const expectedOutputType = new GraphQLNonNull(
      new GraphQLList(
        new GraphQLNonNull(
          new GraphQLList(
            new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(GraphQLInt))),
          ),
        ),
      ),
    );

    expect(outputType).to.deep.equal(expectedOutputType);
  });

  it('applyRequiredStatus produces correct output types with optional overrides', () => {
    // [[[!]]!]!
    const type = new GraphQLNonNull(
      new GraphQLList(
        new GraphQLNonNull(
          new GraphQLList(new GraphQLList(new GraphQLNonNull(GraphQLInt))),
        ),
      ),
    );

    // [[[?]?]?]?
    const nullabilityNode: NullabilityDesignatorNode | ListNullabilityNode = {
      kind: Kind.OPTIONAL_DESIGNATOR,
      element: {
        kind: Kind.LIST_NULLABILITY,
        element: {
          kind: Kind.OPTIONAL_DESIGNATOR,
          element: {
            kind: Kind.LIST_NULLABILITY,
            element: {
              kind: Kind.OPTIONAL_DESIGNATOR,
              element: {
                kind: Kind.LIST_NULLABILITY,
                element: {
                  kind: Kind.OPTIONAL_DESIGNATOR,
                  element: undefined,
                },
              },
            },
          },
        },
      },
    };

    const outputType = applyRequiredStatus(type, nullabilityNode);
    // [[[]]]
    const expectedOutputType = new GraphQLList(
      new GraphQLList(new GraphQLList(GraphQLInt)),
    );

    expect(outputType).to.deep.equal(expectedOutputType);
  });

  it('applyRequiredStatus throws error when modifier is too deep', () => {
    // [[[!]]!]!
    const type = new GraphQLNonNull(
      new GraphQLList(
        new GraphQLNonNull(
          new GraphQLList(new GraphQLList(new GraphQLNonNull(GraphQLInt))),
        ),
      ),
    );

    // [[[]]]
    const nullabilityNode: NullabilityDesignatorNode | ListNullabilityNode = {
      kind: Kind.LIST_NULLABILITY,
      element: {
        kind: Kind.LIST_NULLABILITY,
        element: {
          kind: Kind.LIST_NULLABILITY,
          element: {
            kind: Kind.LIST_NULLABILITY,
            element: undefined,
          },
        },
      },
    };

    expect(() => {
      applyRequiredStatus(type, nullabilityNode);
    }).to.throw('List nullability modifier is too deep.');
  });

  it('applyRequiredStatus throws error when modifier is too shallow', () => {
    // [[[!]]!]!
    const type = new GraphQLNonNull(
      new GraphQLList(
        new GraphQLNonNull(
          new GraphQLList(new GraphQLList(new GraphQLNonNull(GraphQLInt))),
        ),
      ),
    );

    // [[[]]]
    const nullabilityNode: NullabilityDesignatorNode | ListNullabilityNode = {
      kind: Kind.LIST_NULLABILITY,
      element: {
        kind: Kind.LIST_NULLABILITY,
        element: undefined,
      },
    };

    expect(() => {
      applyRequiredStatus(type, nullabilityNode);
    }).to.throw('List nullability modifier is too shallow.');
  });
});
