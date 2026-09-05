/** @category Validation Rules */

import { inspect } from '../../jsutils/inspect.ts';

import type { DefinitionNode } from '../../language/ast.ts';
import { Kind } from '../../language/kinds.ts';
import { print } from '../../language/printer.ts';

import { isOutputType } from '../../type/definition.ts';

import type {
  TypeSystemValidationFn,
  TypeSystemValidationIndex,
} from '../TypeSystemValidationIndex.ts';

/**
 * Object and interface fields must be output types.
 *
 * See https://spec.graphql.org/draft/#sec-Objects
 * See https://spec.graphql.org/draft/#sec-Interfaces
 * @category Validation Rules
 
 * @internal
 */
export const FieldsOfOutputTypesTypeSystemValidation: TypeSystemValidationFn = (
  index: TypeSystemValidationIndex,
): void => {
  if (index.shouldValidateSchemaOnlyElements()) {
    for (const { outputType, field } of index.getSchemaValidationElements()
      .outputTypes) {
      if (!isOutputType(outputType)) {
        index.reportError(
          outputTypeExpectedMessage(String(field), inspect(outputType)),
          field.astNode?.type,
        );
      }
    }
  }

  for (const definition of index.document.definitions) {
    validateDefinition(index, definition);
  }
};

function validateDefinition(
  index: TypeSystemValidationIndex,
  definition: DefinitionNode,
): void {
  switch (definition.kind) {
    case Kind.OBJECT_TYPE_DEFINITION:
    case Kind.OBJECT_TYPE_EXTENSION:
    case Kind.INTERFACE_TYPE_DEFINITION:
    case Kind.INTERFACE_TYPE_EXTENSION: {
      const fields = definition.fields;
      if (fields == null) {
        break;
      }
      for (const field of fields) {
        if (index.hasNonOutputType(field.type)) {
          index.reportError(
            outputTypeExpectedMessage(
              `${definition.name.value}.${field.name.value}`,
              print(field.type),
            ),
            field.type,
          );
        }
      }
      break;
    }
    default:
      break;
  }
}

function outputTypeExpectedMessage(
  fieldStr: string,
  outputTypeStr: string,
): string {
  return `The type of ${fieldStr} must be Output Type but got: ${outputTypeStr}.`;
}
