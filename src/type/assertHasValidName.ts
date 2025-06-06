import { inspect } from '../jsutils/inspect.js';
import { invariant } from '../jsutils/invariant.js';

import { isNameContinue, isNameStart } from '../language/characterClasses.js';

import type { GraphQLSchemaElement } from './definition.js';
import {
  isArgument,
  isEnumValue,
  isField,
  isInputField,
  isNamedType,
} from './definition.js';
import { isDirective } from './directives.js';

function getDescriptor(
  schemaElement: GraphQLSchemaElement & {
    readonly name: string;
  },
): string {
  if (isNamedType(schemaElement)) {
    return `of type "${schemaElement.name}"`;
  }
  if (isField(schemaElement)) {
    return `"${schemaElement.name}" of field "${schemaElement}"`;
  }
  if (isArgument(schemaElement)) {
    return `"${schemaElement.name}" of argument "${schemaElement}"`;
  }
  if (isInputField(schemaElement)) {
    return `"${schemaElement.name}" of input field "${schemaElement}"`;
  }
  if (isEnumValue(schemaElement)) {
    return `"${schemaElement.name}" of enum value "${schemaElement}"`;
  }
  if (isDirective(schemaElement)) {
    return `of directive "${schemaElement}"`;
  }
  /* c8 ignore next 3 */
  // Not reachable, all possible inputs have been considered)
  invariant(false, `Unexpected schema element: "${inspect(schemaElement)}".`);
}

export function assertHasValidName(
  schemaElement: GraphQLSchemaElement & {
    readonly name: string;
  },
  allowReservedNames = false,
): string {
  const name = schemaElement.name;
  if (name.length === 0) {
    throw new Error(
      `Expected name ${getDescriptor(schemaElement)} to be a non-empty string.`,
    );
  }

  for (let i = 1; i < name.length; ++i) {
    if (!isNameContinue(name.charCodeAt(i))) {
      throw new Error(
        `Name ${getDescriptor(schemaElement)} must only contain [_a-zA-Z0-9].`,
      );
    }
  }

  if (!isNameStart(name.charCodeAt(0))) {
    throw new Error(
      `Name ${getDescriptor(schemaElement)} must start with [_a-zA-Z].`,
    );
  }

  if (!allowReservedNames && name.startsWith('__')) {
    throw new Error(
      `Name ${getDescriptor(schemaElement)} must not begin with "__", which is reserved by GraphQL introspection.`,
    );
  }

  if (isEnumValue(schemaElement)) {
    if (name === 'true' || name === 'false' || name === 'null') {
      throw new Error(
        `Name ${getDescriptor(schemaElement)} cannot be: ${name}.`,
      );
    }
  }

  return name;
}
