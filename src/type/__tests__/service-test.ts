import { expect } from 'chai';
import { describe, it } from 'mocha';

import { buildSchema } from '../../utilities/buildASTSchema';
import { printSchema } from '../../utilities/printSchema';
import { withServiceCapabilities } from '../../utilities/withServiceCapabilities';

import { graphqlSync } from '../../graphql';

import { GraphQLObjectType } from '../definition';
import { GraphQLString } from '../scalars';
import { GraphQLSchema } from '../schema';
import {
  assertService,
  builtInService,
  GraphQLService,
  isBuiltInService,
  isService,
} from '../service';

describe('Type System: Service', () => {
  describe('GraphQLService', () => {
    it('creates a service with capabilities', () => {
      const service = new GraphQLService({
        description: 'My GraphQL Service',
        capabilities: [
          { identifier: 'graphql.spec', value: '2024' },
          { identifier: 'graphql.federatedQueries' },
        ],
      });

      expect(service.description).to.equal('My GraphQL Service');
      expect(service.capabilities).to.have.length(2);
      expect(service.capabilities[0].identifier).to.equal('graphql.spec');
      expect(service.capabilities[0].value).to.equal('2024');
      expect(service.capabilities[1].identifier).to.equal(
        'graphql.federatedQueries',
      );
      expect(service.capabilities[1].value).to.equal(null);
    });

    it('has getCapability method', () => {
      const service = new GraphQLService({
        capabilities: [
          { identifier: 'graphql.spec', value: '2024' },
          { identifier: 'graphql.federatedQueries' },
        ],
      });

      const cap = service.getCapability('graphql.spec');
      expect(cap?.identifier).to.equal('graphql.spec');
      expect(cap?.value).to.equal('2024');

      expect(service.getCapability('nonexistent')).to.equal(undefined);
    });

    it('has hasCapability method', () => {
      const service = new GraphQLService({
        capabilities: [{ identifier: 'graphql.spec' }],
      });

      expect(service.hasCapability('graphql.spec')).to.equal(true);
      expect(service.hasCapability('nonexistent')).to.equal(false);
    });

    it('can be converted to config', () => {
      const service = new GraphQLService({
        description: 'Test',
        capabilities: [{ identifier: 'graphql.spec', value: '2024' }],
      });

      const config = service.toConfig();
      expect(config.description).to.equal('Test');
      expect(config.capabilities).to.have.length(1);
      expect(config.capabilities[0].identifier).to.equal('graphql.spec');
    });
  });

  describe('isService', () => {
    it('returns true for GraphQLService', () => {
      const service = new GraphQLService({ capabilities: [] });
      expect(isService(service)).to.equal(true);
    });

    it('returns false for non-services', () => {
      expect(isService({})).to.equal(false);
      expect(isService(null)).to.equal(false);
      expect(isService(undefined)).to.equal(false);
    });
  });

  describe('assertService', () => {
    it('returns the service for valid input', () => {
      const service = new GraphQLService({ capabilities: [] });
      expect(assertService(service)).to.equal(service);
    });

    it('throws for non-services', () => {
      expect(() => assertService({})).to.throw(
        'to be a GraphQL service definition.',
      );
    });
  });
});

describe('Schema with Service', () => {
  it('can add service to schema', () => {
    const service = new GraphQLService({
      capabilities: [{ identifier: 'graphql.spec' }],
    });

    const schema = new GraphQLSchema({
      query: new GraphQLObjectType({
        name: 'Query',
        fields: { test: { type: GraphQLString } },
      }),
      service,
    });

    expect(schema.getService()).to.equal(service);
  });

  it('uses built-in service by default', () => {
    const schema = new GraphQLSchema({
      query: new GraphQLObjectType({
        name: 'Query',
        fields: { test: { type: GraphQLString } },
      }),
    });

    expect(schema.getService()).to.equal(builtInService);
    expect(isBuiltInService(schema.getService())).to.equal(true);
  });

  it('builds service from SDL', () => {
    const schema = buildSchema(`
      type Query {
        test: String
      }
      service {
        capability graphql.spec = "2024"
        capability graphql.federatedQueries
      }
    `);

    const service = schema.getService();
    expect(isBuiltInService(service)).to.equal(false);
    expect(service.capabilities).to.have.length(2);
    expect(service.capabilities[0].identifier).to.equal('graphql.spec');
    expect(service.capabilities[0].value).to.equal('2024');
  });

  it('prints service when schema has custom service', () => {
    const schema = buildSchema(`
      type Query {
        test: String
      }
      service {
        capability graphql.spec = "2024"
      }
    `);

    const printed = printSchema(schema);
    expect(printed).to.include('service {');
    expect(printed).to.include('capability graphql.spec = "2024"');
  });

  it('does not print service when schema has built-in service', () => {
    const schema = new GraphQLSchema({
      query: new GraphQLObjectType({
        name: 'Query',
        fields: { test: { type: GraphQLString } },
      }),
    });

    const printed = printSchema(schema);
    expect(printed).to.not.include('service');
    expect(printed).to.not.include('capability');
  });
});

describe('withServiceCapabilities', () => {
  it('creates a new schema with custom service', () => {
    const originalSchema = new GraphQLSchema({
      query: new GraphQLObjectType({
        name: 'Query',
        fields: { test: { type: GraphQLString } },
      }),
    });

    expect(isBuiltInService(originalSchema.getService())).to.equal(true);

    const newSchema = withServiceCapabilities(originalSchema, {
      description: 'Remote service',
      capabilities: [
        { identifier: 'graphql.spec', value: '2024' },
        { identifier: 'custom.feature' },
      ],
    });

    expect(isBuiltInService(newSchema.getService())).to.equal(false);
    expect(newSchema.getService().description).to.equal('Remote service');
    expect(newSchema.getService().capabilities).to.have.length(2);
  });

  it('results in printSchema including the service', () => {
    const originalSchema = new GraphQLSchema({
      query: new GraphQLObjectType({
        name: 'Query',
        fields: { test: { type: GraphQLString } },
      }),
    });

    const newSchema = withServiceCapabilities(originalSchema, {
      capabilities: [{ identifier: 'graphql.spec', value: '2024' }],
    });

    const printed = printSchema(newSchema);
    expect(printed).to.include('service {');
    expect(printed).to.include('capability graphql.spec = "2024"');
  });
});

describe('Service Introspection', () => {
  it('can query __service meta-field', () => {
    const schema = buildSchema(`
      type Query {
        test: String
      }
      service {
        "The GraphQL spec version"
        capability graphql.spec = "2024"
        capability graphql.federatedQueries
      }
    `);

    const result = graphqlSync({
      schema,
      source: `
        {
          __service {
            capabilities {
              identifier
              description
              value
            }
          }
        }
      `,
    });

    expect(result.errors).to.equal(undefined);
    expect(result.data).to.deep.equal({
      __service: {
        capabilities: [
          {
            identifier: 'graphql.spec',
            description: 'The GraphQL spec version',
            value: '2024',
          },
          {
            identifier: 'graphql.federatedQueries',
            description: null,
            value: null,
          },
        ],
      },
    });
  });

  it('returns built-in capabilities when no custom service defined', () => {
    const schema = buildSchema(`
      type Query {
        test: String
      }
    `);

    const result = graphqlSync({
      schema,
      source: `
        {
          __service {
            capabilities {
              identifier
              value
            }
          }
        }
      `,
    });

    expect(result.errors).to.equal(undefined);
    // The built-in service has the graphql.spec capability
    expect(result.data).to.deep.equal({
      __service: {
        capabilities: [
          {
            identifier: 'graphql.spec',
            value: '2024',
          },
        ],
      },
    });
  });
});
