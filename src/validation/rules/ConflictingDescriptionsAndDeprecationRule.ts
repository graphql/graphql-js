import { GraphQLError } from '../../error/GraphQLError.js';

import type {
  DirectiveNode,
  EnumValueDefinitionNode,
  FieldDefinitionNode,
  InputValueDefinitionNode,
  NameNode,
  StringValueNode,
} from '../../language/ast.js';
import type { ASTVisitor } from '../../language/visitor.js';

import {
  isEnumType,
  isInputObjectType,
  isInterfaceType,
  isObjectType,
} from '../../type/definition.js';
import { GraphQLDeprecatedDirective } from '../../type/directives.js';

import { getDirectiveValues } from '../../execution/values.js';

import type { SDLValidationContext } from '../ValidationContext.js';

/**
 * Conflicting descriptions and deprecation messages
 *
 * A GraphQL type extension is only valid if descriptions and deprecation
 * messages are consistent between the original type and its extensions.
 *
 * This rule validates that:
 * - Extensions cannot override existing descriptions (even if empty)
 * - Extensions cannot override existing deprecation messages (even if empty)
 * - If both original and extension have descriptions/deprecations, they must match exactly
 * - Extensions can only add descriptions/deprecations when the original has null/undefined values
 *
 * Note: Extensions can only override null descriptions and deprecation reasons.
 */
export function ConflictingDescriptionsAndDeprecationRule(
  context: SDLValidationContext,
): ASTVisitor {
  const schema = context.getSchema();
  if (schema == null) {
    return {};
  }

  const existingTypeMap = schema.getTypeMap();

  /**
   * Helper function to check for conflicting descriptions between original and extension.
   */
  function checkDescriptionConflict(
    existingDescription: string | null | undefined,
    extensionDescriptionNode: StringValueNode | undefined,
    itemPath: string,
  ): void {
    const extensionDescription = extensionDescriptionNode?.value;

    if (
      existingDescription != null &&
      extensionDescription != null &&
      existingDescription !== extensionDescription
    ) {
      context.reportError(
        new GraphQLError(
          `${itemPath} cannot override description in extension: original has "${existingDescription}" but extension has "${extensionDescription}".`,
          { nodes: extensionDescriptionNode },
        ),
      );
    }
  }

  /**
   * Helper function to check for conflicting deprecation reasons between original and extension.
   */
  function checkDeprecationConflict(
    existingDeprecationReason: string | null | undefined,
    extensionNode:
      | EnumValueDefinitionNode
      | FieldDefinitionNode
      | InputValueDefinitionNode,
    itemPath: string,
  ): void {
    const extensionDeprecationReason = getDeprecationReason(extensionNode);

    if (
      existingDeprecationReason != null &&
      extensionDeprecationReason != null &&
      existingDeprecationReason !== extensionDeprecationReason
    ) {
      context.reportError(
        new GraphQLError(
          `${itemPath} cannot override deprecation reason in extension: original has "${existingDeprecationReason}" but extension has "${extensionDeprecationReason}".`,
          { nodes: getDeprecatedDirectiveNode(extensionNode) },
        ),
      );
    }
  }

  return {
    ObjectTypeExtension: checkFieldDescriptionsAndDeprecation,
    InterfaceTypeExtension: checkFieldDescriptionsAndDeprecation,
    EnumTypeExtension: checkEnumValueDescriptionsAndDeprecation,
    InputObjectTypeExtension: checkInputFieldDescriptionsAndDeprecation,
  };

  function checkFieldDescriptionsAndDeprecation(node: {
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

      // Check description and deprecation consistency
      checkDescriptionConflict(
        existingField.description,
        extensionField.description,
        `Field "${typeName}.${fieldName}"`,
      );

      checkDeprecationConflict(
        existingField.deprecationReason,
        extensionField,
        `Field "${typeName}.${fieldName}"`,
      );

      // Check argument descriptions and deprecation reasons
      const existingArgs = existingField.args;
      const extensionArgs = extensionField.arguments ?? [];

      for (const extensionArg of extensionArgs) {
        const argName = extensionArg.name.value;
        const existingArg = existingArgs.find((arg) => arg.name === argName);

        if (existingArg != null) {
          checkDescriptionConflict(
            existingArg.description,
            extensionArg.description,
            `Argument "${typeName}.${fieldName}(${argName}:)"`,
          );

          checkDeprecationConflict(
            existingArg.deprecationReason,
            extensionArg,
            `Argument "${typeName}.${fieldName}(${argName}:)"`,
          );
        }
      }
    }
  }

  function checkEnumValueDescriptionsAndDeprecation(node: {
    readonly name: NameNode;
    readonly values?: ReadonlyArray<EnumValueDefinitionNode> | undefined;
  }) {
    const typeName = node.name.value;
    const existingType = existingTypeMap[typeName];

    if (existingType == null || !isEnumType(existingType)) {
      return; // Type doesn't exist or isn't an enum type
    }

    const existingValues = existingType.getValues();
    const extensionValues = node.values ?? [];

    for (const extensionValue of extensionValues) {
      const valueName = extensionValue.name.value;
      const existingValue = existingValues.find(
        (value) => value.name === valueName,
      );

      if (existingValue == null) {
        continue; // New value, no conflict to check
      }

      checkDescriptionConflict(
        existingValue.description,
        extensionValue.description,
        `Enum value "${typeName}.${valueName}"`,
      );

      checkDeprecationConflict(
        existingValue.deprecationReason,
        extensionValue,
        `Enum value "${typeName}.${valueName}"`,
      );
    }
  }

  function checkInputFieldDescriptionsAndDeprecation(node: {
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

      checkDescriptionConflict(
        existingField.description,
        extensionField.description,
        `Input field "${typeName}.${fieldName}"`,
      );

      checkDeprecationConflict(
        existingField.deprecationReason,
        extensionField,
        `Input field "${typeName}.${fieldName}"`,
      );
    }
  }
}

/**
 * Given a node with directives, returns the deprecation reason if it has a
 * deprecated directive, or undefined if it doesn't.
 */
function getDeprecationReason(
  node:
    | EnumValueDefinitionNode
    | FieldDefinitionNode
    | InputValueDefinitionNode,
): string | undefined {
  const deprecated = getDirectiveValues(GraphQLDeprecatedDirective, node);
  // @ts-expect-error validated by `getDirectiveValues`
  return deprecated?.reason;
}

/**
 * Given a node with directives, returns the deprecated directive node if it exists.
 */
function getDeprecatedDirectiveNode(node: {
  readonly directives?: ReadonlyArray<DirectiveNode> | undefined;
}): DirectiveNode | undefined {
  return node.directives?.find(
    (directive) => directive.name.value === GraphQLDeprecatedDirective.name,
  );
}
