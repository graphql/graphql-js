export interface GraphQLGrammarType {
  [name: string]: GraphQLGrammarRule;
}

export type GraphQLGrammarRule =
  | GraphQLGrammarRuleName
  | GraphQLGrammarRuleConstraint
  | GraphQLGrammarConstraintsSet;

export type GraphQLGrammarRuleName = string;

export type GraphQLGrammarRuleConstraint =
  | GraphQLGrammarTokenConstraint
  | GraphQLGrammarOfTypeConstraint
  | GraphQLGrammarListOfTypeConstraint
  | GraphQLGrammarPeekConstraint;

export type GraphQLGrammarConstraintsSet = Array<
  GraphQLGrammarRuleName | GraphQLGrammarRuleConstraint
>;

export interface GraphQLGrammarBaseRuleConstraint {
  butNot?: GraphQLGrammarTokenConstraint | Array<GraphQLGrammarTokenConstraint>;
  optional?: boolean;
  eatNextOnFail?: boolean;
}

export interface GraphQLGrammarTokenConstraint
  extends GraphQLGrammarBaseRuleConstraint {
  token:
    | '!'
    | '$'
    | '&'
    | '('
    | ')'
    | '...'
    | ':'
    | '='
    | '@'
    | '['
    | ']'
    | '{'
    | '}'
    | '|'
    | 'Name'
    | 'Int'
    | 'Float'
    | 'String'
    | 'BlockString'
    | 'Comment';
  ofValue?: string;
  oneOf?: Array<string>;
  tokenName?: string;
  definitionName?: boolean;
  typeName?: boolean;
}

export interface GraphQLGrammarOfTypeConstraint
  extends GraphQLGrammarBaseRuleConstraint {
  ofType: GraphQLGrammarRule;
  tokenName?: string;
}

export interface GraphQLGrammarListOfTypeConstraint
  extends GraphQLGrammarBaseRuleConstraint {
  listOfType: GraphQLGrammarRuleName;
}

export interface GraphQLGrammarPeekConstraint
  extends GraphQLGrammarBaseRuleConstraint {
  peek: Array<GraphQLGrammarPeekConstraintCondition>;
}

export interface GraphQLGrammarPeekConstraintCondition {
  ifCondition: GraphQLGrammarTokenConstraint;
  expect: GraphQLGrammarRule;
  end?: boolean;
}

const grammar: GraphQLGrammarType = {
  Name: { token: 'Name' },
  String: { token: 'String' },
  BlockString: { token: 'BlockString' },

  Document: { listOfType: 'Definition' },
  Definition: {
    peek: [
      {
        ifCondition: {
          token: 'Name',
          oneOf: ['query', 'mutation', 'subscription'],
        },
        expect: 'OperationDefinition',
      },
      {
        ifCondition: { token: 'Name', ofValue: 'fragment' },
        expect: 'FragmentDefinition',
      },
      {
        ifCondition: {
          token: 'Name',
          oneOf: [
            'schema',
            'scalar',
            'type',
            'interface',
            'union',
            'enum',
            'input',
            'directive',
          ],
        },
        expect: 'TypeSystemDefinition',
      },
      {
        ifCondition: { token: 'Name', ofValue: 'extend' },
        expect: 'TypeSystemExtension',
      },
      {
        ifCondition: { token: '{' },
        expect: 'OperationDefinition',
      },
      {
        ifCondition: 'String',
        expect: 'TypeSystemDefinition',
      },
      {
        ifCondition: 'BlockString',
        expect: 'TypeSystemDefinition',
      },
    ],
  },

  OperationDefinition: {
    peek: [
      {
        ifCondition: { token: '{' },
        expect: 'SelectionSet',
      },
      {
        ifCondition: {
          token: 'Name',
          oneOf: ['query', 'mutation', 'subscription'],
        },
        expect: [
          'OperationType',
          {
            token: 'Name',
            optional: true,
            tokenName: 'OperationName',
            definitionName: true,
          },
          { ofType: 'VariableDefinitions', optional: true },
          { ofType: 'Directives', optional: true },
          'SelectionSet',
        ],
      },
    ],
  },
  OperationType: {
    ofType: 'OperationTypeName',
  },
  OperationTypeName: {
    token: 'Name',
    oneOf: ['query', 'mutation', 'subscription'],
    definitionName: true,
  },
  SelectionSet: [{ token: '{' }, { listOfType: 'Selection' }, { token: '}' }],
  Selection: {
    peek: [
      {
        ifCondition: { token: '...' },
        expect: 'Fragment',
      },
      {
        ifCondition: { token: 'Name' },
        expect: 'Field',
      },
    ],
  },

  Field: [
    {
      ofType: 'Alias',
      optional: true,
      eatNextOnFail: true,
      definitionName: true,
    },
    { token: 'Name', tokenName: 'FieldName', definitionName: true },
    { ofType: 'Arguments', optional: true },
    { ofType: 'Directives', optional: true },
    { ofType: 'SelectionSet', optional: true },
  ],

  Arguments: [{ token: '(' }, { listOfType: 'Argument' }, { token: ')' }],
  Argument: [
    { token: 'Name', tokenName: 'ArgumentName', definitionName: true },
    { token: ':' },
    'Value',
  ],

  Alias: [
    { token: 'Name', tokenName: 'AliasName', definitionName: true },
    { token: ':' },
  ],

  Fragment: [
    { token: '...' },
    {
      peek: [
        {
          ifCondition: 'FragmentName',
          expect: 'FragmentSpread',
        },
        {
          ifCondition: { token: 'Name', ofValue: 'on' },
          expect: 'InlineFragment',
        },
        {
          ifCondition: { token: '@' },
          expect: 'InlineFragment',
        },
        {
          ifCondition: { token: '{' },
          expect: 'InlineFragment',
        },
      ],
    },
  ],

  FragmentSpread: ['FragmentName', { ofType: 'Directives', optional: true }],
  FragmentDefinition: [
    {
      token: 'Name',
      ofValue: 'fragment',
      tokenName: 'FragmentDefinitionKeyword',
    },
    'FragmentName',
    'TypeCondition',
    { ofType: 'Directives', optional: true },
    'SelectionSet',
  ],
  FragmentName: {
    token: 'Name',
    butNot: { token: 'Name', ofValue: 'on' },
    definitionName: true,
  },

  TypeCondition: [
    { token: 'Name', ofValue: 'on', tokenName: 'OnKeyword' },
    'TypeName',
  ],

  InlineFragment: [
    { ofType: 'TypeCondition', optional: true },
    { ofType: 'Directives', optional: true },
    'SelectionSet',
  ],

  Value: {
    peek: [
      {
        ifCondition: { token: '$' },
        expect: 'Variable',
      },
      {
        ifCondition: 'IntValue',
        expect: { ofType: 'IntValue', tokenName: 'NumberValue' },
      },
      {
        ifCondition: 'FloatValue',
        expect: { ofType: 'FloatValue', tokenName: 'NumberValue' },
      },
      {
        ifCondition: 'BooleanValue',
        expect: { ofType: 'BooleanValue', tokenName: 'BooleanValue' },
      },
      {
        ifCondition: 'EnumValue',
        expect: { ofType: 'EnumValue', tokenName: 'EnumValue' },
      },
      {
        ifCondition: 'String',
        expect: { ofType: 'String', tokenName: 'StringValue' },
      },
      {
        ifCondition: 'BlockString',
        expect: { ofType: 'BlockString', tokenName: 'StringValue' },
      },
      {
        ifCondition: 'NullValue',
        expect: { ofType: 'NullValue', tokenName: 'NullValue' },
      },
      {
        ifCondition: { token: '[' },
        expect: 'ListValue',
      },
      {
        ifCondition: { token: '{' },
        expect: 'ObjectValue',
      },
    ],
  },

  ConstValue: {
    peek: [
      {
        ifCondition: 'IntValue',
        expect: { ofType: 'IntValue' },
      },
      {
        ifCondition: 'FloatValue',
        expect: { ofType: 'FloatValue' },
      },
      {
        ifCondition: 'BooleanValue',
        expect: 'BooleanValue',
      },
      {
        ifCondition: 'EnumValue',
        expect: 'EnumValue',
      },
      {
        ifCondition: 'String',
        expect: { ofType: 'String', tokenName: 'StringValue' },
      },
      {
        ifCondition: 'BlockString',
        expect: { token: 'BlockString', tokenName: 'StringValue' },
      },
      {
        ifCondition: 'NullValue',
        expect: 'NullValue',
      },
      {
        ifCondition: { token: '[' },
        expect: 'ConstListValue',
      },
      {
        ifCondition: { token: '{' },
        expect: 'ObjectValue',
      },
    ],
  },

  IntValue: { token: 'Int' },

  FloatValue: { token: 'Float' },

  StringValue: {
    peek: [
      {
        ifCondition: { token: 'String' },
        expect: { token: 'String', tokenName: 'StringValue' },
      },
      {
        ifCondition: { token: 'BlockString' },
        expect: { token: 'BlockString', tokenName: 'StringValue' },
      },
    ],
  },

  BooleanValue: {
    token: 'Name',
    oneOf: ['true', 'false'],
    tokenName: 'BooleanValue',
  },

  NullValue: {
    token: 'Name',
    ofValue: 'null',
    tokenName: 'NullValue',
  },

  EnumValue: {
    token: 'Name',
    butNot: { token: 'Name', oneOf: ['null', 'true', 'false'] },
    tokenName: 'EnumValue',
  },

  ListValue: [
    { token: '[' },
    { listOfType: 'Value', optional: true },
    { token: ']' },
  ],

  ConstListValue: [
    { token: '[' },
    { listOfType: 'ConstValue', optional: true },
    { token: ']' },
  ],

  ObjectValue: [
    { token: '{' },
    { listOfType: 'ObjectField', optional: true },
    { token: '}' },
  ],
  ObjectField: [
    { token: 'Name', tokenName: 'ObjectFieldName' },
    { token: ':' },
    { ofType: 'ConstValue' },
  ],

  Variable: [
    { token: '$', tokenName: 'VariableName' },
    { token: 'Name', tokenName: 'VariableName' },
  ],
  VariableDefinitions: [
    { token: '(' },
    { listOfType: 'VariableDefinition' },
    { token: ')' },
  ],
  VariableDefinition: [
    'Variable',
    { token: ':' },
    'Type',
    { ofType: 'DefaultValue', optional: true },
  ],
  DefaultValue: [{ token: '=' }, 'ConstValue'],

  TypeName: { token: 'Name', tokenName: 'TypeName', typeName: true },

  Type: {
    peek: [
      {
        ifCondition: { token: 'Name' },
        expect: ['TypeName', { token: '!', optional: true }],
      },
      {
        ifCondition: { token: '[' },
        expect: 'ListType',
      },
    ],
  },
  ListType: [
    { token: '[' },
    { listOfType: 'Type' },
    { token: ']' },
    { token: '!', optional: true },
  ],

  Directives: { listOfType: 'Directive' },
  Directive: [
    { token: '@', tokenName: 'DirectiveName' },
    { token: 'Name', tokenName: 'DirectiveName' },
    { ofType: 'Arguments', optional: true },
  ],

  TypeSystemDefinition: [
    { ofType: 'Description', optional: true },
    {
      peek: [
        {
          ifCondition: {
            target: 'Name',
            ofValue: 'schema',
          },
          expect: 'SchemaDefinition',
        },
        {
          ifCondition: {
            target: 'Name',
            ofValue: 'scalar',
          },
          expect: 'ScalarTypeDefinition',
        },
        {
          ifCondition: {
            target: 'Name',
            ofValue: 'type',
          },
          expect: 'ObjectTypeDefinition',
        },
        {
          ifCondition: {
            target: 'Name',
            ofValue: 'interface',
          },
          expect: 'InterfaceTypeDefinition',
        },
        {
          ifCondition: {
            target: 'Name',
            ofValue: 'union',
          },
          expect: 'UnionTypeDefinition',
        },
        {
          ifCondition: {
            target: 'Name',
            ofValue: 'enum',
          },
          expect: 'EnumTypeDefinition',
        },
        {
          ifCondition: {
            target: 'Name',
            ofValue: 'input',
          },
          expect: 'InputObjectTypeDefinition',
        },
        {
          ifCondition: {
            target: 'Name',
            ofValue: 'directive',
          },
          expect: 'DirectiveDefinition',
        },
      ],
    },
  ],

  TypeSystemExtension: {
    peek: [
      {
        ifCondition: {
          target: 'Name',
          ofValue: 'schema',
        },
        expect: 'SchemaExtension',
      },
      {
        ifCondition: {
          target: 'Name',
          ofValue: 'scalar',
        },
        expect: 'ScalarTypeExtension',
      },
      {
        ifCondition: {
          target: 'Name',
          ofValue: 'type',
        },
        expect: 'ObjectTypeExtension',
      },
      {
        ifCondition: {
          target: 'Name',
          ofValue: 'interface',
        },
        expect: 'InterfaceTypeExtension',
      },
      {
        ifCondition: {
          target: 'Name',
          ofValue: 'union',
        },
        expect: 'UnionTypeExtension',
      },
      {
        ifCondition: {
          target: 'Name',
          ofValue: 'enum',
        },
        expect: 'EnumTypeExtension',
      },
      {
        ifCondition: {
          target: 'Name',
          ofValue: 'input',
        },
        expect: 'InputObjectTypeExtension',
      },
    ],
  },

  SchemaDefinition: [
    {
      token: 'Name',
      ofValue: 'schema',
      tokenName: 'SchemaDefinitionKeyword',
    },
    { ofType: 'Directives', optional: true },
    { token: '{' },
    { listOfType: 'RootOperationTypeDefinition' },
    { token: '}' },
  ],
  RootOperationTypeDefinition: [
    'OperationType',
    { token: ':' },
    { token: 'Name', tokenName: 'OperationTypeDefinitionName' },
  ],

  SchemaExtension: [
    { token: 'Name', ofValue: 'extend' },
    { token: 'Name', ofValue: 'schema' },
    'Name',
    {
      peek: [
        {
          ifCondition: { token: '@' },
          expect: [
            'Directives',
            {
              ofType: [
                { token: '{' },
                { listOfType: 'RootOperationTypeDefinition' },
                { token: '}' },
              ],
              optional: true,
            },
          ],
        },
        {
          ifCondition: { token: '{' },
          expect: [
            { token: '{' },
            { listOfType: 'RootOperationTypeDefinition' },
            { token: '}' },
          ],
        },
      ],
    },
  ],

  Description: 'StringValue',

  ScalarTypeDefinition: [
    { ofType: 'Description', optional: true },
    {
      token: 'Name',
      ofValue: 'scalar',
      tokenName: 'ScalarDefinitionKeyword',
    },
    'TypeName',
    { ofType: 'Directives', optional: true },
  ],

  ScalarTypeExtension: [
    {
      token: 'Name',
      ofValue: 'extend',
      tokenName: 'ExtendDefinitionKeyword',
    },
    {
      token: 'Name',
      ofValue: 'scalar',
      tokenName: 'ScalarDefinitionKeyword',
    },
    'TypeName',
    'Directives',
  ],

  ObjectTypeDefinition: [
    { ofType: 'Description', optional: true },
    {
      token: 'Name',
      ofValue: 'type',
      tokenName: 'TypeDefinitionKeyword',
    },
    'TypeName',
    { ofType: 'ImplementsInterfaces', optional: true },
    { ofType: 'Directives', optional: true },
    { ofType: 'FieldsDefinition', optional: true },
  ],
  ImplementsInterfaces: [
    {
      token: 'Name',
      ofValue: 'implements',
      tokenName: 'ImplementsKeyword',
    },
    { token: '&', optional: true },
    'TypeName',
    {
      listOfType: 'ImplementsAdditionalInterfaceName',
      optional: true,
    },
  ],
  ImplementsAdditionalInterfaceName: [{ token: '&' }, 'TypeName'],
  FieldsDefinition: [
    { token: '{' },
    { listOfType: 'FieldDefinition' },
    { token: '}' },
  ],
  FieldDefinition: [
    { ofType: 'Description', optional: true },
    { token: 'Name', tokenName: 'AliasName', definitionName: true },
    { ofType: 'ArgumentsDefinition', optional: true },
    { token: ':' },
    'Type',
    { ofType: 'Directives', optional: true },
  ],

  ArgumentsDefinition: [
    { token: '(' },
    { listOfType: 'InputValueDefinition' },
    { token: ')' },
  ],
  InputValueDefinition: [
    { ofType: 'Description', optional: true },
    { token: 'Name', tokenName: 'ArgumentName' },
    { token: ':' },
    'Type',
    { ofType: 'DefaultValue', optional: true },
    { ofType: 'Directives', optional: true },
  ],

  ObjectTypeExtension: [
    {
      token: 'Name',
      ofValue: 'extend',
      tokenName: 'ExtendDefinitionKeyword',
    },
    {
      token: 'Name',
      ofValue: 'type',
      tokenName: 'TypeDefinitionKeyword',
    },
    'TypeName',
    {
      peek: [
        {
          ifCondition: { token: 'Name', ofValue: 'interface' },
          expect: [
            'ImplementsInterfaces',
            {
              peek: [
                {
                  ifCondition: { token: '@' },
                  expect: [
                    'Directives',
                    { ofType: 'FieldsDefinition', optional: true },
                  ],
                },
                {
                  ifCondition: { token: '{' },
                  expect: 'FieldsDefinition',
                },
              ],
              optional: true,
            },
          ],
        },
        {
          ifCondition: { token: '@' },
          expect: [
            'Directives',
            { ofType: 'FieldsDefinition', optional: true },
          ],
        },
        {
          ifCondition: { token: '{' },
          expect: 'FieldsDefinition',
        },
      ],
    },
  ],

  InterfaceTypeDefinition: [
    { ofType: 'Description', optional: true },
    {
      token: 'Name',
      ofValue: 'interface',
      tokenName: 'InterfaceDefinitionKeyword',
    },
    'TypeName',
    { ofType: 'Directives', optional: true },
    { ofType: 'FieldsDefinition', optional: true },
  ],

  InterfaceTypeExtension: [
    {
      token: 'Name',
      ofValue: 'extend',
      tokenName: 'ExtendDefinitionKeyword',
    },
    {
      token: 'Name',
      ofValue: 'interface',
      tokenName: 'InterfaceDefinitionKeyword',
    },
    'TypeName',
    {
      peek: [
        {
          ifCondition: { token: '@' },
          expect: [
            'Directives',
            { ofType: 'FieldsDefinition', optional: true },
          ],
        },
        {
          ifCondition: { token: '{' },
          expect: 'FieldsDefinition',
        },
      ],
    },
  ],

  UnionTypeDefinition: [
    { ofType: 'Description', optional: true },
    {
      token: 'Name',
      ofValue: 'union',
      tokenName: 'UnionDefinitionKeyword',
    },
    'TypeName',
    { ofType: 'Directives', optional: true },
    { ofType: 'UnionMemberTypes', optional: true },
  ],

  UnionMemberTypes: [
    { token: '=' },
    { token: '|', optional: true },
    'Name',
    {
      listOfType: 'UnionMemberAdditionalTypeName',
      optional: true,
    },
  ],

  UnionMemberAdditionalTypeName: [{ token: '|' }, 'TypeName'],

  UnionTypeExtension: [
    {
      token: 'Name',
      ofValue: 'extend',
      tokenName: 'ExtendDefinitionKeyword',
    },
    {
      token: 'Name',
      ofValue: 'union',
      tokenName: 'UnionDefinitionKeyword',
    },
    'TypeName',
    {
      peek: [
        {
          ifCondition: { token: '@' },
          expect: [
            'Directives',
            { ofType: 'UnionMemberTypes', optional: true },
          ],
        },
        {
          ifCondition: { token: '=' },
          expect: 'UnionMemberTypes',
        },
      ],
    },
  ],

  EnumTypeDefinition: [
    { ofType: 'Description', optional: true },
    {
      token: 'Name',
      ofValue: 'enum',
      tokenName: 'EnumDefinitionKeyword',
    },
    'TypeName',
    { ofType: 'Directives', optional: true },
    { ofType: 'EnumValuesDefinition', optional: true },
  ],
  EnumValuesDefinition: [
    { token: '{' },
    { listOfType: 'EnumValueDefinition' },
    { token: '}' },
  ],
  EnumValueDefinition: [
    { ofType: 'Description', optional: true },
    'EnumValue',
    { ofType: 'Directives', optional: true },
  ],

  EnumTypeExtension: [
    {
      token: 'Name',
      ofValue: 'extend',
      tokenName: 'ExtendDefinitionKeyword',
    },
    {
      token: 'Name',
      ofValue: 'enum',
      tokenName: 'EnumDefinitionKeyword',
    },
    'TypeName',
    {
      peek: [
        {
          ifCondition: { token: '@' },
          expect: [
            'Directives',
            { ofType: 'EnumValuesDefinition', optional: true },
          ],
        },
        {
          ifCondition: { token: '{' },
          expect: 'EnumValuesDefinition',
        },
      ],
    },
  ],

  InputObjectTypeDefinition: [
    { ofType: 'Description', optional: true },
    {
      token: 'Name',
      ofValue: 'input',
      tokenName: 'InputDefinitionKeyword',
    },
    'TypeName',
    { ofType: 'Directives', optional: true },
    { ofType: 'InputFieldsDefinition', optional: true },
  ],
  InputFieldsDefinition: [
    { token: '{' },
    { listOfType: 'InputValueDefinition' },
    { token: '}' },
  ],

  InputObjectTypeExtension: [
    {
      token: 'Name',
      ofValue: 'extend',
      tokenName: 'ExtendDefinitionKeyword',
    },
    {
      token: 'Name',
      ofValue: 'input',
      tokenName: 'InputDefinitionKeyword',
    },
    'TypeName',
    {
      peek: [
        {
          ifCondition: { token: '@' },
          expect: [
            'Directives',
            { ofType: 'InputFieldsDefinition', optional: true },
          ],
        },
        {
          ifCondition: { token: '{' },
          expect: 'InputFieldsDefinition',
        },
      ],
    },
  ],

  DirectiveDefinition: [
    { ofType: 'Description', optional: true },
    {
      token: 'Name',
      ofValue: 'directive',
      tokenName: 'DirectiveDefinitionKeyword',
    },
    { token: '@', tokenName: 'DirectiveName' },
    { token: 'Name', tokenName: 'DirectiveName' },
    { ofType: 'ArgumentsDefinition', optional: true },
    { token: 'Name', ofValue: 'on', tokenName: 'OnKeyword' },
    'DirectiveLocations',
  ],
  DirectiveLocations: [
    { token: '|', optional: true },
    'DirectiveLocation',
    {
      listOfType: 'DirectiveLocationAdditionalName',
      optional: true,
    },
  ],
  DirectiveLocationAdditionalName: [{ token: '|' }, 'DirectiveLocation'],
  DirectiveLocation: {
    peek: [
      {
        ifCondition: 'ExecutableDirectiveLocation',
        expect: 'ExecutableDirectiveLocation',
      },
      {
        ifCondition: 'TypeSystemDirectiveLocation',
        expect: 'TypeSystemDirectiveLocation',
      },
    ],
  },
  ExecutableDirectiveLocation: {
    token: 'Name',
    oneOf: [
      'QUERY',
      'MUTATION',
      'SUBSCRIPTION',
      'FIELD',
      'FRAGMENT_DEFINITION',
      'FRAGMENT_SPREAD',
      'INLINE_FRAGMENT',
    ],
    tokenName: 'EnumValue',
  },
  TypeSystemDirectiveLocation: {
    token: 'Name',
    oneOf: [
      'SCHEMA',
      'SCALAR',
      'OBJECT',
      'FIELD_DEFINITION',
      'ARGUMENT_DEFINITION',
      'INTERFACE',
      'UNION',
      'ENUM',
      'ENUM_VALUE',
      'INPUT_OBJECT',
      'INPUT_FIELD_DEFINITION',
    ],
    tokenName: 'EnumValue',
  },
};

export default grammar;
