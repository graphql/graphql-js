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

/**
 * Given two schemas, returns an Array containing descriptions of any
 * descriptions that are new or changed and need review.
 */
export function findDescriptionChanges(
  oldSchema: GraphQLSchema,
  newSchema: GraphQLSchema,
): Array<string> {
  const oldTypeMap = oldSchema.getTypeMap();
  const newTypeMap = newSchema.getTypeMap();

  const descriptionChanges: Array<string> = [];

  Object.keys(newTypeMap).forEach(typeName => {
    const oldType = oldTypeMap[typeName];
    const newType = newTypeMap[typeName];

    if (newType.description) {
      if (!oldType) {
        descriptionChanges.push(
          `Description added on new type ${newType.name}.`,
        );
      } else if (!oldType.description) {
        descriptionChanges.push(`Description added on type ${newType.name}.`);
      } else if (oldType.description !== newType.description) {
        descriptionChanges.push(`Description changed on type ${newType.name}.`);
      }
    }

    if (oldType && !(newType instanceof oldType.constructor)) {
      return;
    }

    if (
      newType instanceof GraphQLObjectType ||
      newType instanceof GraphQLInterfaceType ||
      newType instanceof GraphQLInputObjectType
    ) {
      const oldTypeFields: ?GraphQLFieldMap<*, *> = oldType
        ? oldType.getFields()
        : null;
      const newTypeFields: GraphQLFieldMap<*, *> = newType.getFields();

      Object.keys(newTypeFields).forEach(fieldName => {
        const oldField = oldTypeFields ? oldTypeFields[fieldName] : null;
        const newField = newTypeFields[fieldName];

        if (newField.description) {
          if (!oldField) {
            descriptionChanges.push(
              `Description added on new field ${newType.name}.${newField.name}`,
            );
          } else if (!oldField.description) {
            descriptionChanges.push(
              `Description added on field ${newType.name}.${newField.name}.`,
            );
          } else if (oldField.description !== newField.description) {
            descriptionChanges.push(
              `Description changed on field ${newType.name}.${newField.name}.`,
            );
          }
        }

        if (!newField.args) {
          return;
        }

        newField.args.forEach(newArg => {
          const oldArg = oldField
            ? oldField.args.find(arg => arg.name === newArg.name)
            : null;

          if (newArg.description) {
            if (!oldArg) {
              descriptionChanges.push(
                `Description added on new arg ${newType.name}.${
                  newField.name
                }.${newArg.name}.`,
              );
            } else if (!oldArg.description) {
              descriptionChanges.push(
                `Description added on arg ${newType.name}.${newField.name}.${
                  newArg.name
                }.`,
              );
            } else if (oldArg.description !== newArg.description) {
              descriptionChanges.push(
                `Description changed on arg ${newType.name}.${newField.name}.${
                  newArg.name
                }.`,
              );
            }
          }
        });
      });
    } else if (newType instanceof GraphQLEnumType) {
      const oldValues = oldType ? oldType.getValues() : null;
      const newValues = newType.getValues();
      newValues.forEach(newValue => {
        const oldValue = oldValues
          ? oldValues.find(value => value.name === newValue.name)
          : null;

        if (newValue.description) {
          if (!oldValue) {
            descriptionChanges.push(
              `Description added on enum value ${newType.name}.${
                newValue.name
              }.`,
            );
          } else if (!oldValue.description) {
            descriptionChanges.push(
              `Description added on enum value ${newType.name}.${
                newValue.name
              }.`,
            );
          } else if (oldValue.description !== newValue.description) {
            descriptionChanges.push(
              `Description changed on enum value ${newType.name}.${
                newValue.name
              }.`,
            );
          }
        }
      });
    }
  });

  return descriptionChanges;
}
