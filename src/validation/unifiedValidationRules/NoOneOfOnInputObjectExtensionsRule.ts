/** @category Validation Rules */

import type { InputObjectTypeExtensionNode } from '../../language/ast.ts';
import { Kind } from '../../language/kinds.ts';

import { GraphQLOneOfDirective } from '../../type/directives.ts';

import type {
  TypeSystemValidationFn,
  TypeSystemValidationIndex,
} from '../TypeSystemValidationIndex.ts';

/**
 * The @oneOf directive must not be provided by input object type extensions.
 *
 * See https://spec.graphql.org/draft/#sec-Input-Object-Extensions
 * @category Validation Rules
 
 * @internal
 */
export const NoOneOfOnInputObjectExtensionsTypeSystemValidation: TypeSystemValidationFn =
  (index: TypeSystemValidationIndex): void => {
    for (const definition of index.document.definitions) {
      if (definition.kind === Kind.INPUT_OBJECT_TYPE_EXTENSION) {
        checkTypeSystemOneOfOnInputObjectExtension(index, definition);
      }
    }
  };

function checkTypeSystemOneOfOnInputObjectExtension(
  index: TypeSystemValidationIndex,
  node: InputObjectTypeExtensionNode,
): void {
  const directives = node.directives;
  if (directives == null) {
    return;
  }

  for (const directiveNode of directives) {
    if (directiveNode.name.value === GraphQLOneOfDirective.name) {
      index.reportError(
        oneOfOnInputObjectExtensionMessage(node.name.value),
        directiveNode,
      );
    }
  }
}

function oneOfOnInputObjectExtensionMessage(typeName: string): string {
  return `Directive "@oneOf" must not be used on input object type extension "${typeName}".`;
}
