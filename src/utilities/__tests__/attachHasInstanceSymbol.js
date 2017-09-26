import { describe, it} from 'mocha';
import chai from 'chai';
import attachHasInstanceSymbol from '../attachHasInstanceSymbol';
import { GraphQLInputObjectType as RealInputType } from '../../type';


describe('attachHasInstanceSymbol()', () => {
  it('passes instanceof checks for types for other package instances', () => {
    class GraphQLInputObjectType {
      constructor() {}
    }

    attachHasInstanceSymbol(GraphQLInputObjectType);

    chai.expect(new GraphQLInputObjectType() instanceof RealInputType)
      .to.equal(true);
  });
});
