import { GraphQLError } from '../../error/GraphQLError.js';
import { print } from '../../language/printer.js';
import { isInputType } from '../../type/definition.js';
import { typeFromAST } from '../../utilities/typeFromAST.js';
/**
 * Variables are input types
 *
 * A GraphQL operation is only valid if all the variables it defines are of
 * input types (scalar, enum, or input object).
 *
 * See https://spec.graphql.org/draft/#sec-Variables-Are-Input-Types
 */
export function VariablesAreInputTypesRule(context) {
  return {
    VariableDefinition(node) {
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
