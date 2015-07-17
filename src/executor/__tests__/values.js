// 80+ char lines are useful in describe/it, so ignore in this file.
/*eslint-disable max-len */

import { expect } from 'chai';
import { describe, it } from 'mocha';
import {getArgumentValues} from '../values';
import {GraphQLObjectType, GraphQLString} from '../../type/definition';

describe('getArgumentValues', () => {
  it('returns default value for not provided arguments', () => {

    var dummyType = new GraphQLObjectType({
        name: 'Dummy',
        fields: {
          street: { type: GraphQLString, defaultValue: 'Mainstreet' }
        }
    });
    var argument = {name: 'street'};
    var agumentValues = getArgumentValues([dummyType.getFields().street], [argument]);
    expect(agumentValues.street).to.equal('Mainstreet');
  });
});

