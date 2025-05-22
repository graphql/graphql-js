import { inspect } from '../../jsutils/inspect.js';
import { invariant } from '../../jsutils/invariant.js';

import { GraphQLError } from '../../error/GraphQLError.js';

import type { ASTNode } from '../../language/ast.js';
import { OperationTypeNode } from '../../language/ast.js';
import { DirectiveLocation } from '../../language/directiveLocation.js';
import { Kind } from '../../language/kinds.js';
import type { ASTVisitor } from '../../language/visitor.js';

import { specifiedDirectives } from '../../type/directives.js';

import type {
  SDLValidationContext,
  ValidationContext,
} from '../ValidationContext.js';

/**
 * Known directives
 *
 * A GraphQL document is only valid if all `@directives` are known by the
 * schema and legally positioned.
 *
 * See https://spec.graphql.org/draft/#sec-Directives-Are-Defined
 */
export function KnownDirectivesRule(
  context: ValidationContext | SDLValidationContext,
): ASTVisitor {
  const locationsMap = new Map<string, ReadonlyArray<string>>();

  const schema = context.getSchema();
  const definedDirectives = schema
    ? schema.getDirectives()
    : specifiedDirectives;
  for (const directive of definedDirectives) {
    locationsMap.set(directive.name, directive.locations);
  }

  const astDefinitions = context.getDocument().definitions;
  for (const def of astDefinitions) {
    if (def.kind === Kind.DIRECTIVE_DEFINITION) {
      locationsMap.set(
        def.name.value,
        def.locations.map((name) => name.value),
      );
    }
  }

  return {
    Directive(node, _key, _parent, _path, ancestors) {
      const name = node.name.value;
      const locations = locationsMap.get(name);

      if (locations == null) {
        context.reportError(
          new GraphQLError(`Unknown directive "@${name}".`, { nodes: node }),
        );
        return;
      }

      const candidateLocation = getDirectiveLocationForASTPath(ancestors);
      if (candidateLocation != null && !locations.includes(candidateLocation)) {
        context.reportError(
          new GraphQLError(
            `Directive "@${name}" may not be used on ${candidateLocation}.`,
            { nodes: node },
          ),
        );
      }
    },
  };
}

function getDirectiveLocationForASTPath(
  ancestors: ReadonlyArray<ASTNode | ReadonlyArray<ASTNode>>,
): DirectiveLocation | undefined {
  const appliedTo = ancestors.at(-1);
  invariant(appliedTo != null && 'kind' in appliedTo);

  switch (appliedTo.kind) {
    case Kind.OPERATION_DEFINITION:
      return getDirectiveLocationForOperation(appliedTo.operation);
    case Kind.FIELD:
      return DirectiveLocation.FIELD;
    case Kind.FRAGMENT_SPREAD:
      return DirectiveLocation.FRAGMENT_SPREAD;
    case Kind.INLINE_FRAGMENT:
      return DirectiveLocation.INLINE_FRAGMENT;
    case Kind.FRAGMENT_DEFINITION:
      return DirectiveLocation.FRAGMENT_DEFINITION;
    case Kind.VARIABLE_DEFINITION: {
      const parentNode = ancestors[ancestors.length - 3];
      invariant('kind' in parentNode);
      return parentNode.kind === Kind.OPERATION_DEFINITION
        ? DirectiveLocation.VARIABLE_DEFINITION
        : DirectiveLocation.FRAGMENT_VARIABLE_DEFINITION;
    }
    case Kind.SCHEMA_DEFINITION:
    case Kind.SCHEMA_EXTENSION:
      return DirectiveLocation.SCHEMA;
    case Kind.SCALAR_TYPE_DEFINITION:
    case Kind.SCALAR_TYPE_EXTENSION:
      return DirectiveLocation.SCALAR;
    case Kind.OBJECT_TYPE_DEFINITION:
    case Kind.OBJECT_TYPE_EXTENSION:
      return DirectiveLocation.OBJECT;
    case Kind.FIELD_DEFINITION:
      return DirectiveLocation.FIELD_DEFINITION;
    case Kind.INTERFACE_TYPE_DEFINITION:
    case Kind.INTERFACE_TYPE_EXTENSION:
      return DirectiveLocation.INTERFACE;
    case Kind.UNION_TYPE_DEFINITION:
    case Kind.UNION_TYPE_EXTENSION:
      return DirectiveLocation.UNION;
    case Kind.ENUM_TYPE_DEFINITION:
    case Kind.ENUM_TYPE_EXTENSION:
      return DirectiveLocation.ENUM;
    case Kind.ENUM_VALUE_DEFINITION:
      return DirectiveLocation.ENUM_VALUE;
    case Kind.INPUT_OBJECT_TYPE_DEFINITION:
    case Kind.INPUT_OBJECT_TYPE_EXTENSION:
      return DirectiveLocation.INPUT_OBJECT;
    case Kind.INPUT_VALUE_DEFINITION: {
      const parentNode = ancestors.at(-3);
      invariant(parentNode != null && 'kind' in parentNode);
      return parentNode.kind === Kind.INPUT_OBJECT_TYPE_DEFINITION
        ? DirectiveLocation.INPUT_FIELD_DEFINITION
        : DirectiveLocation.ARGUMENT_DEFINITION;
    }
    // Not reachable, all possible types have been considered.
    /* c8 ignore next 2 */
    default:
      invariant(false, 'Unexpected kind: ' + inspect(appliedTo.kind));
  }
}

function getDirectiveLocationForOperation(
  operation: OperationTypeNode,
): DirectiveLocation {
  switch (operation) {
    case OperationTypeNode.QUERY:
      return DirectiveLocation.QUERY;
    case OperationTypeNode.MUTATION:
      return DirectiveLocation.MUTATION;
    case OperationTypeNode.SUBSCRIPTION:
      return DirectiveLocation.SUBSCRIPTION;
  }
}
