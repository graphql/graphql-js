import { GraphQLError } from '../../error/GraphQLError';
import { print } from '../../language/printer';
import { isInputType } from '../../type/definition';
import { typeFromAST } from '../../utilities/typeFromAST';

/**
 * Variables are input types
 *
 * A GraphQL operation is only valid if all the variables it defines are of
 * input types (scalar, enum, or input object).
 */
export function VariablesAreInputTypes(context) {
  return {
    VariableDefinition: function VariableDefinition(node) {
      var type = typeFromAST(context.getSchema(), node.type);

      if (type && !isInputType(type)) {
        var variableName = node.variable.name.value;
        var typeName = print(node.type);
        context.reportError(new GraphQLError("Variable \"$".concat(variableName, "\" cannot be non-input type \"").concat(typeName, "\"."), node.type));
      }
    }
  };
}
