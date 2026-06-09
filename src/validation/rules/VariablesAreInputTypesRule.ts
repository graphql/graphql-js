/** @category Validation Rules */

import { GraphQLError } from '../../error/GraphQLError.ts';

import type { VariableDefinitionNode } from '../../language/ast.ts';
import { print } from '../../language/printer.ts';
import type { ASTVisitor } from '../../language/visitor.ts';

import { isInputType } from '../../type/definition.ts';

import { typeFromAST } from '../../utilities/typeFromAST.ts';

import type { ValidationContext } from '../ValidationContext.ts';

/**
 * Variables are input types
 *
 * A GraphQL operation is only valid if all the variables it defines are of
 * input types (scalar, enum, or input object).
 *
 * See https://spec.graphql.org/draft/#sec-Variables-Are-Input-Types
 * @param context - The validation context used while checking the document.
 * @returns A visitor that reports validation errors for this rule.
 * @example
 * ```ts
 * import { buildSchema, parse, validate } from 'graphql';
 * import { VariablesAreInputTypesRule } from 'graphql/validation';
 *
 * const schema = buildSchema(`
 *   type Query {
 *     field(arg: ID): String
 *   }
 *
 *   type User {
 *     name: String
 *   }
 * `);
 *
 * const invalidDocument = parse(`
 *   query ($user: User) { field(arg: "1") }
 * `);
 * const invalidErrors = validate(schema, invalidDocument, [
 *   VariablesAreInputTypesRule,
 * ]);
 *
 * invalidErrors.length; // => 1
 *
 * const validDocument = parse(`
 *   query ($id: ID) { field(arg: $id) }
 * `);
 * const validErrors = validate(schema, validDocument, [
 *   VariablesAreInputTypesRule,
 * ]);
 *
 * validErrors; // => []
 * ```
 */
export function VariablesAreInputTypesRule(
  context: ValidationContext,
): ASTVisitor {
  return {
    VariableDefinition(node: VariableDefinitionNode) {
      const type = typeFromAST(context.getSchema(), node.type);

      if (type !== undefined && !isInputType(type)) {
        const variableName = node.variable.name.value;
        const typeName = print(node.type);

        context.reportError(
          new GraphQLError(
            `Variable "$${variableName}" cannot be non-input type "${typeName}".`,
            { nodes: node.type },
          ),
        );
      }
    },
  };
}
