import { describe, it } from 'node:test';

import { assert, expect } from 'chai';

import { dedent } from '../../__testUtils__/dedent.ts';

import type { Maybe } from '../../jsutils/Maybe.ts';

import type { ASTNode } from '../../language/ast.ts';
import { Kind } from '../../language/kinds.ts';
import { parse } from '../../language/parser.ts';
import { print } from '../../language/printer.ts';

import {
  assertEnumType,
  assertInputObjectType,
  assertInterfaceType,
  assertObjectType,
  assertScalarType,
  assertUnionType,
} from '../../type/definition.ts';
import { assertDirective, specifiedDirectives } from '../../type/directives.ts';
import {
  GraphQLBoolean,
  GraphQLFloat,
  GraphQLID,
  GraphQLInt,
  GraphQLString,
} from '../../type/scalars.ts';
import { GraphQLSchema } from '../../type/schema.ts';
import { validateSchema } from '../../type/validate.ts';

import { graphqlSync } from '../../graphql.ts';

import { buildASTSchema, buildSchema } from '../buildASTSchema.ts';
import { concatAST } from '../concatAST.ts';
import { extendSchema } from '../extendSchema.ts';
import { printSchema } from '../printSchema.ts';

function expectExtensionASTNodes(obj: {
  readonly extensionASTNodes: ReadonlyArray<ASTNode>;
}) {
  return expect(obj.extensionASTNodes.map(print).join('\n\n'));
}

function expectASTNode(obj: Maybe<{ readonly astNode: Maybe<ASTNode> }>) {
  assert(obj?.astNode !== undefined && obj.astNode !== null);
  return expect(print(obj.astNode));
}

function expectSchemaChanges(
  schema: GraphQLSchema,
  extendedSchema: GraphQLSchema,
) {
  const schemaDefinitions = parse(printSchema(schema)).definitions.map(print);
  return expect(
    parse(printSchema(extendedSchema))
      .definitions.map(print)
      .filter((def) => !schemaDefinitions.includes(def))
      .join('\n\n'),
  );
}

describe('extendSchema', () => {
  it('returns the original schema when there are no type definitions', () => {
    const schema = buildSchema('type Query');
    const extendedSchema = extendSchema(schema, parse('{ field }'));
    expect(extendedSchema).to.equal(schema);
  });

  it('supplements schema extensions when there are no type definitions', () => {
    const schema = buildSchema('type Query');
    const extendedSchema = extendSchema(schema, parse('{ field }'), {
      supplementalConfig: {
        extensions: { added: 'supplement' },
      },
    });

    expect(extendedSchema).to.not.equal(schema);
    expect(extendedSchema.extensions).to.deep.equal({
      added: 'supplement',
    });
  });

  it('does not supplement schema extensions when the schema already has extensions', () => {
    const schema = new GraphQLSchema({
      ...buildSchema('type Query').toConfig(),
      extensions: { existing: 'schema' },
    });

    expect(() =>
      extendSchema(schema, parse('{ field }'), {
        supplementalConfig: {
          extensions: { added: 'supplement' },
        },
      }),
    ).to.throw(
      'Schema supplemental config cannot add extensions to a schema that already has extensions.',
    );
  });

  it('can be used for limited execution', () => {
    const schema = buildSchema('type Query');
    const extendAST = parse(`
      extend type Query {
        newField: String
      }
    `);
    const extendedSchema = extendSchema(schema, extendAST);

    const result = graphqlSync({
      schema: extendedSchema,
      source: '{ newField }',
      rootValue: { newField: 123 },
    });
    expect(result).to.deep.equal({
      data: { newField: '123' },
    });
  });

  it('supplements SDL definitions and extensions with supported config', () => {
    const serialize = (value: unknown) => `legacy:${String(value)}`;
    const parseValue = (value: unknown) => `parse:${String(value)}`;
    const parseLiteral = () => 'literal';
    const coerceOutputValue = (value: unknown) => `output:${String(value)}`;
    const coerceInputValue = (value: unknown) => `input:${String(value)}`;
    const coerceInputLiteral = () => 'inputLiteral';
    const valueToLiteral = (value: unknown) =>
      ({
        kind: Kind.STRING,
        value: String(value),
      }) as const;

    const schema = new GraphQLSchema({});
    const extendAST = parse(`
      schema {
        query: Query
      }

      directive @tag(label: String) on FIELD_DEFINITION
      directive @marker on FIELD_DEFINITION

      interface Node {
        id: ID
      }

      type Result implements Node {
        id: ID
      }

      scalar Odd @specifiedBy(url: "https://odd.example")

      enum Episode {
        NEW_HOPE
      }

      enum Side {
        LEFT
      }

      input Filter {
        text: String
      }

      union SearchResult = Result

      type Query {
        result: Result
      }

      interface Named {
        name: String
      }

      type Product implements Named {
        name: String
      }

      type ObjectOnly {
        id: ID
      }

      input ProductFilter {
        id: ID = "1"
      }

      input InputOnly {
        id: ID
      }

      enum EnumOnly {
        VALUE
      }

      scalar Even
      scalar MethodOnly
      union ProductSearch = Product

      extend interface Node {
        label: String
      }

      extend type Result {
        label: String
      }

      extend enum Episode {
        EMPIRE
      }

      extend enum Side {
        RIGHT
      }

      extend input Filter {
        limit: Int
      }

      extend union SearchResult = Product

      extend type Query {
        product(name: String): Product
        salutation(name: String): String
        greeting: String
      }
    `);

    const extendedSchema = extendSchema(schema, extendAST, {
      supplementalConfig: {
        extensions: { added: 'schema' },
        directives: {
          tag: {
            args: {
              label: { extensions: { argument: true } },
            },
            extensions: { directive: true },
          },
          marker: {
            extensions: { marker: true },
          },
        },
        objectTypes: {
          Query: {
            fields: {
              greeting: () => 'hi',
              product: {
                resolve: () => ({ name: 'Ada' }),
                subscribe: () => undefined,
                args: {
                  name: { extensions: { queryArgument: true } },
                },
                extensions: { queryField: true },
              },
              salutation: {
                resolve: (_source, args) => `Hello ${String(args.name)}`,
              },
            },
          },
          Result: {
            fields: {
              label: { extensions: { objectExtension: true } },
            },
          },
          Product: {
            isTypeOf: () => true,
            fields: {
              name: { extensions: { objectDefinition: true } },
            },
            extensions: { objectType: true },
          },
          ObjectOnly: {
            isTypeOf: () => true,
            extensions: { objectOnly: true },
          },
        },
        scalarTypes: {
          Even: {
            serialize,
            parseValue,
            parseLiteral,
            coerceOutputValue,
            coerceInputValue,
            coerceInputLiteral,
            valueToLiteral,
            extensions: { scalar: true },
          },
          MethodOnly: {
            serialize,
          },
        },
        interfaceTypes: {
          Named: {
            resolveType: () => 'Product',
            fields: {
              name: { extensions: { interfaceDefinition: true } },
            },
            extensions: { interfaceType: true },
          },
          Node: {
            fields: {
              label: { extensions: { interfaceExtension: true } },
            },
          },
        },
        unionTypes: {
          ProductSearch: {
            resolveType: () => 'Product',
            extensions: { unionType: true },
          },
        },
        enumTypes: {
          EnumOnly: {
            values: {
              VALUE: { value: 'value', extensions: { enumValue: true } },
            },
            extensions: { enumOnly: true },
          },
          Episode: {
            values: {
              EMPIRE: { value: 5, extensions: { enumExtension: true } },
            },
          },
          Side: {},
        },
        inputObjectTypes: {
          ProductFilter: {
            fields: {
              id: { extensions: { inputDefinition: true } },
            },
            extensions: { inputType: true },
          },
          InputOnly: {
            extensions: { inputOnly: true },
          },
          Filter: {
            fields: {
              limit: { extensions: { inputExtension: true } },
            },
          },
        },
      },
    });

    expect(extendedSchema.extensions).to.deep.equal({ added: 'schema' });

    const tag = assertDirective(extendedSchema.getDirective('tag'));
    expect(tag.extensions).to.deep.equal({ directive: true });
    expect(tag.args[0].extensions).to.deep.equal({ argument: true });
    const marker = assertDirective(extendedSchema.getDirective('marker'));
    expect(marker.extensions).to.deep.equal({ marker: true });

    const query = assertObjectType(extendedSchema.getType('Query'));
    const greetingField = query.getFields().greeting;
    expect(greetingField.resolve).to.be.a('function');
    const productField = query.getFields().product;
    expect(productField.resolve).to.be.a('function');
    expect(productField.subscribe).to.be.a('function');
    expect(productField.extensions).to.deep.equal({ queryField: true });
    expect(productField.args[0].extensions).to.deep.equal({
      queryArgument: true,
    });
    expect(
      graphqlSync({
        schema: extendedSchema,
        source:
          '{ greeting salutation(name: "Ada") product(name: "Ada") { name } }',
      }),
    ).to.deep.equal({
      data: {
        greeting: 'hi',
        salutation: 'Hello Ada',
        product: { name: 'Ada' },
      },
    });

    const named = assertInterfaceType(extendedSchema.getType('Named'));
    expect(named.resolveType).to.be.a('function');
    expect(named.extensions).to.deep.equal({ interfaceType: true });
    expect(named.getFields().name.extensions).to.deep.equal({
      interfaceDefinition: true,
    });

    const product = assertObjectType(extendedSchema.getType('Product'));
    expect(product.isTypeOf).to.be.a('function');
    expect(product.extensions).to.deep.equal({ objectType: true });
    expect(product.getFields().name.extensions).to.deep.equal({
      objectDefinition: true,
    });

    const result = assertObjectType(extendedSchema.getType('Result'));
    expect(result.getFields().label.extensions).to.deep.equal({
      objectExtension: true,
    });

    const objectOnly = assertObjectType(extendedSchema.getType('ObjectOnly'));
    expect(objectOnly.isTypeOf).to.be.a('function');
    expect(objectOnly.extensions).to.deep.equal({ objectOnly: true });

    const productFilter = assertInputObjectType(
      extendedSchema.getType('ProductFilter'),
    );
    expect(productFilter.extensions).to.deep.equal({ inputType: true });
    expect(productFilter.getFields().id.extensions).to.deep.equal({
      inputDefinition: true,
    });

    const inputOnly = assertInputObjectType(
      extendedSchema.getType('InputOnly'),
    );
    expect(inputOnly.extensions).to.deep.equal({ inputOnly: true });

    const productSearch = assertUnionType(
      extendedSchema.getType('ProductSearch'),
    );
    expect(productSearch.resolveType).to.be.a('function');
    expect(productSearch.extensions).to.deep.equal({ unionType: true });

    const enumOnly = assertEnumType(extendedSchema.getType('EnumOnly'));
    expect(enumOnly.extensions).to.deep.equal({ enumOnly: true });
    expect(enumOnly.getValue('VALUE')?.value).to.equal('value');
    expect(enumOnly.getValue('VALUE')?.extensions).to.deep.equal({
      enumValue: true,
    });

    const node = assertInterfaceType(extendedSchema.getType('Node'));
    expect(node.getFields().label.extensions).to.deep.equal({
      interfaceExtension: true,
    });

    const episode = assertEnumType(extendedSchema.getType('Episode'));
    expect(episode.getValue('EMPIRE')?.value).to.equal(5);
    expect(episode.getValue('EMPIRE')?.extensions).to.deep.equal({
      enumExtension: true,
    });

    const filter = assertInputObjectType(extendedSchema.getType('Filter'));
    expect(filter.getFields().limit.extensions).to.deep.equal({
      inputExtension: true,
    });

    const odd = assertScalarType(extendedSchema.getType('Odd'));
    expect(odd.specifiedByURL).to.equal('https://odd.example');
    const even = assertScalarType(extendedSchema.getType('Even'));
    expect(even.serialize).to.equal(serialize);
    expect(even.parseValue).to.equal(parseValue);
    expect(even.parseLiteral).to.equal(parseLiteral);
    expect(even.coerceOutputValue).to.equal(coerceOutputValue);
    expect(even.coerceInputValue).to.equal(coerceInputValue);
    expect(even.coerceInputLiteral).to.equal(coerceInputLiteral);
    expect(even.valueToLiteral).to.equal(valueToLiteral);
    expect(even.extensions).to.deep.equal({ scalar: true });
    const methodOnly = assertScalarType(extendedSchema.getType('MethodOnly'));
    expect(methodOnly.serialize).to.equal(serialize);

    const side = assertEnumType(extendedSchema.getType('Side'));
    expect(side.getValue('RIGHT')).to.not.equal(undefined);

    const searchResult = assertUnionType(
      extendedSchema.getType('SearchResult'),
    );
    expect(searchResult.getTypes().map((type) => type.name)).to.deep.equal([
      'Result',
      'Product',
    ]);
  });

  it('supplements a new non-root object definition and extension', () => {
    const defined = () => 'defined';
    const extended = () => 'extended';
    const schema = buildSchema('type Query');
    const extendAST = parse(`
      type ObjectType {
        defined: String
      }

      extend type ObjectType {
        extended: String
      }

      extend type Query {
        object: ObjectType
      }
    `);
    const extendedSchema = extendSchema(schema, extendAST, {
      supplementalConfig: {
        objectTypes: {
          ObjectType: {
            fields: {
              defined,
              extended,
            },
          },
        },
      },
    });

    expect(
      graphqlSync({
        schema: extendedSchema,
        source: '{ object { defined extended } }',
        rootValue: { object: {} },
      }),
    ).to.deep.equal({
      data: {
        object: {
          defined: 'defined',
          extended: 'extended',
        },
      },
    });
  });

  it('preserves SDL descriptions and defaults without supplemental config', () => {
    const schema = buildSchema('type Query');
    const extendedSchema = extendSchema(
      schema,
      parse(`
        """Directive description"""
        directive @other on SCALAR

        """Object description"""
        type DescribedObject {
          describedField(
            """Argument description"""
            arg: String = "default"
          ): String
        }

        """Interface description"""
        interface DescribedInterface {
          id: ID
        }

        """Enum description"""
        enum DescribedEnum {
          VALUE
        }

        """Union description"""
        union DescribedUnion = DescribedObject

        """Scalar description"""
        scalar DescribedScalar

        extend scalar DescribedScalar @specifiedBy(url: "https://specified.example/v2")

        scalar FallbackScalar @specifiedBy(url: "https://specified.example/v1")

        extend scalar FallbackScalar @other

        """Input description"""
        input DescribedInput {
          value: String
        }
      `),
    );

    const object = assertObjectType(extendedSchema.getType('DescribedObject'));
    expect(object.description).to.equal('Object description');
    const arg = object.getFields().describedField.args[0];
    expect(arg.description).to.equal('Argument description');
    expect(arg.default?.literal).to.include({
      kind: Kind.STRING,
      value: 'default',
      block: false,
    });

    const iface = assertInterfaceType(
      extendedSchema.getType('DescribedInterface'),
    );
    expect(iface.description).to.equal('Interface description');

    const enumType = assertEnumType(extendedSchema.getType('DescribedEnum'));
    expect(enumType.description).to.equal('Enum description');

    const union = assertUnionType(extendedSchema.getType('DescribedUnion'));
    expect(union.description).to.equal('Union description');

    const scalar = assertScalarType(extendedSchema.getType('DescribedScalar'));
    expect(scalar.description).to.equal('Scalar description');
    expect(scalar.specifiedByURL).to.equal('https://specified.example/v2');
    const fallbackScalar = assertScalarType(
      extendedSchema.getType('FallbackScalar'),
    );
    expect(fallbackScalar.specifiedByURL).to.equal(
      'https://specified.example/v1',
    );

    const input = assertInputObjectType(
      extendedSchema.getType('DescribedInput'),
    );
    expect(input.description).to.equal('Input description');
  });

  it('extends existing elements while supplementing only new definitions', () => {
    const schema = buildSchema(`
      interface Node {
        id: ID
      }

      type Result implements Node {
        id: ID
      }

      enum Episode {
        NEW_HOPE
      }

      input Filter {
        text: String
      }

      type Query {
        result: Result
      }
    `);

    const extendedSchema = extendSchema(
      schema,
      parse(`
        extend interface Node {
          label: String
        }

        extend type Query {
          filter(input: Filter): Episode
        }

        extend enum Episode {
          EMPIRE
        }

        extend input Filter {
          limit: Int
        }

        type AddedObject {
          id: ID
        }

        interface AddedInterface {
          id: ID
        }

        enum AddedEnum {
          VALUE
        }

        input AddedInput {
          value: String
        }
      `),
      {
        supplementalConfig: {
          objectTypes: {
            Query: {},
            AddedObject: {
              extensions: { added: true },
            },
          },
          interfaceTypes: {
            Node: {},
            AddedInterface: {
              extensions: { added: true },
            },
          },
          enumTypes: {
            Episode: {},
            AddedEnum: {
              extensions: { added: true },
            },
          },
          inputObjectTypes: {
            Filter: {},
            AddedInput: {
              extensions: { added: true },
            },
          },
        },
      },
    );

    const query = assertObjectType(extendedSchema.getType('Query'));
    expect(query.getFields().filter).to.not.equal(undefined);

    const node = assertInterfaceType(extendedSchema.getType('Node'));
    expect(node.getFields().label).to.not.equal(undefined);

    const episode = assertEnumType(extendedSchema.getType('Episode'));
    expect(episode.getValue('EMPIRE')).to.not.equal(undefined);

    const filter = assertInputObjectType(extendedSchema.getType('Filter'));
    expect(filter.getFields().limit).to.not.equal(undefined);
  });

  it('rejects supplemental config for a missing directive', () => {
    const schema = buildSchema('type Query');

    expect(() =>
      extendSchema(
        schema,
        parse('directive @tag(label: String) on FIELD_DEFINITION'),
        {
          supplementalConfig: {
            directives: {
              missing: {},
            },
          },
        },
      ),
    ).to.throw(
      'Directive supplemental config "@missing" does not match a directive declared by the document.',
    );
  });

  it('rejects supplemental config for a missing directive argument', () => {
    const schema = buildSchema('type Query');

    expect(() =>
      extendSchema(
        schema,
        parse('directive @tag(label: String) on FIELD_DEFINITION'),
        {
          supplementalConfig: {
            directives: {
              tag: {
                args: {
                  missing: { extensions: { argument: true } },
                },
              },
            },
          },
        },
      ),
    ).to.throw(
      'Argument supplemental config "@tag(missing:)" does not match an argument declared by the document.',
    );
  });

  it('rejects supplemental config for a missing field coordinate', () => {
    const schema = buildSchema('type Query');

    expect(() =>
      extendSchema(
        schema,
        parse('extend type Query { fieldKnown(argKnown: String): String }'),
        {
          supplementalConfig: {
            objectTypes: {
              Query: {
                fields: {
                  fieldUnknown: () => 'unknown',
                },
              },
            },
          },
        },
      ),
    ).to.throw(
      'Field supplemental config "Query.fieldUnknown" does not match a field declared by the document.',
    );
  });

  it('rejects supplemental config for a missing field argument coordinate', () => {
    const schema = buildSchema('type Query');

    expect(() =>
      extendSchema(
        schema,
        parse('extend type Query { fieldKnown(argKnown: String): String }'),
        {
          supplementalConfig: {
            objectTypes: {
              Query: {
                fields: {
                  fieldKnown: {
                    args: {
                      argUnknown: { extensions: { argument: true } },
                    },
                  },
                },
              },
            },
          },
        },
      ),
    ).to.throw(
      'Argument supplemental config "Query.fieldKnown(argUnknown:)" does not match an argument declared by the document.',
    );
  });

  it('rejects supplemental config for an existing object field', () => {
    const schema = buildSchema('type Query { oldField: String }');

    expect(() =>
      extendSchema(schema, parse('extend type Query { oldField: String }'), {
        assumeValidSDL: true,
        supplementalConfig: {
          objectTypes: {
            Query: {
              fields: {
                oldField: () => 'old',
              },
            },
          },
        },
      }),
    ).to.throw(
      'Field supplemental config "Query.oldField" cannot modify an existing field.',
    );
  });

  it('rejects supplemental config for an existing interface field', () => {
    const schema = buildSchema(`
      interface Node { id: ID }
      type Item implements Node { id: ID }
      type Query { item: Item }
    `);

    expect(() =>
      extendSchema(schema, parse('extend interface Node { id: ID }'), {
        assumeValidSDL: true,
        supplementalConfig: {
          interfaceTypes: {
            Node: {
              fields: {
                id: { extensions: { field: true } },
              },
            },
          },
        },
      }),
    ).to.throw(
      'Field supplemental config "Node.id" cannot modify an existing field.',
    );
  });

  it('rejects supplemental config for an input field not added by the extension', () => {
    const schema = buildSchema('input Filter { text: String } type Query');

    expect(() =>
      extendSchema(schema, parse('extend input Filter { missing: String }'), {
        supplementalConfig: {
          inputObjectTypes: {
            Filter: {
              fields: {
                text: { extensions: { input: true } },
              },
            },
          },
        },
      }),
    ).to.throw(
      'Input field supplemental config "Filter.text" does not match an input field declared by the document.',
    );
  });

  it('rejects supplemental config for a missing input field coordinate', () => {
    const schema = buildSchema('type Query');

    expect(() =>
      extendSchema(schema, parse('input EmptyInput'), {
        supplementalConfig: {
          inputObjectTypes: {
            EmptyInput: {
              fields: {
                missing: { extensions: { input: true } },
              },
            },
          },
        },
      }),
    ).to.throw(
      'Input field supplemental config "EmptyInput.missing" does not match an input field declared by the document.',
    );
  });

  it('rejects supplemental config for an existing input field', () => {
    const schema = buildSchema('input Filter { text: String } type Query');

    expect(() =>
      extendSchema(schema, parse('extend input Filter { text: String }'), {
        assumeValidSDL: true,
        supplementalConfig: {
          inputObjectTypes: {
            Filter: {
              fields: {
                text: { extensions: { input: true } },
              },
            },
          },
        },
      }),
    ).to.throw(
      'Input field supplemental config "Filter.text" cannot modify an existing input field.',
    );
  });

  it('rejects supplemental config for an enum value not added by the extension', () => {
    const schema = buildSchema('enum Episode { NEW_HOPE } type Query');

    expect(() =>
      extendSchema(schema, parse('extend enum Episode { EMPIRE }'), {
        supplementalConfig: {
          enumTypes: {
            Episode: {
              values: {
                JEDI: { value: 6 },
              },
            },
          },
        },
      }),
    ).to.throw(
      'Enum value supplemental config "Episode.JEDI" does not match an enum value declared by the document.',
    );
  });

  it('rejects supplemental config for a missing enum value coordinate', () => {
    const schema = buildSchema('type Query');

    expect(() =>
      extendSchema(schema, parse('enum EmptyEnum'), {
        supplementalConfig: {
          enumTypes: {
            EmptyEnum: {
              values: {
                MISSING: { value: 1 },
              },
            },
          },
        },
      }),
    ).to.throw(
      'Enum value supplemental config "EmptyEnum.MISSING" does not match an enum value declared by the document.',
    );
  });

  it('rejects supplemental config for an existing enum value', () => {
    const schema = buildSchema('enum Episode { NEW_HOPE } type Query');

    expect(() =>
      extendSchema(schema, parse('extend enum Episode { NEW_HOPE }'), {
        assumeValidSDL: true,
        supplementalConfig: {
          enumTypes: {
            Episode: {
              values: {
                NEW_HOPE: { value: 4 },
              },
            },
          },
        },
      }),
    ).to.throw(
      'Enum value supplemental config "Episode.NEW_HOPE" cannot modify an existing enum value.',
    );
  });

  it('rejects supplemental config for a missing type coordinate', () => {
    const schema = buildSchema('type Query');

    expect(() =>
      extendSchema(schema, parse('extend type Query { newField: String }'), {
        supplementalConfig: {
          objectTypes: {
            Missing: {},
          },
        },
      }),
    ).to.throw(
      'Type supplemental config "Missing" does not match a type declared by the document.',
    );
  });

  it('suggests the matching supplementalConfig property for a type in the wrong bucket', () => {
    const schema = buildSchema('type Query');

    expect(() =>
      extendSchema(schema, parse('scalar Odd'), {
        supplementalConfig: {
          objectTypes: {
            Odd: { extensions: { objectType: true } },
          },
        },
      }),
    ).to.throw(
      'Type supplemental config property "objectTypes.Odd" does not match the type declared or extended by the document. Did you mean "scalarTypes.Odd"?',
    );
  });

  it('suggests the matching supplementalConfig property for a type extension in the wrong bucket', () => {
    const schema = buildSchema('scalar Odd type Query');

    expect(() =>
      extendSchema(
        schema,
        parse('extend scalar Odd @specifiedBy(url: "https://odd.example")'),
        {
          supplementalConfig: {
            objectTypes: {
              Odd: {},
            },
          },
        },
      ),
    ).to.throw(
      'Type supplemental config property "objectTypes.Odd" does not match the type declared or extended by the document. Did you mean "scalarTypes.Odd"?',
    );
  });

  it('rejects supplemental extensions for an existing type extension', () => {
    const schema = buildSchema('type Query');

    expect(() =>
      extendSchema(schema, parse('extend type Query { newField: String }'), {
        supplementalConfig: {
          objectTypes: {
            Query: {
              fields: {
                newField: () => 'new',
              },
              extensions: { query: true },
            },
          },
        },
      }),
    ).to.throw(
      'Type supplemental config "Query.extensions" cannot modify an existing type.',
    );
  });

  it('rejects extra supplemental config for an existing type extension', () => {
    const schema = buildSchema('type Query');

    expect(() =>
      extendSchema(schema, parse('extend type Query { newField: String }'), {
        supplementalConfig: {
          objectTypes: {
            Query: {
              unusedOption: 'unused',
            },
          },
        } as any,
      }),
    ).to.throw(
      'Type supplemental config "Query.unusedOption" cannot modify an existing type.',
    );
  });

  it('rejects field supplemental config when an object extension adds no fields', () => {
    const schema = buildSchema('type Query');

    expect(() =>
      extendSchema(
        schema,
        parse('directive @objectTag on OBJECT extend type Query @objectTag'),
        {
          supplementalConfig: {
            objectTypes: {
              Query: {
                fields: {
                  missing: () => 'missing',
                },
              },
            },
          },
        },
      ),
    ).to.throw(
      'Field supplemental config "Query.missing" does not match a field declared by the document.',
    );
  });

  it('rejects field supplemental config for a missing interface field coordinate', () => {
    const schema = buildSchema('type Query');

    expect(() =>
      extendSchema(schema, parse('interface Empty'), {
        supplementalConfig: {
          interfaceTypes: {
            Empty: {
              fields: {
                missing: { extensions: { field: true } },
              },
            },
          },
        },
      }),
    ).to.throw(
      'Field supplemental config "Empty.missing" does not match a field declared by the document.',
    );
  });

  it('rejects field supplemental config when an interface extension adds no fields', () => {
    const schema = buildSchema('interface Node { id: ID } type Query');

    expect(() =>
      extendSchema(
        schema,
        parse(
          'directive @interfaceTag on INTERFACE extend interface Node @interfaceTag',
        ),
        {
          supplementalConfig: {
            interfaceTypes: {
              Node: {
                fields: {
                  missing: { extensions: { field: true } },
                },
              },
            },
          },
        },
      ),
    ).to.throw(
      'Field supplemental config "Node.missing" does not match a field declared by the document.',
    );
  });

  it('rejects input field supplemental config when an input extension adds no fields', () => {
    const schema = buildSchema('input Filter { text: String } type Query');

    expect(() =>
      extendSchema(
        schema,
        parse(
          'directive @inputTag on INPUT_OBJECT extend input Filter @inputTag',
        ),
        {
          supplementalConfig: {
            inputObjectTypes: {
              Filter: {
                fields: {
                  missing: { extensions: { input: true } },
                },
              },
            },
          },
        },
      ),
    ).to.throw(
      'Input field supplemental config "Filter.missing" does not match an input field declared by the document.',
    );
  });

  it('rejects enum value supplemental config when an enum extension adds no values', () => {
    const schema = buildSchema('enum Episode { NEW_HOPE } type Query');

    expect(() =>
      extendSchema(
        schema,
        parse('directive @enumTag on ENUM extend enum Episode @enumTag'),
        {
          supplementalConfig: {
            enumTypes: {
              Episode: {
                values: {
                  MISSING: { value: 1 },
                },
              },
            },
          },
        },
      ),
    ).to.throw(
      'Enum value supplemental config "Episode.MISSING" does not match an enum value declared by the document.',
    );
  });

  it('rejects supplemental config for an existing type without a matching extension', () => {
    const schema = buildSchema('type Query { oldField: String }');

    expect(() =>
      extendSchema(schema, parse('type Added'), {
        supplementalConfig: {
          objectTypes: {
            Query: {
              fields: {
                oldField: () => 'old',
              },
            },
          },
        },
      }),
    ).to.throw(
      'Type supplemental config "Query" cannot modify an existing type.',
    );
  });

  it('rejects scalar supplemental config for an existing type without a matching extension', () => {
    const schema = buildSchema('scalar Odd type Query');

    expect(() =>
      extendSchema(schema, parse('type Added'), {
        supplementalConfig: {
          scalarTypes: {
            Odd: { extensions: { scalar: true } },
          },
        },
      }),
    ).to.throw(
      'Type supplemental config "Odd" cannot modify an existing type.',
    );
  });

  it('rejects interface supplemental config for an existing type without a matching extension', () => {
    const schema = buildSchema('interface Node { id: ID } type Query');

    expect(() =>
      extendSchema(schema, parse('type Added'), {
        supplementalConfig: {
          interfaceTypes: {
            Node: {
              fields: {
                label: { extensions: { field: true } },
              },
            },
          },
        },
      }),
    ).to.throw(
      'Type supplemental config "Node" cannot modify an existing type.',
    );
  });

  it('rejects union supplemental config for an existing type without a matching extension', () => {
    const schema = buildSchema(
      'type Result union SearchResult = Result type Query',
    );

    expect(() =>
      extendSchema(schema, parse('type Added'), {
        supplementalConfig: {
          unionTypes: {
            SearchResult: { resolveType: () => 'Result' },
          },
        },
      }),
    ).to.throw(
      'Type supplemental config "SearchResult" cannot modify an existing type.',
    );
  });

  it('rejects enum supplemental config for an existing type without a matching extension', () => {
    const schema = buildSchema('enum Episode { NEW_HOPE } type Query');

    expect(() =>
      extendSchema(schema, parse('type Added'), {
        supplementalConfig: {
          enumTypes: {
            Episode: {
              values: {
                EMPIRE: { value: 5 },
              },
            },
          },
        },
      }),
    ).to.throw(
      'Type supplemental config "Episode" cannot modify an existing type.',
    );
  });

  it('rejects input object supplemental config for an existing type without a matching extension', () => {
    const schema = buildSchema('input Filter { text: String } type Query');

    expect(() =>
      extendSchema(schema, parse('type Added'), {
        supplementalConfig: {
          inputObjectTypes: {
            Filter: {
              fields: {
                limit: { extensions: { input: true } },
              },
            },
          },
        },
      }),
    ).to.throw(
      'Type supplemental config "Filter" cannot modify an existing type.',
    );
  });

  it('rejects object type supplemental config for an existing type extension', () => {
    const schema = buildSchema('type Query');

    expect(() =>
      extendSchema(schema, parse('extend type Query { newField: String }'), {
        supplementalConfig: {
          objectTypes: {
            Query: {
              isTypeOf: () => true,
            },
          },
        },
      }),
    ).to.throw(
      'Type supplemental config "Query.isTypeOf" cannot modify an existing type.',
    );
  });

  it('rejects scalar supplemental config for an existing type extension', () => {
    const schema = buildSchema('scalar Odd type Query');

    expect(() =>
      extendSchema(
        schema,
        parse('extend scalar Odd @specifiedBy(url: "https://odd.example")'),
        {
          supplementalConfig: {
            scalarTypes: {
              Odd: {
                extensions: { scalar: true },
              },
            },
          },
        },
      ),
    ).to.throw(
      'Type supplemental config "Odd.extensions" cannot modify an existing type.',
    );
  });

  it('rejects union supplemental config for an existing type extension', () => {
    const schema = buildSchema(`
      type Result
      type Product
      union SearchResult = Result
      type Query
    `);

    expect(() =>
      extendSchema(schema, parse('extend union SearchResult = Product'), {
        supplementalConfig: {
          unionTypes: {
            SearchResult: {
              resolveType: () => 'Product',
            },
          },
        },
      }),
    ).to.throw(
      'Type supplemental config "SearchResult.resolveType" cannot modify an existing type.',
    );
  });

  it('does not supplement fields that already existed on the schema', () => {
    const schema = buildSchema('type Query { oldField: String }');
    const extendAST = parse('extend type Query { newField: String }');

    expect(() =>
      extendSchema(schema, extendAST, {
        supplementalConfig: {
          objectTypes: {
            Query: {
              fields: {
                oldField: () => 'old',
              },
            },
          },
        },
      }),
    ).to.throw(
      'Field supplemental config "Query.oldField" does not match a field declared by the document.',
    );
  });

  it('ignores extra top-level supplementalConfig fields', () => {
    const schema = buildSchema('type Query');
    const extendAST = parse('type Added');

    const extendedSchema = extendSchema(schema, extendAST, {
      supplementalConfig: {
        unusedOption: 'ignored',
      } as any,
    });

    expect(extendedSchema.getType('Added')).to.not.equal(undefined);
  });

  it('ignores extra type supplementalConfig fields from the regular config API', () => {
    const schema = buildSchema('type Query');
    const extendAST = parse('type Added');

    const extendedSchema = extendSchema(schema, extendAST, {
      supplementalConfig: {
        objectTypes: {
          Added: {
            description: 'Use SDL for descriptions',
          },
        },
      } as any,
    });

    const added = assertObjectType(extendedSchema.getType('Added'));
    expect(added.description).to.equal(undefined);
  });

  it('ignores extra field supplementalConfig fields from the regular config API', () => {
    const schema = buildSchema('type Query');
    const extendAST = parse('type Added { newField: String }');

    const extendedSchema = extendSchema(schema, extendAST, {
      supplementalConfig: {
        objectTypes: {
          Added: {
            fields: {
              newField: {
                description: 'Use SDL for descriptions',
              },
            },
          },
        },
      } as any,
    });

    const added = assertObjectType(extendedSchema.getType('Added'));
    expect(added.getFields().newField.description).to.equal(undefined);
  });

  it('Do not modify built-in types and directives', () => {
    const schema = buildSchema(`
      type Query {
        str: String
        int: Int
        float: Float
        id: ID
        bool: Boolean
      }
    `);

    const extensionSDL = dedent`
      extend type Query {
        foo: String
      }
    `;
    const extendedSchema = extendSchema(schema, parse(extensionSDL));

    // Built-ins are used
    expect(extendedSchema.getType('Int')).to.equal(GraphQLInt);
    expect(extendedSchema.getType('Float')).to.equal(GraphQLFloat);
    expect(extendedSchema.getType('String')).to.equal(GraphQLString);
    expect(extendedSchema.getType('Boolean')).to.equal(GraphQLBoolean);
    expect(extendedSchema.getType('ID')).to.equal(GraphQLID);

    expect(extendedSchema.getDirectives()).to.have.members(specifiedDirectives);
  });

  it('preserves original schema config', () => {
    const description = 'A schema description';
    const extensions = Object.freeze({ foo: 'bar' });
    const schema = new GraphQLSchema({ description, extensions });

    const extendedSchema = extendSchema(schema, parse('scalar Bar'));

    expect(extendedSchema.description).to.equal(description);
    expect(extendedSchema.extensions).to.deep.equal(extensions);
  });

  it('extends objects by adding new fields', () => {
    const schema = buildSchema(`
      type Query {
        someObject: SomeObject
      }

      type SomeObject implements AnotherInterface & SomeInterface {
        self: SomeObject
        tree: [SomeObject]!
        """Old field description."""
        oldField: String
      }

      interface SomeInterface {
        self: SomeInterface
      }

      interface AnotherInterface {
        self: SomeObject
      }
    `);
    const extensionSDL = dedent`
      extend type SomeObject {
        """New field description."""
        newField(arg: Boolean): String
      }
    `;
    const extendedSchema = extendSchema(schema, parse(extensionSDL));

    expect(validateSchema(extendedSchema)).to.deep.equal([]);
    expectSchemaChanges(schema, extendedSchema).to.equal(dedent`
      type SomeObject implements AnotherInterface & SomeInterface {
        self: SomeObject
        tree: [SomeObject]!
        """Old field description."""
        oldField: String
        """New field description."""
        newField(arg: Boolean): String
      }
    `);
  });

  it('extends objects with standard type fields', () => {
    const schema = buildSchema('type Query');

    // String and Boolean are always included through introspection types
    expect(schema.getType('Int')).to.equal(undefined);
    expect(schema.getType('Float')).to.equal(undefined);
    expect(schema.getType('String')).to.equal(GraphQLString);
    expect(schema.getType('Boolean')).to.equal(GraphQLBoolean);
    expect(schema.getType('ID')).to.equal(undefined);

    const extendAST = parse(`
      extend type Query {
        bool: Boolean
      }
    `);
    const extendedSchema = extendSchema(schema, extendAST);

    expect(validateSchema(extendedSchema)).to.deep.equal([]);
    expect(extendedSchema.getType('Int')).to.equal(undefined);
    expect(extendedSchema.getType('Float')).to.equal(undefined);
    expect(extendedSchema.getType('String')).to.equal(GraphQLString);
    expect(extendedSchema.getType('Boolean')).to.equal(GraphQLBoolean);
    expect(extendedSchema.getType('ID')).to.equal(undefined);

    const extendTwiceAST = parse(`
      extend type Query {
        int: Int
        float: Float
        id: ID
      }
    `);
    const extendedTwiceSchema = extendSchema(schema, extendTwiceAST);

    expect(validateSchema(extendedTwiceSchema)).to.deep.equal([]);
    expect(extendedTwiceSchema.getType('Int')).to.equal(GraphQLInt);
    expect(extendedTwiceSchema.getType('Float')).to.equal(GraphQLFloat);
    expect(extendedTwiceSchema.getType('String')).to.equal(GraphQLString);
    expect(extendedTwiceSchema.getType('Boolean')).to.equal(GraphQLBoolean);
    expect(extendedTwiceSchema.getType('ID')).to.equal(GraphQLID);
  });

  it('extends enums by adding new values', () => {
    const schema = buildSchema(`
      type Query {
        someEnum(arg: SomeEnum): SomeEnum
      }

      directive @foo(arg: SomeEnum) on SCHEMA

      enum SomeEnum {
        """Old value description."""
        OLD_VALUE
      }
    `);
    const extendAST = parse(`
      extend enum SomeEnum {
        """New value description."""
        NEW_VALUE
      }
    `);
    const extendedSchema = extendSchema(schema, extendAST);

    expect(validateSchema(extendedSchema)).to.deep.equal([]);
    expectSchemaChanges(schema, extendedSchema).to.equal(dedent`
      enum SomeEnum {
        """Old value description."""
        OLD_VALUE
        """New value description."""
        NEW_VALUE
      }
    `);
  });

  it('extends unions by adding new types', () => {
    const schema = buildSchema(`
      type Query {
        someUnion: SomeUnion
      }

      union SomeUnion = Foo | Biz

      type Foo { foo: String }
      type Biz { biz: String }
      type Bar { bar: String }
    `);
    const extendAST = parse(`
      extend union SomeUnion = Bar
    `);
    const extendedSchema = extendSchema(schema, extendAST);

    expect(validateSchema(extendedSchema)).to.deep.equal([]);
    expectSchemaChanges(schema, extendedSchema).to.equal(dedent`
      union SomeUnion = Foo | Biz | Bar
    `);
  });

  it('allows extension of union by adding itself', () => {
    const schema = buildSchema(`
      union SomeUnion
    `);
    const extendAST = parse(`
      extend union SomeUnion = SomeUnion
    `);
    const extendedSchema = extendSchema(schema, extendAST);

    expect(validateSchema(extendedSchema)).to.have.lengthOf.above(0);
    expectSchemaChanges(schema, extendedSchema).to.equal(dedent`
      union SomeUnion = SomeUnion
    `);
  });

  it('extends inputs by adding new fields', () => {
    const schema = buildSchema(`
      type Query {
        someInput(arg: SomeInput): String
      }

      directive @foo(arg: SomeInput) on SCHEMA

      input SomeInput {
        """Old field description."""
        oldField: String
      }
    `);
    const extendAST = parse(`
      extend input SomeInput {
        """New field description."""
        newField: String
      }
    `);
    const extendedSchema = extendSchema(schema, extendAST);

    expect(validateSchema(extendedSchema)).to.deep.equal([]);
    expectSchemaChanges(schema, extendedSchema).to.equal(dedent`
      input SomeInput {
        """Old field description."""
        oldField: String
        """New field description."""
        newField: String
      }
    `);
  });

  it('extends scalars by adding new directives', () => {
    const schema = buildSchema(`
      type Query {
        someScalar(arg: SomeScalar): SomeScalar
      }

      directive @foo(arg: SomeScalar) on SCALAR

      input FooInput {
        foo: SomeScalar
      }

      scalar SomeScalar
    `);
    const extensionSDL = dedent`
      extend scalar SomeScalar @foo
    `;
    const extendedSchema = extendSchema(schema, parse(extensionSDL));
    const someScalar = assertScalarType(extendedSchema.getType('SomeScalar'));

    expect(validateSchema(extendedSchema)).to.deep.equal([]);
    expectExtensionASTNodes(someScalar).to.equal(extensionSDL);
  });

  it('extends scalars by adding specifiedBy directive', () => {
    const schema = buildSchema(`
      type Query {
        foo: Foo
      }

      scalar Foo

      directive @foo on SCALAR
    `);
    const extensionSDL = dedent`
      extend scalar Foo @foo

      extend scalar Foo @specifiedBy(url: "https://example.com/foo_spec")
    `;

    const extendedSchema = extendSchema(schema, parse(extensionSDL));
    const foo = assertScalarType(extendedSchema.getType('Foo'));

    expect(foo.specifiedByURL).to.equal('https://example.com/foo_spec');

    expect(validateSchema(extendedSchema)).to.deep.equal([]);
    expectExtensionASTNodes(foo).to.equal(extensionSDL);
  });

  it('builds scalars with specifiedBy directive from extensions', () => {
    const schema = new GraphQLSchema({});
    const extensionSDL = dedent`
      schema {
        query: Query
      }

      type Query {
        foo: Foo
      }

      scalar Foo

      extend scalar Foo @specifiedBy(url: "https://example.com/foo_spec")
    `;

    const extendedSchema = extendSchema(schema, parse(extensionSDL));
    const foo = assertScalarType(extendedSchema.getType('Foo'));

    expect(foo.specifiedByURL).to.equal('https://example.com/foo_spec');

    expect(validateSchema(extendedSchema)).to.deep.equal([]);
    expectASTNode(foo).to.equal('scalar Foo');
    expectExtensionASTNodes(foo).to.equal(
      'extend scalar Foo @specifiedBy(url: "https://example.com/foo_spec")',
    );
  });

  it('correctly assign AST nodes to new and extended types', () => {
    const schema = buildSchema(`
      type Query

      scalar SomeScalar
      enum SomeEnum
      union SomeUnion
      input SomeInput
      type SomeObject
      interface SomeInterface

      directive @foo on SCALAR
    `);
    const firstExtensionAST = parse(`
      extend type Query {
        newField(testArg: TestInput): TestEnum
      }

      extend scalar SomeScalar @foo

      extend enum SomeEnum {
        NEW_VALUE
      }

      extend union SomeUnion = SomeObject

      extend input SomeInput {
        newField: String
      }

      extend interface SomeInterface {
        newField: String
      }

      enum TestEnum {
        TEST_VALUE
      }

      input TestInput {
        testInputField: TestEnum
      }
    `);
    const extendedSchema = extendSchema(schema, firstExtensionAST);

    const secondExtensionAST = parse(`
      extend type Query {
        oneMoreNewField: TestUnion
      }

      extend scalar SomeScalar @test

      extend enum SomeEnum {
        ONE_MORE_NEW_VALUE
      }

      extend union SomeUnion = TestType

      extend input SomeInput {
        oneMoreNewField: String
      }

      extend interface SomeInterface {
        oneMoreNewField: String
      }

      union TestUnion = TestType

      interface TestInterface {
        interfaceField: String
      }

      type TestType implements TestInterface {
        interfaceField: String
      }

      directive @test(arg: Int) repeatable on FIELD | SCALAR
    `);
    const extendedTwiceSchema = extendSchema(
      extendedSchema,
      secondExtensionAST,
    );

    const extendedInOneGoSchema = extendSchema(
      schema,
      concatAST([firstExtensionAST, secondExtensionAST]),
    );
    expect(printSchema(extendedInOneGoSchema)).to.equal(
      printSchema(extendedTwiceSchema),
    );

    const query = assertObjectType(extendedTwiceSchema.getType('Query'));
    const someEnum = assertEnumType(extendedTwiceSchema.getType('SomeEnum'));
    const someUnion = assertUnionType(extendedTwiceSchema.getType('SomeUnion'));
    const someScalar = assertScalarType(
      extendedTwiceSchema.getType('SomeScalar'),
    );
    const someInput = assertInputObjectType(
      extendedTwiceSchema.getType('SomeInput'),
    );
    const someInterface = assertInterfaceType(
      extendedTwiceSchema.getType('SomeInterface'),
    );

    const testInput = assertInputObjectType(
      extendedTwiceSchema.getType('TestInput'),
    );
    const testEnum = assertEnumType(extendedTwiceSchema.getType('TestEnum'));
    const testUnion = assertUnionType(extendedTwiceSchema.getType('TestUnion'));
    const testType = assertObjectType(extendedTwiceSchema.getType('TestType'));
    const testInterface = assertInterfaceType(
      extendedTwiceSchema.getType('TestInterface'),
    );
    const testDirective = assertDirective(
      extendedTwiceSchema.getDirective('test'),
    );

    expect(testType.extensionASTNodes).to.deep.equal([]);
    expect(testEnum.extensionASTNodes).to.deep.equal([]);
    expect(testUnion.extensionASTNodes).to.deep.equal([]);
    expect(testInput.extensionASTNodes).to.deep.equal([]);
    expect(testInterface.extensionASTNodes).to.deep.equal([]);

    expect([
      testInput.astNode,
      testEnum.astNode,
      testUnion.astNode,
      testInterface.astNode,
      testType.astNode,
      testDirective.astNode,
      ...query.extensionASTNodes,
      ...someScalar.extensionASTNodes,
      ...someEnum.extensionASTNodes,
      ...someUnion.extensionASTNodes,
      ...someInput.extensionASTNodes,
      ...someInterface.extensionASTNodes,
    ]).to.have.members([
      ...firstExtensionAST.definitions,
      ...secondExtensionAST.definitions,
    ]);

    const newField = query.getFields().newField;
    expectASTNode(newField).to.equal('newField(testArg: TestInput): TestEnum');
    expectASTNode(newField.args[0]).to.equal('testArg: TestInput');
    expectASTNode(query.getFields().oneMoreNewField).to.equal(
      'oneMoreNewField: TestUnion',
    );

    expectASTNode(someEnum.getValue('NEW_VALUE')).to.equal('NEW_VALUE');
    expectASTNode(someEnum.getValue('ONE_MORE_NEW_VALUE')).to.equal(
      'ONE_MORE_NEW_VALUE',
    );

    expectASTNode(someInput.getFields().newField).to.equal('newField: String');
    expectASTNode(someInput.getFields().oneMoreNewField).to.equal(
      'oneMoreNewField: String',
    );
    expectASTNode(someInterface.getFields().newField).to.equal(
      'newField: String',
    );
    expectASTNode(someInterface.getFields().oneMoreNewField).to.equal(
      'oneMoreNewField: String',
    );

    expectASTNode(testInput.getFields().testInputField).to.equal(
      'testInputField: TestEnum',
    );

    expectASTNode(testEnum.getValue('TEST_VALUE')).to.equal('TEST_VALUE');

    expectASTNode(testInterface.getFields().interfaceField).to.equal(
      'interfaceField: String',
    );
    expectASTNode(testType.getFields().interfaceField).to.equal(
      'interfaceField: String',
    );
    expectASTNode(testDirective.args[0]).to.equal('arg: Int');
  });

  it('builds types with deprecated fields/values', () => {
    const schema = new GraphQLSchema({});
    const extendAST = parse(`
      type SomeObject {
        deprecatedField: String @deprecated(reason: "not used anymore")
      }

      enum SomeEnum {
        DEPRECATED_VALUE @deprecated(reason: "do not use")
      }
    `);
    const extendedSchema = extendSchema(schema, extendAST);

    const someType = assertObjectType(extendedSchema.getType('SomeObject'));
    expect(someType.getFields().deprecatedField).to.include({
      deprecationReason: 'not used anymore',
    });

    const someEnum = assertEnumType(extendedSchema.getType('SomeEnum'));
    expect(someEnum.getValue('DEPRECATED_VALUE')).to.include({
      deprecationReason: 'do not use',
    });
  });

  it('extends objects with deprecated fields', () => {
    const schema = buildSchema('type SomeObject');
    const extendAST = parse(`
      extend type SomeObject {
        deprecatedField: String @deprecated(reason: "not used anymore")
      }
    `);
    const extendedSchema = extendSchema(schema, extendAST);

    const someType = assertObjectType(extendedSchema.getType('SomeObject'));
    expect(someType.getFields().deprecatedField).to.include({
      deprecationReason: 'not used anymore',
    });
  });

  it('extends enums with deprecated values', () => {
    const schema = buildSchema('enum SomeEnum');
    const extendAST = parse(`
      extend enum SomeEnum {
        DEPRECATED_VALUE @deprecated(reason: "do not use")
      }
    `);
    const extendedSchema = extendSchema(schema, extendAST);

    const someEnum = assertEnumType(extendedSchema.getType('SomeEnum'));
    expect(someEnum.getValue('DEPRECATED_VALUE')).to.include({
      deprecationReason: 'do not use',
    });
  });

  it('adds new unused types', () => {
    const schema = buildSchema(`
      type Query {
        dummy: String
      }
    `);
    const extensionSDL = dedent`
      type DummyUnionMember {
        someField: String
      }

      enum UnusedEnum {
        SOME_VALUE
      }

      input UnusedInput {
        someField: String
      }

      interface UnusedInterface {
        someField: String
      }

      type UnusedObject {
        someField: String
      }

      union UnusedUnion = DummyUnionMember
    `;
    const extendedSchema = extendSchema(schema, parse(extensionSDL));

    expect(validateSchema(extendedSchema)).to.deep.equal([]);
    expectSchemaChanges(schema, extendedSchema).to.equal(extensionSDL);
  });

  it('extends objects by adding new fields with arguments', () => {
    const schema = buildSchema(`
      type SomeObject

      type Query {
        someObject: SomeObject
      }
    `);
    const extendAST = parse(`
      input NewInputObj {
        field1: Int
        field2: [Float]
        field3: String!
      }

      extend type SomeObject {
        newField(arg1: String, arg2: NewInputObj!): String
      }
    `);
    const extendedSchema = extendSchema(schema, extendAST);

    expect(validateSchema(extendedSchema)).to.deep.equal([]);
    expectSchemaChanges(schema, extendedSchema).to.equal(dedent`
      type SomeObject {
        newField(arg1: String, arg2: NewInputObj!): String
      }

      input NewInputObj {
        field1: Int
        field2: [Float]
        field3: String!
      }
    `);
  });

  it('extends objects by adding new fields with existing types', () => {
    const schema = buildSchema(`
      type Query {
        someObject: SomeObject
      }

      type SomeObject
      enum SomeEnum { VALUE }
    `);
    const extendAST = parse(`
      extend type SomeObject {
        newField(arg1: SomeEnum!): SomeEnum
      }
    `);
    const extendedSchema = extendSchema(schema, extendAST);

    expect(validateSchema(extendedSchema)).to.deep.equal([]);
    expectSchemaChanges(schema, extendedSchema).to.equal(dedent`
      type SomeObject {
        newField(arg1: SomeEnum!): SomeEnum
      }
    `);
  });

  it('extends objects by adding implemented interfaces', () => {
    const schema = buildSchema(`
      type Query {
        someObject: SomeObject
      }

      type SomeObject {
        foo: String
      }

      interface SomeInterface {
        foo: String
      }
    `);
    const extendAST = parse(`
      extend type SomeObject implements SomeInterface
    `);
    const extendedSchema = extendSchema(schema, extendAST);

    expect(validateSchema(extendedSchema)).to.deep.equal([]);
    expectSchemaChanges(schema, extendedSchema).to.equal(dedent`
      type SomeObject implements SomeInterface {
        foo: String
      }
    `);
  });

  it('extends objects by including new types', () => {
    const schema = buildSchema(`
      type Query {
        someObject: SomeObject
      }

      type SomeObject {
        oldField: String
      }
    `);
    const newTypesSDL = dedent`
      enum NewEnum {
        VALUE
      }

      interface NewInterface {
        baz: String
      }

      type NewObject implements NewInterface {
        baz: String
      }

      scalar NewScalar

      union NewUnion = NewObject`;
    const extendAST = parse(`
      ${newTypesSDL}
      extend type SomeObject {
        newObject: NewObject
        newInterface: NewInterface
        newUnion: NewUnion
        newScalar: NewScalar
        newEnum: NewEnum
        newTree: [SomeObject]!
      }
    `);
    const extendedSchema = extendSchema(schema, extendAST);

    expect(validateSchema(extendedSchema)).to.deep.equal([]);
    expectSchemaChanges(schema, extendedSchema).to.equal(dedent`
      type SomeObject {
        oldField: String
        newObject: NewObject
        newInterface: NewInterface
        newUnion: NewUnion
        newScalar: NewScalar
        newEnum: NewEnum
        newTree: [SomeObject]!
      }

      ${newTypesSDL}
    `);
  });

  it('extends objects by adding implemented new interfaces', () => {
    const schema = buildSchema(`
      type Query {
        someObject: SomeObject
      }

      type SomeObject implements OldInterface {
        oldField: String
      }

      interface OldInterface {
        oldField: String
      }
    `);
    const extendAST = parse(`
      extend type SomeObject implements NewInterface {
        newField: String
      }

      interface NewInterface {
        newField: String
      }
    `);
    const extendedSchema = extendSchema(schema, extendAST);

    expect(validateSchema(extendedSchema)).to.deep.equal([]);
    expectSchemaChanges(schema, extendedSchema).to.equal(dedent`
      type SomeObject implements OldInterface & NewInterface {
        oldField: String
        newField: String
      }

      interface NewInterface {
        newField: String
      }
    `);
  });

  it('extends different types multiple times', () => {
    const schema = buildSchema(`
      type Query {
        someScalar: SomeScalar
        someObject(someInput: SomeInput): SomeObject
        someInterface: SomeInterface
        someEnum: SomeEnum
        someUnion: SomeUnion
      }

      scalar SomeScalar

      type SomeObject implements SomeInterface {
        oldField: String
      }

      interface SomeInterface {
        oldField: String
      }

      enum SomeEnum {
        OLD_VALUE
      }

      union SomeUnion = SomeObject

      input SomeInput {
        oldField: String
      }
    `);
    const newTypesSDL = dedent`
      scalar NewScalar

      scalar AnotherNewScalar

      type NewObject {
        foo: String
      }

      type AnotherNewObject {
        foo: String
      }

      interface NewInterface {
        newField: String
      }

      interface AnotherNewInterface {
        anotherNewField: String
      }
    `;
    const schemaWithNewTypes = extendSchema(schema, parse(newTypesSDL));
    expectSchemaChanges(schema, schemaWithNewTypes).to.equal(newTypesSDL);

    const extendAST = parse(`
      extend scalar SomeScalar @specifiedBy(url: "http://example.com/foo_spec")

      extend type SomeObject implements NewInterface {
        newField: String
      }

      extend type SomeObject implements AnotherNewInterface {
        anotherNewField: String
      }

      extend enum SomeEnum {
        NEW_VALUE
      }

      extend enum SomeEnum {
        ANOTHER_NEW_VALUE
      }

      extend union SomeUnion = NewObject

      extend union SomeUnion = AnotherNewObject

      extend input SomeInput {
        newField: String
      }

      extend input SomeInput {
        anotherNewField: String
      }
    `);
    const extendedSchema = extendSchema(schemaWithNewTypes, extendAST);

    expect(validateSchema(extendedSchema)).to.deep.equal([]);
    expectSchemaChanges(schema, extendedSchema).to.equal(dedent`
      scalar SomeScalar @specifiedBy(url: "http://example.com/foo_spec")

      type SomeObject implements SomeInterface & NewInterface & AnotherNewInterface {
        oldField: String
        newField: String
        anotherNewField: String
      }

      enum SomeEnum {
        OLD_VALUE
        NEW_VALUE
        ANOTHER_NEW_VALUE
      }

      union SomeUnion = SomeObject | NewObject | AnotherNewObject

      input SomeInput {
        oldField: String
        newField: String
        anotherNewField: String
      }

      ${newTypesSDL}
    `);
  });

  it('extends interfaces by adding new fields', () => {
    const schema = buildSchema(`
      interface SomeInterface {
        oldField: String
      }

      interface AnotherInterface implements SomeInterface {
        oldField: String
      }

      type SomeObject implements SomeInterface & AnotherInterface {
        oldField: String
      }

      type Query {
        someInterface: SomeInterface
      }
    `);
    const extendAST = parse(`
      extend interface SomeInterface {
        newField: String
      }

      extend interface AnotherInterface {
        newField: String
      }

      extend type SomeObject {
        newField: String
      }
    `);
    const extendedSchema = extendSchema(schema, extendAST);

    expect(validateSchema(extendedSchema)).to.deep.equal([]);
    expectSchemaChanges(schema, extendedSchema).to.equal(dedent`
      interface SomeInterface {
        oldField: String
        newField: String
      }

      interface AnotherInterface implements SomeInterface {
        oldField: String
        newField: String
      }

      type SomeObject implements SomeInterface & AnotherInterface {
        oldField: String
        newField: String
      }
    `);
  });

  it('extends interfaces by adding new implemented interfaces', () => {
    const schema = buildSchema(`
      interface SomeInterface {
        oldField: String
      }

      interface AnotherInterface implements SomeInterface {
        oldField: String
      }

      type SomeObject implements SomeInterface & AnotherInterface {
        oldField: String
      }

      type Query {
        someInterface: SomeInterface
      }
    `);
    const extendAST = parse(`
      interface NewInterface {
        newField: String
      }

      extend interface AnotherInterface implements NewInterface {
        newField: String
      }

      extend type SomeObject implements NewInterface {
        newField: String
      }
    `);
    const extendedSchema = extendSchema(schema, extendAST);

    expect(validateSchema(extendedSchema)).to.deep.equal([]);
    expectSchemaChanges(schema, extendedSchema).to.equal(dedent`
      interface AnotherInterface implements SomeInterface & NewInterface {
        oldField: String
        newField: String
      }

      type SomeObject implements SomeInterface & AnotherInterface & NewInterface {
        oldField: String
        newField: String
      }

      interface NewInterface {
        newField: String
      }
    `);
  });

  it('allows extension of interface with missing Object fields', () => {
    const schema = buildSchema(`
      type Query {
        someInterface: SomeInterface
      }

      type SomeObject implements SomeInterface {
        oldField: SomeInterface
      }

      interface SomeInterface {
        oldField: SomeInterface
      }
    `);
    const extendAST = parse(`
      extend interface SomeInterface {
        newField: String
      }
    `);
    const extendedSchema = extendSchema(schema, extendAST);

    expect(validateSchema(extendedSchema)).to.have.lengthOf.above(0);
    expectSchemaChanges(schema, extendedSchema).to.equal(dedent`
      interface SomeInterface {
        oldField: SomeInterface
        newField: String
      }
    `);
  });

  it('extends interfaces multiple times', () => {
    const schema = buildSchema(`
      type Query {
        someInterface: SomeInterface
      }

      interface SomeInterface {
        some: SomeInterface
      }
    `);

    const extendAST = parse(`
      extend interface SomeInterface {
        newFieldA: Int
      }

      extend interface SomeInterface {
        newFieldB(test: Boolean): String
      }
    `);
    const extendedSchema = extendSchema(schema, extendAST);

    expect(validateSchema(extendedSchema)).to.deep.equal([]);
    expectSchemaChanges(schema, extendedSchema).to.equal(dedent`
      interface SomeInterface {
        some: SomeInterface
        newFieldA: Int
        newFieldB(test: Boolean): String
      }
    `);
  });

  it('may extend mutations and subscriptions', () => {
    const mutationSchema = buildSchema(`
      type Query {
        queryField: String
      }

      type Mutation {
        mutationField: String
      }

      type Subscription {
        subscriptionField: String
      }
    `);
    const ast = parse(`
      extend type Query {
        newQueryField: Int
      }

      extend type Mutation {
        newMutationField: Int
      }

      extend type Subscription {
        newSubscriptionField: Int
      }
    `);
    const originalPrint = printSchema(mutationSchema);
    const extendedSchema = extendSchema(mutationSchema, ast);
    expect(extendedSchema).to.not.equal(mutationSchema);
    expect(printSchema(mutationSchema)).to.equal(originalPrint);
    expect(printSchema(extendedSchema)).to.equal(dedent`
      type Query {
        queryField: String
        newQueryField: Int
      }

      type Mutation {
        mutationField: String
        newMutationField: Int
      }

      type Subscription {
        subscriptionField: String
        newSubscriptionField: Int
      }
    `);
  });

  it('may extend directives with new directive', () => {
    const schema = buildSchema(`
      type Query {
        foo: String
      }
    `);
    const extensionSDL = dedent`
      """New directive."""
      directive @new(enable: Boolean!, tag: String) repeatable on QUERY | FIELD
    `;
    const extendedSchema = extendSchema(schema, parse(extensionSDL));

    expect(validateSchema(extendedSchema)).to.deep.equal([]);
    expectSchemaChanges(schema, extendedSchema).to.equal(extensionSDL);
  });

  it('Rejects invalid SDL', () => {
    const schema = new GraphQLSchema({});
    const extendAST = parse('extend schema @unknown');

    expect(() => extendSchema(schema, extendAST)).to.throw(
      'Unknown directive "@unknown".',
    );
  });

  it('Allows to disable SDL validation', () => {
    const schema = new GraphQLSchema({});
    const extendAST = parse('extend schema @unknown');

    extendSchema(schema, extendAST, { assumeValid: true });
    extendSchema(schema, extendAST, { assumeValidSDL: true });
  });

  it('Throws on unknown types', () => {
    const schema = new GraphQLSchema({});
    const ast = parse(`
      type Query {
        unknown: UnknownType
      }
    `);
    expect(() => extendSchema(schema, ast, { assumeValidSDL: true })).to.throw(
      'Unknown type: "UnknownType".',
    );
  });

  it('does not allow replacing a default directive', () => {
    const schema = new GraphQLSchema({});
    const extendAST = parse(`
      directive @include(if: Boolean!) on FIELD | FRAGMENT_SPREAD
    `);

    expect(() => extendSchema(schema, extendAST)).to.throw(
      'Directive "@include" already exists in the schema. It cannot be redefined.',
    );
  });

  it('does not allow replacing an existing enum value', () => {
    const schema = buildSchema(`
      enum SomeEnum {
        ONE
      }
    `);
    const extendAST = parse(`
      extend enum SomeEnum {
        ONE
      }
    `);

    expect(() => extendSchema(schema, extendAST)).to.throw(
      'Enum value "SomeEnum.ONE" already exists in the schema. It cannot also be defined in this type extension.',
    );
  });

  describe('can add additional root operation types', () => {
    it('does not automatically include common root type names', () => {
      const schema = new GraphQLSchema({});
      const extendedSchema = extendSchema(schema, parse('type Mutation'));

      expect(extendedSchema.getType('Mutation')).to.not.equal(undefined);
      expect(extendedSchema.getMutationType()).to.equal(undefined);
    });

    it('adds schema definition missing in the original schema', () => {
      const schema = buildSchema(`
        directive @foo on SCHEMA
        type Foo
      `);
      expect(schema.getQueryType()).to.equal(undefined);

      const extensionSDL = dedent`
        """Root schema."""
        schema @foo {
          query: Foo
        }
      `;
      const extendedSchema = extendSchema(schema, parse(extensionSDL));

      const queryType = extendedSchema.getQueryType();
      expect(queryType).to.include({ name: 'Foo' });
      expectASTNode(extendedSchema).to.equal(extensionSDL);
    });

    it('adds new root types via schema extension', () => {
      const schema = buildSchema(`
        type Query
        type MutationRoot
      `);
      const extensionSDL = dedent`
        extend schema {
          mutation: MutationRoot
        }
      `;
      const extendedSchema = extendSchema(schema, parse(extensionSDL));

      const mutationType = extendedSchema.getMutationType();
      expect(mutationType).to.include({ name: 'MutationRoot' });
      expectExtensionASTNodes(extendedSchema).to.equal(extensionSDL);
    });

    it('adds directive via schema extension', () => {
      const schema = buildSchema(`
        type Query

        directive @foo on SCHEMA
      `);
      const extensionSDL = dedent`
        extend schema @foo
      `;
      const extendedSchema = extendSchema(schema, parse(extensionSDL));

      expectExtensionASTNodes(extendedSchema).to.equal(extensionSDL);
    });

    it('adds multiple new root types via schema extension', () => {
      const schema = buildSchema('type Query');
      const extendAST = parse(`
        extend schema {
          mutation: Mutation
          subscription: Subscription
        }

        type Mutation
        type Subscription
      `);
      const extendedSchema = extendSchema(schema, extendAST);

      const mutationType = extendedSchema.getMutationType();
      expect(mutationType).to.include({ name: 'Mutation' });

      const subscriptionType = extendedSchema.getSubscriptionType();
      expect(subscriptionType).to.include({ name: 'Subscription' });
    });

    it('applies multiple schema extensions', () => {
      const schema = buildSchema('type Query');
      const extendAST = parse(`
        extend schema {
          mutation: Mutation
        }
        type Mutation

        extend schema {
          subscription: Subscription
        }
        type Subscription
      `);
      const extendedSchema = extendSchema(schema, extendAST);

      const mutationType = extendedSchema.getMutationType();
      expect(mutationType).to.include({ name: 'Mutation' });

      const subscriptionType = extendedSchema.getSubscriptionType();
      expect(subscriptionType).to.include({ name: 'Subscription' });
    });

    it('schema extension AST are available from schema object', () => {
      const schema = buildSchema(`
        type Query

        directive @foo on SCHEMA
      `);

      const extendAST = parse(`
        extend schema {
          mutation: Mutation
        }
        type Mutation

        extend schema {
          subscription: Subscription
        }
        type Subscription
      `);
      const extendedSchema = extendSchema(schema, extendAST);

      const secondExtendAST = parse('extend schema @foo');
      const extendedTwiceSchema = extendSchema(extendedSchema, secondExtendAST);

      expectExtensionASTNodes(extendedTwiceSchema).to.equal(dedent`
        extend schema {
          mutation: Mutation
        }

        extend schema {
          subscription: Subscription
        }

        extend schema @foo
      `);
    });

    it('extend directive to make it deprecated', () => {
      const schema = buildSchema('directive @isDeprecated on FIELD_DEFINITION');
      const extendAST = parse(
        `
        extend directive @isDeprecated @deprecated(reason: "use another directive")
      `,
      );
      const extendedSchema = extendSchema(schema, extendAST);

      const isDeprecatedDirective = assertDirective(
        extendedSchema.getDirective('isDeprecated'),
      );
      expect(isDeprecatedDirective).to.include({
        deprecationReason: 'use another directive',
      });
    });

    it('preserves deprecated directives when extending other types', () => {
      const schema = buildASTSchema(
        parse(
          dedent`
            type Query {
              foo: String
            }

            directive @isDeprecated @deprecated(reason: "use another directive") on FIELD_DEFINITION
          `,
        ),
      );
      const extendAST = parse(dedent`
        extend type Query {
          bar: Int
        }
      `);
      const extendedSchema = extendSchema(schema, extendAST);

      const isDeprecatedDirective = assertDirective(
        extendedSchema.getDirective('isDeprecated'),
      );
      expect(isDeprecatedDirective).to.include({
        deprecationReason: 'use another directive',
      });
    });

    it('applies directive extensions defined in the same document', () => {
      const schema = buildASTSchema(
        parse(
          dedent`
            directive @onDirective on DIRECTIVE_DEFINITION
            directive @someDirective on FIELD_DEFINITION

            extend directive @someDirective @onDirective
          `,
        ),
      );

      const someDirective = assertDirective(
        schema.getDirective('someDirective'),
      );
      expectExtensionASTNodes(someDirective).to.equal(
        'extend directive @someDirective @onDirective',
      );
    });

    it('builds directives with deprecation from extensions', () => {
      const schema = new GraphQLSchema({});
      const extensionSDL = dedent`
        directive @isDeprecated on FIELD_DEFINITION

        extend directive @isDeprecated @deprecated(reason: "use another directive")
      `;
      const extendedSchema = extendSchema(schema, parse(extensionSDL));

      const isDeprecatedDirective = assertDirective(
        extendedSchema.getDirective('isDeprecated'),
      );
      expect(isDeprecatedDirective).to.include({
        deprecationReason: 'use another directive',
      });
      expectASTNode(isDeprecatedDirective).to.equal(
        'directive @isDeprecated on FIELD_DEFINITION',
      );
      expectExtensionASTNodes(isDeprecatedDirective).to.equal(
        'extend directive @isDeprecated @deprecated(reason: "use another directive")',
      );
    });

    it('applies multiple directive extensions defined in the same document', () => {
      const schema = buildASTSchema(
        parse(
          dedent`
            directive @onDirective on DIRECTIVE_DEFINITION
            directive @otherDirective on DIRECTIVE_DEFINITION
            directive @someDirective on FIELD_DEFINITION

            extend directive @someDirective @onDirective
            extend directive @someDirective @otherDirective
          `,
        ),
      );

      const someDirective = assertDirective(
        schema.getDirective('someDirective'),
      );
      expectExtensionASTNodes(someDirective).to.equal(dedent`
        extend directive @someDirective @onDirective

        extend directive @someDirective @otherDirective
      `);
    });

    it('extend directive without adding new directives is an error', () => {
      expect(() => parse('extend directive @isDeprecated')).to.throw(
        'Syntax Error: Unexpected <EOF>.',
      );
    });
  });
});
