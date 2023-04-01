import { GraphQLError } from '../../error/GraphQLError.mjs';
/**
 * Unique directive names
 *
 * A GraphQL document is only valid if all defined directives have unique names.
 */
export function UniqueDirectiveNamesRule(context) {
  const knownDirectiveNames = new Map();
  const schema = context.getSchema();
  return {
    DirectiveDefinition(node) {
      const directiveName = node.name.value;
      if (schema?.getDirective(directiveName)) {
        context.reportError(
          new GraphQLError(
            `Directive "@${directiveName}" already exists in the schema. It cannot be redefined.`,
            { nodes: node.name },
          ),
        );
        return;
      }
      const knownName = knownDirectiveNames.get(directiveName);
      if (knownName) {
        context.reportError(
          new GraphQLError(
            `There can be only one directive named "@${directiveName}".`,
            { nodes: [knownName, node.name] },
          ),
        );
      } else {
        knownDirectiveNames.set(directiveName, node.name);
      }
      return false;
    },
  };
}
