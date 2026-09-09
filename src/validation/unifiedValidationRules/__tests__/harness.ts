import { expectJSON } from '../../../__testUtils__/expectJSON.ts';

import type { GraphQLError } from '../../../error/GraphQLError.ts';

import type { DocumentNode } from '../../../language/ast.ts';
import { parse } from '../../../language/parser.ts';

import { GraphQLObjectType } from '../../../type/definition.ts';
import { GraphQLString } from '../../../type/scalars.ts';
import type { GraphQLSchema } from '../../../type/schema.ts';
import { GraphQLSchema as GraphQLSchemaImpl } from '../../../type/schema.ts';

import { DocumentIndex } from '../../DocumentIndex.ts';
import { IndexCursor } from '../../IndexCursor.ts';
import type { TypeSystemValidationFn } from '../../TypeSystemValidationIndex.ts';
import { TypeSystemValidationIndex } from '../../TypeSystemValidationIndex.ts';
import { validateWithRules } from '../../validateWithRules.ts';

import type {
  ASTValidationContextOptions,
  ASTVisitorFn,
} from '../ASTValidationContext.ts';
import { ASTValidationContext } from '../ASTValidationContext.ts';

type RuleFn = ASTVisitorFn | TypeSystemValidationFn;

export function expectSDLRuleErrors(
  rule: RuleFn,
  sdlStr: string,
  schema?: GraphQLSchema,
): any {
  const doc = parse(sdlStr, { noLocation: true });
  const isTypeSystemRule = rule.name.endsWith('TypeSystemValidation');
  const errors = validateWithRules({
    documentAST: doc,
    rules: isTypeSystemRule ? [] : [rule as ASTVisitorFn],
    typeSystemRules: isTypeSystemRule ? [rule as TypeSystemValidationFn] : [],
    schema,
  });
  return expectJSON(errors);
}

export function expectSchemaValidationErrors(
  rule: TypeSystemValidationFn,
  schema: GraphQLSchema = schemaWithQuery(),
): any {
  return expectSchemaErrors(schema, (context) => {
    rule(context);
  });
}

export function expectSchemaErrors(
  schema: GraphQLSchema,
  validate: (index: TypeSystemValidationIndex) => void,
): any {
  const errors = new Array<unknown>();
  const documentIndex = new DocumentIndex(undefined);
  const index = new TypeSystemValidationIndex(
    documentIndex,
    schema,
    (error) => {
      errors.push(error);
    },
  );
  validate(index);
  return expectJSON(errors);
}

export function createRuleValidationContext(
  document: DocumentNode,
  schema: GraphQLSchema | undefined,
  onError: (error: GraphQLError) => void,
  options?: Partial<ASTValidationContextOptions>,
): ASTValidationContext {
  const indexCursor = new IndexCursor(
    new TypeSystemValidationIndex(new DocumentIndex(document), schema),
  );
  return new ASTValidationContext(document, indexCursor, onError, {
    ...options,
  });
}

export function getSDLRuleVisitor(
  rule: ASTVisitorFn,
  context: ASTValidationContext,
): ReturnType<ASTVisitorFn> {
  return rule(context);
}

export function schemaWithQuery(): GraphQLSchema {
  return new GraphQLSchemaImpl({
    query: new GraphQLObjectType({
      name: 'Query',
      fields: {
        field: { type: GraphQLString },
      },
    }),
  });
}
