import { inspect } from '../../jsutils/inspect';

import { GraphQLError } from '../../error/GraphQLError';

import type {
  FieldDefinitionNode,
  InputValueDefinitionNode,
  NameNode,
} from '../../language/ast';
import type { ASTVisitor } from '../../language/visitor';

import {
  isInputObjectType,
  isInputType,
  isInterfaceType,
  isObjectType,
} from '../../type/definition';

import { isEqualType } from '../../utilities/typeComparators';
import { typeFromAST } from '../../utilities/typeFromAST';
import { valueFromAST } from '../../utilities/valueFromAST';

import type { SDLValidationContext } from '../ValidationContext';

/**
 * Compare two default values for equality.
 * This handles the case where both values might be undefined, null, or actual values.
 */
function areDefaultValuesEqual(value1: unknown, value2: unknown): boolean {
  // Both undefined or both null
  if (value1 === value2) {
    return true;
  }

  // One is undefined/null and the other isn't
  if (value1 == null || value2 == null) {
    return false;
  }

  // For complex values, use JSON comparison as a simple deep equality check
  try {
    return JSON.stringify(value1) === JSON.stringify(value2);
  } catch {
    // If JSON.stringify fails, fall back to reference equality
    return value1 === value2;
  }
}

/**
 * Extended fields match original type
 *
 * A GraphQL type extension is only valid if all extended fields that already
 * exist in the original type have matching types and arguments.
 *
 * This rule validates that:
 * - Field types match exactly between original and extension
 * - Argument types match exactly between original and extension
 * - Argument default values match exactly between original and extension
 * - New arguments can be added
 */
export function ExtendedFieldsMatchOriginalTypeRule(
  context: SDLValidationContext,
): ASTVisitor {
  const schema = context.getSchema();
  if (schema == null) {
    return {};
  }

  // At this point, schema is guaranteed to be non-null
  const nonNullSchema = schema;
  const existingTypeMap = nonNullSchema.getTypeMap();

  function checkFieldCompatibility(node: {
    readonly name: NameNode;
    readonly fields?: ReadonlyArray<FieldDefinitionNode> | undefined;
  }) {
    const typeName = node.name.value;
    const existingType = existingTypeMap[typeName];

    if (
      existingType == null ||
      (!isObjectType(existingType) && !isInterfaceType(existingType))
    ) {
      return; // Type doesn't exist or isn't a field-bearing type
    }

    const existingFields = existingType.getFields();
    const extensionFields = node.fields ?? [];

    for (const extensionField of extensionFields) {
      const fieldName = extensionField.name.value;
      const existingField = existingFields[fieldName];

      if (existingField == null) {
        continue; // New field, no conflict to check
      }

      // Check field type compatibility
      const extensionFieldType = typeFromAST(
        nonNullSchema,
        extensionField.type,
      );

      if (
        extensionFieldType != null &&
        !isEqualType(existingField.type, extensionFieldType)
      ) {
        context.reportError(
          new GraphQLError(
            `Field "${typeName}.${fieldName}" type mismatch: original type is "${inspect(
              existingField.type,
            )}" but extension defines "${inspect(extensionFieldType)}".`,
            { nodes: extensionField.type },
          ),
        );
        continue;
      }

      // Check argument compatibility
      const existingArgs = existingField.args;
      const extensionArgs = extensionField.arguments ?? [];

      for (const extensionArg of extensionArgs) {
        const argName = extensionArg.name.value;
        const existingArg = existingArgs.find((arg) => arg.name === argName);

        if (existingArg != null) {
          // Argument exists in original, check type compatibility
          const extensionArgType = typeFromAST(
            nonNullSchema,
            extensionArg.type,
          );
          if (
            extensionArgType != null &&
            !isEqualType(existingArg.type, extensionArgType)
          ) {
            context.reportError(
              new GraphQLError(
                `Argument "${typeName}.${fieldName}(${argName})" type mismatch: original type is "${inspect(
                  existingArg.type,
                )}" but extension defines "${inspect(extensionArgType)}".`,
                { nodes: extensionArg.type },
              ),
            );
          }

          const argType = extensionArgType ?? existingArg.type;
          let extensionDefaultValue;

          if (isInputType(argType)) {
            extensionDefaultValue = valueFromAST(
              extensionArg.defaultValue,
              argType,
            );
          }

          if (
            !areDefaultValuesEqual(
              existingArg.defaultValue,
              extensionDefaultValue,
            )
          ) {
            const existingDefaultStr =
              existingArg.defaultValue === undefined
                ? 'no default'
                : JSON.stringify(existingArg.defaultValue);
            const extensionDefaultStr =
              extensionDefaultValue === undefined
                ? 'no default'
                : JSON.stringify(extensionDefaultValue);

            context.reportError(
              new GraphQLError(
                `Argument "${typeName}.${fieldName}(${argName})" default value mismatch: original has ${existingDefaultStr} but extension defines ${extensionDefaultStr}.`,
                { nodes: extensionArg },
              ),
            );
          }
        }
      }
    }
  }

  function checkInputFieldCompatibility(node: {
    readonly name: NameNode;
    readonly fields?: ReadonlyArray<InputValueDefinitionNode> | undefined;
  }) {
    const typeName = node.name.value;
    const existingType = existingTypeMap[typeName];

    if (existingType == null || !isInputObjectType(existingType)) {
      return; // Type doesn't exist or isn't an input object type
    }

    const existingFields = existingType.getFields();
    const extensionFields = node.fields ?? [];

    for (const extensionField of extensionFields) {
      const fieldName = extensionField.name.value;
      const existingField = existingFields[fieldName];

      if (existingField == null) {
        continue; // New field, no conflict to check
      }

      // Check input field type compatibility
      const extensionFieldType = typeFromAST(
        nonNullSchema,
        extensionField.type,
      );
      if (
        extensionFieldType != null &&
        !isEqualType(existingField.type, extensionFieldType)
      ) {
        context.reportError(
          new GraphQLError(
            `Input field "${typeName}.${fieldName}" type mismatch: original type is "${inspect(
              existingField.type,
            )}" but extension defines "${inspect(extensionFieldType)}".`,
            { nodes: extensionField.type },
          ),
        );
      }
    }
  }

  return {
    ObjectTypeExtension: checkFieldCompatibility,
    InterfaceTypeExtension: checkFieldCompatibility,
    InputObjectTypeExtension: checkInputFieldCompatibility,
  };
}
