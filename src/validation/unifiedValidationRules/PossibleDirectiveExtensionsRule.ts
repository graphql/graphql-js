/** @category Validation Rules */

import { didYouMean } from '../../jsutils/didYouMean.ts';
import { suggestionList } from '../../jsutils/suggestionList.ts';

import type { NameNode } from '../../language/ast.ts';
import { Kind } from '../../language/kinds.ts';

import type {
  TypeSystemValidationFn,
  TypeSystemValidationIndex,
} from '../TypeSystemValidationIndex.ts';

/**
 * Directive extensions must extend an existing directive.
 *
 * See https://spec.graphql.org/draft/#sec-Directive-Extensions
 * @category Validation Rules
 
 * @internal
 */
export const PossibleDirectiveExtensionsTypeSystemValidation: TypeSystemValidationFn =
  (index: TypeSystemValidationIndex): void => {
    validateDirectiveExtensions(index, (message, node) => {
      index.reportError(message, node);
    });
  };

/** AST validation rule variant of {@link PossibleDirectiveExtensionsTypeSystemValidation}. */

function validateDirectiveExtensions(
  index: TypeSystemValidationIndex,
  reportError: (message: string, node: NameNode) => void,
): void {
  for (const definition of index.document.definitions) {
    if (definition.kind !== Kind.DIRECTIVE_EXTENSION) {
      continue;
    }

    validateDirectiveExtension(
      definition.name.value,
      index.getDirectiveLocationSet(definition.name.value),
      index.getDirectiveNames(),
      index.hideSuggestions === true,
      (message) => {
        reportError(message, definition.name);
      },
    );
  }
}

function validateDirectiveExtension(
  directiveName: string,
  locations: ReadonlySet<string> | undefined,
  allDirectiveNames: ReadonlyArray<string>,
  hideSuggestions: boolean,
  reportError: (message: string) => void,
): void {
  if (locations != null) {
    return;
  }

  reportError(
    `Cannot extend directive "@${directiveName}" because it is not defined.` +
      didYouMean(
        hideSuggestions ? [] : suggestionList(directiveName, allDirectiveNames),
      ),
  );
}
