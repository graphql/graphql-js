import { GraphQLError } from '../../error/GraphQLError';

import type { ASTVisitor } from '../../language/visitor';
import type {
  NameNode,
  FieldDefinitionNode,
  InputValueDefinitionNode,
} from '../../language/ast';

import type { GraphQLNamedType } from '../../type/definition';
import {
  isObjectType,
  isInterfaceType,
  isInputObjectType,
} from '../../type/definition';

import type { SDLValidationContext } from '../ValidationContext';

/**
 * Unique field definition names
 *
 * A GraphQL complex type is only valid if all its fields are uniquely named.
 */
export function UniqueFieldDefinitionNamesRule(
  context: SDLValidationContext,
): ASTVisitor {
  const schema = context.getSchema();
  const existingTypeMap = schema ? schema.getTypeMap() : Object.create(null);
  const knownFieldNames = Object.create(null);

  return {
    InputObjectTypeDefinition: checkFieldUniqueness,
    InputObjectTypeExtension: checkFieldUniqueness,
    InterfaceTypeDefinition: checkFieldUniqueness,
    InterfaceTypeExtension: checkFieldUniqueness,
    ObjectTypeDefinition: checkFieldUniqueness,
    ObjectTypeExtension: checkFieldUniqueness,
  };

  function checkFieldUniqueness(node: {
    readonly name: NameNode;
    readonly fields?: ReadonlyArray<
      InputValueDefinitionNode | FieldDefinitionNode
    >;
  }) {
    const typeName = node.name.value;

    if (!knownFieldNames[typeName]) {
      knownFieldNames[typeName] = Object.create(null);
    }

    // istanbul ignore next (See: 'https://github.com/graphql/graphql-js/issues/2203')
    const fieldNodes = node.fields ?? [];
    const fieldNames = knownFieldNames[typeName];

    for (const fieldDef of fieldNodes) {
      const fieldName = fieldDef.name.value;

      if (hasField(existingTypeMap[typeName], fieldName)) {
        context.reportError(
          new GraphQLError(
            `Field "${typeName}.${fieldName}" already exists in the schema. It cannot also be defined in this type extension.`,
            fieldDef.name,
          ),
        );
      } else if (fieldNames[fieldName]) {
        context.reportError(
          new GraphQLError(
            `Field "${typeName}.${fieldName}" can only be defined once.`,
            [fieldNames[fieldName], fieldDef.name],
          ),
        );
      } else {
        fieldNames[fieldName] = fieldDef.name;
      }
    }

    return false;
  }
}

function hasField(type: GraphQLNamedType, fieldName: string): boolean {
  if (isObjectType(type) || isInterfaceType(type) || isInputObjectType(type)) {
    return type.getFields()[fieldName] != null;
  }
  return false;
}
