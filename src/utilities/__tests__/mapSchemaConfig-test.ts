import { expect } from 'chai';
import { describe, it } from 'mocha';

import { dedentString } from '../../__testUtils__/dedent.js';

import { GraphQLObjectType } from '../../type/definition.js';
import type { GraphQLSchemaNormalizedConfig } from '../../type/schema.js';
import { GraphQLSchema } from '../../type/schema.js';

import { buildSchema } from '../buildASTSchema.js';
import type {
  ConfigMapperMap,
  MappedSchemaContext,
} from '../mapSchemaConfig.js';
import { mapSchemaConfig, SchemaElementKind } from '../mapSchemaConfig.js';
import { printSchema } from '../printSchema.js';

function expectSchemaMapping(
  schemaConfig: GraphQLSchemaNormalizedConfig,
  configMapperMapFn: (context: MappedSchemaContext) => ConfigMapperMap,
  expected: string,
) {
  const newSchemaConfig = mapSchemaConfig(schemaConfig, configMapperMapFn);
  expect(printSchema(new GraphQLSchema(newSchemaConfig))).to.equal(
    dedentString(expected),
  );
}

describe('mapSchemaConfig', () => {
  it('returns the original config when no mappers are included', () => {
    const sdl = 'type Query';
    const schemaConfig = buildSchema(sdl).toConfig();
    expectSchemaMapping(schemaConfig, () => ({}), sdl);
  });

  describe('scalar mapping', () => {
    it('can map scalar types', () => {
      const sdl = 'scalar SomeScalar';

      const schemaConfig = buildSchema(sdl).toConfig();

      expectSchemaMapping(
        schemaConfig,
        () => ({
          [SchemaElementKind.SCALAR]: (config) => ({
            ...config,
            description: 'Some description',
          }),
        }),
        `
          """Some description"""
          scalar SomeScalar
        `,
      );
    });
  });

  describe('argument mapping', () => {
    it('can map arguments', () => {
      const sdl = `
        type SomeType {
          field(arg: String): String
        }
      `;

      const schemaConfig = buildSchema(sdl).toConfig();

      expectSchemaMapping(
        schemaConfig,
        () => ({
          [SchemaElementKind.ARGUMENT]: (config) => ({
            ...config,
            description: 'Some description',
          }),
        }),
        `
          type SomeType {
            field(
              """Some description"""
              arg: String
            ): String
          }
        `,
      );
    });
  });

  describe('field mapping', () => {
    it('can map fields', () => {
      const sdl = `
      type SomeType {
        field: String
      }
    `;

      const schemaConfig = buildSchema(sdl).toConfig();

      expectSchemaMapping(
        schemaConfig,
        () => ({
          [SchemaElementKind.FIELD]: (config) => ({
            ...config,
            description: 'Some description',
          }),
        }),
        `
          type SomeType {
            """Some description"""
            field: String
          }
        `,
      );
    });

    it('maps fields after mapping arguments', () => {
      const sdl = `
        type SomeType {
          field(arg: String): String
        }
      `;

      const schemaConfig = buildSchema(sdl).toConfig();

      expectSchemaMapping(
        schemaConfig,
        () => ({
          [SchemaElementKind.ARGUMENT]: (config) => ({
            ...config,
            description: 'Some argument description',
          }),
          [SchemaElementKind.FIELD]: (config) => {
            expect(config.args.arg.description).to.equal(
              'Some argument description',
            );
            return {
              ...config,
              description: 'Some field description',
            };
          },
        }),
        `
          type SomeType {
            """Some field description"""
            field(
              """Some argument description"""
              arg: String
            ): String
          }
        `,
      );
    });
  });

  describe('object type mapping', () => {
    it('can map object types', () => {
      const sdl = 'type SomeType';

      const schemaConfig = buildSchema(sdl).toConfig();

      expectSchemaMapping(
        schemaConfig,
        () => ({
          [SchemaElementKind.OBJECT]: (config) => ({
            ...config,
            description: 'Some description',
          }),
        }),
        `
          """Some description"""
          type SomeType
        `,
      );
    });

    it('maps object types after mapping fields', () => {
      const sdl = `
        type SomeType {
          field: String
        }
      `;

      const schemaConfig = buildSchema(sdl).toConfig();

      expectSchemaMapping(
        schemaConfig,
        () => ({
          [SchemaElementKind.FIELD]: (config) => ({
            ...config,
            description: 'Some field description',
          }),
          [SchemaElementKind.OBJECT]: (config) => {
            expect(config.fields().field.description).to.equal(
              'Some field description',
            );
            return {
              ...config,
              description: 'Some object description',
            };
          },
        }),
        `
          """Some object description"""
          type SomeType {
            """Some field description"""
            field: String
          }
        `,
      );
    });

    it('maps object types after mapping interfaces', () => {
      const sdl = `
        interface SomeInterface
        type SomeType implements SomeInterface
      `;

      const schemaConfig = buildSchema(sdl).toConfig();

      expectSchemaMapping(
        schemaConfig,
        () => ({
          [SchemaElementKind.INTERFACE]: (config) => ({
            ...config,
            description: 'Some interface description',
          }),
          [SchemaElementKind.OBJECT]: (config) => {
            expect(config.interfaces()[0].description).to.equal(
              'Some interface description',
            );
            return {
              ...config,
              description: 'Some object description',
            };
          },
        }),
        `
          """Some interface description"""
          interface SomeInterface

          """Some object description"""
          type SomeType implements SomeInterface
        `,
      );
    });
  });

  describe('interface type mapping', () => {
    it('can map interface types', () => {
      const sdl = 'interface SomeInterface';

      const schemaConfig = buildSchema(sdl).toConfig();

      expectSchemaMapping(
        schemaConfig,
        () => ({
          [SchemaElementKind.INTERFACE]: (config) => ({
            ...config,
            description: 'Some description',
          }),
        }),
        `
          """Some description"""
          interface SomeInterface
        `,
      );
    });

    it('maps interface types after mapping fields', () => {
      const sdl = `
        interface SomeInterface {
          field: String
        }
      `;

      const schemaConfig = buildSchema(sdl).toConfig();

      expectSchemaMapping(
        schemaConfig,
        () => ({
          [SchemaElementKind.FIELD]: (config) => ({
            ...config,
            description: 'Some field description',
          }),
          [SchemaElementKind.INTERFACE]: (config) => {
            expect(config.fields().field.description).to.equal(
              'Some field description',
            );
            return {
              ...config,
              description: 'Some interface description',
            };
          },
        }),
        `
          """Some interface description"""
          interface SomeInterface {
            """Some field description"""
            field: String
          }
        `,
      );
    });

    it('maps interface types after mapping parent interfaces', () => {
      const sdl = `
        interface SomeParentInterface
        interface SomeInterface implements SomeParentInterface
      `;

      const schemaConfig = buildSchema(sdl).toConfig();

      expectSchemaMapping(
        schemaConfig,
        () => ({
          [SchemaElementKind.INTERFACE]: (config) => {
            if (config.name === 'SomeInterface') {
              expect(config.interfaces()[0].description).to.equal(
                'Some interface description',
              );
            }
            return {
              ...config,
              description: 'Some interface description',
            };
          },
        }),
        `
          """Some interface description"""
          interface SomeParentInterface

          """Some interface description"""
          interface SomeInterface implements SomeParentInterface
        `,
      );
    });
  });

  describe('union type mapping', () => {
    it('can map union types', () => {
      const sdl = 'union SomeUnion';

      const schemaConfig = buildSchema(sdl).toConfig();

      expectSchemaMapping(
        schemaConfig,
        () => ({
          [SchemaElementKind.UNION]: (config) => ({
            ...config,
            description: 'Some description',
          }),
        }),
        `
          """Some description"""
          union SomeUnion
        `,
      );
    });

    it('maps union types after mapping types', () => {
      const sdl = `
        type SomeType
        union SomeUnion = SomeType
      `;

      const schemaConfig = buildSchema(sdl).toConfig();

      expectSchemaMapping(
        schemaConfig,
        () => ({
          [SchemaElementKind.OBJECT]: (config) => ({
            ...config,
            description: 'Some type description',
          }),
          [SchemaElementKind.UNION]: (config) => {
            expect(config.types()[0].description).to.equal(
              'Some type description',
            );
            return {
              ...config,
              description: 'Some union description',
            };
          },
        }),
        `
          """Some type description"""
          type SomeType

          """Some union description"""
          union SomeUnion = SomeType
        `,
      );
    });
  });

  describe('enum value mapping', () => {
    it('can map enum values', () => {
      const sdl = `
        enum SomeEnum {
          SOME_VALUE
        }
      `;

      const schemaConfig = buildSchema(sdl).toConfig();

      expectSchemaMapping(
        schemaConfig,
        () => ({
          [SchemaElementKind.ENUM_VALUE]: (config) => ({
            ...config,
            description: 'Some description',
          }),
        }),
        `
          enum SomeEnum {
            """Some description"""
            SOME_VALUE
          }
        `,
      );
    });
  });

  describe('enum type mapping', () => {
    it('can map enum types', () => {
      const sdl = 'enum SomeEnum';

      const schemaConfig = buildSchema(sdl).toConfig();

      expectSchemaMapping(
        schemaConfig,
        () => ({
          [SchemaElementKind.ENUM]: (config) => ({
            ...config,
            description: 'Some description',
          }),
        }),
        `
          """Some description"""
          enum SomeEnum
        `,
      );
    });

    it('maps enum types after mapping values', () => {
      const sdl = `
        enum SomeEnum {
          SOME_VALUE
        }
      `;

      const schemaConfig = buildSchema(sdl).toConfig();

      expectSchemaMapping(
        schemaConfig,
        () => ({
          [SchemaElementKind.ENUM_VALUE]: (config) => ({
            ...config,
            description: 'Some value description',
          }),
          [SchemaElementKind.ENUM]: (config) => {
            expect(config.values().SOME_VALUE.description).to.equal(
              'Some value description',
            );
            return {
              ...config,
              description: 'Some enum description',
            };
          },
        }),
        `
          """Some enum description"""
          enum SomeEnum {
            """Some value description"""
            SOME_VALUE
          }
        `,
      );
    });
  });

  describe('input field mapping', () => {
    it('can map input fields', () => {
      const sdl = `
        input SomeInput {
          field: String
        }
      `;

      const schemaConfig = buildSchema(sdl).toConfig();

      expectSchemaMapping(
        schemaConfig,
        () => ({
          [SchemaElementKind.INPUT_FIELD]: (config) => ({
            ...config,
            description: 'Some description',
          }),
        }),
        `
          input SomeInput {
            """Some description"""
            field: String
          }
        `,
      );
    });
  });

  describe('input object type mapping', () => {
    it('can map input object types', () => {
      const sdl = 'input SomeInput';

      const schemaConfig = buildSchema(sdl).toConfig();

      expectSchemaMapping(
        schemaConfig,
        () => ({
          [SchemaElementKind.INPUT_OBJECT]: (config) => ({
            ...config,
            description: 'Some description',
          }),
        }),
        `
          """Some description"""
          input SomeInput
        `,
      );
    });

    it('maps input object types after mapping input fields', () => {
      const sdl = `
        input SomeInput {
          field: String
        }
      `;

      const schemaConfig = buildSchema(sdl).toConfig();

      expectSchemaMapping(
        schemaConfig,
        () => ({
          [SchemaElementKind.INPUT_FIELD]: (config) => ({
            ...config,
            description: 'Some input field description',
          }),
          [SchemaElementKind.INPUT_OBJECT]: (config) => {
            expect(config.fields().field.description).to.equal(
              'Some input field description',
            );
            return {
              ...config,
              description: 'Some input object description',
            };
          },
        }),
        `
          """Some input object description"""
          input SomeInput {
            """Some input field description"""
            field: String
          }
        `,
      );
    });
  });

  describe('directive mapping', () => {
    it('can map directives', () => {
      const sdl = `
        directive @SomeDirective on FIELD
      `;

      const schemaConfig = buildSchema(sdl).toConfig();

      expectSchemaMapping(
        schemaConfig,
        () => ({
          [SchemaElementKind.DIRECTIVE]: (config) => ({
            ...config,
            description: 'Some description',
          }),
        }),
        `
          """Some description"""
          directive @SomeDirective on FIELD
        `,
      );
    });

    it('maps directives after mapping arguments', () => {
      const sdl = `
        directive @SomeDirective(arg: String) on FIELD
      `;

      const schemaConfig = buildSchema(sdl).toConfig();

      expectSchemaMapping(
        schemaConfig,
        () => ({
          [SchemaElementKind.ARGUMENT]: (config) => ({
            ...config,
            description: 'Some argument description',
          }),
          [SchemaElementKind.DIRECTIVE]: (config) => {
            expect(config.args.arg.description).to.equal(
              'Some argument description',
            );
            return {
              ...config,
              description: 'Some directive description',
            };
          },
        }),
        `
          """Some directive description"""
          directive @SomeDirective(
            """Some argument description"""
            arg: String
          ) on FIELD
        `,
      );
    });
  });

  describe('schema mapping', () => {
    it('can map the schema', () => {
      const sdl = `
        type Query

        type Mutation

        type Subscription

        directive @SomeDirective on FIELD

        scalar SomeScalar

        type SomeType {
          field: String
        }

        interface SomeInterface

        union SomeUnion

        enum SomeEnum {
          SOME_VALUE
        }

        input SomeInput {
          field: String
        }
      `;

      const schemaConfig = buildSchema(sdl).toConfig();

      expectSchemaMapping(
        schemaConfig,
        () => ({
          [SchemaElementKind.SCHEMA]: (config) => ({
            ...config,
            description: 'Some description',
          }),
        }),
        `
          """Some description"""
          schema {
            query: Query
            mutation: Mutation
            subscription: Subscription
          }

          directive @SomeDirective on FIELD

          type Query

          type Mutation

          type Subscription

          scalar SomeScalar

          type SomeType {
            field: String
          }

          interface SomeInterface

          union SomeUnion

          enum SomeEnum {
            SOME_VALUE
          }

          input SomeInput {
            field: String
          }
        `,
      );
    });

    it('maps the schema after mapping types and directives', () => {
      const sdl = `
        type Query

        type Mutation

        type Subscription

        directive @SomeDirective on FIELD

        scalar SomeScalar

        type SomeType {
          field: String
        }

        interface SomeInterface

        union SomeUnion

        enum SomeEnum {
          SOME_VALUE
        }

        input SomeInput {
          field: String
        }
      `;

      const schemaConfig = buildSchema(sdl).toConfig();

      expectSchemaMapping(
        schemaConfig,
        () => ({
          [SchemaElementKind.DIRECTIVE]: (config) => ({
            ...config,
            description: 'Some directive description',
          }),
          [SchemaElementKind.SCALAR]: (config) => ({
            ...config,
            description: 'Some scalar description',
          }),
          [SchemaElementKind.OBJECT]: (config) => ({
            ...config,
            description: 'Some object description',
          }),
          [SchemaElementKind.INTERFACE]: (config) => ({
            ...config,
            description: 'Some interface description',
          }),
          [SchemaElementKind.UNION]: (config) => ({
            ...config,
            description: 'Some union description',
          }),
          [SchemaElementKind.ENUM]: (config) => ({
            ...config,
            description: 'Some enum description',
          }),
          [SchemaElementKind.INPUT_OBJECT]: (config) => ({
            ...config,
            description: 'Some input object description',
          }),
          [SchemaElementKind.SCHEMA]: (config) => {
            for (const directive of config.directives) {
              if (directive.name === 'SomeDirective') {
                expect(directive.description).to.equal(
                  'Some directive description',
                );
              }
            }

            for (const type of config.types) {
              switch (type.name) {
                case 'SomeScalar':
                  expect(type.description).to.equal('Some scalar description');
                  break;
                case 'SomeType':
                  expect(type.description).to.equal('Some object description');
                  break;
                case 'SomeInterface':
                  expect(type.description).to.equal(
                    'Some interface description',
                  );
                  break;
                case 'SomeUnion':
                  expect(type.description).to.equal('Some union description');
                  break;
                case 'SomeEnum':
                  expect(type.description).to.equal('Some enum description');
                  break;
                case 'SomeInput':
                  expect(type.description).to.equal(
                    'Some input object description',
                  );
                  break;
              }
            }

            return {
              ...config,
              description: 'Some schema description',
            };
          },
        }),
        `
          """Some schema description"""
          schema {
            query: Query
            mutation: Mutation
            subscription: Subscription
          }

          """Some directive description"""
          directive @SomeDirective on FIELD

          """Some object description"""
          type Query

          """Some object description"""
          type Mutation

          """Some object description"""
          type Subscription

          """Some scalar description"""
          scalar SomeScalar

          """Some object description"""
          type SomeType {
            field: String
          }

          """Some interface description"""
          interface SomeInterface

          """Some union description"""
          union SomeUnion

          """Some enum description"""
          enum SomeEnum {
            SOME_VALUE
          }

          """Some input object description"""
          input SomeInput {
            field: String
          }
        `,
      );
    });
  });

  describe('schema context', () => {
    it('allows access to the final mapped named type via getNamedType()', () => {
      const sdl = `
        """Some description"""
        type SomeType
      `;

      const schema = buildSchema(sdl);
      const schemaConfig = schema.toConfig();
      const someType = schema.getType('SomeType') as GraphQLObjectType;

      expectSchemaMapping(
        schemaConfig,
        ({ getNamedType }) => {
          return {
            [SchemaElementKind.OBJECT]: (config) => ({
              ...config,
              fields: () => {
                expectMappedSomeType();
                return config.fields();
              },
            }),
            [SchemaElementKind.SCHEMA]: (config) => {
              expectMappedSomeType();
              return config;
            },
          };

          function expectMappedSomeType() {
            const mappedType = getNamedType(someType.name);
            expect(mappedType).not.to.equal(someType);
            expect(mappedType.description).to.equal(someType.description);
          }
        },
        sdl,
      );
    });

    it('allows adding a named type via setNamedType() and retrieving the new list via getNamedTypes', () => {
      const sdl = 'type SomeType';

      const schema = buildSchema(sdl);
      const schemaConfig = schema.toConfig();

      expectSchemaMapping(
        schemaConfig,
        ({ setNamedType, getNamedTypes }) => ({
          [SchemaElementKind.SCHEMA]: (config) => {
            setNamedType(
              new GraphQLObjectType({ name: 'AnotherType', fields: {} }),
            );
            return {
              ...config,
              types: getNamedTypes(),
            };
          },
        }),
        `
          type SomeType

          type AnotherType
        `,
      );
    });
  });
});
