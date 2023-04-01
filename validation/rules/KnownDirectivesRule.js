'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.KnownDirectivesRule = void 0;
const inspect_js_1 = require('../../jsutils/inspect.js');
const invariant_js_1 = require('../../jsutils/invariant.js');
const GraphQLError_js_1 = require('../../error/GraphQLError.js');
const ast_js_1 = require('../../language/ast.js');
const directiveLocation_js_1 = require('../../language/directiveLocation.js');
const kinds_js_1 = require('../../language/kinds.js');
const directives_js_1 = require('../../type/directives.js');
/**
 * Known directives
 *
 * A GraphQL document is only valid if all `@directives` are known by the
 * schema and legally positioned.
 *
 * See https://spec.graphql.org/draft/#sec-Directives-Are-Defined
 */
function KnownDirectivesRule(context) {
  const locationsMap = new Map();
  const schema = context.getSchema();
  const definedDirectives = schema
    ? schema.getDirectives()
    : directives_js_1.specifiedDirectives;
  for (const directive of definedDirectives) {
    locationsMap.set(directive.name, directive.locations);
  }
  const astDefinitions = context.getDocument().definitions;
  for (const def of astDefinitions) {
    if (def.kind === kinds_js_1.Kind.DIRECTIVE_DEFINITION) {
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
          new GraphQLError_js_1.GraphQLError(`Unknown directive "@${name}".`, {
            nodes: node,
          }),
        );
        return;
      }
      const candidateLocation = getDirectiveLocationForASTPath(ancestors);
      if (candidateLocation != null && !locations.includes(candidateLocation)) {
        context.reportError(
          new GraphQLError_js_1.GraphQLError(
            `Directive "@${name}" may not be used on ${candidateLocation}.`,
            { nodes: node },
          ),
        );
      }
    },
  };
}
exports.KnownDirectivesRule = KnownDirectivesRule;
function getDirectiveLocationForASTPath(ancestors) {
  const appliedTo = ancestors.at(-1);
  (appliedTo != null && 'kind' in appliedTo) ||
    (0, invariant_js_1.invariant)(false);
  switch (appliedTo.kind) {
    case kinds_js_1.Kind.OPERATION_DEFINITION:
      return getDirectiveLocationForOperation(appliedTo.operation);
    case kinds_js_1.Kind.FIELD:
      return directiveLocation_js_1.DirectiveLocation.FIELD;
    case kinds_js_1.Kind.FRAGMENT_SPREAD:
      return directiveLocation_js_1.DirectiveLocation.FRAGMENT_SPREAD;
    case kinds_js_1.Kind.INLINE_FRAGMENT:
      return directiveLocation_js_1.DirectiveLocation.INLINE_FRAGMENT;
    case kinds_js_1.Kind.FRAGMENT_DEFINITION:
      return directiveLocation_js_1.DirectiveLocation.FRAGMENT_DEFINITION;
    case kinds_js_1.Kind.VARIABLE_DEFINITION:
      return directiveLocation_js_1.DirectiveLocation.VARIABLE_DEFINITION;
    case kinds_js_1.Kind.SCHEMA_DEFINITION:
    case kinds_js_1.Kind.SCHEMA_EXTENSION:
      return directiveLocation_js_1.DirectiveLocation.SCHEMA;
    case kinds_js_1.Kind.SCALAR_TYPE_DEFINITION:
    case kinds_js_1.Kind.SCALAR_TYPE_EXTENSION:
      return directiveLocation_js_1.DirectiveLocation.SCALAR;
    case kinds_js_1.Kind.OBJECT_TYPE_DEFINITION:
    case kinds_js_1.Kind.OBJECT_TYPE_EXTENSION:
      return directiveLocation_js_1.DirectiveLocation.OBJECT;
    case kinds_js_1.Kind.FIELD_DEFINITION:
      return directiveLocation_js_1.DirectiveLocation.FIELD_DEFINITION;
    case kinds_js_1.Kind.INTERFACE_TYPE_DEFINITION:
    case kinds_js_1.Kind.INTERFACE_TYPE_EXTENSION:
      return directiveLocation_js_1.DirectiveLocation.INTERFACE;
    case kinds_js_1.Kind.UNION_TYPE_DEFINITION:
    case kinds_js_1.Kind.UNION_TYPE_EXTENSION:
      return directiveLocation_js_1.DirectiveLocation.UNION;
    case kinds_js_1.Kind.ENUM_TYPE_DEFINITION:
    case kinds_js_1.Kind.ENUM_TYPE_EXTENSION:
      return directiveLocation_js_1.DirectiveLocation.ENUM;
    case kinds_js_1.Kind.ENUM_VALUE_DEFINITION:
      return directiveLocation_js_1.DirectiveLocation.ENUM_VALUE;
    case kinds_js_1.Kind.INPUT_OBJECT_TYPE_DEFINITION:
    case kinds_js_1.Kind.INPUT_OBJECT_TYPE_EXTENSION:
      return directiveLocation_js_1.DirectiveLocation.INPUT_OBJECT;
    case kinds_js_1.Kind.INPUT_VALUE_DEFINITION: {
      const parentNode = ancestors.at(-3);
      (parentNode != null && 'kind' in parentNode) ||
        (0, invariant_js_1.invariant)(false);
      return parentNode.kind === kinds_js_1.Kind.INPUT_OBJECT_TYPE_DEFINITION
        ? directiveLocation_js_1.DirectiveLocation.INPUT_FIELD_DEFINITION
        : directiveLocation_js_1.DirectiveLocation.ARGUMENT_DEFINITION;
    }
    // Not reachable, all possible types have been considered.
    /* c8 ignore next 2 */
    default:
      false ||
        (0, invariant_js_1.invariant)(
          false,
          'Unexpected kind: ' + (0, inspect_js_1.inspect)(appliedTo.kind),
        );
  }
}
function getDirectiveLocationForOperation(operation) {
  switch (operation) {
    case ast_js_1.OperationTypeNode.QUERY:
      return directiveLocation_js_1.DirectiveLocation.QUERY;
    case ast_js_1.OperationTypeNode.MUTATION:
      return directiveLocation_js_1.DirectiveLocation.MUTATION;
    case ast_js_1.OperationTypeNode.SUBSCRIPTION:
      return directiveLocation_js_1.DirectiveLocation.SUBSCRIPTION;
  }
}
