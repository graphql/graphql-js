/* eslint-disable no-restricted-syntax */
// @flow

import {
  GraphQLInterfaceType,
  GraphQLObjectType,
  GraphQLEnumType,
  GraphQLInputObjectType,
} from '../type/definition';
import type { GraphQLFieldMap } from '../type/definition';
import { GraphQLSchema } from '../type/schema';
import invariant from '../jsutils/invariant';

export const DescribedObjectType = {
  FIELD: 'FIELD',
  TYPE: 'TYPE',
  ARGUMENT: 'ARGUMENT',
  ENUM_VALUE: 'ENUM_VALUE',
};

export const DescriptionChangeType = {
  OBJECT_ADDED: 'OBJECT_ADDED',
  DESCRIPTION_ADDED: 'DESCRIPTION_ADDED',
  DESCRIPTION_CHANGED: 'DESCRIPTION_CHANGED',
};

export type DescriptionChange = {
  object: $Keys<typeof DescribedObjectType>,
  change: $Keys<typeof DescriptionChangeType>,
  description: string,
  oldThing: any,
  newThing: any,
};

/**
 * Given two schemas, returns an Array containing descriptions of any
 * descriptions that are new or changed and need review.
 */
export function findDescriptionChanges(
  oldSchema: GraphQLSchema,
  newSchema: GraphQLSchema,
): Array<DescriptionChange> {
  const oldTypeMap = oldSchema.getTypeMap();
  const newTypeMap = newSchema.getTypeMap();

  const descriptionChanges: Array<?DescriptionChange> = [];

  Object.keys(newTypeMap).forEach(typeName => {
    const oldType = oldTypeMap[typeName];
    const newType = newTypeMap[typeName];

    descriptionChanges.push(
      generateDescriptionChange(newType, oldType, DescribedObjectType.TYPE),
    );

    if (
      newType instanceof GraphQLObjectType ||
      newType instanceof GraphQLInterfaceType ||
      newType instanceof GraphQLInputObjectType
    ) {
      invariant(
        !oldType ||
          oldType instanceof GraphQLObjectType ||
          oldType instanceof GraphQLInterfaceType ||
          oldType instanceof GraphQLInputObjectType,
        'Expected oldType to also have fields',
      );
      const oldTypeFields: ?GraphQLFieldMap<*, *> = oldType
        ? oldType.getFields()
        : null;
      const newTypeFields: GraphQLFieldMap<*, *> = newType.getFields();

      Object.keys(newTypeFields).forEach(fieldName => {
        const oldField = oldTypeFields ? oldTypeFields[fieldName] : null;
        const newField = newTypeFields[fieldName];

        descriptionChanges.push(
          generateDescriptionChange(
            newField,
            oldField,
            DescribedObjectType.FIELD,
          ),
        );

        if (!newField.args) {
          return;
        }

        newField.args.forEach(newArg => {
          const oldArg = oldField
            ? oldField.args.find(arg => arg.name === newArg.name)
            : null;

          descriptionChanges.push(
            generateDescriptionChange(
              newArg,
              oldArg,
              DescribedObjectType.ARGUMENT,
            ),
          );
        });
      });
    } else if (newType instanceof GraphQLEnumType) {
      invariant(
        !oldType || oldType instanceof GraphQLEnumType,
        'Expected oldType to also have values',
      );
      const oldValues = oldType ? oldType.getValues() : null;
      const newValues = newType.getValues();
      newValues.forEach(newValue => {
        const oldValue = oldValues
          ? oldValues.find(value => value.name === newValue.name)
          : null;

        descriptionChanges.push(
          generateDescriptionChange(
            newValue,
            oldValue,
            DescribedObjectType.ENUM_VALUE,
          ),
        );
      });
    }
  });

  return descriptionChanges.filter(Boolean);
}

function generateDescriptionChange(
  newThing,
  oldThing,
  objectType: $Keys<typeof DescribedObjectType>,
): ?DescriptionChange {
  if (!newThing.description) {
    return;
  }

  if (!oldThing) {
    return {
      object: objectType,
      change: DescriptionChangeType.OBJECT_ADDED,
      oldThing,
      newThing,
      description: `New ${objectType} ${newThing.name} added with description.`,
    };
  } else if (!oldThing.description) {
    return {
      object: objectType,
      change: DescriptionChangeType.DESCRIPTION_ADDED,
      oldThing,
      newThing,
      description: `Description added on ${objectType} ${newThing.name}.`,
    };
  } else if (oldThing.description !== newThing.description) {
    return {
      object: objectType,
      change: DescriptionChangeType.DESCRIPTION_CHANGED,
      oldThing,
      newThing,
      description: `Description changed on ${objectType} ${newThing.name}.`,
    };
  }
}
