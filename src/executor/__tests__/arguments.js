// 80+ char lines are useful in describe/it, so ignore in this file.
/*eslint-disable max-len */

import { expect } from 'chai';
import { describe, it } from 'mocha';
import { parse } from '../../language';
import { execute } from '../executor';
import { getArgumentValues } from '../values';
import {
  GraphQLSchema,
  GraphQLObjectType,
  GraphQLString,
} from '../../type';


var TestType = new GraphQLObjectType({
  name: 'TestType',
  fields: {
    fieldWithDefaultArgumentValue: {
      type: GraphQLString,
      args: { input: { type: GraphQLString, defaultValue: 'Mainstreet' } },
      resolve: (_, {input}) => {
        return input;
      }
    }
  }
});

var schema = new GraphQLSchema({ query: TestType });
describe('Execute: Handles arguments', () => {
  it('with defaultValue', async () => {
    var doc = `
    {
      fieldWithDefaultArgumentValue
    }
    `;
    var ast = parse(doc);
    return expect(await execute(schema, ast)).to.deep.equal({
      data: {
        fieldWithDefaultArgumentValue: 'Mainstreet'
      }
    });
  });
});

describe('getArgumentValues', () => {
  it('returns default value for not provided arguments', () => {

    var dummyType = new GraphQLObjectType({
        name: 'Dummy',
        fields: {
          street: { type: GraphQLString, defaultValue: 'Mainstreet' }
        }
    });
    var argument = {name: 'street'};
    var argumentValues = getArgumentValues([dummyType.getFields().street], [argument]);
    expect(argumentValues.street).to.equal('Mainstreet');
  });
});
