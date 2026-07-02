/** @category Validation Rules */

import { GraphQLError } from '../../error/GraphQLError.ts';

import type { DirectiveNode } from '../../language/ast.ts';
import type { DirectiveLocation } from '../../language/directiveLocation.ts';
import type { ASTVisitor } from '../../language/visitor.ts';

import type { ASTVisitorFn } from './ASTValidationContext.ts';

/**
 * Directives must be defined and used only in valid locations.
 *
 * See https://spec.graphql.org/draft/#sec-Directives-Are-Defined
 * See https://spec.graphql.org/draft/#sec-Directives-Are-In-Valid-Locations
 * @category Validation Rules
 
 * @internal
 */
export const KnownDirectivesASTVisitor: ASTVisitorFn = (context) => {
  const indexCursor = context.indexCursor;

  const visitor: ASTVisitor = {
    Directive(directiveNode) {
      validateDirectiveNode(
        directiveNode,
        indexCursor.getCurrentDirectiveLocation(),
      );
    },
  };

  return visitor;

  function validateDirectiveNode(
    directive: DirectiveNode,
    candidateLocation: DirectiveLocation | undefined,
  ): void {
    const directiveName = directive.name.value;
    const locations = context.index.getDirectiveLocationSet(directiveName);
    validateDirectiveLocation(
      directive,
      directiveName,
      locations,
      candidateLocation,
      (message) => {
        context.reportError(new GraphQLError(message, { nodes: directive }));
      },
    );
  }
};

function validateDirectiveLocation(
  _directive: DirectiveNode,
  directiveName: string,
  locations: ReadonlySet<string> | undefined,
  candidateLocation: DirectiveLocation | undefined,
  reportError: (message: string) => void,
): void {
  if (locations == null) {
    reportError(unknownDirectiveMessage(directiveName));
    return;
  }

  if (candidateLocation != null && !locations.has(candidateLocation)) {
    reportError(misplacedDirectiveMessage(directiveName, candidateLocation));
  }
}

function unknownDirectiveMessage(directiveName: string): string {
  return `Unknown directive "@${directiveName}".`;
}

function misplacedDirectiveMessage(
  directiveName: string,
  location: string,
): string {
  return `Directive "@${directiveName}" may not be used on ${location}.`;
}
