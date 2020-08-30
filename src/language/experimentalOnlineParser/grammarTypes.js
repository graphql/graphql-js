// @flow

export type GraphQLGrammarType = {|
  rules: GraphQLGrammarRules,
|};

export interface GraphQLGrammarRules {
  [name: string]: GraphQLGrammarRule;
}
export type GraphQLGrammarRuleName = string;
export type GraphQLGrammarRuleConstraint =
  | GraphQLGrammarTokenConstraint
  | GraphQLGrammarOfTypeConstraint
  | GraphQLGrammarListOfTypeConstraint
  | GraphQLGrammarPeekConstraint;
export type GraphQLGrammarConstraintsSet = Array<
  GraphQLGrammarRuleName | GraphQLGrammarRuleConstraint,
>;
export type GraphQLGrammarRule =
  | GraphQLGrammarRuleName
  | GraphQLGrammarRuleConstraint
  | GraphQLGrammarConstraintsSet;
export interface GraphQLGrammarBaseRuleConstraint {
  butNot?:
    | ?GraphQLGrammarTokenConstraint
    | ?Array<GraphQLGrammarTokenConstraint>;
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
  ofValue?: ?string;
  oneOf?: ?Array<string>;
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
